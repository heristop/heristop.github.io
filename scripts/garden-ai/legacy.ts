import {
  GRID_SIZE,
  manhattan,
  cheapestRoute,
  tourCompletes,
  tileAt,
  findWalkablePath,
  canPaveTile,
  type MapTile,
  type Position,
} from "../../src/components/client/garden/headless";

export const GARDENER_REFILL = 2;
export const GARDENER_STEP_MS = 240;
export const GARDENER_RAKE_MS = 720;
export type GardenerAction = { kind: "walk" | "rake"; position: Position };

const canRakeTile = (tile: MapTile): boolean => {
  if (
    !tile.walkable ||
    tile.sprite === "sand-0" ||
    tile.sprite === "sand-1" ||
    tile.decor ||
    tile.npc ||
    tile.stone !== undefined ||
    tile.shrine ||
    tile.gathered ||
    tile.transformed
  )
    return false;
  return Boolean(
    tile.laid ||
    tile.sprite.startsWith("moss") ||
    tile.sprite === "sand-moss" ||
    (tile.sprite === "gravel-edge" &&
      tile.posX > 0 &&
      tile.posX < GRID_SIZE - 1 &&
      tile.posY > 0 &&
      tile.posY < GRID_SIZE - 1),
  );
};

export const planGardenerTurn = (
  map: readonly MapTile[],
  from: Position,
  targets: readonly Position[],
  player: Position,
): GardenerAction[] => {
  // The gardener can cross sand, but respects water, scenery and the player's tile.
  const ground = map.map((tile) => ({
    ...tile,
    sprite: canPaveTile(tile) ? "stone-slab" : tile.sprite,
    walkable: tile.walkable && manhattan(tile, player) !== 0,
  }));
  const actions: GardenerAction[] = [];
  let position = from;
  for (const target of targets) {
    const tile = tileAt(map, target);
    if (!tile || !canRakeTile(tile) || manhattan(target, player) === 0) continue;
    const path = findWalkablePath(ground, position, target);
    if (!path) continue;
    actions.push(...path.map((step) => ({ kind: "walk" as const, position: step })), {
      kind: "rake",
      position: target,
    });
    position = target;
  }
  return actions;
};

// At most three rakes: compare every visit order, keeping the closest finish first
// in the ranking, then minimizing actual walking around obstacles and the player.
const orderRakeTargets = (
  map: readonly MapTile[],
  traversable: readonly MapTile[],
  targets: Position[],
  player: Position,
  goal: Position,
  from?: Position,
): Position[] => {
  const distances = new Map(
    targets.map((target) => [
      target,
      findWalkablePath(traversable, target, goal)?.length ?? Infinity,
    ]),
  );
  let best = targets.toSorted((a, b) => distances.get(b)! - distances.get(a)!);
  if (!from || targets.length < 2) return best;
  const closest = Math.min(...distances.values());
  let fewestSteps = Infinity;
  const visit = (order: Position[], remaining: Position[]) => {
    if (remaining.length) {
      remaining.forEach((target, i) =>
        visit(
          [...order, target],
          remaining.filter((_, j) => i !== j),
        ),
      );
      return;
    }
    if (distances.get(order.at(-1)!) !== closest) return;
    const actions = planGardenerTurn(map, from, order, player);
    if (actions.filter((action) => action.kind === "rake").length !== targets.length) return;
    const steps = actions.length - targets.length;
    if (steps < fewestSteps) {
      best = order;
      fewestSteps = steps;
    }
  };
  visit([], best);
  return best;
};

// Target useful approaches, not arbitrary old slabs. Never remove a discovery or structure.
export const chooseRakeTargets = (
  map: readonly MapTile[],
  _trail: readonly Position[],
  player: Position,
  turnNumber = 1,
  options: { budget?: number; limit?: number; from?: Position } = {},
): Position[] => {
  const stones = map.filter((tile) => tile.stone !== undefined);
  const shrine = map.find((tile) => tile.shrine !== undefined);
  const goals = (stones.length ? stones : shrine ? [shrine] : []).toSorted(
    (a, b) => manhattan(player, a) - manhattan(player, b) || a.posX - b.posX || a.posY - b.posY,
  );
  if (!goals.length) return [];
  if (
    options.budget !== undefined &&
    shrine &&
    !tourCompletes(map, player, stones, shrine, options.budget)
  )
    return [];
  let working = [...map];
  const selected: Position[] = [];
  let focus: Position | undefined;
  const limit = Math.max(0, Math.min(3, options.limit ?? (turnNumber > 1 ? 3 : 2)));
  // Raking changes paving cost, never this graph's connectivity.
  const traversable = map.map((tile) => ({
    ...tile,
    sprite: canPaveTile(tile) ? "stone-slab" : tile.sprite,
  }));
  const goalDistances = new Map(
    goals.map((goal) => [goal, findWalkablePath(traversable, player, goal)?.length]),
  );
  for (let index = 0; index < limit; index++) {
    // Distance selects the stone; paving cost selects the player's route to it.
    // Keep these priorities separate so a distant bottleneck never wins on a score.
    const routes = goals
      .filter((goal) => !focus || manhattan(goal, focus) === 0)
      .flatMap((goal) => {
        const distance = goalDistances.get(goal);
        const route = cheapestRoute(working, player, goal, GRID_SIZE * GRID_SIZE);
        return distance !== undefined && route ? [{ ...route, goal, distance }] : [];
      })
      .sort((a, b) => a.distance - b.distance || a.cost - b.cost || a.path.length - b.path.length);
    const from = selected.at(-1) ?? options.from;
    const candidates = routes.flatMap((route) =>
      route.path
        .slice(0, -1)
        .toReversed()
        .map((position) => ({ position, goal: route.goal })),
    );
    let best: { tile: MapTile; changed: MapTile[]; goal: Position } | undefined;
    const examined = new Set<string>();
    for (const { position, goal } of candidates) {
      const key = `${position.posX},${position.posY}`;
      if (examined.has(key)) continue;
      examined.add(key);
      const tile = tileAt(working, position);
      if (
        !tile ||
        !canRakeTile(tile) ||
        manhattan(tile, player) === 0 ||
        selected.some((target) => manhattan(target, tile) === 0)
      )
        continue;
      if (from && !planGardenerTurn(working, from, [tile], player).length) continue;
      const changed = rakePaths(working, working, [tile]);
      if (
        options.budget !== undefined &&
        shrine &&
        !tourCompletes(changed, player, stones, shrine, options.budget)
      )
        continue;
      best = { tile, changed, goal };
      break;
    }
    if (!best) break;
    focus = best.goal;
    selected.push({ posX: best.tile.posX, posY: best.tile.posY });
    working = best.changed;
  }
  return focus ? orderRakeTargets(map, traversable, selected, player, focus, options.from) : [];
};

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
