import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useHaikuAnimation from "../../../src/components/client/use-haiku-animation";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useHaikuAnimation", () => {
  it("starts with appeared=false and empty words when text is undefined", () => {
    const { result } = renderHook(() => useHaikuAnimation(undefined));
    expect(result.current.appeared).toBe(false);
    expect(result.current.words).toEqual([]);
  });

  it("builds word drifts when text is provided", () => {
    const { result } = renderHook(() => useHaikuAnimation("zen garden"));
    expect(result.current.words.length).toBeGreaterThan(0);
  });

  it("transitions appeared=true after the appear delay", () => {
    const { result } = renderHook(() => useHaikuAnimation("hi"));
    expect(result.current.appeared).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.appeared).toBe(true);
  });

  it("provides a non-empty charClass after appearance", () => {
    const { result } = renderHook(() => useHaikuAnimation("hi"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.charClass).not.toBe("");
  });
});
