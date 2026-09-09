import { act, render, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useRakeTrail from "../../../../../src/components/client/garden/composables/use-rake-trail";
import RakeTrails from "../../../../../src/components/client/garden/components/figures/rake-trails";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const map = Array.from({ length: 8 }, (_, posX) => ({
  posX,
  posY: 2,
  sprite: "sand-0",
  walkable: true,
  decor: "",
  npc: 0,
}));

it("leaves fading furrows on the sand behind the gardener, without changing terrain", () => {
  vi.useFakeTimers();
  const original = structuredClone(map);
  const { result, rerender } = renderHook(
    ({ x }) => useRakeTrail(map, { posX: x, posY: 2 }, "walk"),
    {
      initialProps: { x: 0 },
    },
  );
  expect(result.current).toEqual([]);
  rerender({ x: 1 });
  expect(result.current).toMatchObject([{ posX: 0, posY: 2, dx: 1, dy: 0 }]);
  const view = render(<RakeTrails trails={result.current} offsetX={0} offsetY={0} />);
  expect(view.container.querySelectorAll("polygon")).toHaveLength(3);
  expect(map).toEqual(original);
  for (let x = 2; x <= 6; x++) {
    act(() => vi.advanceTimersByTime(100));
    rerender({ x });
  }
  expect(result.current).toHaveLength(4);
  act(() => vi.advanceTimersByTime(800));
  expect(result.current).toEqual([]);
});

it.each(["moss-mid", "stone-slab", "sand-moss"])("leaves no sand trail on %s", (sprite) => {
  const { result, rerender } = renderHook(
    ({ x }) =>
      useRakeTrail(
        map.map((tile) => ({ ...tile, sprite })),
        { posX: x, posY: 2 },
        "walk",
      ),
    { initialProps: { x: 0 } },
  );
  rerender({ x: 1 });
  expect(result.current).toEqual([]);
});

it("clears trails for a new turn and ignores standing, paving and reset jumps", () => {
  const { result, rerender } = renderHook(
    ({ x, activity, laid }) =>
      useRakeTrail(
        map.map((tile) => ({ ...tile, laid })),
        { posX: x, posY: 2 },
        activity,
      ),
    {
      initialProps: { x: 0, activity: "walk", laid: false },
    },
  );
  rerender({ x: 1, activity: "walk", laid: false });
  expect(result.current).toHaveLength(1);
  rerender({ x: 1, activity: "ready", laid: false });
  expect(result.current).toEqual([]);
  rerender({ x: 2, activity: "idle", laid: false });
  rerender({ x: 3, activity: "walk", laid: true });
  rerender({ x: 7, activity: "walk", laid: false });
  expect(result.current).toEqual([]);
});

it("respects reduced motion", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
  const { result, rerender } = renderHook(
    ({ x }) => useRakeTrail(map, { posX: x, posY: 2 }, "walk"),
    {
      initialProps: { x: 0 },
    },
  );
  rerender({ x: 1 });
  expect(result.current).toEqual([]);
});
