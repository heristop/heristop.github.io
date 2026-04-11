import initializeSearch from "./header-search";

/* ── Magic number constants ── */
const MOBILE_FOCUS_DELAY_MS = 300;
const MOBILE_BREAKPOINT = 767;
const TRANSLATE_Y_MIN = -100;
const TRANSLATE_Y_PROGRESS_OFFSET = 0.7;
const TRANSLATE_Y_MULTIPLIER = 333;
const MAX_BACKDROP_BLUR = 20;
const OPACITY_VISIBILITY_THRESHOLD = 0.9;
const THRESHOLD_INCREMENT = 0.05;
const THRESHOLD_COUNT = 21;
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
  const openMenus = document.querySelectorAll(".header__nav--mobile.header__nav--mobile-open");
  for (const menuNav of openMenus) {
    const menuToggle = menuNav
      .closest(".site-header-static, .site-header-nav")
      ?.querySelector(".header__mobile-toggle");
    if (menuToggle instanceof HTMLElement) {
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.classList.remove("header__mobile-toggle--active");
    }
    menuNav.classList.remove("header__nav--mobile-open");
  }
  if (openMenus.length > 0) {
    document.body.classList.remove("mobile-menu-open");
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
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", (!isExpanded).toString());
    toggle.classList.toggle("header__mobile-toggle--active");
    nav.classList.toggle("header__nav--mobile-open");
    document.body.classList.toggle("mobile-menu-open", !isExpanded);
    if (!isExpanded) {
      const firstLink = nav.querySelector(".header__link--mobile");
      if (firstLink instanceof HTMLElement) {
        setTimeout(() => {
          firstLink.focus();
        }, MOBILE_FOCUS_DELAY_MS);
      }
    }
  });
  for (const link of nav.querySelectorAll(".header__link--mobile")) {
    if (link instanceof HTMLElement && link.dataset.menuLinkInitialized !== "true") {
      link.dataset.menuLinkInitialized = "true";
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        toggle.classList.remove("header__mobile-toggle--active");
        nav.classList.remove("header__nav--mobile-open");
        document.body.classList.remove("mobile-menu-open");
      });
    }
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
};

/* ── Sticky nav ── */

const createStickyNavObserver = (
  banner: HTMLElement,
  onProgress: (progress: number) => void,
): IntersectionObserver => {
  const thresholds = Array.from(
    { length: THRESHOLD_COUNT },
    (_unused, idx) => idx * THRESHOLD_INCREMENT,
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        onProgress(1 - entry.intersectionRatio);
      }
    },
    { root: undefined, rootMargin: "0px", threshold: thresholds },
  );
  observer.observe(banner);
  return observer;
};

const computeNavVisibility = (
  progress: number,
  stickyNav: HTMLElement,
  state: NavVisibilityState,
): void => {
  if (isMobile()) {
    stickyNav.style.setProperty("--nav-opacity", "1");
    stickyNav.style.setProperty("--nav-translate", "0%");
    stickyNav.style.setProperty("--nav-blur", "0px");
    if (!state.isVisible) {
      stickyNav.classList.add("site-header-nav--active");
      state.isVisible = true;
    }
    return;
  }
  const opacity = Math.max(0, Math.min(1, 1 - progress));
  const translateY = Math.max(
    TRANSLATE_Y_MIN,
    Math.min(0, (progress - TRANSLATE_Y_PROGRESS_OFFSET) * TRANSLATE_Y_MULTIPLIER),
  );
  const backdropBlur = Math.max(0, Math.min(MAX_BACKDROP_BLUR, (1 - progress) * MAX_BACKDROP_BLUR));
  stickyNav.style.setProperty("--nav-opacity", opacity.toString());
  stickyNav.style.setProperty("--nav-translate", `${translateY}%`);
  stickyNav.style.setProperty("--nav-blur", `${backdropBlur}px`);
  if (opacity < OPACITY_VISIBILITY_THRESHOLD && !state.isVisible) {
    stickyNav.classList.add("site-header-nav--active");
    state.isVisible = true;
  } else if (opacity >= OPACITY_VISIBILITY_THRESHOLD && state.isVisible) {
    stickyNav.classList.remove("site-header-nav--active");
    state.isVisible = false;
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
  }

  navContainer.addEventListener("mouseleave", () => {
    if (activeLink) {
      moveHighlight(activeLink);
    } else {
      highlight.style.opacity = "0";
    }
  });
};

const initializeNavHighlights = (): void => {
  setupNavHighlight(document.querySelector("#initial-nav"));
  setupNavHighlight(document.querySelector("#header-nav"));
};

/* ── Init ── */

const initializeHeader = (): void => {
  for (const nav of document.querySelectorAll(".header__nav--mobile")) {
    nav.classList.remove("header__nav--mobile-open");
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
  document.body.classList.remove("mobile-menu-open");
};

const updateParallax = (): void => {
  const parallaxImage = document.querySelector(".site-header__banner-image");
  if (parallaxImage instanceof HTMLElement) {
    parallaxImage.style.setProperty(
      "--scroll-y",
      `${Math.min(globalThis.scrollY, MAX_PARALLAX_SCROLL)}px`,
    );
  }
};

const initializeParallax = (): void => {
  if (isMobile()) {
    return;
  }
  globalThis.addEventListener("scroll", updateParallax, { passive: true });
  updateParallax();
};

document.addEventListener("DOMContentLoaded", () => {
  initializeHeader();
  initializeParallax();
});
document.addEventListener("astro:after-swap", () => {
  initializeHeader();
  initializeParallax();
});
