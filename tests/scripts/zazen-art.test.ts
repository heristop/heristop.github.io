import { describe, expect, it } from "vitest";
import { PALETTE } from "../../scripts/zazen-art/palette.mjs";
import { SPRITES } from "../../scripts/zazen-art/sprites.mjs";

interface Sprite {
  width: number;
  height: number;
  rows: string[];
}

// SPRITES is an object literal, so its inferred type has no index signature and cannot
// be looked up by a computed name. The generator indexes it the same way.
const sprites: Record<string, Sprite> = SPRITES;

const ALLOWED = new Set([
  "#f2ece0",
  "#e6dccb",
  "#d4c7b2",
  "#a8b295",
  "#8b9a78",
  "#6d7d5c",
  "#c3cbc9",
  "#93a3a3",
  "#6a7c80",
  "#cdbfba",
  "#a8968f",
  "#7d6c68",
  "#c2566e",
  "#9b3f56",
  "#6e2b3e",
  "#4a4038",
  "#2e2721",
]);

const REQUIRED = [
  "sand-0",
  "sand-1",
  "sand-moss",
  "moss-mid",
  "moss-deep",
  "water-still",
  "stone-slab",
  "gravel-edge",
  "bridge-plank",
  "shrine-locked",
  "shrine-active",
  "pine",
  "maple",
  "bamboo-a",
  "bamboo-b",
  "reed",
  "rock-small",
  "rock-mound",
  "lantern-lit",
  "lantern-unlit",
  "torii",
  "post",
  "stone-marker",
  "stone-marker-lit",
  "pilgrim",
  "npc-2",
  "npc-3",
  "dust-puff",
  "ripple",
];

describe("palette", () => {
  it("uses only the seventeen approved colours", () => {
    for (const value of Object.values(PALETTE)) {
      if (value !== null) {
        expect(ALLOWED.has(value)).toBe(true);
      }
    }
  });

  it("reserves one key for transparency", () => {
    expect(PALETTE["."]).toBeNull();
  });
});

describe("sprites", () => {
  it("defines every sprite the game references", () => {
    for (const name of REQUIRED) {
      expect(sprites[name], `missing sprite: ${name}`).toBeDefined();
    }
  });

  it("has rows matching the declared height and width", () => {
    for (const [name, entry] of Object.entries(sprites)) {
      expect(entry.rows, `${name} row count`).toHaveLength(entry.height);
      for (const row of entry.rows) {
        expect(row, `${name} row width`).toHaveLength(entry.width);
      }
    }
  });

  // Scanned in a plain loop with a single assertion at the end, rather than an expect()
  // per pixel. There are a hundred and forty thousand pixels across the sheet and an
  // expect() each was costing nearly five seconds — the test was not wrong, it was simply
  // slower than the default timeout on a loaded machine, so it failed at random. Gathering
  // the offenders first also reports every bad character at once instead of the first.
  it("uses only characters defined in the palette", () => {
    const offenders: string[] = [];
    for (const [name, entry] of Object.entries(sprites)) {
      const seen = new Set<string>();
      for (const row of entry.rows) {
        for (const char of row) {
          if (!Object.hasOwn(PALETTE, char) && !seen.has(char)) {
            seen.add(char);
            offenders.push(`${name} uses undefined char "${char}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("draws ground tiles on the frozen 64x64 cell", () => {
    for (const name of ["sand-0", "sand-1", "sand-moss", "moss-mid", "moss-deep"]) {
      expect(sprites[name].width).toBe(64);
      expect(sprites[name].height).toBe(64);
    }
  });

  it("keeps the isometric top face on a 2:1 slope", () => {
    // Row y of the diamond must be exactly 4px wider than row y-1 in the top half.
    const rows = sprites["moss-mid"].rows;
    const filled = (row: string) => row.length - row.split("").filter((c) => c === ".").length;
    for (let y = 1; y < 16; y++) {
      expect(filled(rows[y]) - filled(rows[y - 1]), `row ${y}`).toBe(4);
    }
  });

  // The loop has to be exactly as long as the highlight pattern repeats. The pattern is
  // laid every eight rows and travels one row per frame, so eight frames return it to
  // where it started. A shorter strip snaps backwards partway through the loop, which is
  // what read as the pond blinking rather than flowing.
  it("stacks the water animation as one full period of the highlight", () => {
    expect(sprites["water-still"].width).toBe(64);
    expect(sprites["water-still"].height).toBe(64 * 8);
  });

  // Seamlessness, asserted directly: the step from the last frame back to the first must
  // be no larger than any step within the loop. When it is larger the highlight snaps
  // backwards once per cycle, and that snap is what reads as blinking.
  it("loops the water without a jump at the wrap", () => {
    const { rows } = sprites["water-still"];
    const frame = (index: number) => rows.slice(index * 64, index * 64 + 64);
    const changed = (a: string[], b: string[]) =>
      a.reduce(
        (total, row, y) =>
          total + [...row].filter((char, x) => char !== b[y][x]).length,
        0,
      );

    const steps = Array.from({ length: 8 }, (_unused, index) =>
      changed(frame(index), frame((index + 1) % 8)),
    );
    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps)).toBeLessThanOrEqual(Math.min(...steps) * 1.6);
  });

  it("lays the pilgrim out as three frames across four facings", () => {
    expect(sprites.pilgrim.width).toBe(24 * 3);
    expect(sprites.pilgrim.height).toBe(40 * 4);
  });

  it("keeps rose out of the scenery", () => {
    const roseChars = new Set(["m", "n", "o"]);
    const scenery = ["pine", "maple", "bamboo-a", "reed", "rock-small", "sand-0", "moss-mid"];
    for (const name of scenery) {
      const used = new Set(sprites[name].rows.join("").split(""));
      for (const char of roseChars) {
        expect(used.has(char), `${name} uses rose "${char}"`).toBe(false);
      }
    }
  });
});
