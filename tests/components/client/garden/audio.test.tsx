import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useZazenAudio from "../../../../src/components/client/garden/composables/use-audio";

afterEach(() => vi.unstubAllGlobals());

it("synchronizes hits, plays reveals immediately and cancels sound when muted", async () => {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "running",
    currentTime: 10,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockResolvedValue({}),
    createGain: () => gain,
    createBufferSource: () => {
      const source = { start: vi.fn(), stop: vi.fn(), connect: () => gain, disconnect: vi.fn() };
      sources.push(source);
      return source;
    },
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
  );
  const { result, rerender, unmount } = renderHook(({ enabled }) => useZazenAudio(enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(3));
  act(() => {
    result.current.playAttack();
    result.current.playReveal();
    result.current.playVictory();
  });
  expect(sources[0].start).toHaveBeenCalledWith(10.36);
  expect(sources[1].start).toHaveBeenCalledWith(10);
  expect(sources[2].start).toHaveBeenCalledWith(10);
  rerender({ enabled: false });
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  act(() => {
    result.current.playReveal();
    result.current.playVictory();
  });
  expect(sources).toHaveLength(3);
  rerender({ enabled: true });
  context.state = "suspended";
  act(() => result.current.playAttack());
  expect(sources).toHaveLength(3);
  unmount();
  expect(context.close).toHaveBeenCalledOnce();
});
