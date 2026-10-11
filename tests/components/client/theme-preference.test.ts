import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_STORAGE_KEY,
  applyThemePreference,
  colorSchemeFor,
  describeTheme,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  themeColorMediaFor,
  writeThemePreference,
} from "../../../src/components/client/theme-preference";

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

describe("parseThemePreference", () => {
  it("keeps the three choices", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("defaults to light paper for anything else, whatever the OS", () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe("light");
    for (const value of [null, undefined, "", "DARK", "sepia", 1]) {
      expect(parseThemePreference(value)).toBe("light");
    }
  });
});

describe("reading and writing the stored choice", () => {
  it("reads a stored choice and defaults to light", () => {
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: "system" }))).toBe("system");
    expect(readThemePreference(memoryStorage())).toBe("light");
  });

  it("stores Dark and System, and forgets the key for the light default", () => {
    const storage = memoryStorage();
    expect(writeThemePreference("system", storage)).toBe(true);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("system");
    expect(writeThemePreference("dark", storage)).toBe(true);
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("dark");
    expect(writeThemePreference("light", storage)).toBe(true);
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it("survives blocked storage", () => {
    expect(readThemePreference(blockedStorage)).toBe("light");
    expect(writeThemePreference("dark", blockedStorage)).toBe(false);
  });
});

describe("resolveTheme", () => {
  it("lets an explicit choice override the OS", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("follows the OS for system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("describeTheme", () => {
  it("names the choice, and what system resolved to", () => {
    expect(describeTheme("dark", "dark")).toBe("Theme: Dark");
    expect(describeTheme("system", "light")).toBe("Theme: System (light)");
  });
});

describe("applyThemePreference", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <meta name="color-scheme" content="light">
      <meta name="theme-color" content="#21181c" media="not all">`;
    delete document.documentElement.dataset.theme;
  });

  const metas = () => ({
    scheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content"),
    chrome: document.querySelector('meta[name="theme-color"]')?.getAttribute("media"),
  });

  it.each([
    ["light", "light", "not all"],
    ["dark", "dark", "all"],
    ["system", "light dark", "(prefers-color-scheme: dark)"],
  ] as const)("stamps %s on <html> and keeps the metas in step", (preference, scheme, chrome) => {
    applyThemePreference(document, preference);
    expect(document.documentElement.dataset.theme).toBe(preference);
    expect(metas()).toEqual({ scheme, chrome });
    expect(colorSchemeFor(preference)).toBe(scheme);
    expect(themeColorMediaFor(preference)).toBe(chrome);
  });

  it("works on a document without the metas", () => {
    document.head.innerHTML = "";
    expect(() => {
      applyThemePreference(document, "dark");
    }).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("the BaseHead boot script", () => {
  const source = readFileSync("src/components/BaseHead.astro", "utf8");
  const script = /<script is:inline define:vars=\{\{ storageKey: THEME_STORAGE_KEY \}\}>([\s\S]*?)<\/script>/.exec(
    source,
  )?.[1];

  const boot = (stored: string | null, doc: Document = document) => {
    const storage = memoryStorage(stored === null ? {} : { [THEME_STORAGE_KEY]: stored });
    // Runs the repository's own inline source, as the browser would
    new Function("storageKey", "window", "document", "localStorage", script ?? "")(
      THEME_STORAGE_KEY,
      {},
      doc,
      storage,
    );
  };

  it("is present and shares the module's storage key", () => {
    expect(script).toBeDefined();
  });

  it.each([
    ["dark", "dark"],
    ["system", "system"],
    ["light", "light"],
    [null, "light"],
    ["bogus", "light"],
  ])("applies a stored %s exactly as the module does", (stored, expected) => {
    document.head.innerHTML = `
      <meta name="color-scheme" content="light">
      <meta name="theme-color" content="#21181c" media="not all">`;
    boot(stored);
    const preference = parseThemePreference(expected);
    expect(document.documentElement.dataset.theme).toBe(expected);
    expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe(
      colorSchemeFor(preference),
    );
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("media")).toBe(
      themeColorMediaFor(preference),
    );
  });
});
