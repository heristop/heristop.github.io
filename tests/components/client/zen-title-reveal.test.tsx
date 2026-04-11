import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ZenTitleReveal from "../../../src/components/client/zen-title-reveal";

describe("<ZenTitleReveal />", () => {
  it("renders an h1 with aria-label matching the text", () => {
    render(<ZenTitleReveal text="Hello Zen" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("aria-label", "Hello Zen");
  });
});
