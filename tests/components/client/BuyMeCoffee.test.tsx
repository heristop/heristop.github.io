import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BuyMeCoffee from "../../../src/components/client/BuyMeCoffee";

describe("<BuyMeCoffee />", () => {
  it("renders a link to the provided url", () => {
    render(<BuyMeCoffee url="https://buymeacoffee.com/alex" />);
    const link = screen.getByRole("link", { name: /buy me a coffee/i });
    expect(link).toHaveAttribute("href", "https://buymeacoffee.com/alex");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the label with its secondary line", () => {
    render(<BuyMeCoffee url="https://example.com" />);
    expect(screen.getByText("Buy me a coffee")).toBeInTheDocument();
    expect(screen.getByText("Support my writing")).toBeInTheDocument();
  });

  it("is named by its visible text alone, leaving the new-tab hint to new-tab-links", () => {
    const { container } = render(<BuyMeCoffee url="https://example.com" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName("Buy me a coffee Support my writing");
    expect(link).not.toHaveAttribute("aria-label");
    for (const svg of container.querySelectorAll("svg")) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
    }
  });
});
