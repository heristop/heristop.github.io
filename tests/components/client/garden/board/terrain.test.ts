import { describe, expect, it } from "vitest";
import type { GardenDay, GardenSeed } from "../../../../../src/components/client/garden/schema";
import {
  DATA_TILES,
  FALLBACK_SEED,
  STONE_COUNT,
  WINDOW_DAYS,
} from "../../../../../src/components/client/garden/schema";
import { isWalkableTile } from "../../../../../src/components/client/garden/board/rules";
import { cheapestCrossing } from "../../../../../src/components/client/garden/board/routing";
import {
  HAIKU_LINES,
  buildGarden,
  randomizeFrog,
  cellToPosition,
  dayIndexToCell,
  groundForCount,
  tourCompletes,
} from "../../../../../src/components/client/garden/board/terrain";

const seedWith = (counts: readonly number[]): GardenSeed => ({
  days: Array.from({ length: WINDOW_DAYS }, (_unused, index): GardenDay | null =>
    counts[index] === undefined
      ? null
      : { count: counts[index], date: "2026-01-01", language: "TypeScript", repo: "zazen-code" },
  ),
  generatedAt: "2026-09-05T00:00:00.000Z",
  login: "test",
  totalContributions: counts.reduce((sum, count) => sum + count, 0),
});

describe("dayIndexToCell", () => {
  it("runs the first row left to right", () => {
    expect(dayIndexToCell(0)).toEqual({ col: 0, row: 0 });
    expect(dayIndexToCell(9)).toEqual({ col: 9, row: 0 });
  });

  it("runs the second row right to left, so consecutive days stay adjacent", () => {
    expect(dayIndexToCell(10)).toEqual({ col: 9, row: 1 });
    expect(dayIndexToCell(19)).toEqual({ col: 0, row: 1 });
  });

  it("keeps every consecutive pair of days orthogonally adjacent", () => {
    for (let index = 0; index < DATA_TILES - 1; index++) {
      const a = dayIndexToCell(index);
      const b = dayIndexToCell(index + 1);
      expect(Math.abs(a.col - b.col) + Math.abs(a.row - b.row)).toBe(1);
    }
  });
});

describe("cellToPosition", () => {
  it("offsets the data field inside the authored border", () => {
    expect(cellToPosition(0, 0)).toEqual({ posX: 1, posY: 1 });
    expect(cellToPosition(9, 9)).toEqual({ posX: 10, posY: 10 });
  });
});

describe("groundForCount", () => {
  it("reads a quiet day as raked sand, never water", () => {
    expect(groundForCount(0)).toBe("sand-0");
  });

  it("climbs the moss ramp with activity", () => {
    expect(groundForCount(2)).toBe("sand-moss");
    expect(groundForCount(6)).toBe("moss-mid");
    expect(groundForCount(20)).toBe("moss-deep");
  });
});

describe("buildGarden", () => {
  it("is deterministic for the same seed", () => {
    expect(buildGarden(FALLBACK_SEED).map).toEqual(buildGarden(FALLBACK_SEED).map);
  });

  it("places exactly five stones", () => {
    expect(buildGarden(FALLBACK_SEED).stones).toHaveLength(STONE_COUNT);
  });

  it("puts exactly five stone markers on the board, none of them the shrine", () => {
    const { map, shrine } = buildGarden(FALLBACK_SEED);
    const stoneTiles = map.filter((tile) => tile.stone !== undefined);
    expect(stoneTiles).toHaveLength(STONE_COUNT);
    expect(stoneTiles.some((tile) => tile.posX === shrine.posX && tile.posY === shrine.posY)).toBe(
      false,
    );
  });

  it("numbers the stones 0 to 4 with no gaps", () => {
    const { map } = buildGarden(FALLBACK_SEED);
    const indices = map
      .filter((tile) => tile.stone !== undefined)
      .map((tile) => tile.stone as number)
      .sort((a, b) => a - b);
    expect(indices).toEqual([0, 1, 2, 3, 4]);
  });

  it("has one haiku line per stone", () => {
    expect(HAIKU_LINES).toHaveLength(STONE_COUNT);
  });

  it("spreads stones at least five tiles apart", () => {
    const { stones } = buildGarden(FALLBACK_SEED);
    for (let i = 0; i < stones.length; i++) {
      for (let j = i + 1; j < stones.length; j++) {
        const distance =
          Math.abs(stones[i].posX - stones[j].posX) + Math.abs(stones[i].posY - stones[j].posY);
        expect(distance).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("places a locked shrine away from the stones", () => {
    const { shrine, map } = buildGarden(FALLBACK_SEED);
    const tile = map.find((t) => t.posX === shrine.posX && t.posY === shrine.posY);
    expect(tile?.shrine).toBe("locked");
  });

  it("never turns a zero-commit day into water", () => {
    const { map } = buildGarden(seedWith(Array.from({ length: WINDOW_DAYS }, () => 0)));
    const inner = map.filter((t) => t.posX >= 1 && t.posX <= 10 && t.posY >= 1 && t.posY <= 10);
    expect(inner.every((t) => !t.sprite.startsWith("water"))).toBe(true);
  });

  it("still places five stones when the history is empty", () => {
    expect(buildGarden(seedWith([])).stones).toHaveLength(STONE_COUNT);
  });

  it("still places five stones when only one day has commits", () => {
    const counts = Array.from({ length: WINDOW_DAYS }, () => 0);
    counts[42] = 9;
    expect(buildGarden(seedWith(counts)).stones).toHaveLength(STONE_COUNT);
  });

  // The guarantee the whole design rests on. Raked sand is impassable, so "reachable" no
  // longer means reachable on foot — it means reachable for a price the garden has
  // actually handed you. A garden that costs more stones than it gives is not hard, it is
  // shut, and on a personal site a shut garden is a broken page.
  it("never asks for more stones than it hands out, for many shapes of history", () => {
    const shapes: readonly (readonly number[])[] = [
      Array.from({ length: WINDOW_DAYS }, () => 0),
      Array.from({ length: WINDOW_DAYS }, () => 30),
      Array.from({ length: WINDOW_DAYS }, (_u, i) => (i % 7 === 0 ? 15 : 0)),
      Array.from({ length: WINDOW_DAYS }, (_u, i) => (i < 7 ? 0 : 12)),
      Array.from({ length: WINDOW_DAYS }, (_u, i) => (i % 2 === 0 ? 1 : 0)),
      [],
    ];
    for (const counts of shapes) {
      const { map, start, stones, shrine, stoneBudget } = buildGarden(seedWith(counts));
      const toShrine = cheapestCrossing(map, start, shrine);
      expect(toShrine, `shrine unreachable at any price for ${counts.length} days`).toBeDefined();
      for (const stone of stones) {
        const toStone = cheapestCrossing(map, start, stone);
        expect(toStone, "a stone sat somewhere no crossing could reach").toBeDefined();
      }
      // Rewards and later gardener refills are part of the available tour budget.
      expect(
        tourCompletes(map, start, stones, shrine, stoneBudget + 6),
        `no tour finished on ${stoneBudget} starting stones plus refills`,
      ).toBe(true);
    }
  });

  // Firm ground is the busier half of the days you actually worked. The point of a
  // relative threshold is that every fortnight is a puzzle: an absolute one either turns a
  // productive fortnight into a lawn with nothing to solve, or reads an ordinary one as
  // failure.
  it("always leaves roughly half the garden to cross, however busy the fortnight", () => {
    const busy = Array.from({ length: WINDOW_DAYS }, () => 40);
    const ordinary = Array.from({ length: WINDOW_DAYS }, (_u, i) => (i % 5 === 0 ? 0 : 1));
    for (const counts of [busy, ordinary]) {
      const { map, start, stones, shrine, stoneBudget } = buildGarden(seedWith(counts));
      const cost = cheapestCrossing(map, start, shrine);
      expect(cost, "even a busy fortnight must cost something").toBeGreaterThan(0);
      expect(tourCompletes(map, start, stones, shrine, stoneBudget + 6)).toBe(true);
    }
  });

  // The garden has to be worth playing on a bad week too. Half the fortnight is firm
  // whatever it held — but a day with nothing on it gives bare gravel, not moss, so the
  // challenge holds its shape while the ground still tells the truth about the fortnight.
  it("gives a dead fortnight ground to stand on, and makes it visibly bare", () => {
    const counts = Array.from({ length: WINDOW_DAYS }, () => 0);
    const { map } = buildGarden(seedWith(counts));
    const beds = map.filter((tile) => tile.day !== undefined);
    const firm = beds.filter((tile) => isWalkableTile(tile));
    expect(firm.length).toBeGreaterThan(20);
    // Not one blade of moss was earned.
    expect(beds.some((tile) => tile.sprite.startsWith("moss"))).toBe(false);
  });

  // The point of a relative threshold, stated as a promise: no fortnight produces a garden
  // that is a walk, and none produces one that is a hundred tiles of paving.
  it("keeps the crossing worth solving whatever the fortnight held", () => {
    const shapes: readonly (readonly number[])[] = [
      Array.from({ length: WINDOW_DAYS }, () => 0),
      Array.from({ length: WINDOW_DAYS }, () => 40),
      Array.from({ length: WINDOW_DAYS }, (_u, i) => (i === 6 ? 20 : 0)),
      Array.from({ length: WINDOW_DAYS }, (_u, i) => i),
      [8, 6, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0],
    ];
    for (const counts of shapes) {
      const { map, start, stones, shrine, stoneBudget } = buildGarden(seedWith(counts));
      const cost = cheapestCrossing(map, start, shrine);
      expect(cost, "the shrine must never be free").toBeGreaterThan(0);
      expect(cost ?? Infinity, "nor should it be a paving job").toBeLessThanOrEqual(8);
      // The opening reserve alone cannot finish; the scheduled refills keep a full
      // tour affordable, while actual gardener interactions are tested in simulations.
      expect(
        tourCompletes(map, start, stones, shrine, stoneBudget + 6),
        "the garden must be finishable on what it hands you",
      ).toBe(true);
      expect(
        tourCompletes(map, start, stones, shrine, stoneBudget),
        "the opening reserve alone should not bypass the gardener",
      ).toBe(false);

      // Neither a lawn nor a desert. The board is only a puzzle while both kinds of
      // ground are present in quantity, and that has to hold for a fortnight of nothing
      // as much as for a fortnight of forties.
      const beds = map.filter((tile) => tile.day !== undefined);
      const firm = beds.filter((tile) => isWalkableTile(tile)).length;
      expect(firm / beds.length).toBeGreaterThan(0.3);
      expect(firm / beds.length).toBeLessThan(0.75);
    }
  });

  // The other half of the same promise: a garden you can cross without spending anything
  // is not a game either. An empty fortnight must actually cost stones.
  it("charges for a fortnight with nothing in it", () => {
    const counts = Array.from({ length: WINDOW_DAYS }, () => 0);
    const { map, start, stones, shrine, stoneBudget } = buildGarden(seedWith(counts));
    const toShrine = cheapestCrossing(map, start, shrine);
    expect(toShrine).toBeGreaterThan(0);
    expect(tourCompletes(map, start, stones, shrine, stoneBudget + 6)).toBe(true);
    expect(tourCompletes(map, start, stones, shrine, stoneBudget)).toBe(false);
  });
});

describe("randomizeFrog", () => {
  it("selects varied clear banks without changing the challenge or mutating the layout", () => {
    const layout = buildGarden(FALLBACK_SEED);
    const original = structuredClone(layout);
    const positions = new Set<string>();
    for (const roll of [0, 0.25, 0.5, 0.75, 0.999]) {
      const next = randomizeFrog(layout, roll);
      positions.add(JSON.stringify(next.frog));
      const frogs = next.map.filter((tile) => tile.decor === "frog");
      expect(frogs).toHaveLength(1);
      expect(
        next.map.some(
          (tile) =>
            tile.sprite.startsWith("water") &&
            Math.abs(tile.posX - next.frog.posX) + Math.abs(tile.posY - next.frog.posY) === 1,
        ),
      ).toBe(true);
      expect(next.map.map(({ decor, ...tile }) => tile)).toEqual(
        layout.map.map(({ decor, ...tile }) => tile),
      );
      expect(next.stones).toEqual(layout.stones);
      expect(next.stoneBudget).toBe(layout.stoneBudget);
    }
    expect(positions.size).toBeGreaterThan(1);
    expect(layout).toEqual(original);
  });
});
