import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TurnAnnouncement from "../../../../src/components/client/garden/components/hud/turn-announcement";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("gives each turn a full announcement without restarting on ordinary renders", () => {
  const { container, rerender } = render(<TurnAnnouncement phase="player" round={1} opening />);
  const announcement = () => container.querySelector(".path-stones__turn-announcement");
  expect(announcement()).not.toBeNull();
  act(() => vi.advanceTimersByTime(1000));
  rerender(<TurnAnnouncement phase="player" round={1} opening />);
  act(() => vi.advanceTimersByTime(400));
  expect(announcement()).toBeNull();
  rerender(<TurnAnnouncement phase="gardener" round={1} opening={false} />);
  expect(announcement()).toHaveTextContent("Gardener’s Turn");
  act(() => vi.advanceTimersByTime(1399));
  expect(announcement()).not.toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(announcement()).toBeNull();
  rerender(<TurnAnnouncement phase="player" round={2} opening={false} />);
  expect(announcement()).toHaveTextContent("Round 2");
  rerender(<TurnAnnouncement phase="lost" round={2} opening={false} />);
  expect(announcement()).toBeNull();
});
