import { act, cleanup, render, screen } from "@testing-library/react";
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
  act(() => vi.advanceTimersByTime(3600));
  expect(screen.getByRole("status")).toHaveTextContent("Frog freed");
  act(() => vi.advanceTimersByTime(3600));
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
