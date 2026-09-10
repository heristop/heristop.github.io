import type { Direction, Position } from "../types";
import { manhattan } from "./geometry";

export interface GardenerMemory {
  recentRakes: readonly { position: Position; turn: number }[];
  heading?: Direction;
}

export function rememberGardenerRake(
  memory: GardenerMemory,
  position: Position,
  turn: number,
): GardenerMemory {
  return {
    ...memory,
    recentRakes: [
      ...memory.recentRakes.filter(
        (entry) => turn - entry.turn < 2 && manhattan(entry.position, position) !== 0,
      ),
      { position: { ...position }, turn },
    ].slice(-9),
  };
}

export const recentRakeCost = (
  memory: GardenerMemory | undefined,
  position: Position,
  turn: number,
): number =>
  memory?.recentRakes.reduce((cost, entry) => {
    const age = turn - entry.turn;
    return (
      cost + (age >= 0 && age <= 2 && manhattan(entry.position, position) === 0 ? 1 / (age + 1) : 0)
    );
  }, 0) ?? 0;
