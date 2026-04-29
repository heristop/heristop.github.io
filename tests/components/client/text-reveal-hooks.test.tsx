import { act, renderHook, waitFor } from "@testing-library/react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { beforeEach, describe, expect, it, vi } from "vitest";
import textRevealHooks from "../../../src/components/client/text-reveal-hooks";

const { useReducedMotion, useTextLayout } = textRevealHooks;

type MediaQueryListener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: (type: string, listener: MediaQueryListener) => void;
  removeEventListener: (type: string, listener: MediaQueryListener) => void;
}

const createMockMediaQueryList = (initial: boolean) => {
  const listeners = new Set<MediaQueryListener>();
  const mql: MockMediaQueryList = {
    matches: initial,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  const emit = (matches: boolean) => {
    mql.matches = matches;
    for (const listener of listeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  };
  return { mql, emit };
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(layoutWithLines).mockClear();
  vi.mocked(prepareWithSegments).mockClear();
});

describe("useReducedMotion", () => {
  it("returns false when matchMedia reports no preference", () => {
    const { mql } = createMockMediaQueryList(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when matchMedia reports reduced motion on mount", () => {
    const { mql } = createMockMediaQueryList(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reacts to change events", () => {
    const { mql, emit } = createMockMediaQueryList(false);
    vi.spyOn(window, "matchMedia").mockReturnValue(mql as unknown as MediaQueryList);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => {
      emit(true);
    });
    expect(result.current).toBe(true);
  });
});

describe("useTextLayout", () => {
  const makeContainerRef = () => {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetWidth", {
      configurable: true,
      value: 240,
    });
    return { current: element };
  };

  const mockMatchMedia = (coarsePointer: boolean) => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      const isReducedMotionQuery = query.includes("prefers-reduced-motion");
      const { mql } = createMockMediaQueryList(!isReducedMotionQuery && coarsePointer);
      return mql as unknown as MediaQueryList;
    });
  };

  it("uses a single browser-wrapped line on coarse pointer devices without Pretext", async () => {
    mockMatchMedia(true);
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useTextLayout("mobile smoke", "400 16px Comfortaa, sans-serif", 24, containerRef)
    );

    await waitFor(() => {
      expect(result.current.lines.map((line) => line.text)).toEqual(["mobile smoke"]);
    });
    expect(prepareWithSegments).not.toHaveBeenCalled();
    expect(layoutWithLines).not.toHaveBeenCalled();
  });

  it("keeps desktop line layout on Pretext", async () => {
    mockMatchMedia(false);
    vi.mocked(layoutWithLines).mockReturnValue({
      height: 24,
      lineCount: 1,
      lines: [{
        end: { graphemeIndex: 0, segmentIndex: 0 },
        start: { graphemeIndex: 0, segmentIndex: 0 },
        text: "measured desktop line",
        width: 120,
      }],
    });
    const containerRef = makeContainerRef();
    const { result } = renderHook(() =>
      useTextLayout("desktop smoke", "400 16px Comfortaa, sans-serif", 24, containerRef)
    );

    await waitFor(() => {
      expect(result.current.lines.map((line) => line.text)).toEqual(["measured desktop line"]);
    });
    expect(prepareWithSegments).toHaveBeenCalledWith("desktop smoke", "400 16px Comfortaa, sans-serif");
    expect(layoutWithLines).toHaveBeenCalled();
  });
});
