// The ground: what a tile is made of, what it costs to stand on, and how a route across
// it is priced. Nothing in here knows that a player exists.
export {
  DECOR_HEADROOM,
  applyDirectionOffset,
  calculateMapDimensions,
  directionFromDelta,
  manhattan,
  toScreen,
} from "./geometry";
export { createRng, hashString } from "./rng";
export {
  LAID_STONE_SPRITE,
  STONE_DECOR,
  activateShrine,
  canPaveTile,
  collectStoneAt,
  handleKeyDirection,
  isRakedSand,
  isWalkableTile,
  layStoneAt,
  performMove,
  tileAt,
} from "./rules";
export { cheapestCrossing, cheapestRoute } from "./routing";
export type { Route } from "./routing";
export {
  HAIKU_LINES,
  STONE_REFUEL,
  buildGarden,
  cellToPosition,
  dayIndexForPosition,
  dayIndexToCell,
  groundForCount,
  positionForDay,
  tileIndexForPosition,
  tourCompletes,
} from "./terrain";
export type { GardenLayout } from "./terrain";
