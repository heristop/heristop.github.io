import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GRID_SIZE,
  buildInitialMap,
  calculateMapDimensions,
  generateTerrain,
  handleKeyDirection,
  performMove,
} from "../../../src/components/client/zazen-world-helpers";
import type { Direction, MapTile } from "../../../src/components/client/zazen-world-helpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateTerrain", () => {
  it("returns original content for known keys", () => {
    expect(generateTerrain(5, 5)).toEqual({ decors: "", img: "terre", perso: 1 });
    expect(generateTerrain(6, 9)).toEqual({ decors: "barque", img: "eau-1", perso: 0 });
  });

  it("returns procedural terrain for unknown keys", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const result = generateTerrain(1, 1);
    expect(result.perso).toBe(0);
    expect(typeof result.img).toBe("string");
  });

  it("returns a water image on water rows", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = generateTerrain(1, 9);
    expect(result.img).toBe("eau-1");
  });
});

describe("buildInitialMap", () => {
  it("builds a 12x12 grid", () => {
    const map = buildInitialMap();
    expect(map).toHaveLength(GRID_SIZE * GRID_SIZE);
    for (const tile of map) {
      expect(tile.posX).toBeGreaterThanOrEqual(1);
      expect(tile.posX).toBeLessThanOrEqual(GRID_SIZE);
      expect(tile.posY).toBeGreaterThanOrEqual(1);
      expect(tile.posY).toBeLessThanOrEqual(GRID_SIZE);
    }
  });

  it("places the player at 5-5 per ORIGINAL_CONTENT", () => {
    const map = buildInitialMap();
    const player = map.find((tile) => tile.perso === 1);
    expect(player?.posX).toBe(5);
    expect(player?.posY).toBe(5);
  });
});

describe("calculateMapDimensions", () => {
  it("returns positive width and height", () => {
    const map = buildInitialMap();
    const dims = calculateMapDimensions(map);
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });
});

describe("performMove", () => {
  const buildTinyMap = (): MapTile[] => [
    { posX: 1, posY: 1, perso: 1, decors: "", img: "terre" },
    { posX: 1, posY: 2, perso: 0, decors: "", img: "terre" },
    { posX: 2, posY: 1, perso: 0, decors: "", img: "terre" },
    { posX: 2, posY: 2, perso: 0, decors: "", img: "eau-1" },
    { posX: 3, posY: 1, perso: 0, decors: "arbre", img: "terre" },
  ];

  it("moves character onto a valid empty tile (W increments posY)", () => {
    const map = buildTinyMap();
    const result = performMove("W", { posX: 1, posY: 1 }, map);
    expect(result).toBeDefined();
    expect(result?.newPosition).toEqual({ posX: 1, posY: 2 });
    const newPlayer = result?.newMap.find((t) => t.perso === 1);
    expect(newPlayer).toMatchObject({ posX: 1, posY: 2 });
    const oldCell = result?.newMap.find((t) => t.posX === 1 && t.posY === 1);
    expect(oldCell?.perso).toBe(0);
  });

  it("returns undefined when target tile is water", () => {
    const map: MapTile[] = [
      { posX: 1, posY: 1, perso: 1, decors: "", img: "terre" },
      { posX: 1, posY: 2, perso: 0, decors: "", img: "eau-2" },
    ];
    expect(performMove("W", { posX: 1, posY: 1 }, map)).toBeUndefined();
  });

  it("returns undefined when target tile has decor", () => {
    const map: MapTile[] = [
      { posX: 1, posY: 1, perso: 1, decors: "", img: "terre" },
      { posX: 2, posY: 1, perso: 0, decors: "arbre", img: "terre" },
    ];
    expect(performMove("S", { posX: 1, posY: 1 }, map)).toBeUndefined();
  });

  it("returns undefined when target is off the map", () => {
    const map = buildTinyMap();
    expect(performMove("N", { posX: 1, posY: 1 }, map)).toBeUndefined();
  });
});

describe("handleKeyDirection", () => {
  const makeEvent = (key: string): KeyboardEvent => {
    const ev = new KeyboardEvent("keydown", { key });
    vi.spyOn(ev, "preventDefault");
    return ev;
  };

  it.each<[string, Direction]>([
    ["ArrowUp", "N"],
    ["w", "N"],
    ["W", "N"],
    ["ArrowDown", "S"],
    ["s", "S"],
    ["ArrowLeft", "W"],
    ["a", "W"],
    ["ArrowRight", "E"],
    ["d", "E"],
  ])("maps %s to direction %s", (key, expected) => {
    const move = vi.fn();
    const ev = makeEvent(key);
    handleKeyDirection(ev, move);
    expect(move).toHaveBeenCalledWith(expected);
    expect(ev.preventDefault).toHaveBeenCalled();
  });

  it("ignores unrelated keys", () => {
    const move = vi.fn();
    handleKeyDirection(makeEvent("Enter"), move);
    expect(move).not.toHaveBeenCalled();
  });
});
