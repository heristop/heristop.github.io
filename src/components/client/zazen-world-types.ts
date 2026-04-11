interface MapTile {
  posX: number;
  posY: number;
  img: string;
  perso: number;
  decors: string;
  stone?: number;
  shrine?: "locked" | "active";
}

type Direction = "N" | "E" | "S" | "W";

interface MoveResult {
  newMap: MapTile[];
  newPosition: { posX: number; posY: number };
}

interface StoneConfig {
  posX: number;
  posY: number;
  line: string;
}

interface HaikuEntry {
  stoneIndex: number;
  text: string;
}

interface GameState {
  map: MapTile[];
  characterPosition: { posX: number; posY: number } | undefined;
  mapDimensions: { height: number; width: number; offsetX: number; offsetY: number };
  stonesFound: readonly number[];
  shrineActivated: boolean;
  finaleOpen: boolean;
  haikuLines: readonly HaikuEntry[];
  announcement: string;
}

export type { Direction, GameState, HaikuEntry, MapTile, MoveResult, StoneConfig };
