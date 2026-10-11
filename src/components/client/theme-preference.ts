/* The visitor's appearance choice. Light paper is the default and is never stored: forgetting
   the key is how the site goes back to it. "system" is an explicit choice to follow the OS.
   BaseHead's inline boot script mirrors `readThemePreference` + `applyThemePreference`, so the
   first paint is already right. */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme-preference";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";

export const parseThemePreference = (value: unknown): ThemePreference =>
  value === "dark" || value === "system" ? value : DEFAULT_THEME_PREFERENCE;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

const defaultStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const readThemePreference = (
  storage: ReadableStorage | undefined = defaultStorage(),
): ThemePreference => {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
};

/* Returns whether the choice was persisted; a blocked storage still applies for this page */
export const writeThemePreference = (
  preference: ThemePreference,
  storage: WritableStorage | undefined = defaultStorage(),
): boolean => {
  if (storage === undefined) {
    return false;
  }
  try {
    if (preference === DEFAULT_THEME_PREFERENCE) {
      storage.removeItem(THEME_STORAGE_KEY);
    } else {
      storage.setItem(THEME_STORAGE_KEY, preference);
    }
    return true;
  } catch {
    return false;
  }
};

export const systemPrefersDark = (): boolean =>
  typeof globalThis.matchMedia === "function" && globalThis.matchMedia(DARK_QUERY).matches;

export const resolveTheme = (preference: ThemePreference, systemDark: boolean): ResolvedTheme => {
  if (preference === "system") {
    return systemDark ? "dark" : "light";
  }
  return preference;
};

export const colorSchemeFor = (preference: ThemePreference): string =>
  preference === "system" ? "light dark" : preference;

/* The night `theme-color` only shows when the night garden does: Dark, or System on a dark OS */
export const themeColorMediaFor = (preference: ThemePreference): string => {
  if (preference === "dark") {
    return "all";
  }
  if (preference === "light") {
    return "not all";
  }
  return DARK_QUERY;
};

export const applyThemePreference = (doc: Document, preference: ThemePreference): void => {
  doc.documentElement.dataset.theme = preference;
  doc
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", colorSchemeFor(preference));
  doc
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("media", themeColorMediaFor(preference));
};

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/* "Theme: Dark" or "Theme: System (dark)", shared by the accessible name and the tooltip */
export const describeTheme = (preference: ThemePreference, resolved: ResolvedTheme): string =>
  preference === "system" ? `Theme: System (${resolved})` : `Theme: ${THEME_LABELS[preference]}`;
