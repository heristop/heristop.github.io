import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useZazenAudio from "../../../../src/components/client/garden/composables/use-audio";

afterEach(() => vi.unstubAllGlobals());

it("defers audio resources until enabled and keeps them across later mute toggles", async () => {
  const context = {
    state: "running",
    close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockResolvedValue({}),
  };
  const created = vi.fn();
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        created();
        return context;
      }
    },
  );
  const fetchSound = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(0),
  });
  vi.stubGlobal("fetch", fetchSound);
  const { rerender, unmount } = renderHook(({ enabled }) => useZazenAudio(enabled), {
    initialProps: { enabled: false },
  });
  expect(created).not.toHaveBeenCalled();
  expect(fetchSound).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(3));
  rerender({ enabled: false });
  rerender({ enabled: true });
  expect(created).toHaveBeenCalledOnce();
  expect(fetchSound).toHaveBeenCalledTimes(3);
  unmount();
  expect(context.close).toHaveBeenCalledOnce();
});

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
  act(() => result.current.stopEffects());
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  act(() => result.current.playVictory());
  rerender({ enabled: false });
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  act(() => {
    result.current.playReveal();
    result.current.playVictory();
  });
  expect(sources).toHaveLength(4);
  rerender({ enabled: true });
  context.state = "suspended";
  act(() => result.current.playAttack());
  expect(sources).toHaveLength(4);
  unmount();
  expect(context.close).toHaveBeenCalledOnce();
});

it("synthesizes a short reward and a sand impact, and resumes suspended audio", () => {
  const param = () => ({
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const nodes: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const node = () => {
    const value = {
      frequency: param(),
      gain: param(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    value.connect.mockReturnValue(value);
    nodes.push(value);
    return value;
  };
  const channel = new Float32Array(100);
  const context = {
    state: "suspended",
    currentTime: 5,
    sampleRate: 500,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(node),
    createGain: vi.fn(node),
    createBufferSource: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    createBuffer: vi.fn(() => ({ getChannelData: () => channel })),
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const { result, unmount } = renderHook(() => useZazenAudio());
  act(() => {
    result.current.playChime();
    result.current.playStoneDrop();
  });
  expect(context.resume).toHaveBeenCalled();
  expect(context.createOscillator).toHaveBeenCalledTimes(2);
  const scheduled = nodes.filter((n) => n.start.mock.calls.length);
  expect(scheduled).toHaveLength(3);
  expect(scheduled.every((n) => n.start.mock.calls[0][0] === 5)).toBe(true);
  expect(scheduled[0].stop.mock.calls[0][0]).toBeGreaterThan(5);
  expect(channel.some((value) => value !== 0)).toBe(true);
  act(() => window.dispatchEvent(new Event("pointerdown")));
  expect(context.resume).toHaveBeenCalledTimes(3);
  unmount();
});

it.each(["missing", "blocked"])("keeps gameplay calls safe when audio is %s", (kind) => {
  vi.stubGlobal(
    "AudioContext",
    kind === "missing"
      ? undefined
      : class {
          constructor() {
            throw new Error("blocked");
          }
        },
  );
  vi.stubGlobal("webkitAudioContext", undefined);
  const { result } = renderHook(() => useZazenAudio());
  expect(() => {
    result.current.playChime();
    result.current.playStoneDrop();
    result.current.playAttack();
  }).not.toThrow();
});
