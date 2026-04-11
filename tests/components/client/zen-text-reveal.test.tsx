import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ZenTextReveal from "../../../src/components/client/zen-text-reveal";

describe("<ZenTextReveal />", () => {
  it("renders a span tag by default with aria-label", () => {
    const { container } = render(<ZenTextReveal text="quiet mind" />);
    const node = container.querySelector("span[aria-label='quiet mind']");
    expect(node).toBeTruthy();
    expect(node?.tagName).toBe("SPAN");
  });

  it("respects the tag prop", () => {
    const { container } = render(<ZenTextReveal text="block" tag="p" />);
    const node = container.querySelector("p[aria-label='block']");
    expect(node).toBeTruthy();
  });

  it("forwards className", () => {
    const { container } = render(<ZenTextReveal text="x" className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeTruthy();
  });
});
