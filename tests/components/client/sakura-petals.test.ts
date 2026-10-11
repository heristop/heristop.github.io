import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BURST_INTERVAL_MS,
  PETALS_STORAGE_KEY,
  createBurstGate,
  isPetalSurface,
  parsePetalsPreference,
  readPetalsEnabled,
  shouldBindSakuraTouchBursts,
  writePetalsEnabled,
} from "../../../src/components/client/sakura-petals";

const mockMatchMedia = (coarsePointer: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("pointer: coarse") && coarsePointer,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

const memoryStorage = (entries: Record<string, string> = {}) => {
  const data = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

const blocked = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("shouldBindSakuraTouchBursts", () => {
  it("does not bind touch bursts on coarse pointer devices", () => {
    mockMatchMedia(true);

    expect(shouldBindSakuraTouchBursts()).toBe(false);
  });

  it("binds touch bursts on fine pointer devices", () => {
    mockMatchMedia(false);

    expect(shouldBindSakuraTouchBursts()).toBe(true);
  });
});

describe("petals preference", () => {
  it.each([
    ["on", false, true],
    ["on", true, true],
    ["off", false, false],
    ["off", true, false],
    [null, false, true],
    [null, true, false],
    ["bogus", false, true],
  ])("stored %s with reduced motion %s reads as %s", (stored, reduced, expected) => {
    expect(parsePetalsPreference(stored, reduced)).toBe(expected);
    const storage = memoryStorage(stored === null ? {} : { [PETALS_STORAGE_KEY]: stored });
    expect(readPetalsEnabled(storage, reduced)).toBe(expected);
  });

  it("stores an explicit choice either way, so it outlives the reduced-motion default", () => {
    const storage = memoryStorage();
    expect(writePetalsEnabled(false, storage)).toBe(true);
    expect(readPetalsEnabled(storage, false)).toBe(false);
    expect(writePetalsEnabled(true, storage)).toBe(true);
    expect(readPetalsEnabled(storage, true)).toBe(true);
  });

  it("falls back to the default when storage is blocked", () => {
    expect(readPetalsEnabled(blocked, false)).toBe(true);
    expect(readPetalsEnabled(blocked, true)).toBe(false);
    expect(writePetalsEnabled(true, blocked)).toBe(false);
  });
});

describe("isPetalSurface", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header><p id="in-header">Title</p></header>
      <main>
        <p id="paper">Plain <span id="ink">text</span></p>
        <a id="link" href="/"><span id="in-link">Read</span></a>
        <button id="button">Go</button>
        <input id="input">
        <div role="menu"><div id="in-menu">x</div></div>
        <div role="menuitemradio" id="radio">Dark</div>
        <div role="dialog"><p id="in-dialog">Search</p></div>
        <div data-theme-toggle><span id="in-toggle">x</span></div>
      </main>`;
  });

  it("accepts plain paper and the text on it", () => {
    expect(isPetalSurface(document.getElementById("paper"))).toBe(true);
    expect(isPetalSurface(document.getElementById("ink"))).toBe(true);
  });

  it.each(["link", "in-link", "button", "input", "in-menu", "radio", "in-dialog", "in-header", "in-toggle"])(
    "ignores presses on or inside interface: %s",
    (id) => {
      expect(isPetalSurface(document.getElementById(id))).toBe(false);
    },
  );

  it("ignores targets that are not elements", () => {
    expect(isPetalSurface(null)).toBe(false);
    expect(isPetalSurface(document)).toBe(false);
  });
});

describe("createBurstGate", () => {
  it("opens at most once per interval", () => {
    let now = 1000;
    const gate = createBurstGate(BURST_INTERVAL_MS, () => now);
    expect(gate()).toBe(true);
    now += BURST_INTERVAL_MS - 1;
    expect(gate()).toBe(false);
    now += 1;
    expect(gate()).toBe(true);
    now += 100;
    expect(gate()).toBe(false);
  });

  it("throttles to one burst per 600ms by default", () => {
    expect(BURST_INTERVAL_MS).toBe(600);
  });
});
