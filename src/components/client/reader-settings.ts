import {
  DEFAULT_READER_PREFERENCES,
  READER_FONT_KEY,
  READER_SIZE_KEY,
  applyReaderPreferences,
  describeReaderFont,
  describeReaderSize,
  isDefaultReaderPreferences,
  isLargestReaderSize,
  isSmallestReaderSize,
  readReaderPreferences,
  stepReaderSize,
  writeReaderPreferences,
  type ReaderPreferences,
} from "./reader-preference";

/* The article's "Reading" menu: A− / A+ with the current size, a dyslexia-friendly switch and a
   reset. It shares the theme menu's look and keyboard model (./theme-toggle.ts): arrows move,
   Escape closes and returns focus, Tab leaves. Every row is a setting, so the menu stays open
   while the reader tunes it; each change is announced once, politely. The attributes it writes
   on <html> are the ones BaseHead's boot script stamps before first paint. */

const SETTINGS_SELECTOR = "[data-reader-settings]";
const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"]';
const NAVIGATION_KEYS = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];

/* Held here as well as in storage, so a blocked storage still keeps the choice for this page */
let preferences: ReaderPreferences = readReaderPreferences();

const partsOf = (root: HTMLElement) => ({
  button: root.querySelector<HTMLButtonElement>(".reader-settings__button"),
  menu: root.querySelector<HTMLElement>(".reader-settings__menu"),
  smaller: root.querySelector<HTMLButtonElement>('[data-reader-step="-1"]'),
  larger: root.querySelector<HTMLButtonElement>('[data-reader-step="1"]'),
  value: root.querySelector<HTMLElement>("[data-reader-value]"),
  legible: root.querySelector<HTMLButtonElement>("[data-reader-legible]"),
  reset: root.querySelector<HTMLButtonElement>("[data-reader-reset]"),
  status: root.querySelector<HTMLElement>("[data-reader-status]"),
});

const menuItems = (root: HTMLElement): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR),
];

const setDisabled = (item: HTMLElement | null, disabled: boolean): void => {
  // aria-disabled, not disabled: the row stays reachable by the arrows and keeps its focus
  item?.setAttribute("aria-disabled", String(disabled));
};

const syncSettings = (): void => {
  const { size, font } = preferences;
  for (const root of document.querySelectorAll<HTMLElement>(SETTINGS_SELECTOR)) {
    const { button, smaller, larger, value, legible, reset } = partsOf(root);
    if (value) {
      value.textContent = `${size}%`;
    }
    setDisabled(smaller, isSmallestReaderSize(size));
    setDisabled(larger, isLargestReaderSize(size));
    setDisabled(reset, isDefaultReaderPreferences(preferences));
    legible?.setAttribute("aria-checked", String(font === "legible"));
    // The trigger shows a quiet dot while the article reads differently from its defaults
    button?.toggleAttribute("data-active", !isDefaultReaderPreferences(preferences));
  }
};

const announce = (root: HTMLElement | null, message: string): void => {
  const status = root ? partsOf(root).status : null;
  if (!status) {
    return;
  }
  // A repeated message (pressing A+ at the top) is still spoken: clear, then write next frame
  status.textContent = "";
  requestAnimationFrame(() => {
    status.textContent = message;
  });
};

const commit = (next: ReaderPreferences, root: HTMLElement | null, message: string): void => {
  preferences = next;
  writeReaderPreferences(next);
  applyReaderPreferences(document, next);
  syncSettings();
  announce(root, message);
};

const changeSize = (root: HTMLElement | null, direction: 1 | -1): void => {
  const size = stepReaderSize(preferences.size, direction);
  const edge =
    size === preferences.size ? (direction === 1 ? ", the largest" : ", the smallest") : "";
  commit({ ...preferences, size }, root, `${describeReaderSize(size)}${edge}`);
};

const closeMenu = (root: HTMLElement, restoreFocus: boolean): void => {
  if (!("open" in root.dataset)) {
    return;
  }
  delete root.dataset.open;
  const { button } = partsOf(root);
  button?.setAttribute("aria-expanded", "false");
  if (restoreFocus) {
    button?.focus();
  }
};

const closeAll = (except?: HTMLElement): void => {
  for (const root of document.querySelectorAll<HTMLElement>(`${SETTINGS_SELECTOR}[data-open]`)) {
    if (root !== except) {
      closeMenu(root, false);
    }
  }
};

const openMenu = (root: HTMLElement, pick: "first" | "last"): void => {
  closeAll(root);
  root.dataset.open = "";
  partsOf(root).button?.setAttribute("aria-expanded", "true");
  // The menu leaves `visibility: hidden` on this frame; focus once it can take it
  requestAnimationFrame(() => {
    (pick === "last" ? menuItems(root).at(-1) : menuItems(root)[0])?.focus();
  });
};

const moveFocus = (root: HTMLElement, key: string): void => {
  const items = menuItems(root);
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const count = items.length;
  const next: Record<string, number> = {
    ArrowDown: (index + 1) % count,
    ArrowRight: (index + 1) % count,
    ArrowUp: (index - 1 + count) % count,
    ArrowLeft: (index - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  items[next[key] ?? 0]?.focus();
};

const bindSettings = (root: HTMLElement): void => {
  if (root.dataset.readerSettingsBound === "true") {
    return;
  }
  root.dataset.readerSettingsBound = "true";
  const { button, menu, smaller, larger, legible, reset } = partsOf(root);
  if (!button || !menu) {
    return;
  }

  button.addEventListener("click", () => {
    if ("open" in root.dataset) {
      closeMenu(root, false);
    } else {
      openMenu(root, "first");
    }
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(root, event.key === "ArrowUp" ? "last" : "first");
    }
  });

  menu.addEventListener("keydown", (event) => {
    if (NAVIGATION_KEYS.includes(event.key)) {
      event.preventDefault();
      moveFocus(root, event.key);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(root, true);
    } else if (event.key === "Tab") {
      closeMenu(root, false);
    }
  });

  smaller?.addEventListener("click", () => {
    changeSize(root, -1);
  });
  larger?.addEventListener("click", () => {
    changeSize(root, 1);
  });

  legible?.addEventListener("click", () => {
    const font = preferences.font === "legible" ? "default" : "legible";
    commit({ ...preferences, font }, root, describeReaderFont(font));
  });

  reset?.addEventListener("click", () => {
    if (isDefaultReaderPreferences(preferences)) {
      return;
    }
    commit({ ...DEFAULT_READER_PREFERENCES }, root, "Reading settings reset");
  });

  root.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
      closeMenu(root, false);
    }
  });
};

const initializeReaderSettings = (): void => {
  for (const root of document.querySelectorAll<HTMLElement>(SETTINGS_SELECTOR)) {
    bindSettings(root);
  }
  // The boot script re-reads storage on every swap; a blocked storage only lives in this module
  applyReaderPreferences(document, preferences);
  syncSettings();
};

const isEditable = (element: Element | null): boolean =>
  element instanceof HTMLElement &&
  (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));

/* Optional shortcuts, Ctrl/Cmd + Alt + = or -: browser zoom (Ctrl/Cmd + = without Alt) stays
   the browser's. `code` is matched, not `key`, since Alt turns "=" into "≠" on a Mac layout. */
export const readerShortcutDirection = (event: KeyboardEvent): 1 | -1 | undefined => {
  if (!event.altKey || !(event.ctrlKey || event.metaKey) || event.shiftKey) {
    return undefined;
  }
  if (event.code === "Equal" || event.code === "NumpadAdd") {
    return 1;
  }
  if (event.code === "Minus" || event.code === "NumpadSubtract") {
    return -1;
  }
  return undefined;
};

/* Document-level wiring happens once; the module outlives every client-side swap */
document.addEventListener("pointerdown", (event) => {
  const target = event.target instanceof Element ? event.target.closest(SETTINGS_SELECTOR) : null;
  closeAll(target instanceof HTMLElement ? target : undefined);
});

document.addEventListener("keydown", (event) => {
  const root = document.querySelector<HTMLElement>(SETTINGS_SELECTOR);
  const direction = readerShortcutDirection(event);
  if (!root || direction === undefined || isEditable(document.activeElement)) {
    return;
  }
  event.preventDefault();
  changeSize(root, direction);
});

// Another tab changed the settings: follow it here too
globalThis.addEventListener("storage", (event) => {
  if (event.key === null || event.key === READER_SIZE_KEY || event.key === READER_FONT_KEY) {
    preferences = readReaderPreferences();
    applyReaderPreferences(document, preferences);
    syncSettings();
  }
});

initializeReaderSettings();
document.addEventListener("astro:after-swap", initializeReaderSettings);
