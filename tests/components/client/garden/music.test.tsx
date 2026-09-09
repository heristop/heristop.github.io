import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useGardenMusic from "../../../../src/components/client/garden/composables/use-music";

const track = {
  loop: false,
  volume: 1,
  preload: "",
  paused: true,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  removeAttribute: vi.fn(),
  load: vi.fn(),
};
beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  vi.clearAllMocks();
  vi.stubGlobal(
    "Audio",
    class {
      constructor() {
        return track;
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("starts only from its own toggle and stays independent from sound effects", () => {
  localStorage.setItem("path-stones:sound", "off");
  const { result, unmount } = renderHook(() => useGardenMusic());
  expect(result.current.musicOn).toBe(false);
  expect(track.play).not.toHaveBeenCalled();
  expect(track.loop).toBe(true);
  expect(track.volume).toBe(1);
  fireEvent.pointerDown(window);
  expect(track.play).not.toHaveBeenCalled();
  act(() => result.current.toggleMusic());
  expect(result.current.musicOn).toBe(true);
  expect(track.play).toHaveBeenCalledOnce();
  act(() => result.current.toggleMusic());
  expect(result.current.musicOn).toBe(false);
  const played = track.play.mock.calls.length;
  fireEvent.keyDown(window);
  expect(track.play).toHaveBeenCalledTimes(played);
  act(() => result.current.toggleMusic());
  expect(track.play).toHaveBeenCalledTimes(played + 1);
  expect(localStorage.getItem("path-stones:sound")).toBe("off");
  unmount();
  expect(track.removeAttribute).toHaveBeenCalledWith("src");
});

it.each(["on", "off"])("starts each visit disabled even when storage contains %s", (stored) => {
  localStorage.setItem("path-stones:music", stored);
  const { result, unmount } = renderHook(() => useGardenMusic());
  fireEvent.pointerDown(window);
  expect(result.current.musicOn).toBe(false);
  expect(track.play).not.toHaveBeenCalled();
  act(() => result.current.toggleMusic());
  expect(result.current.musicOn).toBe(true);
  unmount();
  track.play.mockClear();
  const nextVisit = renderHook(() => useGardenMusic());
  expect(nextVisit.result.current.musicOn).toBe(false);
  fireEvent.keyDown(window);
  expect(track.play).not.toHaveBeenCalled();
});

it("pauses while hidden and resumes only when enabled", () => {
  const { result } = renderHook(() => useGardenMusic());
  act(() => result.current.toggleMusic());
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  expect(track.pause).toHaveBeenCalled();
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  expect(track.play).toHaveBeenCalledTimes(2);
  act(() => result.current.toggleMusic());
  fireEvent(document, new Event("visibilitychange"));
  expect(track.play).toHaveBeenCalledTimes(2);
  hidden.mockRestore();
});
