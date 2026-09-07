import { describe, expect, it, vi } from "vitest";
import type { MapTile } from "../../../../../src/components/client/garden/types";
import {
  activateShrine,
  canPaveTile,
  collectStoneAt,
  handleKeyDirection,
  isWalkableTile,
  layStoneAt,
  performMove,
  tileAt,
} from "../../../../../src/components/client/garden/board/rules";

const tile = (posX: number, posY: number, over: Partial<MapTile> = {}): MapTile => ({
  decor: "",
  npc: 0,
  posX,
  posY,
  // Moss by default: firm ground. Raked sand has to be asked for explicitly now, because
  // it is the obstacle rather than the floor.
  sprite: "moss-mid",
  walkable: true,
  ...over,
});

const grid = (): MapTile[] => [
  tile(1, 1),
  tile(1, 2),
  tile(2, 1, { sprite: "water-still", walkable: false }),
  tile(2, 2, { decor: "pine" }),
];

// The rule the whole game turns on: a day with no commits leaves raked sand, and sand is
// not walked through. It is not blocked either — it is the thing a stepping stone is for.
describe("raked sand", () => {
  it("refuses to be walked on", () => {
    expect(isWalkableTile(tile(1, 1, { sprite: "sand-0" }))).toBe(false);
  });

  it("may be paved, unlike water or the gate", () => {
    expect(canPaveTile(tile(1, 1, { sprite: "sand-0" }))).toBe(true);
    expect(canPaveTile(tile(1, 1, { sprite: "water-still", walkable: false }))).toBe(false);
    expect(canPaveTile(tile(1, 1, { sprite: "sand-0", decor: "torii" }))).toBe(false);
  });

  it("is not pavable once it is already firm", () => {
    expect(canPaveTile(tile(1, 1, { sprite: "moss-mid" }))).toBe(false);
  });

  it("becomes walkable for good once a stone is laid on it", () => {
    const before = [tile(1, 1, { sprite: "sand-0" })];
    expect(isWalkableTile(before[0])).toBe(false);
    const after = layStoneAt(before, { posX: 1, posY: 1 });
    expect(isWalkableTile(after[0])).toBe(true);
    expect(after[0].laid).toBe(true);
    // The original map is untouched, so a rejected move cannot half-pave the garden.
    expect(isWalkableTile(before[0])).toBe(false);
  });
});

describe("isWalkableTile", () => {
  it("accepts plain ground", () => {
    expect(isWalkableTile(tile(1, 1))).toBe(true);
  });

  it("rejects unwalkable ground", () => {
    expect(isWalkableTile(tile(1, 1, { walkable: false }))).toBe(false);
  });

  it("rejects a tile occupied by an npc", () => {
    expect(isWalkableTile(tile(1, 1, { npc: 2 }))).toBe(false);
  });

  it("rejects a tile blocked by decor but allows a stone marker", () => {
    expect(isWalkableTile(tile(1, 1, { decor: "pine" }))).toBe(false);
    expect(isWalkableTile(tile(1, 1, { decor: "stone-marker", stone: 0 }))).toBe(true);
  });
});

describe("tileAt", () => {
  it("finds a tile by position", () => {
    expect(tileAt(grid(), { posX: 1, posY: 2 })?.posY).toBe(2);
  });

  it("returns undefined off the map", () => {
    expect(tileAt(grid(), { posX: 9, posY: 9 })).toBeUndefined();
  });
});

describe("performMove", () => {
  it("moves west onto walkable ground", () => {
    const result = performMove("W", { posX: 1, posY: 1 }, grid());
    expect(result?.newPosition).toEqual({ posX: 1, posY: 2 });
  });

  it("refuses to move onto water", () => {
    expect(performMove("S", { posX: 1, posY: 1 }, grid())).toBeUndefined();
  });

  it("refuses to move off the map", () => {
    expect(performMove("N", { posX: 1, posY: 1 }, grid())).toBeUndefined();
  });

  it("refuses to move onto blocking decor", () => {
    expect(performMove("S", { posX: 1, posY: 2 }, grid())).toBeUndefined();
  });
});

describe("collectStoneAt", () => {
  it("clears the marker and the stone index", () => {
    const map = [tile(3, 3, { decor: "stone-marker", stone: 2 })];
    const next = collectStoneAt(map, 2);
    expect(next[0].decor).toBe("");
    expect(next[0].stone).toBeUndefined();
  });

  it("leaves other stones alone", () => {
    const map = [tile(3, 3, { decor: "stone-marker", stone: 1 })];
    expect(collectStoneAt(map, 2)[0].stone).toBe(1);
  });
});

describe("activateShrine", () => {
  it("switches the shrine sprite and state", () => {
    const map = [tile(4, 4, { shrine: "locked", sprite: "shrine-locked" })];
    const next = activateShrine(map, { posX: 4, posY: 4 });
    expect(next[0].shrine).toBe("active");
    expect(next[0].sprite).toBe("shrine-active");
  });
});

describe("handleKeyDirection", () => {
  it("maps wasd and arrows to directions", () => {
    const cases: [string, string][] = [
      ["w", "N"],
      ["ArrowUp", "N"],
      ["s", "S"],
      ["ArrowDown", "S"],
      ["a", "W"],
      ["ArrowLeft", "W"],
      ["d", "E"],
      ["ArrowRight", "E"],
    ];
    for (const [key, direction] of cases) {
      const move = vi.fn();
      const preventDefault = vi.fn();
      handleKeyDirection({ key, preventDefault } as unknown as KeyboardEvent, move);
      expect(move).toHaveBeenCalledWith(direction);
      expect(preventDefault).toHaveBeenCalled();
    }
  });

  it("leaves interactive controls and browser shortcuts alone", () => {
    const move = vi.fn();
    for (const tag of ["summary", "button", "a", "input"]) {
      const control = document.createElement(tag);
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true });
      control.addEventListener("keydown", (ev) => handleKeyDirection(ev as KeyboardEvent, move));
      control.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      const event = new KeyboardEvent("keydown", { key: "s", [modifier]: true, cancelable: true });
      handleKeyDirection(event, move);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(move).not.toHaveBeenCalled();
  });

  it("ignores unrelated keys", () => {
    const move = vi.fn();
    handleKeyDirection({ key: "q", preventDefault: vi.fn() } as unknown as KeyboardEvent, move);
    expect(move).not.toHaveBeenCalled();
  });
});
