import { describe, expect, it } from "vitest";
import {
  chooseRakeTargets,
  planGardenerTurn,
  rakePaths,
} from "../../../../../src/components/client/garden/board/gardener";
import type { MapTile } from "../../../../../src/components/client/garden/types";
const tile = (posX: number, extra: Partial<MapTile> = {}): MapTile => ({
  posX,
  posY: 2,
  walkable: true,
  sprite: "stone-slab",
  decor: "",
  npc: 0,
  laid: true,
  ...extra,
});

describe("the gardener", () => {
  it("rakes free approaches to an uncollected stone while protecting the player and discoveries", () => {
    const map = Array.from({ length: 9 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
    map[8] = tile(8, { stone: 0, laid: false });
    map[4] = tile(4, { gathered: true });
    const targets = chooseRakeTargets(map, [], map[0]);
    expect(targets).toHaveLength(2);
    expect(targets.map((p) => p.posX)).toEqual([6, 7]);
    expect(targets.every((p) => p.posX > 1 && p.posX !== 4 && p.posX !== 8)).toBe(true);
    expect(rakePaths(map, map, targets)[7]).toMatchObject({ sprite: "sand-0", laid: false });
  });
  it("restores the original sand pattern without mutating the old map or neighbouring tiles", () => {
    const map = [tile(0), tile(1)];
    const original = [
      tile(0, { sprite: "sand-1", laid: false }),
      tile(1, { sprite: "sand-0", laid: false }),
    ];
    const result = rakePaths(map, original, [map[0]]);
    expect(result[0]).toMatchObject({ sprite: "sand-1", laid: false });
    expect(result[1]).toBe(map[1]);
    expect(map[0].laid).toBe(true);
  });
});

it("walks adjacent cells around obstacles before raking each target", () => {
  const map = Array.from({ length: 15 }, (_, index) => ({
    ...tile(index % 5),
    posY: Math.floor(index / 5),
    sprite: "sand-0",
    laid: false,
  }));
  map[2] = { ...map[2], sprite: "water-still", walkable: false };
  const player = { posX: 2, posY: 1 };
  const targets = [
    { posX: 4, posY: 0 },
    { posX: 4, posY: 2 },
  ];
  for (const target of targets) {
    const cell = map.find((tile) => tile.posX === target.posX && tile.posY === target.posY)!;
    cell.sprite = "moss-mid";
  }
  let position = { posX: 0, posY: 0 };
  const actions = planGardenerTurn(map, position, targets, player);
  expect(
    actions.filter((action) => action.kind === "rake").map((action) => action.position),
  ).toEqual(targets);
  for (const action of actions) {
    const distance =
      Math.abs(position.posX - action.position.posX) +
      Math.abs(position.posY - action.position.posY);
    expect(distance).toBe(action.kind === "walk" ? 1 : 0);
    expect(action.position).not.toEqual(player);
    expect(action.position).not.toEqual({ posX: 2, posY: 0 });
    position = action.position;
  }
});

it("escalates from two to three approaches, but respects the remaining route budget", () => {
  const map = Array.from({ length: 9 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
  map[7] = tile(7, { stone: 0, laid: false });
  map[8] = tile(8, { shrine: "locked", laid: false });
  expect(chooseRakeTargets(map, [], map[0], 1)).toHaveLength(2);
  expect(chooseRakeTargets(map, [], map[0], 2)).toHaveLength(3);
  expect(chooseRakeTargets(map, [], map[0], 2, { budget: 1 })).toHaveLength(1);
});

it("uses the closest stone to break ties between equally costly approaches", () => {
  const map = [
    ...Array.from({ length: 5 }, (_, x) => tile(x)),
    ...Array.from({ length: 8 }, (_, index) => tile(0, { posY: index + 3 })),
  ];
  map[4] = { ...map[4], stone: 0, laid: false };
  map[10] = { ...map[10], stone: 1, laid: false };
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 3, posY: 2 }]);
});

it("switches to the gate approach once no stones remain", () => {
  const map = Array.from({ length: 8 }, (_, x) => tile(x));
  map[7] = tile(7, { shrine: "active", laid: false });
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 6, posY: 2 }]);
});

it("rakes just before the nearest stone even when a farther route would cost more", () => {
  const map = [
    ...Array.from({ length: 12 }, (_, index) =>
      tile(index % 4, { posY: 2 + Math.floor(index / 4) }),
    ),
    ...Array.from({ length: 5 }, (_, index) => tile(0, { posY: 5 + index })),
  ];
  map[3] = { ...map[3], stone: 0, laid: false };
  map[16] = { ...map[16], stone: 1, laid: false };
  const targets = chooseRakeTargets(map, [], map[0], 1, { limit: 1 });
  expect(targets).toEqual([{ posX: 2, posY: 2 }]);
});

it("keeps the nearest stone ahead of a shared bottleneck toward farther stones", () => {
  const map = [
    ...Array.from({ length: 5 }, (_, x) => tile(x)),
    ...Array.from({ length: 8 }, (_, index) => tile(0, { posY: index + 3 })),
  ];
  map[4] = { ...map[4], stone: 0, laid: false };
  map[10] = { ...map[10], stone: 1, laid: false };
  map[12] = { ...map[12], stone: 2, laid: false };
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 3, posY: 2 }]);
});

it("ends at the last rake without a further blocking walk", () => {
  const map = Array.from({ length: 9 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
  map[8] = { ...map[8], stone: 0 };
  const actions = planGardenerTurn(map, map[7], [map[5], map[2]], map[0]);
  expect(
    actions.filter((action) => action.kind === "rake").map((action) => action.position),
  ).toEqual([map[5], map[2]]);
  expect(actions.at(-1)).toEqual({ kind: "rake", position: map[2] });
  expect(planGardenerTurn(map, map[7], [], map[0])).toEqual([]);
});

it("rakes between the player and the next stone even when only the adjacent crossing is available", () => {
  const map = [tile(0, { laid: false }), tile(1), tile(2, { stone: 0, laid: false })];
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 1, posY: 2 }]);
  expect(rakePaths(map, map, [map[1]])[0]).toBe(map[0]);
});

it("rakes the affordable route ahead instead of a more distant reward's approach behind the player", () => {
  const map = Array.from({ length: 9 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
  map[0] = { ...map[0], stone: 0 };
  map[8] = { ...map[8], stone: 1 };
  map[1] = { ...map[1], sprite: "sand-0" };
  const targets = chooseRakeTargets(map, [], map[4], 1, { limit: 1 });
  expect(targets[0].posX).toBeGreaterThan(4);
  expect(targets[0].posX).toBeLessThan(8);
});

it("prioritizes the nearest stone even when its route already crosses sand", () => {
  const map = Array.from({ length: 9 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
  map[0] = { ...map[0], stone: 0 };
  map[8] = { ...map[8], stone: 1 };
  map[2] = { ...map[2], sprite: "sand-0" };
  expect(chooseRakeTargets(map, [], map[3], 1, { limit: 1 })).toEqual([{ posX: 1, posY: 2 }]);
});

it.each(["sand-0", "sand-1"])("never schedules a rake on %s", (sprite) => {
  const map = [tile(0), tile(1, { sprite, laid: false }), tile(2, { stone: 0, laid: false })];
  expect(chooseRakeTargets(map, [], map[0])).toEqual([]);
  expect(planGardenerTurn(map, map[0], [map[1]], map[2])).toEqual([]);
  expect(rakePaths(map, map, [map[1]])[1]).toBe(map[1]);
});

it("works back from the stone to find firm ground when the last approach is sand", () => {
  const map = Array.from({ length: 6 }, (_, x) => tile(x, { laid: false, sprite: "moss-mid" }));
  map[5] = { ...map[5], stone: 0 };
  map[4] = { ...map[4], sprite: "sand-0" };
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 2 })).toEqual([
    { posX: 2, posY: 2 },
    { posX: 3, posY: 2 },
  ]);
});

it("minimizes walking between rake targets while finishing by the nearest stone", () => {
  const map = Array.from({ length: 16 }, (_, index) =>
    tile(index % 4, {
      posY: Math.floor(index / 4),
      sprite: "moss-mid",
      laid: false,
    }),
  );
  map[15] = { ...map[15], stone: 0 };
  const player = map[0];
  const from = map[12];
  const targets = chooseRakeTargets(map, [], player, 2, {
    from,
    limit: 3,
    weights: { work: 2, walking: 0.05, bends: 0.1, cohesion: 0.05, variation: 0 },
  });
  const actions = planGardenerTurn(map, from, targets, player);
  expect(targets).toHaveLength(3);
  expect(actions.filter((action) => action.kind === "walk").length).toBeLessThanOrEqual(6);
  expect(actions.at(-1)?.kind).toBe("rake");
  const last = targets.at(-1)!;
  expect(Math.abs(last.posX - 3) + Math.abs(last.posY - 3)).toBe(1);
});

it("uses the next reachable stone when the geometrically closest one is isolated", () => {
  const map = [
    ...Array.from({ length: 5 }, (_, posX) => tile(posX, { posY: 0, sprite: "moss-mid", laid: false })),
    tile(0, { posY: 2, stone: 0, laid: false }),
  ];
  map[4] = { ...map[4], stone: 1 };
  expect(chooseRakeTargets(map, [], map[0], 1, { from: map[1], limit: 1 }))
    .toEqual([{ posX: 3, posY: 0 }]);
});
