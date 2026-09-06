import type { MapTile, Position } from "./zazen-garden-types";
import { applyDirectionOffset } from "./zazen-world-geometry";
import { canPaveTile, isWalkableTile } from "./zazen-world-rules";

// What a crossing costs in stepping stones. Firm ground is free; raked sand costs one
// stone, laid once and kept forever; water and the gate cost nothing because you cannot
// buy your way through them at all.
//
// This is the same search twice over. The terrain generator runs it to decide how many
// stones the garden hands you, so a lean fortnight is tight rather than impossible; and
// the board runs it to price a route before you commit to walking it. Both have to agree,
// or the garden promises a crossing it will not honour.
const DIRECTIONS = ["N", "E", "S", "W"] as const;

const positionKey = (position: Position): string => `${position.posX},${position.posY}`;

// A 0-1 BFS rather than Dijkstra: every edge costs either nothing or exactly one stone,
// so a deque is enough — free steps go to the front of the queue and paid steps to the
// back, and the first time a tile is settled it is settled at its true cost.
const cheapestCrossing = (
  map: readonly MapTile[],
  from: Position,
  to: Position,
): number | undefined => {
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const cost = new Map<string, number>([[positionKey(from), 0]]);
  const queue: Position[] = [from];
  const targetKey = positionKey(to);

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    const currentCost = cost.get(positionKey(current)) ?? Infinity;

    for (const direction of DIRECTIONS) {
      const next = applyDirectionOffset(direction, current.posX, current.posY);
      const nextKey = positionKey(next);
      const tile = byKey.get(nextKey);
      if (!tile) {
        continue;
      }
      const firm = isWalkableTile(tile);
      const pavable = canPaveTile(tile);
      if (!firm && !pavable) {
        continue;
      }
      const stepCost = firm ? 0 : 1;
      const candidate = currentCost + stepCost;
      if (candidate >= (cost.get(nextKey) ?? Infinity)) {
        continue;
      }
      cost.set(nextKey, candidate);
      if (stepCost === 0) {
        queue.unshift(next);
      } else {
        queue.push(next);
      }
    }
  }

  return cost.get(targetKey);
};

// The same search, but keeping the route it found. Ties on price are broken by length,
// so of two crossings that cost one stone you get the short one — a route that wanders
// for free still reads as the game not understanding what you asked for.
//
// The rank packs both into one number: stones in the high digits, steps in the low ones.
// STEP_SCALE only has to exceed the longest possible walk, and the board is 144 tiles.
const STEP_SCALE = 1000;

interface Route {
  path: Position[];
  cost: number;
}

const cheapestRoute = (
  map: readonly MapTile[],
  from: Position,
  to: Position,
  budget: number,
): Route | undefined => {
  const fromKey = positionKey(from);
  const targetKey = positionKey(to);
  if (fromKey === targetKey) {
    return { cost: 0, path: [] };
  }

  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const best = new Map<string, number>([[fromKey, 0]]);
  const parents = new Map<string, Position>();
  const queue: { key: string; position: Position; rank: number }[] = [
    { key: fromKey, position: from, rank: 0 },
  ];

  while (queue.length > 0) {
    queue.sort((left, right) => left.rank - right.rank);
    const current = queue.shift() as { key: string; position: Position; rank: number };
    if (current.rank > (best.get(current.key) ?? Infinity)) {
      continue;
    }

    for (const direction of DIRECTIONS) {
      const next = applyDirectionOffset(direction, current.position.posX, current.position.posY);
      const nextKey = positionKey(next);
      const tile = byKey.get(nextKey);
      if (!tile) {
        continue;
      }
      const firm = isWalkableTile(tile);
      const pavable = canPaveTile(tile);
      if (!firm && !pavable) {
        continue;
      }
      const rank = current.rank + (firm ? 1 : STEP_SCALE + 1);
      // Anything you cannot afford is not a route, it is a wish. Pruned here rather than
      // at the end so an unaffordable detour never wins on length.
      if (Math.floor(rank / STEP_SCALE) > budget) {
        continue;
      }
      if (rank >= (best.get(nextKey) ?? Infinity)) {
        continue;
      }
      best.set(nextKey, rank);
      parents.set(nextKey, current.position);
      queue.push({ key: nextKey, position: next, rank });
    }
  }

  const targetRank = best.get(targetKey);
  if (targetRank === undefined) {
    return undefined;
  }

  const path: Position[] = [];
  let cursor: Position | undefined = to;
  while (cursor && positionKey(cursor) !== fromKey) {
    path.unshift(cursor);
    cursor = parents.get(positionKey(cursor));
  }
  return { cost: Math.floor(targetRank / STEP_SCALE), path };
};

export type { Route };
export { cheapestCrossing, cheapestRoute };
