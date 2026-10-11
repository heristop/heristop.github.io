import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_READER_PREFERENCES,
  READER_FONT_KEY,
  READER_SIZES,
  READER_SIZE_KEY,
  applyReaderPreferences,
  describeReaderSize,
  isDefaultReaderPreferences,
  isLargestReaderSize,
  isSmallestReaderSize,
  parseReaderFont,
  parseReaderSize,
  readReaderPreferences,
  stepReaderSize,
  writeReaderPreferences,
} from "../../../src/components/client/reader-preference";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
};

const blockedStorage = {
  getItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
  setItem: () => {
    throw new DOMException("quota", "QuotaExceededError");
  },
  removeItem: () => {
    throw new DOMException("blocked", "SecurityError");
  },
};

const root = () => document.documentElement;

beforeEach(() => {
  root().removeAttribute("data-reader-size");
  root().removeAttribute("data-reader-font");
});

describe("reader size", () => {
  it("offers five steps around the prose size", () => {
    expect(READER_SIZES).toEqual([90, 100, 110, 125, 140]);
  });

  it.each([
    ["110", 110],
    [125, 125],
    ["90", 90],
    ["100", 100],
    ["115", 100],
    ["1.1", 100],
    ["", 100],
    [null, 100],
    ["Infinity", 100],
    ["<script>", 100],
  ])("parses %s as %s", (value, expected) => {
    expect(parseReaderSize(value)).toBe(expected);
  });

  it("steps up and down one size at a time", () => {
    expect(stepReaderSize(100, 1)).toBe(110);
    expect(stepReaderSize(110, 1)).toBe(125);
    expect(stepReaderSize(125, -1)).toBe(110);
    expect(stepReaderSize(100, -1)).toBe(90);
  });

  it("clamps at both ends instead of wrapping", () => {
    expect(stepReaderSize(140, 1)).toBe(140);
    expect(stepReaderSize(90, -1)).toBe(90);
    expect(isLargestReaderSize(140)).toBe(true);
    expect(isSmallestReaderSize(90)).toBe(true);
    expect(isLargestReaderSize(125)).toBe(false);
    expect(isSmallestReaderSize(100)).toBe(false);
  });

  it("is announced as a percentage", () => {
    expect(describeReaderSize(110)).toBe("Text size 110%");
  });

  it("has a CSS scale for every step but the default", () => {
    const scss = readFileSync("src/styles/_blog.scss", "utf8");
    for (const size of READER_SIZES.filter((step) => step !== 100)) {
      expect(scss).toContain(
        `:root[data-reader-size="${size}"] {\n  --reader-scale: ${size / 100};\n}`,
      );
    }
  });
});

describe("reader font", () => {
  it("accepts only the legible face", () => {
    expect(parseReaderFont("legible")).toBe("legible");
    expect(parseReaderFont("comic")).toBe("default");
    expect(parseReaderFont(null)).toBe("default");
  });
});

describe("persistence", () => {
  it("reads the defaults from an empty storage", () => {
    expect(readReaderPreferences(memoryStorage())).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("reads stored choices", () => {
    const storage = memoryStorage({ [READER_SIZE_KEY]: "125", [READER_FONT_KEY]: "legible" });
    expect(readReaderPreferences(storage)).toEqual({ size: 125, font: "legible" });
  });

  it("falls back to the defaults on a tampered value", () => {
    const storage = memoryStorage({ [READER_SIZE_KEY]: "999", [READER_FONT_KEY]: "x" });
    expect(readReaderPreferences(storage)).toEqual(DEFAULT_READER_PREFERENCES);
  });

  it("stores only what differs from the defaults", () => {
    const storage = memoryStorage({ [READER_SIZE_KEY]: "140", [READER_FONT_KEY]: "legible" });
    expect(writeReaderPreferences({ size: 110, font: "default" }, storage)).toBe(true);
    expect(storage.data.get(READER_SIZE_KEY)).toBe("110");
    expect(storage.data.has(READER_FONT_KEY)).toBe(false);
    writeReaderPreferences(DEFAULT_READER_PREFERENCES, storage);
    expect(storage.data.size).toBe(0);
  });

  it("round-trips through storage", () => {
    const storage = memoryStorage();
    writeReaderPreferences({ size: 90, font: "legible" }, storage);
    expect(readReaderPreferences(storage)).toEqual({ size: 90, font: "legible" });
  });

  it("survives a blocked storage", () => {
    expect(readReaderPreferences(blockedStorage)).toEqual(DEFAULT_READER_PREFERENCES);
    expect(writeReaderPreferences({ size: 125, font: "legible" }, blockedStorage)).toBe(false);
  });

  it("knows when nothing has been changed", () => {
    expect(isDefaultReaderPreferences(DEFAULT_READER_PREFERENCES)).toBe(true);
    expect(isDefaultReaderPreferences({ size: 100, font: "legible" })).toBe(false);
  });
});

describe("applyReaderPreferences", () => {
  it("stamps non-default choices on <html> and clears the defaults", () => {
    applyReaderPreferences(document, { size: 125, font: "legible" });
    expect(root().dataset.readerSize).toBe("125");
    expect(root().dataset.readerFont).toBe("legible");
    applyReaderPreferences(document, DEFAULT_READER_PREFERENCES);
    expect(root().hasAttribute("data-reader-size")).toBe(false);
    expect(root().hasAttribute("data-reader-font")).toBe(false);
  });
});

describe("the BaseHead reader boot script", () => {
  const source = readFileSync("src/components/BaseHead.astro", "utf8");
  const script =
    /<script is:inline define:vars=\{\{ sizeKey: READER_SIZE_KEY, fontKey: READER_FONT_KEY, sizes: READER_SIZES \}\}>([\s\S]*?)<\/script>/.exec(
      source,
    )?.[1];

  const boot = (
    storage: Pick<Storage, "getItem">,
    win: Record<string, unknown> = {},
    doc: Document = document,
  ) => {
    // Runs the repository's own inline source, as the browser would
    new Function("sizeKey", "fontKey", "sizes", "window", "document", "localStorage", script ?? "")(
      READER_SIZE_KEY,
      READER_FONT_KEY,
      [...READER_SIZES],
      win,
      doc,
      storage,
    );
  };

  it("is present", () => {
    expect(script).toBeDefined();
  });

  it.each([
    [{ [READER_SIZE_KEY]: "110" }, "110", null],
    [{ [READER_SIZE_KEY]: "140", [READER_FONT_KEY]: "legible" }, "140", "legible"],
    [{ [READER_SIZE_KEY]: "100" }, null, null],
    [{ [READER_SIZE_KEY]: "999", [READER_FONT_KEY]: "bogus" }, null, null],
    [{}, null, null],
  ])("applies %o exactly as the module does", (stored, size, font) => {
    const storage = memoryStorage(stored);
    boot(storage);
    expect(root().getAttribute("data-reader-size")).toBe(size);
    expect(root().getAttribute("data-reader-font")).toBe(font);

    // Same outcome as the module's read + apply
    const viaModule = document.implementation.createHTMLDocument("");
    applyReaderPreferences(viaModule, readReaderPreferences(storage));
    expect(viaModule.documentElement.getAttribute("data-reader-size")).toBe(size);
    expect(viaModule.documentElement.getAttribute("data-reader-font")).toBe(font);
  });

  it("clears stale attributes and tolerates a blocked storage", () => {
    root().setAttribute("data-reader-size", "125");
    root().setAttribute("data-reader-font", "legible");
    boot(blockedStorage);
    expect(root().hasAttribute("data-reader-size")).toBe(false);
    expect(root().hasAttribute("data-reader-font")).toBe(false);
  });

  it("re-applies onto the incoming page of a client-side navigation", () => {
    const storage = memoryStorage({ [READER_SIZE_KEY]: "125" });
    const win: Record<string, unknown> = {};
    boot(storage, win);
    expect(win.__readerBoot).toBe(true);

    const incoming = document.implementation.createHTMLDocument("next");
    const event = Object.assign(new Event("astro:before-swap"), { newDocument: incoming });
    document.dispatchEvent(event);
    expect(incoming.documentElement.getAttribute("data-reader-size")).toBe("125");

    root().removeAttribute("data-reader-size");
    document.dispatchEvent(new Event("astro:after-swap"));
    expect(root().getAttribute("data-reader-size")).toBe("125");
  });
});
