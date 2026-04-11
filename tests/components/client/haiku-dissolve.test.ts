import { describe, expect, it } from "vitest";
import haikuDissolve from "../../../src/components/client/haiku-dissolve";
import type { CharCacheEntry } from "../../../src/components/client/haiku-dissolve";

const { applyDissolveToElement, getHaikuCharClass, processCharEntry, resetElement } = haikuDissolve;

describe("getHaikuCharClass", () => {
  it("returns empty string when reducedMotion is set", () => {
    expect(getHaikuCharClass(true, true, true)).toBe("");
  });

  it("returns breathe class when breathing", () => {
    expect(getHaikuCharClass(false, true, false)).toBe("haiku-char--breathe");
  });

  it("returns appear class when appeared but not breathing", () => {
    expect(getHaikuCharClass(false, false, true)).toBe("haiku-char--appear");
  });

  it("returns smoke class as the default", () => {
    expect(getHaikuCharClass(false, false, false)).toBe("haiku-char--smoke");
  });
});

describe("applyDissolveToElement / resetElement", () => {
  it("mutates inline styles on the element", () => {
    const el = document.createElement("span");
    applyDissolveToElement(el, 0.5, 10, -4, 2);
    expect(el.style.opacity).not.toBe("");
    expect(el.style.transform).toContain("translate");
    expect(el.style.color).toContain("color-mix");
    expect(el.style.transition).toContain("opacity");
  });

  it("resetElement restores base styles", () => {
    const el = document.createElement("span");
    applyDissolveToElement(el, 0.5, 10, -4, 2);
    resetElement(el);
    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toContain("translate(0, 0)");
    expect(el.style.color).toBe("");
  });
});

describe("processCharEntry", () => {
  const makeCached = (px: number, py: number): CharCacheEntry => ({
    driftR: 0,
    driftX: 0,
    driftY: 0,
    px,
    py,
  });

  it("adds key to nextDissolved and mutates styles within radius", () => {
    const el = document.createElement("span");
    const charElsRef = { current: new Map([["k1", el]]) };
    const dissolvedKeys = { current: new Set<string>() };
    const nextDissolved = new Set<string>();
    processCharEntry({
      cached: makeCached(0, 0),
      charElsRef,
      dissolvedKeys,
      key: "k1",
      mouseX: 5,
      mouseY: 5,
      nextDissolved,
    });
    expect(nextDissolved.has("k1")).toBe(true);
    expect(el.style.opacity).not.toBe("");
  });

  it("resets element when outside radius and previously dissolved", () => {
    const el = document.createElement("span");
    el.style.opacity = "0.3";
    const charElsRef = { current: new Map([["k1", el]]) };
    const dissolvedKeys = { current: new Set<string>(["k1"]) };
    const nextDissolved = new Set<string>();
    processCharEntry({
      cached: makeCached(0, 0),
      charElsRef,
      dissolvedKeys,
      key: "k1",
      mouseX: 9999,
      mouseY: 9999,
      nextDissolved,
    });
    expect(el.style.opacity).toBe("1");
    expect(nextDissolved.has("k1")).toBe(false);
  });

  it("is a no-op when outside radius and not previously dissolved", () => {
    const el = document.createElement("span");
    el.style.opacity = "0.8";
    const charElsRef = { current: new Map([["k1", el]]) };
    const dissolvedKeys = { current: new Set<string>() };
    const nextDissolved = new Set<string>();
    processCharEntry({
      cached: makeCached(0, 0),
      charElsRef,
      dissolvedKeys,
      key: "k1",
      mouseX: 9999,
      mouseY: 9999,
      nextDissolved,
    });
    expect(el.style.opacity).toBe("0.8");
  });
});
