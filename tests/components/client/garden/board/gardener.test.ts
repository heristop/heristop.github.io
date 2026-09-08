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
    expect(targets.map((p) => p.posX)).toEqual([7, 6]);
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
  }));
  map[2] = { ...map[2], sprite: "water-still", walkable: false };
  const player = { posX: 2, posY: 1 };
  const targets = [
    { posX: 4, posY: 0 },
    { posX: 4, posY: 2 },
  ];
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

it("prioritizes the closest stone even when farther stones share another approach", () => {
  const map = [
    ...Array.from({ length: 5 }, (_, x) => tile(x)),
    ...Array.from({ length: 8 }, (_, index) => tile(0, { posY: index + 3 })),
  ];
  map[4] = { ...map[4], stone: 0, laid: false };
  map[10] = { ...map[10], stone: 1, laid: false };
  map[12] = { ...map[12], stone: 2, laid: false };
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 3, posY: 2 }]);
});

it("switches to the gate approach once no stones remain", () => {
  const map = Array.from({ length: 8 }, (_, x) => tile(x));
  map[7] = tile(7, { shrine: "active", laid: false });
  expect(chooseRakeTargets(map, [], map[0], 1, { limit: 1 })).toEqual([{ posX: 6, posY: 2 }]);
});
