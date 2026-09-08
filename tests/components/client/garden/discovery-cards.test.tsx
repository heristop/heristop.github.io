import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DiscoveryCollection,
  DiscoveryReveal,
} from "../../../../src/components/client/garden/components/hud/discovery-cards";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("queues both discoveries and never replays them on ordinary rerenders", () => {
  const { rerender } = render(<DiscoveryReveal catMet={false} frogFreed={false} />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<DiscoveryReveal catMet frogFreed />);
  act(() => vi.advanceTimersByTime(1450));
  expect(screen.getByRole("status")).toHaveTextContent("Cat befriended");
  act(() => vi.advanceTimersByTime(2600));
  expect(screen.getByRole("status")).toHaveTextContent("Frog freed");
  act(() => vi.advanceTimersByTime(2600));
  rerender(<DiscoveryReveal catMet frogFreed />);
  expect(screen.queryByRole("status")).toBeNull();
});

it("clears a pending reveal on restart and lets the new run earn it again", () => {
  const { rerender } = render(<DiscoveryReveal catMet frogFreed />);
  rerender(<DiscoveryReveal catMet={false} frogFreed={false} />);
  act(() => vi.advanceTimersByTime(4000));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<DiscoveryReveal catMet={false} frogFreed />);
  expect(screen.getByRole("status")).toHaveTextContent("Frog freed");
});

it("keeps collected cards and shows the pair bonus only once both are earned", () => {
  const { rerender } = render(<DiscoveryCollection catMet frogFreed={false} />);
  expect(screen.getByText("Cat befriended")).toBeInTheDocument();
  expect(screen.getByText("Break the frog’s spell")).toBeInTheDocument();
  expect(screen.queryByText(/Pair complete/)).toBeNull();
  rerender(<DiscoveryCollection catMet frogFreed />);
  expect(screen.getByText("Pair complete · +200 bonus points")).toBeInTheDocument();
});

it("waits for the gardener and turn announcement before revealing a queued card", () => {
  const { rerender } = render(<DiscoveryReveal catMet frogFreed={false} paused />);
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<DiscoveryReveal catMet frogFreed={false} paused={false} />);
  act(() => vi.advanceTimersByTime(1400));
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(50));
  expect(screen.getByRole("status")).toHaveTextContent("Cat befriended");
});

it("keeps the secret out of the journal until the mermaid awakens", () => {
  const { rerender } = render(<DiscoveryCollection catMet={false} frogFreed />);
  expect(screen.queryByText("The Tidekeeper")).toBeNull();
  rerender(<DiscoveryCollection catMet={false} frogFreed mermaidAwakened />);
  expect(screen.getByText("The Tidekeeper")).toBeVisible();
  expect(screen.getByLabelText("2 of 3 cards discovered")).toBeVisible();
  expect(screen.getByText("Secret arcana")).toBeVisible();
});

it("reveals the secret only after the transformation signals completion", () => {
  const complete = vi.fn();
  const { rerender } = render(<DiscoveryReveal catMet={false} frogFreed onComplete={complete} />);
  act(() => vi.advanceTimersByTime(1450));
  expect(screen.getByRole("status")).toHaveTextContent("Frog freed");
  act(() => vi.advanceTimersByTime(2600));
  expect(complete).toHaveBeenCalledWith("frog");
  expect(screen.queryByRole("status")).toBeNull();
  act(() => vi.advanceTimersByTime(1600));
  rerender(<DiscoveryReveal catMet={false} frogFreed mermaidAwakened onComplete={complete} />);
  expect(screen.getByRole("status")).toHaveTextContent("The Tidekeeper");
  act(() => vi.advanceTimersByTime(2600));
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<DiscoveryReveal catMet={false} frogFreed mermaidAwakened onComplete={complete} />);
  expect(screen.queryByRole("status")).toBeNull();
});

it("absorbs clicks without dismissing the card or passing them to the game", () => {
  const click = vi.fn();
  const pointer = vi.fn();
  render(
    <div onClick={click} onPointerDown={pointer}>
      <DiscoveryReveal catMet frogFreed={false} />
    </div>,
  );
  act(() => vi.advanceTimersByTime(1450));
  const card = screen.getByText("The Familiar");
  fireEvent.pointerDown(card);
  fireEvent.click(card);
  expect(click).not.toHaveBeenCalled();
  expect(pointer).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toBeVisible();
  act(() => vi.advanceTimersByTime(2599));
  expect(screen.getByRole("status")).toBeVisible();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).toBeNull();
});
