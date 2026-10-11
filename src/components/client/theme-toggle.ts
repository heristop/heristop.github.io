import {
  DARK_QUERY,
  THEME_STORAGE_KEY,
  applyThemePreference,
  describeTheme,
  parseThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
  type ThemePreference,
} from "./theme-preference";
import {
  PETALS_CHANGE_EVENT,
  PETALS_STORAGE_KEY,
  readPetalsEnabled,
  writePetalsEnabled,
} from "./sakura-petals";
import { ensureInkMask, inkOrigin, runInkTransition } from "./theme-ink";

/* A menu button: the glyph shows the garden you are in (sun or moon, with a small pip when it
   follows the device), and opens three explicit choices. The glyph itself is driven by CSS from
   <html data-theme>, so it is right on first paint and after every swap; this script only owns
   the menu, the stored choice and the accessible labels. Below the three choices sits one
   switch, "Petals", for the sakura burst on press (see ./sakura-petals.ts). */

const TOGGLE_SELECTOR = "[data-theme-toggle]";
const OPTION_SELECTOR = "[data-theme-value]";
const PETALS_SELECTOR = "[data-petals-toggle]";
const ITEM_SELECTOR = '[role="menuitemradio"], [role="menuitemcheckbox"]';
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const currentPreference = (): ThemePreference =>
  parseThemePreference(document.documentElement.dataset.theme);

const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;

const partsOf = (toggle: HTMLElement) => {
  const button = toggle.querySelector<HTMLButtonElement>(".theme-toggle__button");
  const menu = toggle.querySelector<HTMLElement>(".theme-toggle__menu");
  const options = [...toggle.querySelectorAll<HTMLButtonElement>(OPTION_SELECTOR)];
  const petals = toggle.querySelector<HTMLButtonElement>(PETALS_SELECTOR);
  return { button, menu, options, petals };
};

/* Every row the arrow keys can reach; a row hidden by CSS (Petals on touch screens) is skipped */
const menuItems = (toggle: HTMLElement): HTMLButtonElement[] =>
  [...toggle.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR)].filter(
    (item) => item.getClientRects().length > 0,
  );

/* Held here as well as in storage, so a blocked storage still keeps the choice for this page */
let petalsEnabled = readPetalsEnabled();

const syncPetals = (): void => {
  for (const petals of document.querySelectorAll<HTMLElement>(
    `${TOGGLE_SELECTOR} ${PETALS_SELECTOR}`,
  )) {
    petals.setAttribute("aria-checked", String(petalsEnabled));
  }
};

const syncToggles = (): void => {
  const preference = currentPreference();
  const label = describeTheme(preference, resolveTheme(preference, systemPrefersDark()));
  for (const toggle of document.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR)) {
    const { button, options } = partsOf(toggle);
    if (button) {
      button.setAttribute("aria-label", label);
      button.dataset.tooltip = label;
    }
    for (const option of options) {
      const checked = option.dataset.themeValue === preference;
      option.setAttribute("aria-checked", String(checked));
    }
  }
  syncPetals();
};

const commitPetals = (enabled: boolean): void => {
  petalsEnabled = enabled;
  writePetalsEnabled(enabled);
  syncPetals();
  document.dispatchEvent(new CustomEvent(PETALS_CHANGE_EVENT, { detail: { enabled } }));
};

/* Night falls as a drop of ink spreading from the button; dawn draws it back (./theme-ink.ts).
   Without View Transitions, under reduced motion, or when the garden on screen does not change
   (System on a dark OS to Dark), the switch is instant. */
const commitPreference = (preference: ThemePreference, origin?: Element | null): void => {
  const before = resolveTheme(currentPreference(), systemPrefersDark());
  const after = resolveTheme(preference, systemPrefersDark());
  writeThemePreference(preference);
  const commit = () => {
    applyThemePreference(document, preference);
    syncToggles();
  };
  if (
    before === after ||
    !origin ||
    prefersReducedMotion() ||
    typeof document.startViewTransition !== "function"
  ) {
    commit();
    return;
  }
  void runInkTransition(
    commit,
    inkOrigin(origin.getBoundingClientRect()),
    after === "dark" ? "spread" : "recede",
  );
};

const focusOption = (toggle: HTMLElement, pick: "checked" | "first" | "last"): void => {
  const { options } = partsOf(toggle);
  const checked = options.find((option) => option.getAttribute("aria-checked") === "true");
  const target =
    pick === "last"
      ? menuItems(toggle).at(-1)
      : pick === "checked"
        ? (checked ?? options[0])
        : options[0];
  target?.focus();
};

const closeMenu = (toggle: HTMLElement, restoreFocus: boolean): void => {
  if (!("open" in toggle.dataset)) {
    return;
  }
  delete toggle.dataset.open;
  const { button } = partsOf(toggle);
  button?.setAttribute("aria-expanded", "false");
  if (restoreFocus) {
    button?.focus();
  }
};

const closeAll = (except?: HTMLElement): void => {
  for (const toggle of document.querySelectorAll<HTMLElement>(`${TOGGLE_SELECTOR}[data-open]`)) {
    if (toggle !== except) {
      closeMenu(toggle, false);
    }
  }
};

const openMenu = (toggle: HTMLElement, pick: "checked" | "first" | "last"): void => {
  closeAll(toggle);
  toggle.dataset.open = "";
  partsOf(toggle).button?.setAttribute("aria-expanded", "true");
  // Draw the ink drop while the visitor is still choosing, not on the frame that needs it
  ensureInkMask();
  // The menu leaves `visibility: hidden` on this frame; focus once it can take it
  requestAnimationFrame(() => {
    focusOption(toggle, pick);
  });
};

const moveFocus = (toggle: HTMLElement, key: string): void => {
  const options = menuItems(toggle);
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  const count = options.length;
  const next: Record<string, number> = {
    ArrowDown: (index + 1) % count,
    ArrowUp: (index - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  options[next[key]]?.focus();
};

const bindToggle = (toggle: HTMLElement): void => {
  if (toggle.dataset.themeToggleBound === "true") {
    return;
  }
  toggle.dataset.themeToggleBound = "true";
  const { button, menu, options, petals } = partsOf(toggle);
  if (!button || !menu) {
    return;
  }

  button.addEventListener("click", () => {
    if ("open" in toggle.dataset) {
      closeMenu(toggle, false);
    } else {
      openMenu(toggle, "checked");
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(toggle, event.key === "ArrowUp" ? "last" : "checked");
    }
  });

  menu.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      moveFocus(toggle, event.key);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(toggle, true);
    } else if (event.key === "Tab") {
      closeMenu(toggle, false);
    }
  });

  for (const option of options) {
    option.addEventListener("click", () => {
      closeMenu(toggle, true);
      commitPreference(parseThemePreference(option.dataset.themeValue), button);
    });
  }

  // A switch, not a choice: it flips in place and the menu stays open to show it
  petals?.addEventListener("click", () => {
    commitPetals(petals.getAttribute("aria-checked") !== "true");
  });

  toggle.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !toggle.contains(event.relatedTarget)) {
      closeMenu(toggle, false);
    }
  });
};

const initializeThemeToggles = (): void => {
  for (const toggle of document.querySelectorAll<HTMLElement>(TOGGLE_SELECTOR)) {
    bindToggle(toggle);
  }
  syncToggles();
};

/* Document-level wiring happens once; the module outlives every client-side swap */
document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target.closest(TOGGLE_SELECTOR) : null;
  closeAll(target instanceof HTMLElement ? target : undefined);
});

if (typeof globalThis.matchMedia === "function") {
  globalThis.matchMedia(DARK_QUERY).addEventListener("change", syncToggles);
}

// Another tab changed the choice: follow it here too
globalThis.addEventListener("storage", (event) => {
  if (event.key === null || event.key === THEME_STORAGE_KEY) {
    applyThemePreference(document, parseThemePreference(event.newValue));
    syncToggles();
  }
  if (event.key === null || event.key === PETALS_STORAGE_KEY) {
    petalsEnabled = readPetalsEnabled();
    syncPetals();
  }
});

initializeThemeToggles();
document.addEventListener("astro:after-swap", initializeThemeToggles);
