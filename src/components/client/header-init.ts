import initializeSearch from "./header-search";
import initializeTouchPress from "./touch-press";
import { describeNewTabLinks } from "./new-tab-links";
import {
  DRAG_SLOP_PX,
  SHEET_QUERY,
  createVelocityTracker,
  handoffDuration,
  sheetOffset,
  shouldDismiss,
} from "./sheet-gesture";

/* ── Magic number constants ── */
const MOBILE_BREAKPOINT = 767;
// Show the sticky bar once most of the banner (and the inline nav above it) has scrolled away
const STICKY_SHOW_PROGRESS = 0.65;
const STICKY_THRESHOLDS = [0, 1 - STICKY_SHOW_PROGRESS, 1];
const SEARCH_HINT_KEY = "search-hint-shown";
const RESIZE_DEBOUNCE_MS = 100;
const MAX_PARALLAX_SCROLL = 300;

const noopFn = () => {};

interface HeaderGlobals {
  __headerEscapeHandler?: (event: KeyboardEvent) => void;
  __headerStickyCleanup?: () => void;
}

const headerGlobals: HeaderGlobals = {};

interface NavVisibilityState {
  isVisible: boolean;
}

/* ── Helpers ── */

const isMobile = (): boolean => globalThis.innerWidth <= MOBILE_BREAKPOINT;

const handleEscapeKey = (event: KeyboardEvent): void => {
  if (event.key !== "Escape") {
    return;
  }
  for (const menuNav of document.querySelectorAll(
    ".header__nav--mobile.header__nav--mobile-open",
  )) {
    const menuToggle = menuNav
      .closest(".site-header-static, .site-header-nav")
      ?.querySelector(".header__mobile-toggle");
    if (menuToggle instanceof HTMLElement && menuNav instanceof HTMLElement) {
      closeMenu(menuToggle, menuNav);
      menuToggle.focus();
    }
  }
};

/* ── Mobile menu ── */

const setupMobileMenu = (toggle: Element | undefined, nav: Element | undefined): void => {
  if (toggle === undefined || nav === undefined) {
    return;
  }
  if (!(toggle instanceof HTMLElement) || !(nav instanceof HTMLElement)) {
    return;
  }
  if (toggle.dataset.menuInitialized === "true") {
    return;
  }
  toggle.dataset.menuInitialized = "true";
  toggle.addEventListener("click", () => {
    if (isMenuOpen(nav)) {
      closeMenu(toggle, nav);
    } else {
      openMenu(toggle, nav);
    }
  });
  for (const link of nav.querySelectorAll(".header__link--mobile")) {
    if (link instanceof HTMLElement && link.dataset.menuLinkInitialized !== "true") {
      link.dataset.menuLinkInitialized = "true";
      link.addEventListener("click", () => {
        closeMenu(toggle, nav);
      });
    }
  }
  nav.querySelector(".header__sheet-handle")?.addEventListener("click", () => {
    closeMenu(toggle, nav);
    toggle.focus();
  });
  trapMenuFocus(toggle, nav);
  dismissMenuOnSwipeUp(toggle, nav);
  dragSheetToDismiss(toggle, nav);
};

const isMenuOpen = (nav: HTMLElement): boolean =>
  nav.classList.contains("header__nav--mobile-open");

// Below 600px the menu is a bottom sheet (CSS); the dropdown above it keeps its own gestures
const isSheet = (): boolean => globalThis.matchMedia(SHEET_QUERY).matches;

// The sheet is a modal dialog with its own close control (the grabber); the dropdown stays a
// disclosure whose toggle is part of the focus ring
const setSheetSemantics = (nav: HTMLElement, sheet: boolean): void => {
  if (sheet) {
    nav.setAttribute("role", "dialog");
    nav.setAttribute("aria-modal", "true");
    nav.setAttribute("aria-label", "Site menu");
  } else {
    nav.removeAttribute("role");
    nav.removeAttribute("aria-modal");
    nav.removeAttribute("aria-label");
  }
};

const openMenu = (toggle: HTMLElement, nav: HTMLElement): void => {
  setSheetSemantics(nav, isSheet());
  toggle.setAttribute("aria-expanded", "true");
  toggle.classList.add("header__mobile-toggle--active");
  nav.style.removeProperty("transition");
  nav.classList.add("header__nav--mobile-open");
  document.body.classList.remove("mobile-menu-closing");
  document.body.classList.add("mobile-menu-open");
  const firstLink = nav.querySelector(".header__link--mobile");
  if (firstLink instanceof HTMLElement) {
    focusWhenShown(firstLink, nav);
  }
};

// The sheet turns visible a frame or two after it opens, and a hidden link refuses focus: without
// a retry, focus (and the screen reader) stays on the toggle, outside the modal dialog
const FOCUS_RETRY_MS = 500;
const focusWhenShown = (target: HTMLElement, nav: HTMLElement): void => {
  const deadline = performance.now() + FOCUS_RETRY_MS;
  const attempt = () => {
    if (!isMenuOpen(nav)) {
      return;
    }
    target.focus();
    if (document.activeElement !== target && performance.now() < deadline) {
      requestAnimationFrame(attempt);
    }
  };
  attempt();
};

let closingTimer: ReturnType<typeof setTimeout> | undefined = undefined;
const SHEET_EXIT_FALLBACK_MS = 400;

const closeMenu = (toggle: Element, nav: HTMLElement): void => {
  toggle.setAttribute("aria-expanded", "false");
  toggle.classList.remove("header__mobile-toggle--active");
  nav.classList.remove("header__nav--mobile-open");
  document.body.classList.remove("mobile-menu-open");
  // Focus must not stay on a row that is about to turn invisible
  if (nav.contains(document.activeElement) && toggle instanceof HTMLElement) {
    toggle.focus({ preventScroll: true });
  }
  if (!isSheet()) {
    return;
  }
  // The scrim fades with the sheet instead of vanishing under it
  document.body.classList.add("mobile-menu-closing");
  clearTimeout(closingTimer);
  const settle = (): void => {
    clearTimeout(closingTimer);
    nav.removeEventListener("transitionend", onEnd);
    document.body.classList.remove("mobile-menu-closing");
    nav.style.removeProperty("transition");
  };
  const onEnd = (event: TransitionEvent): void => {
    if (event.target === nav && event.propertyName === "transform") {
      settle();
    }
  };
  nav.addEventListener("transitionend", onEnd);
  closingTimer = setTimeout(settle, SHEET_EXIT_FALLBACK_MS);
};

// Rows, plus the grabber when it shows (sheet only)
const sheetFocusables = (nav: HTMLElement): HTMLElement[] =>
  [...nav.querySelectorAll<HTMLElement>(".header__sheet-handle, .header__link--mobile")].filter(
    (element) => element.getClientRects().length > 0,
  );

// While open, Tab cycles inside the menu instead of the page behind the scrim: the sheet's own
// controls when it is a modal dialog, the toggle and the rows when it is the dropdown
const trapMenuFocus = (toggle: HTMLElement, nav: HTMLElement): void => {
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || !isMenuOpen(nav)) {
      return;
    }
    const ring =
      nav.getAttribute("aria-modal") === "true"
        ? sheetFocusables(nav)
        : [toggle, ...nav.querySelectorAll<HTMLElement>(".header__link--mobile")];
    const index = ring.indexOf(document.activeElement as HTMLElement);
    const step = event.shiftKey ? -1 : 1;
    const next = index === -1 ? ring[0] : ring.at((index + step) % ring.length);
    if (next !== undefined) {
      event.preventDefault();
      next.focus();
    }
  };
  toggle.addEventListener("keydown", onKeydown);
  nav.addEventListener("keydown", onKeydown);
};

// The panel drops from the bar, so flicking it back up toward the bar puts it away
const MENU_SWIPE_DISMISS_PX = 40;
const dismissMenuOnSwipeUp = (toggle: HTMLElement, nav: HTMLElement): void => {
  let startX = 0;
  let startY = 0;
  nav.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.touches[0];
      startX = touch?.clientX ?? 0;
      startY = touch?.clientY ?? 0;
    },
    { passive: true },
  );
  nav.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (touch === undefined || !isMenuOpen(nav) || nav.scrollTop > 0 || isSheet()) {
        return;
      }
      const deltaY = touch.clientY - startY;
      if (deltaY < -MENU_SWIPE_DISMISS_PX && Math.abs(deltaY) > Math.abs(touch.clientX - startX)) {
        closeMenu(toggle, nav);
      }
    },
    { passive: true },
  );
};

/* The sheet follows the finger down 1:1 and resists going up; on release the velocity decides
   between closing and settling back, and the animation leaves at the finger's speed. A press that
   never passes the slop stays a tap on the row. */
const dragSheetToDismiss = (toggle: HTMLElement, nav: HTMLElement): void => {
  const tracker = createVelocityTracker();
  let pointerId: number | undefined = undefined;
  let originY = 0;
  let originX = 0;
  let base = 0;
  let height = 0;
  let offset = 0;
  let dragging = false;
  let swallowClick = false;

  nav.addEventListener("pointerdown", (event) => {
    if (pointerId !== undefined || event.button !== 0 || !isMenuOpen(nav) || !isSheet()) {
      return;
    }
    pointerId = event.pointerId;
    originY = event.clientY;
    originX = event.clientX;
    dragging = false;
    swallowClick = false;
    tracker.reset(event.clientY, event.timeStamp);
  });

  nav.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) {
      return;
    }
    if (!dragging) {
      const dy = event.clientY - originY;
      if (Math.abs(dy) < DRAG_SLOP_PX) {
        return;
      }
      if (Math.abs(event.clientX - originX) > Math.abs(dy)) {
        pointerId = undefined;
        return;
      }
      // Grabbed mid-flight (still rising): start from where it is on screen, not where it is going
      base = new DOMMatrixReadOnly(getComputedStyle(nav).transform).m42;
      height = nav.offsetHeight;
      originY = event.clientY;
      dragging = true;
      nav.setPointerCapture(event.pointerId);
      nav.classList.add("header__nav--dragging");
    }
    tracker.add(event.clientY, event.timeStamp);
    offset = sheetOffset(base + event.clientY - originY, height);
    nav.style.transform = `translate3d(0, ${offset}px, 0)`;
  });

  const release = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) {
      return;
    }
    pointerId = undefined;
    if (!dragging) {
      return;
    }
    dragging = false;
    swallowClick = true;
    const velocity = event.type === "pointercancel" ? 0 : tracker.velocity(event.timeStamp);
    const dismiss = shouldDismiss(offset, velocity, height);
    const duration = dismiss
      ? handoffDuration(height - offset, velocity)
      : handoffDuration(Math.abs(offset), velocity, 160);
    nav.style.transition = `transform ${duration}ms var(--motion-ease-out), visibility 0s linear ${dismiss ? duration : 0}ms`;
    nav.classList.remove("header__nav--dragging");
    nav.style.removeProperty("transform");
    if (dismiss) {
      closeMenu(toggle, nav);
    } else {
      nav.addEventListener("transitionend", () => nav.style.removeProperty("transition"), {
        once: true,
      });
    }
  };
  nav.addEventListener("pointerup", release);
  nav.addEventListener("pointercancel", release);

  // A drag that started on a row must not also follow its link
  nav.addEventListener(
    "click",
    (event) => {
      if (swallowClick) {
        swallowClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );
};

// A tap anywhere outside the open menu (the scrim, the page) dismisses it
const handleOutsideTap = (event: MouseEvent): void => {
  const nav = document.querySelector(".header__nav--mobile.header__nav--mobile-open");
  const { target } = event;
  if (!(nav instanceof HTMLElement) || !(target instanceof Node)) {
    return;
  }
  const toggle = nav
    .closest(".site-header-static, .site-header-nav")
    ?.querySelector(".header__mobile-toggle");
  if (nav.contains(target) || toggle?.contains(target) === true) {
    return;
  }
  // The scrim is body::after: a tap on it only dismisses, it never reaches the page beneath
  if (target === document.body || target === document.documentElement) {
    event.preventDefault();
  }
  if (toggle) {
    closeMenu(toggle, nav);
  }
};

const initializeMobileMenus = (): void => {
  setupMobileMenu(
    document.querySelector(".header__nav-initial .header__mobile-toggle") ?? undefined,
    document.querySelector("#initial-mobile-nav") ?? undefined,
  );
  setupMobileMenu(
    document.querySelector(".site-header-nav .header__mobile-toggle") ?? undefined,
    document.querySelector("#mobile-nav") ?? undefined,
  );
};

const setupEscapeListener = (): void => {
  const existing = headerGlobals.__headerEscapeHandler;
  if (existing !== undefined) {
    document.removeEventListener("keydown", existing);
  }
  document.addEventListener("keydown", handleEscapeKey);
  headerGlobals.__headerEscapeHandler = handleEscapeKey;
  // Same handler reference every time, so re-adding on a page swap is a no-op
  document.addEventListener("click", handleOutsideTap, { capture: true });
};

/* ── Sticky nav ── */

const createStickyNavObserver = (
  banner: HTMLElement,
  onProgress: (progress: number) => void,
): IntersectionObserver => {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        onProgress(1 - entry.intersectionRatio);
      }
    },
    { root: undefined, rootMargin: "0px", threshold: STICKY_THRESHOLDS },
  );
  observer.observe(banner);
  return observer;
};

const computeNavVisibility = (
  progress: number,
  stickyNav: HTMLElement,
  state: NavVisibilityState,
): void => {
  // Binary state: CSS owns the cross-fade, so scroll position never drives styles directly
  const shouldShow = isMobile() || progress >= STICKY_SHOW_PROGRESS;
  if (shouldShow !== state.isVisible) {
    stickyNav.classList.toggle("site-header-nav--active", shouldShow);
    state.isVisible = shouldShow;
  }
};

const initializeStickyNav = (): void => {
  const cleanup = headerGlobals.__headerStickyCleanup;
  if (cleanup !== undefined) {
    cleanup();
  }
  const stickyNav = document.querySelector(".site-header-nav");
  const banner = document.querySelector("#header-banner");
  if (!(stickyNav instanceof HTMLElement) || !(banner instanceof HTMLElement)) {
    headerGlobals.__headerStickyCleanup = undefined;
    return;
  }
  const visState: NavVisibilityState = { isVisible: false };
  let resizeTimeout: ReturnType<typeof setTimeout> = setTimeout(noopFn, 0);
  let scrollObserver: IntersectionObserver | undefined = undefined;
  const onProgress = (progress: number) => {
    computeNavVisibility(progress, stickyNav, visState);
  };
  const initializeObserver = () => {
    if (scrollObserver !== undefined) {
      scrollObserver.disconnect();
    }
    scrollObserver = createStickyNavObserver(banner, onProgress);
  };
  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      initializeObserver();
      onProgress(0);
    }, RESIZE_DEBOUNCE_MS);
  };
  globalThis.addEventListener("resize", handleResize);
  initializeObserver();
  headerGlobals.__headerStickyCleanup = () => {
    globalThis.removeEventListener("resize", handleResize);
    if (scrollObserver !== undefined) {
      scrollObserver.disconnect();
      scrollObserver = undefined;
    }
  };
};

/* ── Magnetic nav highlight ── */

const setupNavHighlight = (navContainer: Element | null): void => {
  if (!(navContainer instanceof HTMLElement)) {
    return;
  }
  if (navContainer.dataset.highlightInit === "true") {
    return;
  }
  navContainer.dataset.highlightInit = "true";

  const highlight = navContainer.querySelector(".header__nav-highlight") as HTMLElement | null;
  if (!highlight) {
    return;
  }

  const links = navContainer.querySelectorAll(".header__link");
  const activeLink = navContainer.querySelector(".header__link.active") as HTMLElement | null;

  const moveHighlight = (target: HTMLElement) => {
    const navRect = navContainer.getBoundingClientRect();
    const linkRect = target.getBoundingClientRect();
    const offsetX = linkRect.left - navRect.left;

    highlight.style.width = `${linkRect.width}px`;
    highlight.style.transform = `translateX(${offsetX}px)`;
    highlight.style.opacity = "1";
  };

  /* Set initial position on the active link */
  if (activeLink) {
    requestAnimationFrame(() => {
      moveHighlight(activeLink);
      highlight.classList.add("header__nav-highlight--active");
    });
  }

  for (const link of links) {
    link.addEventListener("mouseenter", () => {
      moveHighlight(link as HTMLElement);
    });
    link.addEventListener("focusin", () => {
      moveHighlight(link as HTMLElement);
    });
  }

  const restoreHighlight = () => {
    if (activeLink) {
      moveHighlight(activeLink);
    } else {
      highlight.style.opacity = "0";
    }
  };
  navContainer.addEventListener("mouseleave", restoreHighlight);
  navContainer.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !navContainer.contains(event.relatedTarget)) {
      restoreHighlight();
    }
  });
};

const initializeNavHighlights = (): void => {
  setupNavHighlight(document.querySelector("#initial-nav"));
  setupNavHighlight(document.querySelector("#header-nav"));
};

/* ── Search hint ── */

const readSessionFlag = (key: string): boolean => {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return true;
  }
};

const initializeSearchHint = (): void => {
  if (readSessionFlag(SEARCH_HINT_KEY)) {
    return;
  }
  for (const toggle of document.querySelectorAll(".header__search-toggle")) {
    toggle.classList.add("header__search-toggle--hint");
  }
  try {
    sessionStorage.setItem(SEARCH_HINT_KEY, "1");
  } catch {
    /* storage unavailable: the hint simply plays this once */
  }
};

/* ── Init ── */

const initializeHeader = (): void => {
  for (const nav of document.querySelectorAll(".header__nav--mobile")) {
    nav.classList.remove("header__nav--mobile-open", "header__nav--dragging");
    if (nav instanceof HTMLElement) {
      nav.style.removeProperty("transform");
      nav.style.removeProperty("transition");
    }
  }
  for (const toggle of document.querySelectorAll(".header__mobile-toggle")) {
    if (toggle instanceof HTMLElement) {
      toggle.classList.remove("header__mobile-toggle--active");
      toggle.setAttribute("aria-expanded", "false");
    }
  }
  initializeMobileMenus();
  setupEscapeListener();
  initializeStickyNav();
  initializeSearch();
  initializeNavHighlights();
  initializeSearchHint();
  initializeTouchPress();
  document.body.classList.remove("mobile-menu-open", "mobile-menu-closing");
};

let parallaxImage: HTMLElement | null = null;
let parallaxOffset = -1;

// Past MAX_PARALLAX_SCROLL the offset is pinned, so most scroll events write nothing
const updateParallax = (): void => {
  if (!parallaxImage?.isConnected) {
    const image = document.querySelector(".site-header__banner-image");
    parallaxImage = image instanceof HTMLElement ? image : null;
    parallaxOffset = -1;
  }
  const offset = Math.min(globalThis.scrollY, MAX_PARALLAX_SCROLL);
  if (!parallaxImage || offset === parallaxOffset) {
    return;
  }
  parallaxOffset = offset;
  parallaxImage.style.setProperty("--scroll-y", `${offset}px`);
};

const initializeParallax = (): void => {
  if (isMobile() || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  globalThis.addEventListener("scroll", updateParallax, { passive: true });
  updateParallax();
};

document.addEventListener("DOMContentLoaded", () => {
  initializeHeader();
  initializeParallax();
  describeNewTabLinks();
});
// A client-side swap leaves focus on the old link; move it to the new page's heading
const focusPageHeading = (): void => {
  const heading = document.querySelector(".site-layout__meta-title h1, main h1");
  if (!(heading instanceof HTMLElement)) {
    return;
  }
  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
};

document.addEventListener("astro:after-swap", () => {
  initializeHeader();
  initializeParallax();
  focusPageHeading();
  describeNewTabLinks();
});
