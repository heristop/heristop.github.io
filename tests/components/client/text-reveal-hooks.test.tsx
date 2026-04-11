import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import textRevealHooks from "../../../src/components/client/text-reveal-hooks";

const { useReducedMotion } = textRevealHooks;

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
