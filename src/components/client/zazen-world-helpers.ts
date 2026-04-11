import type { Direction, MapTile, MoveResult, StoneConfig } from "./zazen-world-types";

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

const STONE_DECOR = "pierre-2";
const WALKABLE_DECORS: ReadonlySet<string> = new Set(["", STONE_DECOR]);

const STONES: readonly StoneConfig[] = [
  { posX: 5, posY: 6, line: "A path of stones —" },
  { posX: 7, posY: 5, line: "each one a breath held still" },
  { posX: 7, posY: 7, line: "between the pine and pond." },
  { posX: 9, posY: 5, line: "Evening light remembers" },
  { posX: 10, posY: 7, line: "the river's oldest vow." },
];

const SHRINE_POSITION = { posX: 10, posY: 6 };
const SHRINE_IMG_LOCKED = "dalle-2";
const SHRINE_IMG_ACTIVE = "dalle";

interface TerrainResult {
  img: string;
  decors: string;
  perso: number;
  stone?: number;
  shrine?: "locked" | "active";
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
  "10-5": { decors: "", img: "terre", perso: 0 },
};

const findStoneIndex = (posX: number, posY: number): number =>
  STONES.findIndex((stone) => stone.posX === posX && stone.posY === posY);

const isShrinePosition = (posX: number, posY: number): boolean =>
  posX === SHRINE_POSITION.posX && posY === SHRINE_POSITION.posY;

const getWaterImage = (posY: number): string => {
  if (posY === WATER_ROW_END) {
    return "eau-1";
  }
  return "eau-2";
};

const getTerrainVariant = (chance: number): string => {
  if (Math.random() > chance) {
    return "terre-2";
  }
  return "terre";
};

const getRandomDecor = (): string => {
  const decorOptions = ["arbre", "pierre"];
  return decorOptions[Math.floor(Math.random() * decorOptions.length)];
};

const isWaterRow = (posY: number): boolean =>
  posY >= WATER_ROW_START && posY <= WATER_ROW_END;

const isOuterEdge = (posX: number, posY: number, distance: number): boolean =>
  distance > DISTANCE_THRESHOLD ||
  posX <= OUTER_EDGE_LOW ||
  posX >= OUTER_EDGE_HIGH ||
  posY <= OUTER_EDGE_LOW ||
  posY >= OUTER_EDGE_HIGH;

const getProceduralTerrain = (posX: number, posY: number): TerrainResult => {
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

const generateTerrain = (posX: number, posY: number): TerrainResult => {
  const stoneIndex = findStoneIndex(posX, posY);
  if (stoneIndex !== -1) {
    return { decors: STONE_DECOR, img: "terre", perso: 0, stone: stoneIndex };
  }

  if (isShrinePosition(posX, posY)) {
    return { decors: "", img: SHRINE_IMG_LOCKED, perso: 0, shrine: "locked" };
  }

  const key = `${posX}-${posY}`;
  if (ORIGINAL_CONTENT[key] !== undefined) {
    return ORIGINAL_CONTENT[key];
  }
  return getProceduralTerrain(posX, posY);
};

const buildInitialMap = (): MapTile[] => {
  const result: MapTile[] = [];
  for (let posX = 1; posX <= GRID_SIZE; posX++) {
    for (let posY = 1; posY <= GRID_SIZE; posY++) {
      const { img, decors, perso, stone, shrine } = generateTerrain(posX, posY);
      const tile: MapTile = { decors, img, perso, posX, posY };
      if (stone !== undefined) {
        tile.stone = stone;
      }
      if (shrine !== undefined) {
        tile.shrine = shrine;
      }
      result.push(tile);
    }
  }
  return result;
};

const calculateMapDimensions = (map: MapTile[]): {
  height: number;
  width: number;
  offsetX: number;
  offsetY: number;
} => {
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

const applyDirectionOffset = (
  direction: Direction,
  posX: number,
  posY: number,
): { newX: number; newY: number } => {
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

const findTargetTile = (map: MapTile[], newX: number, newY: number): number =>
  map.findIndex(
    (tile) =>
      tile.posX === newX &&
      tile.posY === newY &&
      tile.perso === 0 &&
      WALKABLE_DECORS.has(tile.decors) &&
      !tile.img.includes("eau"),
  );

const performMove = (
  direction: Direction,
  characterPosition: { posX: number; posY: number },
  map: MapTile[],
): MoveResult | undefined => {
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

const isStoneTile = (tile: MapTile): boolean => tile.stone !== undefined;

const isShrineTile = (tile: MapTile): boolean => tile.shrine !== undefined;

const isWalkableTile = (tile: MapTile): boolean =>
  tile.perso === 0 && WALKABLE_DECORS.has(tile.decors) && !tile.img.includes("eau");

const directionFromDelta = (
  from: { posX: number; posY: number },
  to: { posX: number; posY: number },
): Direction | undefined => {
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

const collectStoneAt = (map: MapTile[], stoneIndex: number): MapTile[] =>
  map.map((tile) => {
    if (tile.stone === stoneIndex) {
      const next: MapTile = { ...tile, decors: "" };
      delete next.stone;
      return next;
    }
    return tile;
  });

const activateShrine = (map: MapTile[]): MapTile[] =>
  map.map((tile) => {
    if (tile.shrine !== undefined && isShrinePosition(tile.posX, tile.posY)) {
      return { ...tile, img: SHRINE_IMG_ACTIVE, shrine: "active" };
    }
    return tile;
  });

const handleKeyDirection = (
  ev: KeyboardEvent,
  move: (dir: Direction) => void,
): void => {
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

export type { Direction, MapTile, MoveResult, StoneConfig };
export {
  GRID_SIZE,
  ICON_SIZE,
  ICON_STROKE_WIDTH,
  SHRINE_POSITION,
  STONES,
  TILE_FULL_HEIGHT_WITH_PADDING,
  TILE_FULL_WIDTH,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  WALKABLE_DECORS,
  activateShrine,
  buildInitialMap,
  calculateMapDimensions,
  collectStoneAt,
  directionFromDelta,
  generateTerrain,
  handleKeyDirection,
  isShrineTile,
  isStoneTile,
  isWalkableTile,
  performMove,
};
