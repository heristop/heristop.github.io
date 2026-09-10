import { expect, it } from "vitest";
import {
  planGardenerTurn,
  type GardenerAction,
} from "../../../../../src/components/client/garden/board/gardener";
import type {
  Direction,
  MapTile,
  Position,
} from "../../../../../src/components/client/garden/types";

const p = (posX: number, posY: number): Position => ({ posX, posY });
const grid = (size: number): MapTile[] =>
  Array.from({ length: size * size }, (_, i) => ({
    ...p(i % size, Math.floor(i / size)),
    sprite: "moss-mid",
    walkable: true,
    decor: "",
    npc: 0,
  }));
const player = p(9, 9);
const vector: Record<Direction, readonly [number, number]> = {
  N: [-1, 0],
  E: [0, -1],
  S: [1, 0],
  W: [0, 1],
};
const cornerCost = (a: readonly number[] | undefined, b: readonly number[]) =>
  a ? 1 - a[0] * b[0] - a[1] * b[1] : 0;

it("anticipates the next rake instead of reaching the first one facing backwards", () => {
  const actions = planGardenerTurn(grid(2), p(0, 0), [p(1, 1), p(1, 0)], player);
  // Both approaches take three steps. Walking east in grid coordinates first
  // causes a reversal after the first rake; the other approach needs two corners.
  expect(actions).toEqual([
    { kind: "walk", position: p(0, 1) },
    { kind: "walk", position: p(1, 1) },
    { kind: "rake", position: p(1, 1) },
    { kind: "walk", position: p(1, 0) },
    { kind: "rake", position: p(1, 0) },
  ]);
});

it("keeps the established direction order when equally smooth approaches tie", () => {
  const blocked = new Set([2, 4, 8, 11, 12, 21, 24]);
  const map = grid(5).map((tile, index) => ({ ...tile, walkable: !blocked.has(index) }));
  const actions = planGardenerTurn(map, p(2, 4), [p(4, 2)], player);
  expect(actions).toEqual([
    { kind: "walk", position: p(2, 3) },
    { kind: "walk", position: p(3, 3) },
    { kind: "walk", position: p(4, 3) },
    { kind: "walk", position: p(4, 2) },
    { kind: "rake", position: p(4, 2) },
  ]);
});

// Independent exhaustive search of the entire walk, including ordered rake events.
// The production planner instead joins shortest-path fields for individual targets.
function optimalCost(map: MapTile[], from: Position, targets: Position[], heading?: Direction) {
  const open = new Set(
    map.filter((tile) => tile.walkable && !tile.decor).map((tile) => `${tile.posX},${tile.posY}`),
  );
  const queue = [
    {
      position: from,
      index: 0,
      heading: heading ? vector[heading] : undefined,
      steps: 0,
      bends: 0,
    },
  ];
  const best = new Map<string, { steps: number; bends: number }>();
  while (queue.length) {
    queue.sort((a, b) => a.steps - b.steps || a.bends - b.bends);
    const current = queue.shift()!;
    if (current.index === targets.length) return { steps: current.steps, bends: current.bends };
    const key = `${current.position.posX},${current.position.posY}:${current.index}:${current.heading}`;
    const old = best.get(key);
    if (
      old &&
      (old.steps < current.steps || (old.steps === current.steps && old.bends <= current.bends))
    )
      continue;
    best.set(key, current);
    const target = targets[current.index];
    if (current.position.posX === target.posX && current.position.posY === target.posY) {
      queue.push({ ...current, index: current.index + 1 });
      continue;
    }
    for (const nextHeading of Object.values(vector)) {
      const next = p(
        current.position.posX + nextHeading[0],
        current.position.posY + nextHeading[1],
      );
      if (!open.has(`${next.posX},${next.posY}`)) continue;
      queue.push({
        position: next,
        index: current.index,
        heading: nextHeading,
        steps: current.steps + 1,
        bends: current.bends + cornerCost(current.heading, nextHeading),
      });
    }
  }
  throw new Error("Unreachable test fixture");
}

function actualCost(actions: GardenerAction[], from: Position, initial?: Direction) {
  let previous = from;
  let heading: readonly number[] | undefined = initial ? vector[initial] : undefined;
  let steps = 0,
    bends = 0;
  for (const action of actions) {
    if (action.kind === "rake") continue;
    const next = [action.position.posX - previous.posX, action.position.posY - previous.posY];
    expect(Math.abs(next[0]) + Math.abs(next[1])).toBe(1);
    bends += cornerCost(heading, next);
    steps++;
    previous = action.position;
    heading = next;
  }
  return { steps, bends };
}

it("matches an exhaustive search across three rakes, incoming headings and obstacles", () => {
  for (const blocked of [false, true]) {
    const map = grid(3).map((tile) =>
      blocked && tile.posX === 1 && tile.posY === 1 ? { ...tile, walkable: false } : tile,
    );
    for (const heading of [undefined, "N", "E", "S", "W"] as const) {
      for (const targets of [
        [p(2, 2), p(0, 2), p(2, 0)],
        [p(1, 2), p(2, 0), p(0, 2)],
        [p(0, 0), p(2, 2), p(2, 0)],
      ]) {
        const actions = planGardenerTurn(map, p(0, 0), targets, player, heading);
        expect(
          actualCost(actions, p(0, 0), heading),
          JSON.stringify({ blocked, heading, targets }),
        ).toEqual(optimalCost(map, p(0, 0), targets, heading));
        expect(
          actions.filter((action) => action.kind === "rake").map((action) => action.position),
        ).toEqual(targets);
        expect(actions.at(-1)?.kind).toBe("rake");
        expect(
          actions.every((action) =>
            map.some(
              (tile) =>
                tile.walkable &&
                tile.posX === action.position.posX &&
                tile.posY === action.position.posY,
            ),
          ),
        ).toBe(true);
      }
    }
  }
});
