import { beforeEach, describe, expect, it, vi } from "vitest";
import searchHelpers from "../../../src/components/client/header-search-helpers";

const {
  isBlogPostArray,
  createSearchResultItem,
  renderNoResults,
  showEmptyState,
  handleSearchKeyNavigation,
} = searchHelpers;

beforeEach(() => {
  document.body.replaceChildren();
});

describe("isBlogPostArray", () => {
  it("accepts a valid blog post array", () => {
    expect(isBlogPostArray([{ slug: "a", title: "A" }])).toBe(true);
  });

  it("accepts an empty array", () => {
    expect(isBlogPostArray([])).toBe(true);
  });

  it("rejects non-arrays", () => {
    expect(isBlogPostArray(null)).toBe(false);
    expect(isBlogPostArray({ slug: "x", title: "x" })).toBe(false);
    expect(isBlogPostArray("string")).toBe(false);
  });

  it("rejects arrays with missing fields", () => {
    expect(isBlogPostArray([{ slug: "only" }])).toBe(false);
    expect(isBlogPostArray([{ title: "only" }])).toBe(false);
  });
});

describe("createSearchResultItem", () => {
  it("renders title, formatted date and up to three tags", () => {
    const item = createSearchResultItem({
      slug: "hello-world",
      title: "Hello World",
      pubDate: new Date("2024-03-15T00:00:00Z"),
      tags: ["zen", "code", "haiku", "ignored"],
    });
    expect(item.tagName).toBe("LI");
    expect(item.getAttribute("role")).toBe("option");
    const anchor = item.querySelector("a.search-result");
    expect(anchor?.getAttribute("href")).toBe("/blog/hello-world/");
    expect(item.querySelector("h3")?.textContent).toBe("Hello World");
    const time = item.querySelector("time");
    expect(time?.textContent).toMatch(/2024/);
    const tags = item.querySelectorAll(".search-result-tag");
    expect(tags).toHaveLength(3);
    expect(tags[0].textContent).toBe("zen");
  });

  it("omits date block when pubDate missing", () => {
    const item = createSearchResultItem({ slug: "x", title: "X" });
    expect(item.querySelector("time")).toBeNull();
    expect(item.querySelector(".search-result-tags")).toBeNull();
  });
});

describe("renderNoResults", () => {
  it("renders an empty state with the query text", () => {
    const container = document.createElement("div");
    container.textContent = "previous";
    renderNoResults("astro", container);
    expect(container.textContent).toContain(`No reflections found for "astro"`);
    expect(container.querySelector(".search-empty")).toBeTruthy();
  });
});

describe("showEmptyState", () => {
  it("renders an initial empty prompt", () => {
    const container = document.createElement("div");
    showEmptyState(container);
    expect(container.textContent).toContain("Start typing");
    expect(container.querySelector(".search-empty")).toBeTruthy();
  });
});

describe("handleSearchKeyNavigation", () => {
  const makeContext = () => {
    const overlay = document.createElement("div");
    const results = document.createElement("ul");
    const input = document.createElement("input");
    document.body.append(overlay, results, input);
    const openSearch = vi.fn();
    const closeSearch = vi.fn();
    return { overlay, results, input, openSearch, closeSearch };
  };

  it("opens search on Cmd/Ctrl+K", () => {
    const { overlay, results, input, openSearch, closeSearch } = makeContext();
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
    const preventSpy = vi.spyOn(event, "preventDefault");
    handleSearchKeyNavigation({
      closeSearch,
      event,
      openSearch,
      searchInput: input,
      searchOverlay: overlay,
      searchResults: results,
    });
    expect(openSearch).toHaveBeenCalled();
    expect(preventSpy).toHaveBeenCalled();
  });

  it("closes search on Escape when overlay is open", () => {
    const { overlay, results, input, openSearch, closeSearch } = makeContext();
    overlay.classList.add("search-overlay--open");
    handleSearchKeyNavigation({
      closeSearch,
      event: new KeyboardEvent("keydown", { key: "Escape" }),
      openSearch,
      searchInput: input,
      searchOverlay: overlay,
      searchResults: results,
    });
    expect(closeSearch).toHaveBeenCalled();
  });

  it("does not process arrow keys when overlay closed", () => {
    const { overlay, results, input, openSearch, closeSearch } = makeContext();
    const first = document.createElement("a");
    first.className = "search-result";
    results.append(first);
    handleSearchKeyNavigation({
      closeSearch,
      event: new KeyboardEvent("keydown", { key: "ArrowDown" }),
      openSearch,
      searchInput: input,
      searchOverlay: overlay,
      searchResults: results,
    });
    expect(document.activeElement).not.toBe(first);
  });

  it("focuses first result on ArrowDown when overlay open", () => {
    const { overlay, results, input, openSearch, closeSearch } = makeContext();
    overlay.classList.add("search-overlay--open");
    const first = document.createElement("a");
    first.className = "search-result";
    first.tabIndex = 0;
    const second = document.createElement("a");
    second.className = "search-result";
    second.tabIndex = 0;
    results.append(first, second);
    handleSearchKeyNavigation({
      closeSearch,
      event: new KeyboardEvent("keydown", { key: "ArrowDown" }),
      openSearch,
      searchInput: input,
      searchOverlay: overlay,
      searchResults: results,
    });
    expect(document.activeElement).toBe(first);
  });
});
