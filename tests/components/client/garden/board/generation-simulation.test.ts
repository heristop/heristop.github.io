import { writeFileSync } from "node:fs";
import { canPaveTile } from "../../../../../src/components/client/garden/board/rules";
import { expect, it } from "vitest";
import snapshot from "../../../../../src/data/github-garden.json";
import {
  FALLBACK_SEED,
  parseGardenSeed,
  type GardenSeed,
} from "../../../../../src/components/client/garden/schema";
import {
  buildGarden,
  randomizeFrog,
  tourCompletes,
  type GardenLayout,
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

// Exercise the production state machine: no teleporting, free paving or skipped rakes.
// Strategies choose by price, walking distance, or whether the remaining tour is affordable.
const strategies = ["economical", "nearby", "lookahead"] as const;
const simulate = (layout: GardenLayout, strategy: (typeof strategies)[number]) => {
  const reduce = makeReducer(layout);
  let state = initialState(layout);
  let target: Position | undefined;
  let actions = 0;
  let firstRoundStones = 0;
  let stolen = 0;
  for (; actions < 800 && !state.finaleOpen && state.phase !== "lost"; actions++) {
    if (state.phase === "gardener") {
      if (state.gardenerActivity === "rake") {
        const tile = state.map.find((tile) => manhattan(tile, state.gardenerPosition) === 0);
        expect(tile?.sprite, "a real gardener action must never rake bare sand").not.toMatch(
          /^sand-[01]$/,
        );
        if (state.rakeTargets.length === 1) expect(state.gardenerActions).toHaveLength(0);
      }
      target = undefined;
      state = reduce(state, { type: "advanceGardener" });
      continue;
    }
    const goals = state.map.filter((tile) => tile.stone !== undefined);
    if (
      !target ||
      manhattan(state.position, target) === 0 ||
      (goals.length && !goals.some((goal) => manhattan(goal, target!) === 0))
    ) {
      const choices = (goals.length ? goals : [layout.shrine])
        .flatMap((goal) => {
          const route = cheapestRoute(state.map, state.position, goal, 100);
          if (!route) return [];
          const nextDistance = Math.min(
            ...goals.filter((other) => other !== goal).map((other) => manhattan(goal, other)),
            manhattan(goal, layout.shrine),
          );
          let preservesTour = true;
          if (strategy === "lookahead") {
            const crossed = new Set(route.path.map((p) => `${p.posX},${p.posY}`));
            const collected = goals.filter((stone) => crossed.has(`${stone.posX},${stone.posY}`));
            const rescued =
              !state.frogFreed && route.path.some((p) => manhattan(p, state.frog) <= 1);
            const forecast = state.map.map((tile) => {
              if (rescued && tile.decor === "frog") return { ...tile, decor: "" };
              if (!crossed.has(`${tile.posX},${tile.posY}`)) return tile;
              return {
                ...tile,
                sprite: canPaveTile(tile) ? "stone-slab" : tile.sprite,
                ...(tile.stone !== undefined ? { stone: undefined, decor: "" } : {}),
              };
            });
            const budget =
              state.stonesLeft +
              (3 - state.gardenerTurns) * 2 -
              route.cost +
              collected.length +
              (rescued ? 2 : 0);
            preservesTour =
              budget >= 0 &&
              tourCompletes(
                forecast,
                goal,
                goals.filter((stone) => !collected.includes(stone)),
                layout.shrine,
                budget,
              );
          }
          const rank =
            strategy === "nearby"
              ? route.path.length
              : route.cost * 1000 +
                route.path.length +
                (strategy === "lookahead" ? nextDistance * 4 : 0);
          return [{ goal, rank: rank + (preservesTour ? 0 : 100000) }];
        })
        .sort((a, b) => a.rank - b.rank);
      target = choices[0]?.goal;
    }
    if (!target) break;
    const next = cheapestRoute(state.map, state.position, target, 100)?.path[0];
    const direction = next && directionFromDelta(state.position, next);
    if (!direction) break;
    const moved = reduce(state, { type: "move", direction });
    if (moved === state) break;
    if (moved.attackTicks > state.attackTicks) stolen += moved.lastAttackLoss;
    if (state.gardenerTurns === 0) firstRoundStones = moved.stonesFound.length;
    state = moved;
  }
  return {
    strategy,
    won: state.finaleOpen,
    position: state.position,
    stonesFound: state.stonesFound.length,
    steps: state.steps,
    laid: state.stonesLaid,
    refills: state.gardenerTurns,
    attacks: state.attackTicks,
    actions,
    firstRoundStones,
    stolen,
    supplyLeft: state.stonesLeft,
    phase: state.phase,
  };
};

const profiles = {
  published: parseGardenSeed(snapshot),
  sample: FALLBACK_SEED,
  ...Object.fromEntries(
    Object.entries({
      zero: Array(14).fill(0),
      quiet: Array.from({ length: 14 }, (_, i) => (i === 6 ? 1 : 0)),
      steady: Array(14).fill(3),
      intense: Array(14).fill(1000),
      burst: Array.from({ length: 14 }, (_, i) => (i === 6 ? 10000 : 0)),
      uneven: [0, 2, 0, 1000, 3, 0, 80, 2, 0, 9, 600, 1, 0, 3],
    }).map(([name, counts]) => [
      name,
      {
        ...FALLBACK_SEED,
        days: FALLBACK_SEED.days.map((day, i) => ({ ...day!, count: counts[i] })),
      },
    ]),
  ),
} satisfies Record<string, GardenSeed>;

const variants = Math.max(3, Math.min(100, Number(process.env.GARDEN_BALANCE_VARIANTS) || 3));

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
