import { describe, expect, it } from "vitest";
import { canReachNextReward } from "../../../../../src/components/client/garden/board/challenge";
import type { MapTile } from "../../../../../src/components/client/garden/types";
const map: MapTile[] = [
  { posX: 0, posY: 0, walkable: true, sprite: "moss-mid", decor: "", npc: 0 },
  { posX: 1, posY: 0, walkable: true, sprite: "sand-0", decor: "", npc: 0 },
  { posX: 2, posY: 0, walkable: true, sprite: "moss-mid", decor: "stone-marker", npc: 0, stone: 0 },
];
describe("final round", () => {
  it("does not promise an unaffordable reward", () => {
    expect(canReachNextReward(map, map[0], 0)).toBe(false);
    expect(canReachNextReward(map, map[0], 1)).toBe(true);
  });
  it("allows free movement to a stone with an empty supply", () => {
    expect(
      canReachNextReward(
        map.map((tile) => ({ ...tile, sprite: "moss-mid" })),
        map[0],
        0,
      ),
    ).toBe(true);
  });
  it("keeps the frog rescue available as a last chance", () => {
    expect(canReachNextReward(map, map[0], 0, { posX: 0, posY: 1 })).toBe(true);
  });
  it("allows the final walk to the awakened shrine", () => {
    const shrineMap = map.map(({ stone, ...tile }) => ({
      ...tile,
      sprite: "moss-mid",
      decor: "",
      ...(tile.posX === 2 ? { shrine: "active" as const } : {}),
    }));
    expect(canReachNextReward(shrineMap, map[0], 0)).toBe(true);
  });
});
