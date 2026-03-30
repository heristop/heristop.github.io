interface MapTile {
  posX: number;
  posY: number;
  img: string;
  perso: number;
  decors: string;
}

type Direction = "N" | "E" | "S" | "W";

interface MoveResult {
  newMap: MapTile[];
  newPosition: { posX: number; posY: number };
}

export type { MapTile, Direction, MoveResult };
