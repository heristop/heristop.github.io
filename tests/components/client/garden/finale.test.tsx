import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Finale from "../../../../src/components/client/garden/components/hud/finale-overlay";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../../../src/components/client/use-text-reveal", () => ({
  default: { useReducedMotion: () => preference.reduced },
}));
vi.mock("../../../../src/components/client/zen-text-reveal", () => ({
  default: ({ text }: { text: string }) => <p>{text}</p>,
}));

beforeEach(() => {
  preference.reduced = false;
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("reveals all results when reduced motion becomes known after mounting", () => {
  const props = {
    lines: [
      { stoneIndex: 0, text: "First line" },
      { stoneIndex: 1, text: "Second line" },
    ],
    steps: 20,
    stonesLaid: 2,
    stonesLeft: 4,
  };
  const { rerender } = render(<Finale {...props} />);
  expect(screen.queryByText("Total")).not.toBeInTheDocument();
  preference.reduced = true;
  rerender(<Finale {...props} />);
  expect(screen.getByText("Total")).toBeInTheDocument();
  expect(screen.getByText("Second line")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Return" })).toHaveFocus();
});

it("delays and focuses the primary action, keeping Escape bound to Return", () => {
  const onReturn = vi.fn((event?: { preventDefault: () => void }) => event?.preventDefault());
  const onWalkAgain = vi.fn();
  render(
    <Finale
      lines={[]}
      steps={20}
      stonesLaid={2}
      stonesLeft={4}
      onReturn={onReturn}
      onWalkAgain={onWalkAgain}
    />,
  );
  act(() => vi.advanceTimersByTime(4999));
  expect(screen.queryByRole("button", { name: "Walk again" })).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("button", { name: "Walk again" })).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onReturn).toHaveBeenCalledTimes(1);
  expect(onWalkAgain).not.toHaveBeenCalled();
});
