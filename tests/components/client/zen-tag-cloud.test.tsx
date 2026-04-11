import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ZenTagCloud from "../../../src/components/client/zen-tag-cloud";

describe("<ZenTagCloud />", () => {
  it("renders one pill per tag with link and count", () => {
    render(
      <ZenTagCloud
        tags={[
          { tag: "zen", count: 3, size: "lg" },
          { tag: "astro", count: 1, size: "sm" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/tags/zen/");
    expect(links[1]).toHaveAttribute("href", "/tags/astro/");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
