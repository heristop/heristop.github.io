import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  buildGarden,
  randomizeFrog,
} from "../../../../../src/components/client/garden/board/terrain";
import { cheapestRoute } from "../../../../../src/components/client/garden/board/routing";
import {
  directionFromDelta,
  manhattan,
} from "../../../../../src/components/client/garden/board/geometry";
import {
  initialState,
  makeReducer,
} from "../../../../../src/components/client/garden/composables/use-game";
import type { Position } from "../../../../../src/components/client/garden/types";

import { profiles, simulate, strategies } from "../../../../../scripts/garden-ai/simulation";

const variants = Math.max(3, Math.min(100, Number(process.env.GARDEN_BALANCE_VARIANTS) || 3));

it.each(["economical", "lookahead"] as const)(
  "%s finishes the tight garden by visiting the reachable frog instead of giving up",
  (strategy) => {
    const seed = {
      ...profiles.sample,
      login: `${profiles.sample.login}:audit:61`,
      days: profiles.sample.days.map((day, index) => ({ ...day!, count: index === 6 ? 1 : 0 })),
    };
    // The failed audit generated 64 variants before filtering; that count also
    // determines frog placement. Keep this exact board in the regression suite.
    const layout = randomizeFrog(buildGarden(seed), 61.5 / 65);
    const run = simulate(layout, strategy);
    expect(run.termination).toBe("won");
    expect(run.position).toEqual({ posX: 3, posY: 6 });
    expect(run.stonesFound).toBe(5);
    expect(run.refills).toBe(3);
    expect(run.laid).toBeGreaterThan(0);
  },
);

it(
  "keeps current and contrasting histories winnable against the gardener with measurable crossings",
  () => {
    const results: (ReturnType<typeof simulate> & { profile: string })[] = [];
    const failures: string[] = [];
    for (const [profile, seed] of Object.entries(profiles)) {
      for (let variant = 0; variant < variants; variant++) {
        const layout = randomizeFrog(
          buildGarden(variant === 0 ? seed : { ...seed, login: `${seed.login}-${variant}` }),
          variant / variants,
        );
        const runs = strategies.map((strategy) => simulate(layout, strategy));
        results.push(...runs.map((run) => ({ profile: `${profile}/${variant}`, ...run })));
        if (!runs.some((run) => run.won)) failures.push(`${profile}/${variant}`);
        for (const run of runs.filter((run) => run.won)) {
          expect(run.position).toEqual(layout.shrine);
          expect(run.stonesFound).toBe(5);
          expect(run.laid).toBeGreaterThan(0);
          expect(run.steps).toBeGreaterThan(10);
          expect(run.steps).toBeLessThan(300);
          expect(run.refills).toBeGreaterThanOrEqual(1);
          if (profile === "published" && variant === 0)
            expect(run.refills).toBeGreaterThanOrEqual(2);
          expect(run.refills).toBeLessThanOrEqual(3);
        }
      }
    }
    expect(results.reduce((sum, run) => sum + run.attacks, 0)).toBeGreaterThan(0);
    const summary = strategies.map((strategy) => {
      const runs = results.filter((run) => run.strategy === strategy);
      const winners = runs.filter((run) => run.won);
      return {
        strategy,
        wins: `${winners.length}/${runs.length}`,
        averageRefills: +(
          winners.reduce((sum, run) => sum + run.refills, 0) / winners.length
        ).toFixed(2),
        averageSteps: Math.round(winners.reduce((sum, run) => sum + run.steps, 0) / winners.length),
        minSteps: Math.min(...winners.map((run) => run.steps)),
        maxSteps: Math.max(...winners.map((run) => run.steps)),
        winsByRound: [0, 1, 2, 3].map(
          (refills) => winners.filter((run) => run.refills === refills).length,
        ),
        gardenerAttacks: runs.reduce((sum, run) => sum + run.attacks, 0),
        stonesStolen: runs.reduce((sum, run) => sum + run.stolen, 0),
      };
    });
    if (process.env.GARDEN_BALANCE_REPORT)
      writeFileSync(
        process.env.GARDEN_BALANCE_REPORT,
        JSON.stringify({ summary, failures, results }, null, 2),
      );
    console.table(summary);
    expect(failures, "boards with no winning strategy").toEqual([]);
  },
  Math.max(60000, variants * 15000),
);

it("cannot finish the published garden in one round by reordering stones or detouring to the frog", () => {
  const openings = [0, 0.5, 0.999].map((roll) => {
    const layout = randomizeFrog(buildGarden(profiles.published), roll);
    const reduce = makeReducer(layout);
    let opening = initialState(layout);
    while (opening.phase === "gardener") opening = reduce(opening, { type: "advanceGardener" });
    let explored = 0;
    let maxStones = 0;
    let oneRoundWin = false;
    const visit = (state: ReturnType<typeof initialState>) => {
      explored++;
      maxStones = Math.max(maxStones, state.stonesFound.length);
      if (state.finaleOpen) {
        oneRoundWin = true;
        return;
      }
      if (state.phase !== "player" || state.gardenerTurns > 0) return;
      const stones = state.map.filter((tile) => tile.stone !== undefined);
      const goals: Position[] = stones.length ? [...stones] : [layout.shrine];
      if (!state.frogFreed)
        goals.push(
          ...state.map.filter((tile) => tile.walkable && manhattan(tile, state.frog) === 1),
        );
      for (const goal of goals) {
        const route = cheapestRoute(state.map, state.position, goal, 100);
        if (!route?.path.length) continue;
        let next = state;
        for (const step of route.path) {
          if (next.phase !== "player" || next.finaleOpen) break;
          const direction = directionFromDelta(next.position, step);
          if (!direction) break;
          const moved = reduce(next, { type: "move", direction });
          if (moved === next) break;
          next = moved;
        }
        if (
          next !== state &&
          (next.phase !== "player" ||
            next.finaleOpen ||
            next.stonesFound.length > state.stonesFound.length ||
            next.frogFreed !== state.frogFreed)
        )
          visit(next);
      }
    };
    visit(opening);
    return { roll, explored, maxStones, oneRoundWin };
  });
  if (process.env.GARDEN_BALANCE_REPORT)
    writeFileSync(
      `${process.env.GARDEN_BALANCE_REPORT}.opening.json`,
      JSON.stringify(openings, null, 2),
    );
  expect(
    openings.every((result) => !result.oneRoundWin),
    JSON.stringify(openings),
  ).toBe(true);
}, 60000);
