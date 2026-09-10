import type { Direction, MapTile, Position } from "../types";
import { applyDirectionOffset, directionFromDelta, manhattan } from "./geometry";
import { canPaveTile, canRakeTile, isWalkableTile, tileAt } from "./rules";

export type GardenerAction = { kind: "walk" | "rake"; position: Position };
const directions = ["N", "E", "S", "W"] as const;
const key = (p: Position) => `${p.posX},${p.posY}`;
export const turnCost = (before: Direction | undefined, after: Direction): number => {
  if (!before || before === after) return 0;
  return ({ N: "S", S: "N", E: "W", W: "E" } as const)[before] === after ? 2 : 1;
};

export function measureGardenerActions(
  actions: readonly GardenerAction[],
  from: Position,
  heading?: Direction,
) {
  let walking = 0,
    bends = 0;
  let previous = from;
  for (const action of actions) {
    if (action.kind !== "walk") continue;
    const next = directionFromDelta(previous, action.position)!;
    bends += turnCost(heading, next);
    walking++;
    heading = next;
    previous = action.position;
  }
  return { walking, bends, heading };
}

// Shortest paths first; among equally short paths, minimize bends and preserve heading.
// Distance fields are shared by every candidate plan in this decision.
export function createGardenerPlanner(map: readonly MapTile[], player: Position) {
  const clear = new Map(
    map
      .filter((t) => manhattan(t, player) !== 0 && (isWalkableTile(t) || canPaveTile(t)))
      .map((t) => [key(t), t]),
  );
  const fields = new Map<string, Map<string, number>>();
  const routes = new Map<string, { path: Position[]; bends: number } | undefined>();
  const fieldFor = (to: Position) => {
    let field = fields.get(key(to));
    if (field) return field;
    field = new Map<string, number>();
    if (clear.has(key(to))) {
      field.set(key(to), 0);
      const queue = [to];
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i];
        for (const direction of directions) {
          const next = applyDirectionOffset(direction, p.posX, p.posY);
          if (!clear.has(key(next)) || field.has(key(next))) continue;
          field.set(key(next), field.get(key(p))! + 1);
          queue.push(next);
        }
      }
    }
    fields.set(key(to), field);
    return field;
  };
  const route = (
    from: Position,
    to: Position,
    heading?: Direction,
  ): { path: Position[]; bends: number } | undefined => {
    if (manhattan(from, to) === 0) return { path: [], bends: 0 };
    const memoKey = `${key(from)}:${key(to)}:${heading ?? ""}`;
    if (routes.has(memoKey)) return routes.get(memoKey);
    const field = fieldFor(to);
    const adjacent = directions.map((direction) => ({
      direction,
      next: applyDirectionOffset(direction, from.posX, from.posY),
    }));
    const distance =
      field.get(key(from)) ??
      Math.min(...adjacent.map(({ next }) => field.get(key(next)) ?? Infinity)) + 1;
    let best: { path: Position[]; bends: number } | undefined;
    for (const { direction, next } of adjacent) {
      if (!Number.isFinite(distance) || field.get(key(next)) !== distance - 1) continue;
      const rest = route(next, to, direction)!;
      const bends = turnCost(heading, direction) + rest.bends;
      if (!best || bends < best.bends) best = { path: [next, ...rest.path], bends };
    }
    routes.set(memoKey, best);
    return best;
  };
  return (from: Position, targets: readonly Position[], heading?: Direction): GardenerAction[] => {
    const actions: GardenerAction[] = [];
    let position = from;
    for (const target of targets) {
      const tile = tileAt(map, target);
      if (!tile || !canRakeTile(tile) || manhattan(target, player) === 0) continue;
      const path = route(position, target, heading)?.path;
      if (!path) continue;
      if (path.length)
        heading = directionFromDelta(path.length > 1 ? path.at(-2)! : position, path.at(-1)!);
      actions.push(...path.map((p) => ({ kind: "walk" as const, position: p })), {
        kind: "rake",
        position: target,
      });
      position = target;
    }
    return actions;
  };
}

export const planGardenerTurn = (
  map: readonly MapTile[],
  from: Position,
  targets: readonly Position[],
  player: Position,
  heading?: Direction,
): GardenerAction[] => createGardenerPlanner(map, player)(from, targets, heading);
