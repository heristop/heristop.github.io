import { describe, expect, it } from "vitest";
import textReveal from "../src/text-reveal-motion";
import type { LayoutLine } from "@chenglou/pretext";

const {
  buildCharDrifts,
  buildTitleCharDrifts,
  buildWordDrifts,
  getCharClass,
  getSmokeClass,
  getSmokeStyle,
  maxAnimationEnd,
  seededRandom,
  TITLE_REVEAL_TIMING,
  titleTransitionName,
} = textReveal;

const makeLine = (text: string): LayoutLine => ({
  text,
  width: 0,
  start: { graphemeIndex: 0, segmentIndex: 0 },
  end: { graphemeIndex: 0, segmentIndex: 0 },
});

describe("seededRandom", () => {
  it("is deterministic for the same seed", () => {
    expect(seededRandom(42)).toBe(seededRandom(42));
  });

  it("returns values in [0, 1)", () => {
    for (let i = 1; i < 20; i++) {
      const v = seededRandom(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("buildCharDrifts", () => {
  it("returns one inner array per line with one drift per char", () => {
    const lines = [makeLine("ab"), makeLine("hi")];
    const drifts = buildCharDrifts(lines, 500);
    expect(drifts).toHaveLength(2);
    expect(drifts[0]).toHaveLength(2);
    expect(drifts[1]).toHaveLength(2);
    expect(drifts[0][0].char).toBe("a");
    expect(drifts[0][0].key).toContain("0-0-");
  });

  it("defaults the baseDuration when omitted", () => {
    const drifts = buildCharDrifts([makeLine("x")]);
    expect(drifts[0][0].duration).toBeGreaterThan(0);
  });
});

describe("buildWordDrifts", () => {
  it("splits on whitespace and builds per-char drifts", () => {
    const words = buildWordDrifts("hi world", 500);
    expect(words.length).toBeGreaterThan(0);
    const joined = words.map((w) => w.word).join("");
    expect(joined).toBe("hi world");
    const firstWord = words.find((w) => w.word === "hi");
    expect(firstWord?.chars).toHaveLength(2);
  });

  it("returns empty drifts for empty string", () => {
    expect(buildWordDrifts("")).toEqual([{ chars: [], word: "" }]);
  });
});

describe("maxAnimationEnd", () => {
  it("picks max (delay + duration) across a line-based drift", () => {
    const drifts = buildCharDrifts([makeLine("ab")], 1000);
    const max = maxAnimationEnd(drifts);
    const expected = Math.max(...drifts[0].map((c) => c.delay + c.duration));
    expect(max).toBe(expected);
  });

  it("picks max across a word-based drift", () => {
    const words = buildWordDrifts("hi", 1000);
    const max = maxAnimationEnd(words);
    expect(max).toBeGreaterThan(0);
  });

  it("returns 0 when drifts are empty", () => {
    expect(maxAnimationEnd([])).toBe(0);
  });
});

describe("getCharClass / getSmokeClass", () => {
  it("returns settled when settled is true", () => {
    expect(getCharClass(true, true, true)).toBe("haiku-char--settled");
  });

  it("returns empty string when reducedMotion and not settled", () => {
    expect(getCharClass(false, false, true)).toBe("");
  });

  it("returns appear when appeared and not settled", () => {
    expect(getSmokeClass(true, false)).toBe("haiku-char--appear");
  });

  it("returns smoke when not appeared", () => {
    expect(getSmokeClass(false, false)).toBe("haiku-char--smoke");
  });
});

describe("getSmokeStyle", () => {
  it("returns plain inline-block when reduced motion", () => {
    const drifts = buildCharDrifts([makeLine("a")], 500);
    expect(getSmokeStyle(drifts[0][0], true)).toEqual({ display: "inline-block" });
  });

  it("returns CSS variables when motion is enabled", () => {
    const drifts = buildCharDrifts([makeLine("a")], 500);
    const style = getSmokeStyle(drifts[0][0], false) as Record<string, string>;
    expect(style["--drift-x"]).toMatch(/px$/);
    expect(style["--char-duration"]).toMatch(/ms$/);
    expect(style.display).toBe("inline-block");
  });
});

describe("buildTitleCharDrifts", () => {
  it("lands a long title within the shared ~600ms budget", () => {
    const long = "x".repeat(120);
    const drifts = buildTitleCharDrifts([makeLine(long.slice(0, 60)), makeLine(long.slice(60))]);
    const budget = TITLE_REVEAL_TIMING.charStaggerBudgetMs + TITLE_REVEAL_TIMING.durationMs;
    expect(maxAnimationEnd(drifts)).toBeLessThanOrEqual(budget);
  });

  it("keeps drift, rotation and blur within the title limits", () => {
    for (const drift of buildTitleCharDrifts([makeLine("A quiet title")]).flat()) {
      expect(Math.abs(drift.driftX)).toBeLessThanOrEqual(TITLE_REVEAL_TIMING.driftXPx);
      expect(drift.driftY).toBeLessThanOrEqual(-TITLE_REVEAL_TIMING.driftYMinPx);
      expect(drift.driftY).toBeGreaterThanOrEqual(-TITLE_REVEAL_TIMING.driftYMaxPx);
      expect(Math.abs(drift.rotation)).toBeLessThanOrEqual(TITLE_REVEAL_TIMING.rotationDeg);
      expect(drift.blur).toBeLessThanOrEqual(TITLE_REVEAL_TIMING.blurMaxPx);
    }
  });

  it("offsets every char by the row delay", () => {
    const [[first]] = buildTitleCharDrifts([makeLine("ab")], 140);
    expect(first.delay).toBe(140);
  });
});

describe("titleTransitionName", () => {
  it("is stable for a title and differs between titles", () => {
    expect(titleTransitionName("Zen")).toBe(titleTransitionName("Zen"));
    expect(titleTransitionName("Zen")).not.toBe(titleTransitionName("Code"));
    expect(titleTransitionName("Zen")).toMatch(/^post-title-[a-z0-9]+$/);
  });
});
