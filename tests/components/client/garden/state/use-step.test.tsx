import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useZazenStep from "../../../../../src/components/client/garden/state/use-step";

describe("useZazenStep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rests on the given tile before any move", () => {
    const { result } = renderHook(() => useZazenStep({ posX: 3, posY: 3 }));
    expect(result.current.renderPosition).toEqual({ posX: 3, posY: 3 });
    expect(result.current.moving).toBe(false);
  });

  it("faces the direction it moved in", () => {
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 3, posY: 3 },
    });
    rerender({ posX: 4, posY: 3 });
    expect(result.current.facing).toBe("S");
    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ posX: 4, posY: 2 });
    expect(result.current.facing).toBe("E");
  });

  it("lands exactly on the target tile once the step finishes", () => {
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 3, posY: 3 },
    });
    rerender({ posX: 3, posY: 4 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.renderPosition).toEqual({ posX: 3, posY: 4 });
    expect(result.current.moving).toBe(false);
  });

  it("rests on frame zero when it is not moving", () => {
    const { result } = renderHook(() => useZazenStep({ posX: 1, posY: 1 }));
    expect(result.current.frame).toBe(0);
  });

  it("jumps straight to the target when the viewer prefers reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: query.includes("reduced-motion"),
          media: query,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 1, posY: 1 },
    });
    rerender({ posX: 2, posY: 1 });
    expect(result.current.renderPosition).toEqual({ posX: 2, posY: 1 });
    expect(result.current.moving).toBe(false);
  });
});
