import type { MapTile, Position } from "../types";
import { cheapestCrossing } from "./routing";
import { applyDirectionOffset } from "./geometry";

export const MAX_GARDENER_TURNS = 3;

export const canReachNextReward = (
  map: readonly MapTile[],
  position: Position,
  supply: number,
  frog?: Position,
): boolean => {
  const stones = map.filter((tile) => tile.stone !== undefined);
  const goals: Position[] = stones.length ? stones : map.filter((tile) => tile.shrine === "active");
  if (frog)
    goals.push(
      ...(["N", "E", "S", "W"] as const).map((direction) =>
        applyDirectionOffset(direction, frog.posX, frog.posY),
      ),
    );
  return goals.some((goal) => {
    const cost = cheapestCrossing(map, position, goal);
    return cost !== undefined && cost <= supply;
  });
};
