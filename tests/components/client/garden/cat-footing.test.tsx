import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const updates = vi.hoisted(() => ({ revision: 0 }));
vi.mock("../../../../src/components/client/garden/composables/use-game", async (importOriginal) => {
  const { useMemo } = await import("react");
  const original = await importOriginal<
    typeof import("../../../../src/components/client/garden/composables/use-game")
  >();
  return {
    ...original,
    default: (options: Parameters<typeof original.default>[0]) => {
      const game = original.default(options);
      // A frog hop replaces the map even though the cat's footing remains firm.
      const map = useMemo(() => [...game.map], [game.map, updates.revision]);
      return { ...game, map };
    },
  };
});

import ZazenWorld from "../../../../src/components/client/garden/world";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  updates.revision = 0;
});

it("keeps a wandering cat on its current firm tile when the map updates", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { container, rerender } = render(<ZazenWorld />);
  const cat = container.querySelector<HTMLElement>(".zazen-world__cat")!;
  const position = () => [cat.style.left, cat.style.top];
  const start = position();
  act(() => vi.advanceTimersByTime(900));
  const wandered = position();
  expect(wandered).not.toEqual(start);
  updates.revision++;
  rerender(<ZazenWorld />);
  expect(position()).toEqual(wandered);
});
