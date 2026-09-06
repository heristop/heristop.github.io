import type { GardenDay } from "./schema";

interface Position {
  posX: number;
  posY: number;
}

interface MapTile extends Position {
  // Ground sprite basename, resolved to /images/zazen/sol/<sprite>.png
  sprite: string;
  // Explicit, so nothing has to infer passability from a filename.
  walkable: boolean;
  // "" or a decor sprite basename, resolved to /images/zazen/decors/<decor>.png
  decor: string;
  // Decorative NPCs only. The player is a separate layer and is not stored on tiles.
  npc: number;
  stone?: number;
  laid?: boolean;
  // A stone was taken from here. The stone itself is gone from the tile the instant it is
  // gathered, so without this the board has nothing left to celebrate with.
  gathered?: boolean;
  // She was a frog here. Set once, so the transformation plays on the render it happens.
  transformed?: boolean;
  shrine?: "locked" | "active";
  day?: GardenDay;
}

type Direction = "N" | "E" | "S" | "W";

interface MoveResult {
  newMap: MapTile[];
  newPosition: Position;
}

interface HaikuEntry {
  stoneIndex: number;
  text: string;
  day?: GardenDay;
}

export type { Direction, HaikuEntry, MapTile, MoveResult, Position };
