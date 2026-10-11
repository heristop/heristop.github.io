/* The reader's text settings for articles: a size step for the prose and a more legible face.
   Both are stamped on <html> (data-reader-size, data-reader-font) and only `.post-page` reads
   them, so other pages never change. The defaults are never stored: forgetting a key is how the
   article goes back to them. BaseHead's inline boot script mirrors `readReaderPreferences` +
   `applyReaderPreferences`, so the first paint is already right. */

/* Percentages of the prose size; _blog.scss maps each one to --reader-scale */
export const READER_SIZES = [90, 100, 110, 125, 140] as const;
export type ReaderSize = (typeof READER_SIZES)[number];
export type ReaderFont = "default" | "legible";

export interface ReaderPreferences {
  size: ReaderSize;
  font: ReaderFont;
}

export const READER_SIZE_KEY = "reader-size";
export const READER_FONT_KEY = "reader-font";
export const DEFAULT_READER_SIZE: ReaderSize = 100;
export const DEFAULT_READER_FONT: ReaderFont = "default";
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  size: DEFAULT_READER_SIZE,
  font: DEFAULT_READER_FONT,
};

export const parseReaderSize = (value: unknown): ReaderSize => {
  const size = Number(value);
  return READER_SIZES.find((step) => step === size) ?? DEFAULT_READER_SIZE;
};

export const parseReaderFont = (value: unknown): ReaderFont =>
  value === "legible" ? "legible" : DEFAULT_READER_FONT;

/* One step up or down the scale, held at either end */
export const stepReaderSize = (size: ReaderSize, direction: 1 | -1): ReaderSize => {
  const index = READER_SIZES.indexOf(size);
  const next = Math.min(READER_SIZES.length - 1, Math.max(0, index + direction));
  return READER_SIZES[next] ?? DEFAULT_READER_SIZE;
};

export const isSmallestReaderSize = (size: ReaderSize): boolean => size === READER_SIZES[0];
export const isLargestReaderSize = (size: ReaderSize): boolean => size === READER_SIZES.at(-1);

export const isDefaultReaderPreferences = ({ size, font }: ReaderPreferences): boolean =>
  size === DEFAULT_READER_SIZE && font === DEFAULT_READER_FONT;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem" | "removeItem">;

const defaultStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const readReaderPreferences = (
  storage: ReadableStorage | undefined = defaultStorage(),
): ReaderPreferences => {
  try {
    return {
      size: parseReaderSize(storage?.getItem(READER_SIZE_KEY)),
      font: parseReaderFont(storage?.getItem(READER_FONT_KEY)),
    };
  } catch {
    return { ...DEFAULT_READER_PREFERENCES };
  }
};

/* Returns whether the choice was persisted; a blocked storage still applies for this page */
export const writeReaderPreferences = (
  { size, font }: ReaderPreferences,
  storage: WritableStorage | undefined = defaultStorage(),
): boolean => {
  if (storage === undefined) {
    return false;
  }
  try {
    if (size === DEFAULT_READER_SIZE) {
      storage.removeItem(READER_SIZE_KEY);
    } else {
      storage.setItem(READER_SIZE_KEY, String(size));
    }
    if (font === DEFAULT_READER_FONT) {
      storage.removeItem(READER_FONT_KEY);
    } else {
      storage.setItem(READER_FONT_KEY, font);
    }
    return true;
  } catch {
    return false;
  }
};

export const applyReaderPreferences = (doc: Document, { size, font }: ReaderPreferences): void => {
  const root = doc.documentElement;
  if (size === DEFAULT_READER_SIZE) {
    root.removeAttribute("data-reader-size");
  } else {
    root.setAttribute("data-reader-size", String(size));
  }
  if (font === DEFAULT_READER_FONT) {
    root.removeAttribute("data-reader-font");
  } else {
    root.setAttribute("data-reader-font", font);
  }
};

export const describeReaderSize = (size: ReaderSize): string => `Text size ${size}%`;

export const describeReaderFont = (font: ReaderFont): string =>
  font === "legible" ? "Legible font on" : "Legible font off";
