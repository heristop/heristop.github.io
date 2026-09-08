import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type useGame from "../../../../src/components/client/garden/composables/use-game";
import type useGamepad from "../../../../src/components/client/garden/composables/use-gamepad";
import { positionForDay, cheapestRoute, isWalkableTile, manhattan } from "./model";

const harness = vi.hoisted(() => ({
  overrides: {} as Partial<ReturnType<typeof useGame>>,
  game: undefined as ReturnType<typeof useGame> | undefined,
  controls: undefined as Parameters<typeof useGamepad>[0] | undefined,
  callbacks: undefined as Parameters<typeof useGame>[0] | undefined,
  move: vi.fn(),
  restart: vi.fn(),
  audio: {
    playChime: vi.fn(),
    playStoneDrop: vi.fn(),
    playVictory: vi.fn(),
    playAttack: vi.fn(),
    playReveal: vi.fn(),
    stopEffects: vi.fn(),
  },
}));
vi.mock("../../../../src/components/client/garden/composables/use-audio", () => ({
  default: () => harness.audio,
}));
vi.mock("../../../../src/components/client/garden/composables/use-game", async (load) => {
  const original =
    await load<typeof import("../../../../src/components/client/garden/composables/use-game")>();
  return {
    ...original,
    default: (options: Parameters<typeof useGame>[0]) => {
      const game = original.default(options);
      harness.callbacks = options;
      harness.game = {
        ...game,
        phase: "player",
        move: harness.move,
        restart: harness.restart,
        ...harness.overrides,
      };
      return harness.game;
    },
  };
});
vi.mock("../../../../src/components/client/garden/composables/use-gamepad", () => ({
  default: (controls: Parameters<typeof useGamepad>[0]) => {
    harness.controls = controls;
    return "connected";
  },
}));
import World from "../../../../src/components/client/garden/world";

const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  HTMLElement.prototype.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  harness.overrides = {};
  harness.move.mockClear();
  harness.restart.mockClear();
  Object.values(harness.audio).forEach((sound) => sound.mockClear());
  vi.stubGlobal("localStorage", { getItem: vi.fn(() => null), setItem: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const [name, descriptor] of [
    ["scrollTo", scrollToDescriptor],
    ["scrollIntoView", scrollIntoViewDescriptor],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, name);
  }
  document.querySelector(".stone-game-help")?.remove();
});
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const tileElement = (container: HTMLElement, index: number) =>
  container.querySelectorAll<HTMLElement>(".zazen-world__tile")[index];

it("lets the inspect cursor walk history, clamps at its ends, and clears on escape", () => {
  harness.overrides = { stonesLeft: 1000 };
  const { container } = render(<World />);
  const map = screen.getByRole("application");
  map.focus();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(container.querySelector(".zazen-world__tile--inspected")).toBeTruthy();
  fireEvent.keyDown(window, { key: "Enter" });
  tick(190);
  expect(harness.move).toHaveBeenCalled();
  for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: "Tab" });
  expect(container.querySelectorAll(".zazen-world__tile--inspected")).toHaveLength(1);
  expect(container.querySelector(".path-stones__day-index")).toHaveTextContent("day 14 of 14");
  for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(container.querySelectorAll(".zazen-world__tile--inspected")).toHaveLength(1);
  expect(container.querySelector(".path-stones__day-index")).toHaveTextContent("day 1 of 14");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(container.querySelector(".zazen-world__tile--inspected")).toBeNull();
});

it("previews route costs, queues a click and cancels it with a manual compass move", () => {
  const { container } = render(<World />);
  const game = harness.game!;
  const index = game.map.findIndex((t) => {
    const r = cheapestRoute(game.map, game.position, t, 1000);
    return r && r.cost > 0;
  });
  const tile = tileElement(container, index);
  fireEvent.mouseEnter(tile);
  expect(container.querySelectorAll(".zazen-world__tile--preview-pave").length).toBeGreaterThan(0);
  fireEvent.click(tile);
  fireEvent.click(screen.getByRole("button", { name: /walk down and right/i }));
  tick(190);
  expect(harness.move).toHaveBeenCalledExactlyOnceWith("S");
  fireEvent.mouseLeave(tile);
  expect(container.querySelector(".zazen-world__tile--preview")).toBeNull();
});

it("describes an unaffordable preview without preventing the player from planning it", () => {
  harness.overrides = { stonesLeft: 0 };
  const { container } = render(<World />);
  const game = harness.game!;
  const index = game.map.findIndex((t) => {
    const r = cheapestRoute(game.map, game.position, t, 1000);
    return r && r.cost > 0;
  });
  fireEvent.mouseEnter(tileElement(container, index));
  expect(container.querySelector(".path-stones__quote")).toHaveTextContent(
    "walk until the gardener",
  );
  fireEvent.click(tileElement(container, index));
  tick(190);
  expect(harness.move).toHaveBeenCalled();
});

it("explains a click on the current tile and clears the refusal when the turn changes", () => {
  const { container, rerender } = render(<World />);
  const game = harness.game!;
  fireEvent.click(
    tileElement(
      container,
      game.map.findIndex((t) => manhattan(t, game.position) === 0),
    ),
  );
  expect(container.querySelector(".path-stones__quote")).toHaveTextContent("No way through");
  harness.overrides = { phase: "gardener" };
  rerender(<World />);
  expect(container.querySelector(".path-stones__quote")).not.toHaveTextContent("No way through");
});

it("selects a contribution day from the heatmap and stops a pending route at turn handover", () => {
  const { container, rerender } = render(<World />);
  const target = [...container.querySelectorAll<HTMLButtonElement>(".path-stones__heat-cell")].find(
    (_, i) => {
      const t = positionForDay(i);
      return cheapestRoute(harness.game!.map, harness.game!.position, t, 1000)?.path.length;
    },
  )!;
  fireEvent.click(target);
  harness.overrides = { phase: "gardener" };
  rerender(<World />);
  tick(500);
  expect(harness.move).not.toHaveBeenCalled();
  fireEvent.click(target);
  tick(500);
  expect(harness.move).not.toHaveBeenCalled();
});

it("recenters the board for touch and restores keyboard focus", () => {
  render(<World />);
  fireEvent.click(screen.getByRole("button", { name: /Find pilgrim/ }));
  expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: "auto" }),
  );
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  expect(screen.getByRole("application")).toHaveFocus();
});

it("maps controller help, cancel, sound and confirmation without moving through overlays", () => {
  const help = document.createElement("details");
  help.className = "stone-game-help";
  document.body.append(help);
  render(<World />);
  const controls = () => harness.controls!;
  expect(controls().canMove()).toBe(true);
  act(() => controls().help());
  expect(help.open).toBe(true);
  expect(controls().canMove()).toBe(false);
  act(() => controls().confirm());
  expect(help.open).toBe(false);
  act(() => controls().help());
  act(() => controls().cancel());
  expect(help.open).toBe(false);
  act(() => controls().move("W"));
  expect(harness.move).toHaveBeenCalledWith("W");
  const before = screen.getByRole("button", { name: /^Sound / }).getAttribute("aria-pressed");
  act(() => controls().sound());
  expect(screen.getByRole("button", { name: /^Sound / })).not.toHaveAttribute(
    "aria-pressed",
    before,
  );
  act(() => controls().confirm());
  expect(screen.getByRole("application")).toHaveFocus();
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  expect(controls().canMove()).toBe(false);
  input.remove();
});

it.each(["lost", "finale"] as const)(
  "replays %s with the controller and ignores help",
  (ending) => {
    harness.overrides = ending === "lost" ? { phase: "lost" } : { finaleOpen: true };
    render(<World />);
    expect(harness.controls!.canMove()).toBe(false);
    act(() => harness.controls!.help());
    act(() => harness.controls!.confirm());
    expect(harness.restart).toHaveBeenCalledOnce();
  },
);

it("shows a counterattack at the impacted tile for only the strike duration", () => {
  const { container, rerender } = render(<World />);
  harness.overrides = { attackTicks: 1 };
  rerender(<World />);
  expect(container.querySelector(".zazen-world__attack-loss")).toBeTruthy();
  tick(800);
  expect(container.querySelector(".zazen-world__attack-loss")).toBeNull();
});

it.each([false, true])("transforms the frog after its card, in place, aquatic=%s", (aquatic) => {
  const { container, rerender } = render(<World />);
  const game = harness.game!;
  const frog = game.map.find((t) =>
    aquatic ? t.sprite.startsWith("water") : isWalkableTile(t) && manhattan(t, game.position) > 2,
  )!;
  harness.overrides = { frog: { posX: frog.posX, posY: frog.posY }, frogFreed: true };
  rerender(<World />);
  expect(container.querySelector(".zazen-world__companion")).toBeNull();
  tick(1450);
  tick(2600);
  expect(container.querySelector(".zazen-world__companion")).toBeTruthy();
  expect(container.querySelector(".zazen-world__companion")).toHaveAttribute(
    "data-position",
    `${frog.posX},${frog.posY}`,
  );
  tick(1600);
  expect(
    container.querySelector('.garden-card[data-kind="mermaid"]')?.getAttribute("data-earned") ===
      "true",
  ).toBe(aquatic);
  harness.overrides = { frogFreed: false };
  rerender(<World />);
  expect(container.querySelector(".zazen-world__companion")).toBeNull();
});

it("shows spent and restored supply, collected stones and the awakened return objective", () => {
  const { container, rerender } = render(<World />);
  harness.overrides = {
    stonesFound: [0],
    stonesLaid: 1,
    stonesLeft: 1,
    supplyTicks: 1,
    lastSupplyDelta: -1,
  };
  act(() => harness.callbacks!.onStoneCollected?.(0));
  act(() => harness.callbacks!.onStoneLaid?.({ posX: 2, posY: 2 }));
  expect(harness.audio.playChime).toHaveBeenCalledOnce();
  expect(harness.audio.playStoneDrop).toHaveBeenCalledOnce();
  rerender(<World />);
  tick(30);
  expect(screen.getByLabelText("1 of 5 stones gathered")).toBeTruthy();
  expect(container.querySelector(".path-stones__gauge-delta")).toHaveTextContent("−1");
  expect(container.querySelector(".path-stones__pip--falling")).toBeTruthy();
  harness.overrides = {
    stonesFound: [0, 1, 2, 3, 4],
    stonesLeft: 2,
    supplyTicks: 2,
    lastSupplyDelta: 2,
    shrineActivated: true,
    gardenerTurns: 3,
  };
  rerender(<World />);
  expect(container.querySelector(".path-stones__gauge-delta")).toHaveTextContent("+2");
  expect(container.querySelector(".path-stones__scene-heading")).toHaveTextContent(
    "Reach the awakened shrine",
  );
  expect(container.querySelector(".path-stones__turn")).toHaveTextContent("No more refills");
  act(() => harness.callbacks!.onFinaleOpened?.());
  expect(harness.audio.playVictory).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Sound on" }));
  act(() => {
    harness.callbacks!.onStoneCollected?.(1);
    harness.callbacks!.onStoneLaid?.({ posX: 3, posY: 2 });
    harness.callbacks!.onFinaleOpened?.();
  });
  expect(harness.audio.playChime).toHaveBeenCalledOnce();
  expect(harness.audio.playStoneDrop).toHaveBeenCalledOnce();
  expect(harness.audio.playVictory).toHaveBeenCalledOnce();
});

it("announces gardener raking, marks the target and explains the following refill", () => {
  const { container, rerender } = render(<World />);
  const target = { posX: 2, posY: 2 };
  harness.overrides = {
    phase: "gardener",
    openingTurn: false,
    gardenerActivity: "rake",
    gardenerPosition: target,
    rakeTargets: [target],
  };
  rerender(<World />);
  expect(container.querySelector(".path-stones__turn")).toHaveTextContent("Raking this path");
  expect(container.querySelector(".path-stones__turn")).toHaveTextContent(
    "Your turn resumes with 2 stones",
  );
  expect(
    container.querySelector(".zazen-world__tile[data-working=true] .zazen-world__rake-dust"),
  ).toBeTruthy();
  expect(container.querySelector(".zazen-world__gardener-sweep")).toBeTruthy();
});

it("keeps the active actor inside a small camera viewport while respecting reduced motion", () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(180);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(600);
  const { rerender } = render(<World />);
  expect(HTMLElement.prototype.scrollTo).toHaveBeenCalledWith(
    expect.objectContaining({ behavior: "auto" }),
  );
  vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList);
  harness.overrides = { phase: "gardener", gardenerPosition: { posX: 9, posY: 9 } };
  rerender(<World />);
  expect(HTMLElement.prototype.scrollTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ behavior: "smooth" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Find pilgrim/ }));
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenLastCalledWith({
    block: "center",
    behavior: "smooth",
  });
  fireEvent(window, new Event("resize"));
});
