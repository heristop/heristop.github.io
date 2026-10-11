import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ZenTagIndex, { type TagEntry } from "../../../src/components/client/zen-tag-index";

const TAGS: TagEntry[] = [
  { tag: "ai", posts: 9, essays: 9 },
  { tag: "javascript", posts: 46, essays: 6 },
  { tag: "css", posts: 40, essays: 0 },
  { tag: "rust", posts: 1, essays: 1 },
  { tag: "goodhart", posts: 1, essays: 1 },
];

const renderIndex = () => render(<ZenTagIndex tags={TAGS} totalPosts={66} totalDigests={40} />);

const rowNames = () =>
  [...document.querySelectorAll(".tag-index__row .tag-index__name")].map((node) => node.textContent);

describe("<ZenTagIndex />", () => {
  it("lists tags with two posts or more by essay count, digests left out", () => {
    renderIndex();
    expect(rowNames()).toEqual(["ai", "javascript"]);
    expect(screen.getByRole("link", { name: "javascript, 6 posts" })).toHaveAttribute("href", "/tags/javascript/");
    // css only lives on digests: it leaves the rows but stays reachable from the note
    expect(within(document.querySelector(".tag-index__note") as HTMLElement).getByRole("link", { name: "css" }))
      .toHaveAttribute("href", "/tags/css/");
  });

  it("folds single-post tags into one line, A to Z", () => {
    renderIndex();
    const once = document.querySelector(".tag-index__once") as HTMLElement;
    expect(within(once).getAllByRole("link").map((link) => link.textContent)).toEqual(["goodhart", "rust"]);
  });

  it("counts the digests when the switch is on", () => {
    renderIndex();
    const toggle = screen.getByRole("switch", { name: "Count weekly digests" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(rowNames()).toEqual(["javascript", "css", "ai"]);
    expect(document.querySelector(".tag-index__note")).toBeNull();
  });

  it("sorts A to Z", () => {
    renderIndex();
    fireEvent.click(screen.getByRole("button", { name: "A to Z" }));
    expect(screen.getByRole("button", { name: "A to Z" })).toHaveAttribute("aria-pressed", "true");
    expect(rowNames()).toEqual(["ai", "javascript"]);
    fireEvent.click(screen.getByRole("switch"));
    expect(rowNames()).toEqual(["ai", "css", "javascript"]);
  });

  it("filters both groups and highlights the match", () => {
    renderIndex();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a tag" }), { target: { value: "us" } });
    expect(rowNames()).toEqual([]);
    const once = document.querySelector(".tag-index__once") as HTMLElement;
    expect(within(once).getAllByRole("link").map((link) => link.textContent)).toEqual(["rust"]);
    expect(once.querySelector("mark")?.textContent).toBe("us");
    expect(screen.getByText(/1 tag of 4 match/)).toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    renderIndex();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/No tag matches/)).toBeInTheDocument();
  });

  it("focuses the search on /", () => {
    renderIndex();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
});
