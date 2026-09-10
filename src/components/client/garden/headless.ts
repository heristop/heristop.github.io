// Offline simulation entry point. Keep the website on index.ts so it cannot depend
// on game internals; keep training on this entry so Node never loads the renderer.
export { initialState, makeReducer, type GardenerController } from "./composables/use-game";
export { FALLBACK_SEED, GRID_SIZE, parseGardenSeed, type GardenSeed } from "./schema";
export type { Direction, MapTile, Position } from "./types";
export { buildGarden, randomizeFrog, tourCompletes, type GardenLayout } from "./board/terrain";
export { cheapestRoute } from "./board/routing";
export { canPaveTile, tileAt, findWalkablePath } from "./board/rules";
export { directionFromDelta, manhattan } from "./board/geometry";
export { createRng } from "./board/rng";
export { turnCost } from "./board/gardener-movement";
export {
  chooseRakeTargets,
  planGardenerTurn,
  DEFAULT_GARDENER_WEIGHTS,
  GARDENER_WEIGHT_BOUNDS,
  resolveGardenerWeights,
  type GardenerWeights,
} from "./board/gardener";
