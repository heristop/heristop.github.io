import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Icon from "@zazencode/ui/icon";

describe("shared Lucide icons", () => {
  it("renders a Lucide glyph without an external sprite request", () => {
    const { container } = render(<Icon name="gamepad" size={20} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
    expect(container.querySelector("path")).not.toBeNull();
    expect(container.querySelector("use")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
  it("exposes labelled icons and preserves caller styles", () => {
    render(<Icon name="search" aria-label="Search" className="toolbar-icon" strokeWidth={2} />);
    const icon = screen.getByRole("img", { name: "Search" });
    expect(icon).not.toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("icon", "toolbar-icon");
    expect(icon).toHaveAttribute("stroke-width", "2");
  });
});
