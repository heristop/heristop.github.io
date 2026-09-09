import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../../../src/components/client/garden/composables/use-daily-haiku", () => ({
  default: () => undefined,
}));

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
import ZazenCat from "../../../../src/components/client/garden/components/figures/cat";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  updates.revision = 0;
});

it.each([false, true])("keeps the cat enlarged when facing left (walking: %s)", (walking) => {
  const style = document.createElement("style");
  style.textContent = ".zazen-world__cat { scale: 1.35; }";
  document.head.appendChild(style);
  try {
    const props = { position: { posX: 2, posY: 1 }, walking, greeting: false, offsetX: 0, offsetY: 0 };
    const { container, rerender } = render(<ZazenCat {...props} facingLeft={false} />);
    const cat = container.firstElementChild!;
    expect(getComputedStyle(cat).scale).toBe("1.35");
    rerender(<ZazenCat {...props} facingLeft />);
    expect(getComputedStyle(cat).scale).toBe("1.35");
    expect(getComputedStyle(cat).transform).toBe("scaleX(-1)");
  } finally {
    style.remove();
  }
});

it("keeps a wandering cat on its current firm tile when the map updates", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { container, rerender } = render(<ZazenWorld />);
  const cat = container.querySelector<HTMLElement>(".zazen-world__cat")!;
  const position = () => cat.style.translate;
  const start = position();
  act(() => vi.advanceTimersByTime(900));
  const wandered = position();
  expect(wandered).not.toEqual(start);
  updates.revision++;
  rerender(<ZazenWorld />);
  expect(position()).toEqual(wandered);
});

it("rediscovers the cat after restarting while it remains beside the starting pilgrim", () => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const { container } = render(<ZazenWorld />);
  const catCard = () =>
    container.querySelector('.garden-collection .garden-card[data-kind="cat"]');
  for (let tick = 0; tick < 30 && catCard()?.getAttribute("data-earned") !== "true"; tick++) {
    act(() => vi.advanceTimersByTime(900));
  }
  expect(catCard()).toHaveAttribute("data-earned", "true");
  fireEvent.click(screen.getByRole("button", { name: /Restart run/ }));
  expect(catCard()).toHaveAttribute("data-earned", "true");
});
