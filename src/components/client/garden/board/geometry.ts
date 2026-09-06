import type { Direction, MapTile, Position } from "../types";

// Frozen: a 64x32 diamond drawn inside a 64x64 cell. Every sprite is authored to this.
const TILE_HALF_WIDTH = 32;
const TILE_HALF_HEIGHT = 16;
const TILE_FULL_WIDTH = 64;
const TILE_FULL_HEIGHT_WITH_PADDING = 90;
// A decor sprite is 64 tall and sits with its base at the tile's front vertex, so it
// reaches 32px above the tile's own box.
const DECOR_HEADROOM = 32;

// Fractional coordinates are legal: the walk tween interpolates between two tiles.
const toScreen = (
  posX: number,
  posY: number,
  offsetX: number,
  offsetY: number,
): { left: number; top: number } => ({
  left: (posX - posY) * TILE_HALF_WIDTH - offsetX,
  top: (posX + posY) * TILE_HALF_HEIGHT - offsetY,
});

const calculateMapDimensions = (
  map: readonly MapTile[],
): { height: number; width: number; offsetX: number; offsetY: number } => {
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let minY = Infinity;

  for (const tile of map) {
    const { left, top } = toScreen(tile.posX, tile.posY, 0, 0);
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, left);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, top);
  }

  // Decor hangs 32px above the tile it stands on, so the top row needs the same headroom
  // the bottom already gets. Without it anything tall on the back edge — a pine, and the
  // torii over the entrance especially — was sliced off at the map's top edge.
  return {
    height: maxY - minY + TILE_FULL_HEIGHT_WITH_PADDING + DECOR_HEADROOM,
    offsetX: minX,
    offsetY: minY - DECOR_HEADROOM,
    width: maxX - minX + TILE_FULL_WIDTH,
  };
};

const applyDirectionOffset = (direction: Direction, posX: number, posY: number): Position => {
  switch (direction) {
    case "N": {
      return { posX: posX - 1, posY };
    }
    case "S": {
      return { posX: posX + 1, posY };
    }
    case "E": {
      return { posX, posY: posY - 1 };
    }
    case "W": {
      return { posX, posY: posY + 1 };
    }
  }
};

const directionFromDelta = (from: Position, to: Position): Direction | undefined => {
  const dx = to.posX - from.posX;
  const dy = to.posY - from.posY;
  if (dx === -1 && dy === 0) {
    return "N";
  }
  if (dx === 1 && dy === 0) {
    return "S";
  }
  if (dx === 0 && dy === -1) {
    return "E";
  }
  if (dx === 0 && dy === 1) {
    return "W";
  }
  return undefined;
};

const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.posX - b.posX) + Math.abs(a.posY - b.posY);

export {
  DECOR_HEADROOM,
  TILE_FULL_HEIGHT_WITH_PADDING,
  TILE_FULL_WIDTH,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  applyDirectionOffset,
  calculateMapDimensions,
  directionFromDelta,
  manhattan,
  toScreen,
};
