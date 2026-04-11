import type { Direction, MapTile, MoveResult } from "./zazen-world-types";

const CENTER_COORDINATE = 6.5;
const WATER_ROW_START = 8;
const WATER_ROW_END = 9;
const OUTER_EDGE_LOW = 2;
const OUTER_EDGE_HIGH = 11;
const DISTANCE_THRESHOLD = 7;
const OUTER_TERRAIN_CHANCE = 0.6;
const INNER_TERRAIN_CHANCE = 0.7;
const DECOR_CHANCE = 0.8;

const GRID_SIZE = 12;
const TILE_HALF_WIDTH = 32;
const TILE_HALF_HEIGHT = 16;
const TILE_FULL_WIDTH = 64;
const TILE_FULL_HEIGHT_WITH_PADDING = 90;
const ICON_SIZE = 16;
const ICON_STROKE_WIDTH = 2.5;

interface TerrainResult {
  img: string;
  decors: string;
  perso: number;
}

const ORIGINAL_CONTENT: Record<string, TerrainResult> = {
  "4-4": { decors: "pierre", img: "terre", perso: 0 },
  "4-5": { decors: "pierre", img: "terre", perso: 0 },
  "4-6": { decors: "", img: "terre", perso: 0 },
  "4-7": { decors: "arbre", img: "terre", perso: 0 },
  "4-8": { decors: "", img: "eau-2", perso: 0 },
  "4-9": { decors: "", img: "eau-1", perso: 0 },
  "5-4": { decors: "", img: "terre", perso: 0 },
  "5-5": { decors: "", img: "terre", perso: 1 },
  "5-6": { decors: "", img: "terre", perso: 0 },
  "5-7": { decors: "", img: "terre", perso: 0 },
  "5-8": { decors: "", img: "eau-2", perso: 0 },
  "5-9": { decors: "", img: "eau-1", perso: 0 },
  "6-4": { decors: "", img: "terre", perso: 0 },
  "6-5": { decors: "", img: "terre", perso: 0 },
  "6-6": { decors: "", img: "terre", perso: 0 },
  "6-7": { decors: "", img: "terre", perso: 0 },
  "6-8": { decors: "", img: "eau-2", perso: 0 },
  "6-9": { decors: "barque", img: "eau-1", perso: 0 },
  "7-4": { decors: "", img: "terre", perso: 0 },
  "7-5": { decors: "", img: "terre", perso: 0 },
  "7-6": { decors: "", img: "terre", perso: 0 },
  "7-7": { decors: "", img: "terre", perso: 0 },
  "7-8": { decors: "", img: "eau-2", perso: 0 },
  "7-9": { decors: "", img: "eau-1", perso: 0 },
  "8-4": { decors: "", img: "terre-2", perso: 0 },
  "8-5": { decors: "", img: "terre", perso: 0 },
  "8-6": { decors: "", img: "terre", perso: 3 },
  "8-7": { decors: "", img: "terre", perso: 2 },
  "8-8": { decors: "", img: "eau-2", perso: 0 },
  "8-9": { decors: "", img: "eau-1", perso: 0 },
  "9-4": { decors: "", img: "terre", perso: 0 },
  "9-5": { decors: "", img: "terre-2", perso: 0 },
  "9-6": { decors: "arbre", img: "terre", perso: 0 },
  "9-7": { decors: "", img: "terre", perso: 0 },
  "9-8": { decors: "", img: "eau-2", perso: 0 },
  "9-9": { decors: "", img: "eau-1", perso: 0 },
};

const getWaterImage = function getWaterImage(posY: number): string {
  if (posY === WATER_ROW_END) {
    return "eau-1";
  }
  return "eau-2";
};

const getTerrainVariant = function getTerrainVariant(chance: number): string {
  if (Math.random() > chance) {
    return "terre-2";
  }
  return "terre";
};

const getRandomDecor = function getRandomDecor(): string {
  const decorOptions = ["arbre", "pierre"];
  return decorOptions[Math.floor(Math.random() * decorOptions.length)];
};

const isWaterRow = function isWaterRow(posY: number): boolean {
  return posY >= WATER_ROW_START && posY <= WATER_ROW_END;
};

const isOuterEdge = function isOuterEdge(posX: number, posY: number, distance: number): boolean {
  return (
    distance > DISTANCE_THRESHOLD ||
    posX <= OUTER_EDGE_LOW ||
    posX >= OUTER_EDGE_HIGH ||
    posY <= OUTER_EDGE_LOW ||
    posY >= OUTER_EDGE_HIGH
  );
};

const getProceduralTerrain = function getProceduralTerrain(
  posX: number,
  posY: number,
): TerrainResult {
  const distanceFromCenter = Math.sqrt(
    (posX - CENTER_COORDINATE) ** 2 + (posY - CENTER_COORDINATE) ** 2,
  );
  let img = "terre";
  let decors = "";

  if (isWaterRow(posY)) {
    img = getWaterImage(posY);
  } else if (isOuterEdge(posX, posY, distanceFromCenter)) {
    img = getTerrainVariant(OUTER_TERRAIN_CHANCE);
  } else {
    img = getTerrainVariant(INNER_TERRAIN_CHANCE);
  }

  if (img.includes("terre") && Math.random() > DECOR_CHANCE) {
    decors = getRandomDecor();
  }

  return { decors, img, perso: 0 };
};

const generateTerrain = function generateTerrain(posX: number, posY: number): TerrainResult {
  const key = `${posX}-${posY}`;
  if (ORIGINAL_CONTENT[key] !== undefined) {
    return ORIGINAL_CONTENT[key];
  }
  return getProceduralTerrain(posX, posY);
};

const buildInitialMap = function buildInitialMap(): MapTile[] {
  const result: MapTile[] = [];
  for (let posX = 1; posX <= GRID_SIZE; posX++) {
    for (let posY = 1; posY <= GRID_SIZE; posY++) {
      const { img, decors, perso } = generateTerrain(posX, posY);
      result.push({ decors, img, perso, posX, posY });
    }
  }
  return result;
};

const calculateMapDimensions = function calculateMapDimensions(map: MapTile[]): {
  height: number;
  width: number;
  offsetX: number;
  offsetY: number;
} {
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let minY = Infinity;

  for (const tile of map) {
    const top = (tile.posX + tile.posY) * TILE_HALF_HEIGHT;
    const left = (tile.posX - tile.posY) * TILE_HALF_WIDTH;

    if (top < minY) {
      minY = top;
    }
    if (top > maxY) {
      maxY = top;
    }
    if (left < minX) {
      minX = left;
    }
    if (left > maxX) {
      maxX = left;
    }
  }

  const width = maxX - minX + TILE_FULL_WIDTH;
  const height = maxY - minY + TILE_FULL_HEIGHT_WITH_PADDING;

  return { height, width, offsetX: minX, offsetY: minY };
};

const applyDirectionOffset = function applyDirectionOffset(
  direction: Direction,
  posX: number,
  posY: number,
): { newX: number; newY: number } {
  let newX = posX;
  let newY = posY;
  switch (direction) {
    case "N": {
      newX -= 1;
      break;
    }
    case "E": {
      newY -= 1;
      break;
    }
    case "S": {
      newX += 1;
      break;
    }
    case "W": {
      newY += 1;
      break;
    }
  }
  return { newX, newY };
};

const findTargetTile = function findTargetTile(map: MapTile[], newX: number, newY: number): number {
  return map.findIndex(
    (tile) =>
      tile.posX === newX &&
      tile.posY === newY &&
      tile.perso === 0 &&
      tile.decors === "" &&
      !tile.img.includes("eau"),
  );
};

const performMove = function performMove(
  direction: Direction,
  characterPosition: { posX: number; posY: number },
  map: MapTile[],
): MoveResult | undefined {
  const { newX, newY } = applyDirectionOffset(
    direction,
    characterPosition.posX,
    characterPosition.posY,
  );
  const targetTileIndex = findTargetTile(map, newX, newY);

  if (targetTileIndex === -1) {
    return undefined;
  }

  const newMap = [...map];
  const currentIndex = map.findIndex(
    (tile) => tile.posX === characterPosition.posX && tile.posY === characterPosition.posY,
  );

  if (currentIndex === -1) {
    return undefined;
  }

  newMap[targetTileIndex] = { ...newMap[targetTileIndex], perso: 1 };
  newMap[currentIndex] = { ...newMap[currentIndex], perso: 0 };

  return { newMap, newPosition: { posX: newX, posY: newY } };
};

const handleKeyDirection = function handleKeyDirection(
  ev: KeyboardEvent,
  move: (dir: Direction) => void,
): void {
  switch (ev.key.toLowerCase()) {
    case "arrowup":
    case "w": {
      ev.preventDefault();
      move("N");
      break;
    }
    case "arrowdown":
    case "s": {
      ev.preventDefault();
      move("S");
      break;
    }
    case "arrowleft":
    case "a": {
      ev.preventDefault();
      move("W");
      break;
    }
    case "arrowright":
    case "d": {
      ev.preventDefault();
      move("E");
      break;
    }
  }
};

export type { Direction, MapTile, MoveResult };
export {
  GRID_SIZE,
  TILE_HALF_WIDTH,
  TILE_HALF_HEIGHT,
  TILE_FULL_WIDTH,
  TILE_FULL_HEIGHT_WITH_PADDING,
  ICON_SIZE,
  ICON_STROKE_WIDTH,
  generateTerrain,
  buildInitialMap,
  calculateMapDimensions,
  performMove,
  handleKeyDirection,
};
