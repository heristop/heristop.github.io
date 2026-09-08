import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import WebGLBoard from "../../../../../src/components/client/garden/rendering/webgl-board";
import type { GardenScene } from "../../../../../src/components/client/garden/rendering/scene";
const factory = vi.hoisted(() => vi.fn());
vi.mock("../../../../../src/components/client/garden/rendering/webgl-engine", () => ({
  createGardenRenderer: factory,
}));
const scene = { width: 768 } as GardenScene;
beforeEach(() => {
  factory.mockReset();
});
it("publishes readiness, forwards snapshots without recreating, and disposes on unmount", async () => {
  const renderer = { update: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() };
  factory.mockResolvedValue(renderer);
  const ready = vi.fn();
  const view = render(<WebGLBoard scene={scene} onReady={ready} />);
  await waitFor(() => expect(ready).toHaveBeenCalledWith(true));
  const next = { ...scene, width: 800 };
  view.rerender(<WebGLBoard scene={next} onReady={ready} />);
  await waitFor(() => expect(renderer.update).toHaveBeenLastCalledWith(next));
  expect(factory).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(renderer.destroy).toHaveBeenCalledTimes(1);
});
it("destroys late initialization after unmount without publishing readiness", async () => {
  let resolve!: (value: unknown) => void;
  factory.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const ready = vi.fn();
  const renderer = { update: vi.fn(), destroy: vi.fn() };
  const view = render(<WebGLBoard scene={scene} onReady={ready} />);
  await waitFor(() => expect(factory).toHaveBeenCalled());
  view.unmount();
  await act(async () => resolve(renderer));
  expect(renderer.destroy).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
});
it("preserves the fallback on initialization, context and snapshot failures", async () => {
  const ready = vi.fn();
  factory.mockRejectedValueOnce(new Error("unsupported"));
  const first = render(<WebGLBoard scene={scene} onReady={ready} />);
  await waitFor(() =>
    expect(first.container.firstChild).toHaveAttribute("data-status", "fallback"),
  );
  first.unmount();
  const renderer = { update: vi.fn().mockResolvedValue(undefined), destroy: vi.fn() };
  factory.mockResolvedValue(renderer);
  const second = render(<WebGLBoard scene={scene} onReady={ready} />);
  await waitFor(() => expect(second.container.firstChild).toHaveAttribute("data-status", "ready"));
  act(() => factory.mock.calls.at(-1)![2]());
  expect(renderer.destroy).toHaveBeenCalledOnce();
  expect(second.container.firstChild).toHaveAttribute("data-status", "fallback");
  second.unmount();
  renderer.update.mockResolvedValue(undefined);
  renderer.destroy.mockClear();
  const third = render(<WebGLBoard scene={scene} onReady={ready} />);
  await waitFor(() => expect(third.container.firstChild).toHaveAttribute("data-status", "ready"));
  renderer.update.mockRejectedValueOnce(new Error("missing texture"));
  third.rerender(<WebGLBoard scene={{ ...scene, width: 800 }} onReady={ready} />);
  await waitFor(() =>
    expect(third.container.firstChild).toHaveAttribute("data-status", "fallback"),
  );
  expect(ready).toHaveBeenLastCalledWith(false);
  expect(renderer.destroy).toHaveBeenCalledOnce();
});
