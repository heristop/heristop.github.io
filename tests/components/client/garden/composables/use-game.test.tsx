import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_SEED, STONE_COUNT } from "../../../../../src/components/client/garden/schema";
import { HAIKU_LINES, buildGarden } from "../../../../../src/components/client/garden/board/terrain";
import useZazenGame from "../../../../../src/components/client/garden/composables/use-game";

describe("useZazenGame", () => {
  it("starts the pilgrim on the seed's start tile", () => {
    const { start } = buildGarden(FALLBACK_SEED);
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    expect(result.current.position).toEqual(start);
  });

  it("refuses to walk off the edge of the board", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const corner = { posX: 0, posY: 0 };
    act(() => {
      result.current.teleportForTest(corner);
    });
    // From the outermost corner both of these leave the 12x12 grid entirely.
    act(() => {
      result.current.move("N");
    });
    expect(result.current.position).toEqual(corner);
    act(() => {
      result.current.move("E");
    });
    expect(result.current.position).toEqual(corner);
  });

  it("refuses to walk into the pond", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    // The pond fills the far border rows, so posY 10 -> 11 is always water.
    const bank = { posX: 0, posY: 9 };
    act(() => {
      result.current.teleportForTest(bank);
    });
    act(() => {
      result.current.move("W");
    });
    act(() => {
      result.current.move("W");
    });
    expect(result.current.position.posY).toBeLessThan(11);
  });

  it("gathers a stone, records its haiku line and announces it", () => {
    const onStoneCollected = vi.fn();
    const { result } = renderHook(() => useZazenGame({ onStoneCollected, seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.stonesFound).toHaveLength(1);
    expect(result.current.haikuLines[0].text).toBeTruthy();
    expect(result.current.announcement).toMatch(/stone 1 of 5/i);
    expect(onStoneCollected).toHaveBeenCalledWith(0);
  });

  it("names the day a stone came from, for screen readers", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.announcement).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(result.current.announcement).toMatch(/commits/);
  });

  // Stones sit on the busiest days, which has nothing to do with the order you walk
  // past them. The poem is the payoff of the page, so it has to read top to bottom
  // whatever route the player takes.
  it("assembles the poem in reading order however the stones are gathered", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    const backwards = [...stones].reverse();
    act(() => {
      for (const stone of backwards) {
        result.current.teleportForTest(stone);
      }
    });
    expect(result.current.haikuLines.map((line) => line.text)).toEqual([...HAIKU_LINES]);
  });

  it("gives the first stone gathered the first line, whichever stone it is", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[3]);
    });
    expect(result.current.haikuLines[0].text).toBe(HAIKU_LINES[0]);
    expect(result.current.announcement).toContain(HAIKU_LINES[0]);
  });

  it("wakes the shrine once every stone is gathered", () => {
    const onShrineActivated = vi.fn();
    const { result } = renderHook(() => useZazenGame({ onShrineActivated, seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      for (const stone of stones) {
        result.current.teleportForTest(stone);
      }
    });
    expect(result.current.stonesFound).toHaveLength(STONE_COUNT);
    expect(result.current.shrineActivated).toBe(true);
    expect(onShrineActivated).toHaveBeenCalledTimes(1);
  });

  it("opens the finale on reaching the woken shrine", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones, shrine } = buildGarden(FALLBACK_SEED);
    act(() => {
      for (const stone of stones) {
        result.current.teleportForTest(stone);
      }
    });
    act(() => {
      result.current.teleportForTest(shrine);
    });
    expect(result.current.finaleOpen).toBe(true);
  });

  it("does not open the finale while the shrine is still locked", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { shrine } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(shrine);
    });
    expect(result.current.finaleOpen).toBe(false);
  });

  it("counts a stone only once", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.stonesFound).toHaveLength(1);
  });

  // The score reads brevity off this counter, so a move that goes nowhere must not cost
  // anything — otherwise walking into the pond a few times quietly spends your bonus.
  it("counts arrivals, not attempts", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    expect(result.current.steps).toBe(0);
    const corner = { posX: 0, posY: 0 };
    act(() => {
      result.current.teleportForTest(corner);
    });
    const afterTeleport = result.current.steps;
    act(() => {
      result.current.move("N");
    });
    expect(result.current.position).toEqual(corner);
    expect(result.current.steps).toBe(afterTeleport);
  });

  // Nobody is told she is there, so nothing about the walk may depend on her — but
  // standing beside her has to actually do something, or the easter egg is only a sprite.
  it("turns the frog into a woman when you stand beside her, once", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { frog } = buildGarden(FALLBACK_SEED);
    const before = result.current.stonesLeft;
    act(() => {
      result.current.teleportForTest({ posX: frog.posX, posY: frog.posY - 1 });
    });
    expect(result.current.frogFreed).toBe(true);
    expect(result.current.stonesLeft).toBeGreaterThan(before);
    expect(result.current.map.some((tile) => tile.transformed === true)).toBe(true);

    const afterFirst = result.current.stonesLeft;
    act(() => {
      result.current.teleportForTest({ posX: frog.posX, posY: frog.posY - 1 });
    });
    expect(result.current.stonesLeft, "she does not pay twice").toBe(afterFirst);
  });

  // Gathering a stone hands one back. Without that the five stones are objectives; with
  // it they are fuel, and the order you take them in is the game.
  it("refunds a stone when one is gathered", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    const before = result.current.stonesLeft;
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.stonesLeft).toBeGreaterThan(before);
    expect(result.current.lastSupplyDelta).toBeGreaterThan(0);
  });

  it("falls back to a playable garden with no seed", () => {
    const { result } = renderHook(() => useZazenGame({}));
    expect(result.current.map.length).toBeGreaterThan(0);
  });
});
