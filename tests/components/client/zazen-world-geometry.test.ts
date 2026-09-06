import { describe, expect, it } from "vitest";
import type { MapTile } from "../../../src/components/client/zazen-garden-types";
import {
  TILE_FULL_WIDTH,
  applyDirectionOffset,
  calculateMapDimensions,
  directionFromDelta,
  manhattan,
  toScreen,
} from "../../../src/components/client/zazen-world-geometry";

const tile = (posX: number, posY: number): MapTile => ({
  decor: "",
  npc: 0,
  posX,
  posY,
  sprite: "sand-0",
  walkable: true,
});

describe("toScreen", () => {
  it("projects the origin to the offset-corrected origin", () => {
    expect(toScreen(0, 0, 0, 0)).toEqual({ left: 0, top: 0 });
  });

  it("moves one tile east by half a tile width and half a tile height", () => {
    expect(toScreen(1, 0, 0, 0)).toEqual({ left: 32, top: 16 });
  });

  it("interpolates fractional coordinates for the walk tween", () => {
    expect(toScreen(0.5, 0, 0, 0)).toEqual({ left: 16, top: 8 });
  });

  it("subtracts the map offsets", () => {
    expect(toScreen(1, 1, 10, 20)).toEqual({ left: -10, top: 12 });
  });
});

describe("calculateMapDimensions", () => {
  it("spans a single tile by exactly one tile box", () => {
    const dims = calculateMapDimensions([tile(1, 1)]);
    expect(dims.width).toBe(TILE_FULL_WIDTH);
    expect(dims.offsetX).toBe(0);
  });

  it("grows with the map", () => {
    const small = calculateMapDimensions([tile(1, 1), tile(2, 2)]);
    const large = calculateMapDimensions([tile(1, 1), tile(6, 6)]);
    expect(large.height).toBeGreaterThan(small.height);
  });
});

describe("applyDirectionOffset", () => {
  it("maps each direction to the documented axis change", () => {
    expect(applyDirectionOffset("N", 5, 5)).toEqual({ posX: 4, posY: 5 });
    expect(applyDirectionOffset("S", 5, 5)).toEqual({ posX: 6, posY: 5 });
    expect(applyDirectionOffset("E", 5, 5)).toEqual({ posX: 5, posY: 4 });
    expect(applyDirectionOffset("W", 5, 5)).toEqual({ posX: 5, posY: 6 });
  });
});

describe("directionFromDelta", () => {
  it("recognises the four adjacent tiles", () => {
    const from = { posX: 5, posY: 5 };
    expect(directionFromDelta(from, { posX: 4, posY: 5 })).toBe("N");
    expect(directionFromDelta(from, { posX: 6, posY: 5 })).toBe("S");
    expect(directionFromDelta(from, { posX: 5, posY: 4 })).toBe("E");
    expect(directionFromDelta(from, { posX: 5, posY: 6 })).toBe("W");
  });

  it("returns undefined for non-adjacent tiles", () => {
    expect(directionFromDelta({ posX: 5, posY: 5 }, { posX: 7, posY: 5 })).toBeUndefined();
    expect(directionFromDelta({ posX: 5, posY: 5 }, { posX: 6, posY: 6 })).toBeUndefined();
  });
});

describe("manhattan", () => {
  it("sums the axis distances", () => {
    expect(manhattan({ posX: 1, posY: 1 }, { posX: 4, posY: 3 })).toBe(5);
  });
});
