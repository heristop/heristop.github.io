import { describe, expect, it } from "vitest";
import {
  buildGarden,
  randomizeFrog,
  tourCompletes,
} from "../../../../../src/components/client/garden/board/terrain";
import {
  chooseRakeTargets,
  planGardenerTurn,
  rakePaths,
} from "../../../../../src/components/client/garden/board/gardener";
import { cheapestCrossing } from "../../../../../src/components/client/garden/board/routing";
import { isWalkableTile } from "../../../../../src/components/client/garden/board/rules";
import type { GardenSeed } from "../../../../../src/components/client/garden/schema";

const profiles = {
  missing: Array<null>(14).fill(null),
  zero: Array<number>(14).fill(0),
  quiet: Array.from({ length: 14 }, (_, i) => (i === 6 ? 1 : 0)),
  steady: Array<number>(14).fill(1),
  intense: Array<number>(14).fill(1000),
  burst: Array.from({ length: 14 }, (_, i) => (i === 6 ? 10000 : 0)),
  uneven: [0, 2, 0, 1000, 3, 0, 80, 2, 0, 9, 600, 1, 0, 3],
};

describe("activity-independent challenge", () => {
  for (const [name, counts] of Object.entries(profiles)) {
    it(`keeps ${name} histories playable with a meaningful gardener opening across eight seeds`, () => {
      for (let variant = 0; variant < 8; variant++) {
        const seed: GardenSeed = {
          login: `balance-${variant}`,
          generatedAt: `2026-09-${String(variant + 1).padStart(2, "0")}T00:00:00Z`,
          totalContributions: counts.reduce<number>((sum, count) => sum + (count ?? 0), 0),
          days: counts.map((count, i) =>
            count === null
              ? null
              : {
                  count,
                  date: `2026-08-${String(i + 1).padStart(2, "0")}`,
                  language: variant % 2 ? "Rust" : "TypeScript",
                  repo: "balance",
                },
          ),
        };
        const layout = randomizeFrog(buildGarden(seed), variant / 8);
        const { map, start, stones, shrine, stoneBudget } = layout;
        expect(
          map.filter((tile) => tile.stone !== undefined),
          `${name}/${variant} relics`,
        ).toHaveLength(5);
        expect(stoneBudget).toBeLessThanOrEqual(2);
        expect(
          Math.max(...stones.map((stone) => stone.posX)) -
            Math.min(...stones.map((stone) => stone.posX)),
        ).toBeGreaterThanOrEqual(7);
        expect(
          Math.max(...stones.map((stone) => stone.posY)) -
            Math.min(...stones.map((stone) => stone.posY)),
        ).toBeGreaterThanOrEqual(6);
        for (let i = 0; i < stones.length; i++) {
          for (let j = i + 1; j < stones.length; j++) {
            const a = stones[i],
              b = stones[j];
            expect(Math.abs(a.posX - b.posX) + Math.abs(a.posY - b.posY)).toBeGreaterThanOrEqual(5);
            for (const c of stones.slice(j + 1)) {
              expect(
                (b.posX - a.posX) * (c.posY - a.posY) - (b.posY - a.posY) * (c.posX - a.posX),
              ).not.toBe(0);
            }
          }
        }
        const beds = map.filter(
          (tile) => tile.posX > 0 && tile.posX < 11 && tile.posY > 0 && tile.posY < 11,
        );
        const firmRatio = beds.filter(isWalkableTile).length / beds.length;
        expect(firmRatio).toBeGreaterThan(0.3);
        expect(firmRatio).toBeLessThan(0.75);
        expect(cheapestCrossing(map, start, shrine)).toBeGreaterThan(0);
        expect(
          tourCompletes(map, start, stones, shrine, stoneBudget + 6),
          `${name}/${variant} budget=${stoneBudget} `,
        ).toBe(true);
        const targets = chooseRakeTargets(map, [], start, 1, {
          budget: stoneBudget + 6,
          limit: 1,
          from: { posX: 0, posY: 3 },
        });
        expect(targets, `${name}/${variant} opening`).toHaveLength(1);
        const actions = planGardenerTurn(map, { posX: 0, posY: 3 }, targets, start);
        expect(actions.filter((action) => action.kind === "rake")).toHaveLength(1);
        const changed = rakePaths(map, map, targets);
        expect(tourCompletes(changed, start, stones, shrine, stoneBudget + 6)).toBe(true);
      }
    });
  }
});
