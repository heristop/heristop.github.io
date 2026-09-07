import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_SEED, STONE_COUNT } from "../../../../../src/components/client/garden/schema";
import {
  HAIKU_LINES,
  buildGarden,
} from "../../../../../src/components/client/garden/board/terrain";
import * as terrain from "../../../../../src/components/client/garden/board/terrain";
import useZazenGame from "../../../../../src/components/client/garden/composables/use-game";

function finishGardener(result: { current: ReturnType<typeof useZazenGame> }) {
  for (let tick = 0; tick < 100 && result.current.phase === "gardener"; tick++)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
}
function renderReadyGame(callback: () => ReturnType<typeof useZazenGame>) {
  const fake = vi.isFakeTimers();
  if (!fake) vi.useFakeTimers();
  const hook = renderHook(callback);
  finishGardener(hook.result);
  if (!fake) vi.useRealTimers();
  return hook;
}

it("opens with the gardener, locks movement and preserves all player supplies and refills", () => {
  vi.useFakeTimers();
  try {
    const { result, unmount } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const start = result.current.position;
    const supply = result.current.stonesLeft;
    expect(result.current.phase).toBe("gardener");
    expect(result.current.openingTurn).toBe(true);
    act(() => result.current.move("S"));
    expect(result.current.position).toEqual(start);
    finishGardener(result);
    expect(result.current.phase).toBe("player");
    expect(result.current.openingTurn).toBe(false);
    expect(result.current.stonesLeft).toBe(supply);
    expect(result.current.gardenerTurns).toBe(0);
    unmount();
  } finally {
    vi.useRealTimers();
  }
});

describe("useZazenGame", () => {
  it("starts the pilgrim on the seed's start tile", () => {
    const { start } = buildGarden(FALLBACK_SEED);
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    expect(result.current.position).toEqual(start);
  });

  it("refuses to walk off the edge of the board", () => {
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() =>
      useZazenGame({ onStoneCollected, seed: FALLBACK_SEED }),
    );
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[3]);
    });
    expect(result.current.haikuLines[0].text).toBe(HAIKU_LINES[0]);
    expect(result.current.announcement).toContain(HAIKU_LINES[0]);
  });

  it("wakes the shrine once every stone is gathered", () => {
    const onShrineActivated = vi.fn();
    const { result } = renderReadyGame(() =>
      useZazenGame({ onShrineActivated, seed: FALLBACK_SEED }),
    );
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { shrine } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(shrine);
    });
    expect(result.current.finaleOpen).toBe(false);
  });

  it("counts a stone only once", () => {
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
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
  it("moves the frog to a different bank on restart and keeps exactly one frog", () => {
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    const previous = result.current.frog;
    act(() => {
      result.current.restart();
    });
    expect(result.current.frog).not.toEqual(previous);
    expect(result.current.map.filter((tile) => tile.decor === "frog")).toHaveLength(1);
    expect(result.current.frogFreed).toBe(false);
  });

  it("turns the frog into a woman when you stand beside her, once", () => {
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { frog } = result.current;
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
    const { result } = renderReadyGame(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones } = buildGarden(FALLBACK_SEED);
    const before = result.current.stonesLeft;
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.stonesLeft).toBeGreaterThan(before);
    expect(result.current.lastSupplyDelta).toBeGreaterThan(0);
  });

  it("falls back to a playable garden with no seed", () => {
    const { result } = renderReadyGame(() => useZazenGame({}));
    expect(result.current.map.length).toBeGreaterThan(0);
  });
});

describe("gardener turns", () => {
  it("keeps the player's turn when the last lay immediately collects a stone", () => {
    const layout = buildGarden(FALLBACK_SEED);
    const start = { posX: 1, posY: 1 };
    const target = { posX: 2, posY: 1 };
    const map = layout.map.map((tile) =>
      tile.posX === target.posX && tile.posY === target.posY
        ? { ...tile, sprite: "sand-0", walkable: true, npc: 0, decor: "stone-marker", stone: 0 }
        : tile,
    );
    const mock = vi
      .spyOn(terrain, "buildGarden")
      .mockReturnValue({ ...layout, map, start, stoneBudget: 1 });
    try {
      const { result, unmount } = renderReadyGame(() => useZazenGame());
      act(() => result.current.move("S"));
      expect(result.current.stonesFound).toContain(0);
      expect(result.current.stonesLeft).toBe(1);
      finishGardener(result);
      expect(result.current.phase).toBe("player");
      expect(result.current.gardenerTurns).toBe(0);
      unmount();
    } finally {
      mock.mockRestore();
    }
  });

  const spendOne = (game: ReturnType<typeof useZazenGame>) => {
    const target = game.map.find(
      (tile) =>
        (tile.sprite === "sand-0" || tile.sprite === "sand-1") &&
        tile.walkable &&
        tile.decor === "" &&
        tile.npc === 0 &&
        tile.stone === undefined &&
        Math.abs(tile.posX - game.frog.posX) + Math.abs(tile.posY - game.frog.posY) > 2,
    )!;
    act(() => game.teleportForTest({ posX: target.posX - 1, posY: target.posY }));
    return target;
  };

  it("hands over at zero, locks movement, rakes and refills once", () => {
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderReadyGame(() => useZazenGame());
      while (result.current.stonesLeft > 0) {
        spendOne(result.current);
        act(() => result.current.move("S"));
      }
      expect(result.current.phase).toBe("gardener");
      expect(result.current.gardenerTurns).toBe(1);
      const position = result.current.position;
      const steps = result.current.steps;
      act(() => {
        result.current.move("N");
        result.current.move("E");
      });
      expect(result.current.position).toEqual(position);
      expect(result.current.steps).toBe(steps);
      const targets = result.current.rakeTargets;
      for (let tick = 0; tick < 100 && result.current.phase === "gardener"; tick++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(result.current.phase).toBe("player");
      expect(result.current.stonesLeft).toBe(2);
      expect(result.current.gardenerTurns).toBe(1);
      for (const target of targets) {
        expect(
          result.current.map.find((tile) => tile.posX === target.posX && tile.posY === target.posY)
            ?.laid,
        ).toBe(false);
      }
      expect(
        result.current.map.find(
          (tile) => tile.posX === position.posX && tile.posY === position.posY,
        )?.laid,
      ).toBe(true);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the pending gardener action when restarting", () => {
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderReadyGame(() => useZazenGame());
      const supply = result.current.stonesLeft;
      while (result.current.stonesLeft > 0) {
        spendOne(result.current);
        act(() => result.current.move("S"));
      }
      act(() => result.current.restart());
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      finishGardener(result);
      expect(result.current.phase).toBe("player");
      expect(result.current.gardenerTurns).toBe(0);
      expect(result.current.stonesLeft).toBe(supply);
      expect(result.current.map.some((tile) => tile.laid)).toBe(false);
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

it("ends an exhausted final round and resets the refill limit on replay", () => {
  vi.useFakeTimers();
  const layout = buildGarden(FALLBACK_SEED);
  const map = Array.from({ length: 24 }, (_, posX) => ({
    posX,
    posY: 0,
    walkable: true,
    sprite: posX === 0 ? "moss-mid" : "sand-0",
    decor: posX === 23 ? "stone-marker" : "",
    npc: 0,
    ...(posX === 23 ? { stone: 0 } : {}),
  }));
  const mock = vi
    .spyOn(terrain, "buildGarden")
    .mockReturnValue({ ...layout, map, start: map[0], stoneBudget: 1 });
  try {
    const { result, unmount } = renderReadyGame(() => useZazenGame());
    for (let tick = 0; tick < 50 && result.current.phase !== "lost"; tick++) {
      if (result.current.phase === "gardener")
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      else act(() => result.current.move("S"));
    }
    expect(result.current.phase).toBe("lost");
    expect(result.current.gardenerTurns).toBe(3);
    expect(result.current.stonesLeft).toBe(0);
    const position = result.current.position;
    act(() => result.current.move("N"));
    expect(result.current.position).toEqual(position);
    act(() => result.current.restart());
    expect(result.current.phase).toBe("gardener");
    finishGardener(result);
    expect(result.current.phase).toBe("player");
    expect(result.current.gardenerTurns).toBe(0);
    expect(result.current.stonesLeft).toBe(1);
    unmount();
  } finally {
    mock.mockRestore();
    vi.useRealTimers();
  }
});
