import { describe, expect, it } from "vitest";
import {
  DATA_TILES,
  FALLBACK_SEED,
  WINDOW_DAYS,
  dayForTile,
  parseGardenSeed,
  tileForDay,
} from "../../src/data/garden-schema";

describe("FALLBACK_SEED", () => {
  it("has exactly one entry per day in the window", () => {
    expect(FALLBACK_SEED.days).toHaveLength(WINDOW_DAYS);
  });

  it("contains at least five days with commits so stones can be placed", () => {
    const active = FALLBACK_SEED.days.filter((day) => day !== null && day.count > 0);
    expect(active.length).toBeGreaterThanOrEqual(5);
  });
});

describe("parseGardenSeed", () => {
  it("falls back when given nothing", () => {
    expect(parseGardenSeed(undefined)).toBe(FALLBACK_SEED);
    expect(parseGardenSeed(null)).toBe(FALLBACK_SEED);
  });

  it("falls back when days is the wrong length", () => {
    const raw = { days: [], generatedAt: "2026-09-05", login: "x", totalContributions: 1 };
    expect(parseGardenSeed(raw)).toBe(FALLBACK_SEED);
  });

  it("falls back when a day is malformed", () => {
    const days = Array.from({ length: WINDOW_DAYS }, () => ({ count: "lots", date: "2026-01-01" }));
    const raw = { days, generatedAt: "2026-09-05", login: "x", totalContributions: 1 };
    expect(parseGardenSeed(raw)).toBe(FALLBACK_SEED);
  });

  it("accepts a well-formed seed and normalises missing optional fields", () => {
    const days = Array.from({ length: WINDOW_DAYS }, (_unused, index) => ({
      count: index % 12,
      date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    }));
    const raw = { days, generatedAt: "2026-09-05", login: "heristop", totalContributions: 42 };
    const parsed = parseGardenSeed(raw);
    expect(parsed).not.toBe(FALLBACK_SEED);
    expect(parsed.login).toBe("heristop");
    expect(parsed.days).toHaveLength(WINDOW_DAYS);
    expect(parsed.days[3]).toEqual({ count: 3, date: "2026-01-04", language: "", repo: "" });
  });

  it("accepts nulls in days for padding", () => {
    const days: unknown[] = Array.from({ length: WINDOW_DAYS }, () => null);
    const raw = { days, generatedAt: "2026-09-05", login: "x", totalContributions: 0 };
    expect(parseGardenSeed(raw).days.every((day) => day === null)).toBe(true);
  });
});

// The board still has a hundred tiles; a day now owns a run of them. Every tile must map
// to a real day, every day must own at least one tile, and a day's representative tile
// must map back to that same day — otherwise walking to a day from the chart lands you in
// somebody else's bed.
describe("day beds", () => {
  it("assigns every tile to a day inside the window", () => {
    for (let tile = 0; tile < DATA_TILES; tile++) {
      const day = dayForTile(tile);
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThan(WINDOW_DAYS);
    }
  });

  it("gives every day a bed, and lands each day's tile back on that day", () => {
    const owned = new Map<number, number>();
    for (let tile = 0; tile < DATA_TILES; tile++) {
      const day = dayForTile(tile);
      owned.set(day, (owned.get(day) ?? 0) + 1);
    }
    expect(owned.size).toBe(WINDOW_DAYS);
    for (let day = 0; day < WINDOW_DAYS; day++) {
      expect(owned.get(day)).toBeGreaterThan(0);
      expect(dayForTile(tileForDay(day))).toBe(day);
    }
  });

  it("keeps each day's tiles contiguous, so a streak reads as one unbroken run", () => {
    let previous = 0;
    for (let tile = 0; tile < DATA_TILES; tile++) {
      const day = dayForTile(tile);
      expect(day - previous).toBeLessThanOrEqual(1);
      previous = day;
    }
  });
});
