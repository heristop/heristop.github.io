import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Finale from "../../../../src/components/client/garden/components/hud/finale-overlay";

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock("../../../../src/components/client/use-text-reveal", () => ({
  default: { useReducedMotion: () => preference.reduced },
}));
vi.mock("../../../../src/components/client/zen-text-reveal", () => ({
  default: ({ text }: { text: string }) => <p>{text}</p>,
}));

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
});
