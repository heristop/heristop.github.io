/* Sakura petals: a small burst where the visitor presses on plain paper. Restrained by design:
   never on controls, chrome or menus, at most one burst per BURST_INTERVAL_MS, and switchable
   from the theme menu ("Petals"). The choice is stored only once made; until then it follows
   reduced motion (off) or defaults to on. */

const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export const PETALS_STORAGE_KEY = "sakura-petals";
export const PETALS_CHANGE_EVENT = "sakura:preference";
export const BURST_INTERVAL_MS = 600;

/* Presses here belong to the interface, not the paper */
export const PETAL_IGNORE_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "dialog",
  "[contenteditable]",
  '[role="button"]',
  '[role="link"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="dialog"]',
  '[aria-modal="true"]',
  "header",
  "nav",
  ".site-header-nav",
  "[data-theme-toggle]",
].join(", ");

export const shouldBindSakuraTouchBursts = (): boolean =>
  typeof globalThis.matchMedia !== "function" ||
  !globalThis.matchMedia(COARSE_POINTER_QUERY).matches;

export const prefersReducedMotion = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

const defaultStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const parsePetalsPreference = (value: unknown, reducedMotion: boolean): boolean => {
  if (value === "on") {
    return true;
  }
  if (value === "off") {
    return false;
  }
  return !reducedMotion;
};

export const readPetalsEnabled = (
  storage: ReadableStorage | undefined = defaultStorage(),
  reducedMotion: boolean = prefersReducedMotion(),
): boolean => {
  try {
    return parsePetalsPreference(storage?.getItem(PETALS_STORAGE_KEY), reducedMotion);
  } catch {
    return parsePetalsPreference(null, reducedMotion);
  }
};

/* Returns whether the choice was persisted; a blocked storage still applies for this page */
export const writePetalsEnabled = (
  enabled: boolean,
  storage: WritableStorage | undefined = defaultStorage(),
): boolean => {
  if (storage === undefined) {
    return false;
  }
  try {
    storage.setItem(PETALS_STORAGE_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
};

export const isPetalSurface = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest(PETAL_IGNORE_SELECTOR) === null;
};

/* Returns a gate that opens at most once per interval */
export const createBurstGate = (
  intervalMs: number = BURST_INTERVAL_MS,
  now: () => number = Date.now,
): (() => boolean) => {
  let last = Number.NEGATIVE_INFINITY;
  return () => {
    const time = now();
    if (time - last < intervalMs) {
      return false;
    }
    last = time;
    return true;
  };
};
