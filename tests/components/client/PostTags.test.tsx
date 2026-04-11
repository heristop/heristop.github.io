import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostTags from "../../../src/components/client/PostTags";

describe("<PostTags />", () => {
  it("renders one link per tag with /tags/{tag}/ href", () => {
    render(<PostTags tags={["zen", "astro", "haiku"]} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/tags/zen/");
    expect(links[1]).toHaveAttribute("href", "/tags/astro/");
    expect(links[2]).toHaveAttribute("href", "/tags/haiku/");
  });

  it("renders nothing when tags is empty", () => {
    const { container } = render(<PostTags tags={[]} />);
    expect(container.querySelector(".post-page__tags")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
