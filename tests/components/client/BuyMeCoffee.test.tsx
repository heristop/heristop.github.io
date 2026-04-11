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

  it("renders the cup label", () => {
    render(<BuyMeCoffee url="https://example.com" />);
    expect(screen.getAllByText(/buy me a coffee/i).length).toBeGreaterThan(0);
  });
});
