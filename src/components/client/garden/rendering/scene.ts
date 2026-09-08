import type { MapTile, Position } from "../types";

export interface GardenScene {
  interaction?: { id: number; posX: number; posY: number; kind: "tree" | "stone" | "cat" | "frog" };
  map: readonly MapTile[];
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  pilgrim: Position;
  cat: Position;
  catFacingLeft: boolean;
  catGreeting: boolean;
  gardener: Position;
  gardenerFacingLeft: boolean;
  gardenerActivity: "idle" | "ready" | "walk" | "rake" | "attack";
  frog: Position;
  frogVisible: boolean;
  companionVisible: boolean;
  aquatic: boolean;
  transforming: boolean;
}

export interface GardenRenderer {
  update: (scene: GardenScene) => Promise<void>;
  destroy: () => void;
}
