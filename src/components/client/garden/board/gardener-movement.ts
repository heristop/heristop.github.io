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

interface Arrival {
  path: Position[];
  bends: number;
  heading?: Direction;
  order: string;
}

// Keep the best shortest approach for each arrival heading. A locally smooth
// approach can otherwise force a reversal on the next leg of the same turn.
// Distance fields and approaches are shared by every candidate plan in this decision.
export function createGardenerPlanner(map: readonly MapTile[], player: Position) {
  const clear = new Map(
    map
      .filter((t) => manhattan(t, player) !== 0 && (isWalkableTile(t) || canPaveTile(t)))
      .map((t) => [key(t), t]),
  );
  const fields = new Map<string, Map<string, number>>();
  const routes = new Map<string, Arrival[]>();
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
  const approaches = (from: Position, to: Position, heading?: Direction): Arrival[] => {
    if (manhattan(from, to) === 0) return [{ path: [], bends: 0, heading, order: "" }];
    const memoKey = `${key(from)}:${key(to)}:${heading ?? ""}`;
    const cached = routes.get(memoKey);
    if (cached) return cached;
    const field = fieldFor(to);
    const adjacent = directions.map((direction) => ({
      direction,
      next: applyDirectionOffset(direction, from.posX, from.posY),
    }));
    const distance =
      field.get(key(from)) ??
      Math.min(...adjacent.map(({ next }) => field.get(key(next)) ?? Infinity)) + 1;
    const best = new Map<Direction | undefined, Arrival>();
    for (const { direction, next } of adjacent) {
      if (!Number.isFinite(distance) || field.get(key(next)) !== distance - 1) continue;
      for (const rest of approaches(next, to, direction)) {
        const bends = turnCost(heading, direction) + rest.bends;
        const previous = best.get(rest.heading);
        if (!previous || bends < previous.bends)
          best.set(rest.heading, {
            path: [next, ...rest.path],
            bends,
            heading: rest.heading,
            order: `${directions.indexOf(direction)}${rest.order}`,
          });
      }
    }
    // Prefer the established local route if looking ahead cannot save any bends.
    const arrivals = [...best.values()].sort(
      (a, b) => a.bends - b.bends || a.order.localeCompare(b.order),
    );
    routes.set(memoKey, arrivals);
    return arrivals;
  };
  return (from: Position, targets: readonly Position[], heading?: Direction): GardenerAction[] => {
    const valid = targets.filter((target) => {
      const tile = tileAt(map, target);
      return tile && canRakeTile(tile) && manhattan(target, player) !== 0;
    });
    type Turn = { actions: GardenerAction[]; bends: number };
    const turns = new Map<string, Turn>();
    const finish = (index: number, position: Position, facing?: Direction): Turn => {
      if (index === valid.length) return { actions: [], bends: 0 };
      const memoKey = `${index}:${key(position)}:${facing ?? ""}`;
      const cached = turns.get(memoKey);
      if (cached) return cached;
      const target = valid[index];
      let best: Turn | undefined;
      for (const arrival of approaches(position, target, facing)) {
        const rest = finish(index + 1, target, arrival.heading);
        const bends = arrival.bends + rest.bends;
        if (!best || bends < best.bends)
          best = {
            bends,
            actions: [
              ...arrival.path.map((p) => ({ kind: "walk" as const, position: p })),
              { kind: "rake", position: target },
              ...rest.actions,
            ],
          };
      }
      // An unreachable target must not hide later reachable work.
      best ??= finish(index + 1, position, facing);
      turns.set(memoKey, best);
      return best;
    };
    return finish(0, from, heading).actions;
  };
}

export const planGardenerTurn = (
  map: readonly MapTile[],
  from: Position,
  targets: readonly Position[],
  player: Position,
  heading?: Direction,
): GardenerAction[] => createGardenerPlanner(map, player)(from, targets, heading);
