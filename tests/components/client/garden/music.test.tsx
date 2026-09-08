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

it("waits for interaction, loops quietly and remembers its independent toggle", () => {
  localStorage.setItem("path-stones:sound", "off");
  const { result, unmount } = renderHook(() => useGardenMusic());
  expect(track.play).not.toHaveBeenCalled();
  expect(track.loop).toBe(true);
  expect(track.volume).toBe(1);
  fireEvent.pointerDown(window);
  expect(track.play).toHaveBeenCalledOnce();
  act(() => result.current.toggleMusic());
  expect(result.current.musicOn).toBe(false);
  expect(localStorage.getItem("path-stones:music")).toBe("off");
  const played = track.play.mock.calls.length;
  fireEvent.keyDown(window);
  expect(track.play).toHaveBeenCalledTimes(played);
  act(() => result.current.toggleMusic());
  expect(track.play).toHaveBeenCalledTimes(played + 1);
  expect(localStorage.getItem("path-stones:sound")).toBe("off");
  unmount();
  expect(track.removeAttribute).toHaveBeenCalledWith("src");
});

it("restores disabled music without starting it on interaction", () => {
  localStorage.setItem("path-stones:music", "off");
  const { result } = renderHook(() => useGardenMusic());
  fireEvent.pointerDown(window);
  expect(result.current.musicOn).toBe(false);
  expect(track.play).not.toHaveBeenCalled();
});

it("pauses while hidden and resumes only when enabled", () => {
  const { result } = renderHook(() => useGardenMusic());
  fireEvent.pointerDown(window);
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
