import { GRID_SIZE } from "../schema";
import type { MapTile, Position } from "../types";
import { manhattan } from "./geometry";
import { cheapestRoute } from "./routing";
import { tourCompletes } from "./terrain";
import { tileAt, findWalkablePath, canPaveTile, canRakeTile } from "./rules";
import { createRng, hashString } from "./rng";
import { createGardenerPlanner, measureGardenerActions } from "./gardener-movement";
import { recentRakeCost, type GardenerMemory } from "./gardener-memory";
import profile from "./gardener-profile.json" with { type: "json" };

export { planGardenerTurn, type GardenerAction } from "./gardener-movement";
export { rememberGardenerRake, type GardenerMemory } from "./gardener-memory";
export const GARDENER_REFILL = 2;
export const GARDENER_STEP_MS = 240;
export const GARDENER_RAKE_MS = 720;

export interface GardenerWeights {
  pressure: number;
  work: number;
  walking: number;
  bends: number;
  repetition: number;
  cohesion: number;
  variation: number;
}
export const GARDENER_WEIGHT_BOUNDS: Record<keyof GardenerWeights, readonly [number, number]> = {
  pressure: [1, 6],
  work: [0.4, 2],
  walking: [0.05, 0.4],
  bends: [0.1, 1],
  repetition: [0.5, 4],
  variation: [0, 0.15],
  cohesion: [0.05, 0.3],
};
export const DEFAULT_GARDENER_WEIGHTS: Readonly<GardenerWeights> = Object.freeze(profile);
export const GARDENER_PROFILE_ID = hashString(JSON.stringify(profile)).toString(36);
export const resolveGardenerWeights = (overrides: Partial<GardenerWeights> = {}): GardenerWeights =>
  Object.fromEntries(
    Object.entries(GARDENER_WEIGHT_BOUNDS).map(([name, [min, max]]) => {
      const key = name as keyof GardenerWeights;
      const value = overrides[key];
      return [
        key,
        Number.isFinite(value)
          ? Math.max(min, Math.min(max, value!))
          : DEFAULT_GARDENER_WEIGHTS[key],
      ];
    }),
  ) as unknown as GardenerWeights;

export interface GardenerOptions {
  budget?: number;
  limit?: number;
  from?: Position;
  seed?: number;
  memory?: GardenerMemory;
  weights?: Partial<GardenerWeights>;
}
export interface GardenerPlan {
  targets: Position[];
  goal?: Position;
  utility: number;
  candidates: number;
  metrics: {
    pressure: number;
    work: number;
    walking: number;
    bends: number;
    repetition: number;
    cohesion: number;
  };
}
const emptyPlan = (): GardenerPlan => ({
  targets: [],
  utility: 0,
  candidates: 0,
  metrics: { pressure: 0, work: 0, walking: 0, bends: 0, repetition: 0, cohesion: 0 },
});
const key = (p: Position) => `${p.posX},${p.posY}`;
const copyPosition = (p: Position): Position => ({ posX: p.posX, posY: p.posY });
const MAX_CANDIDATES = 8;

export const rakePaths = (
  map: readonly MapTile[],
  original: readonly MapTile[],
  targets: readonly Position[],
): MapTile[] =>
  map.map((tile) => {
    if (!canRakeTile(tile) || !targets.some((target) => manhattan(tile, target) === 0)) return tile;
    return {
      ...tile,
      laid: false,
      sprite: tileAt(original, tile)?.sprite === "sand-1" ? "sand-1" : "sand-0",
    };
  });

// Enumerate a bounded set of complete plans. The closest valid approach is mandatory;
// utility only chooses the additional work, never a different strategic objective.
export function chooseGardenerPlan(
  map: readonly MapTile[],
  _trail: readonly Position[],
  player: Position,
  turnNumber = 1,
  options: GardenerOptions = {},
): GardenerPlan {
  const limit = Math.max(0, Math.min(3, Math.floor(options.limit ?? (turnNumber > 1 ? 3 : 2))));
  if (!limit) return emptyPlan();
  const stones = map.filter((tile) => tile.stone !== undefined);
  const shrine = map.find((tile) => tile.shrine !== undefined);
  const feasible = (changed: readonly MapTile[]) =>
    options.budget === undefined ||
    !shrine ||
    tourCompletes(changed, player, stones, shrine, options.budget);
  if (!feasible(map)) return emptyPlan();
  const traversable = map.map((tile) => ({
    ...tile,
    sprite: canPaveTile(tile) ? "stone-slab" : tile.sprite,
  }));
  const goals = (stones.length ? stones : shrine ? [shrine] : [])
    .flatMap((goal) => {
      const distance = findWalkablePath(traversable, player, goal)?.length;
      const route = cheapestRoute(map, player, goal, GRID_SIZE * GRID_SIZE);
      return distance !== undefined && route ? [{ goal, distance, route }] : [];
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.route.cost - b.route.cost ||
        a.route.path.length - b.route.path.length ||
        a.goal.posX - b.goal.posX ||
        a.goal.posY - b.goal.posY,
    );
  const planner = createGardenerPlanner(map, player);
  const from = options.from;
  const reachable = (position: Position) =>
    !from || planner(from, [position], options.memory?.heading).at(-1)?.kind === "rake";
  const legal = (position: Position) => {
    const tile = tileAt(map, position);
    return !!tile && canRakeTile(tile) && manhattan(position, player) !== 0 && reachable(position);
  };
  const weights = resolveGardenerWeights(options.weights);
  for (const { goal, route } of goals) {
    const approaches = route.path.slice(0, -1).toReversed().filter(legal);
    const anchor = approaches.find((position) => feasible(rakePaths(map, map, [position])));
    if (!anchor) continue;
    // Raking the anchor can expose an equally economical alternative approach.
    const afterAnchor = rakePaths(map, map, [anchor]);
    const alternative =
      cheapestRoute(afterAnchor, player, goal, GRID_SIZE * GRID_SIZE)
        ?.path.slice(0, -1)
        .toReversed() ?? [];
    const pool = [
      ...new Map([...approaches, ...alternative.filter(legal)].map((p) => [key(p), p])).values(),
    ]
      .filter((p) => manhattan(p, anchor) !== 0)
      .sort((a, b) => manhattan(a, goal) - manhattan(b, goal) || key(a).localeCompare(key(b)))
      .slice(0, MAX_CANDIDATES - 1);
    const plans: GardenerPlan[] = [];
    const consider = (extras: Position[]) => {
      const targets = [...extras, anchor].map(copyPosition);
      // At most two extras: compare both orders, always finishing at the anchor.
      const orders =
        extras.length === 2 ? [targets, [targets[1], targets[0], targets[2]]] : [targets];
      let ordered = targets;
      let movement = { walking: 0, bends: 0 };
      if (from) {
        let bestCost = Infinity;
        for (const order of orders) {
          const actions = planner(from, order, options.memory?.heading);
          if (actions.filter((a) => a.kind === "rake").length !== order.length) continue;
          const measured = measureGardenerActions(actions, from, options.memory?.heading);
          const cost = measured.walking * weights.walking + measured.bends * weights.bends;
          if (cost < bestCost) {
            bestCost = cost;
            ordered = order;
            movement = measured;
          }
        }
        if (!Number.isFinite(bestCost)) return;
      }
      const changed = rakePaths(map, map, ordered);
      const nextRoute = cheapestRoute(changed, player, goal, GRID_SIZE * GRID_SIZE)!;
      const metrics = {
        pressure: nextRoute.cost - route.cost,
        work: ordered.length,
        cohesion: ordered.reduce((sum, p) => sum + manhattan(p, anchor), 0),
        walking: movement.walking,
        bends: movement.bends,
        repetition: ordered.reduce(
          (sum, p) => sum + recentRakeCost(options.memory, p, turnNumber),
          0,
        ),
      };
      const salt = `${options.seed ?? 0}:${turnNumber}:${key(player)}:${ordered.map(key).join(";")}`;
      const jitter = (createRng(hashString(salt))() - 0.5) * weights.variation;
      const utility =
        metrics.pressure * weights.pressure +
        metrics.work * weights.work -
        metrics.walking * weights.walking -
        metrics.bends * weights.bends -
        metrics.repetition * weights.repetition -
        metrics.cohesion * weights.cohesion +
        jitter;
      plans.push({ targets: ordered, goal: copyPosition(goal), utility, candidates: 0, metrics });
    };
    consider([]);
    for (let i = 0; i < pool.length && limit > 1; i++) {
      consider([pool[i]]);
      if (limit > 2) for (let j = i + 1; j < pool.length; j++) consider([pool[i], pool[j]]);
    }
    plans.sort((a, b) => b.utility - a.utility);
    // Check solvability in score order. We only return a verified plan; rejecting a
    // candidate cannot weaken the mandatory target or any of the terrain rules.
    for (const plan of plans) {
      if (feasible(rakePaths(map, map, plan.targets))) return { ...plan, candidates: plans.length };
    }
  }
  return emptyPlan();
}

export const chooseRakeTargets = (
  map: readonly MapTile[],
  trail: readonly Position[],
  player: Position,
  turnNumber = 1,
  options: GardenerOptions = {},
): Position[] => chooseGardenerPlan(map, trail, player, turnNumber, options).targets;
