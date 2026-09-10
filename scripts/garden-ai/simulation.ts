import snapshot from "../../src/data/github-garden.json" with { type: "json" };
import {
  FALLBACK_SEED,
  parseGardenSeed,
  buildGarden,
  randomizeFrog,
  tourCompletes,
  cheapestRoute,
  canPaveTile,
  directionFromDelta,
  manhattan,
  turnCost,
  initialState,
  makeReducer,
  type GardenSeed,
  type GardenLayout,
  type GardenerController,
  type Position,
  type Direction,
} from "../../src/components/client/garden/headless";

// Exercise the production state machine: no teleporting, free paving or skipped rakes.
// Strategies choose by price, walking distance, or whether the remaining tour is affordable.
export const strategies = ["economical", "nearby", "lookahead"] as const;
export const simulate = (
  layout: GardenLayout,
  strategy: (typeof strategies)[number],
  controller?: GardenerController,
) => {
  const reduce = makeReducer(layout, controller);
  let state = initialState(layout, controller);
  let target: Position | undefined;
  let actions = 0;
  let firstRoundStones = 0;
  let stolen = 0;
  let rakes = 0,
    gardenerSteps = 0,
    bends = 0;
  let repeats = 0;
  let previousHeading: Direction | undefined;
  let previousGardener = state.gardenerPosition;
  const recent: { position: Position; turn: number }[] = [];
  for (; actions < 800 && !state.finaleOpen && state.phase !== "lost"; actions++) {
    if (state.phase === "gardener") {
      if (state.gardenerActivity === "rake") {
        const tile = state.map.find((tile) => manhattan(tile, state.gardenerPosition) === 0);
        if (
          !tile ||
          /^sand-[01]$/.test(tile.sprite) ||
          !tile.walkable ||
          tile.decor ||
          tile.npc ||
          tile.stone !== undefined ||
          tile.shrine ||
          tile.gathered ||
          tile.transformed
        )
          throw new Error("Illegal gardener rake");
        if (state.rakeTargets.length > 3) throw new Error("Too many rakes in a turn");
        if (state.rakeTargets.length === 1 && state.gardenerActions.length)
          throw new Error("Movement after final rake");
        rakes++;
        if (
          recent.some(
            (r) =>
              manhattan(r.position, state.gardenerPosition) === 0 &&
              state.gardenerTurns - r.turn <= 2,
          )
        )
          repeats++;
        recent.push({ position: state.gardenerPosition, turn: state.gardenerTurns });
      }
      if (state.gardenerActivity === "walk") {
        const heading = directionFromDelta(previousGardener, state.gardenerPosition)!;
        bends += turnCost(previousHeading, heading);
        previousHeading = heading;
        previousGardener = state.gardenerPosition;
        gardenerSteps++;
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
    termination: state.finaleOpen
      ? ("won" as const)
      : state.phase === "lost"
        ? ("lost" as const)
        : actions >= 800
          ? ("action-limit" as const)
          : ("strategy-blocked" as const),
    gardenerSteps,
    rakes,
    bends,
    repeats,
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

export const profiles = {
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

export interface Scenario {
  id: string;
  layout: GardenLayout;
}
export function scenarios(split: "training" | "validation" | "audit", variants = 1): Scenario[] {
  const selected = Object.entries(profiles).filter(
    ([name]) => split !== "training" || !["published", "sample"].includes(name),
  );
  return selected.flatMap(([name, seed]) =>
    Array.from({ length: variants }, (_, variant) => ({
      id: `${split}/${name}/${variant}`,
      layout: randomizeFrog(
        buildGarden(
          split === "validation" && variant === 0
            ? seed
            : { ...seed, login: `${seed.login}:${split}:${variant}` },
        ),
        (variant + 0.5) / (variants + 1),
      ),
    })),
  );
}
