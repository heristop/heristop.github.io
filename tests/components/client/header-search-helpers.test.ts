import { beforeEach, describe, expect, it, vi } from "vitest";
import searchHelpers from "../../../src/components/client/header-search-helpers";

const {
  isBlogPostArray,
  createSearchResultItem,
  renderNoResults,
  showEmptyState,
  handleSearchKeyNavigation,
  describeSearchResults,
  ensureSearchStatus,
  trapDialogFocus,
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
    expect(item.hasAttribute("role")).toBe(false);
    expect(item.hasAttribute("aria-label")).toBe(false);
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
    expect(container.textContent).toContain("No reflections found for “astro”");
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

describe("describeSearchResults", () => {
  it("stays silent for an empty query", () => {
    expect(describeSearchResults(0, "   ")).toBe("");
  });

  it("announces counts with the right plural", () => {
    expect(describeSearchResults(1, "css")).toBe("1 reflection found");
    expect(describeSearchResults(4, "css")).toBe("4 reflections found");
  });

  it("names the query when nothing matches", () => {
    expect(describeSearchResults(0, "astro")).toBe("No reflections found for “astro”");
  });
});

describe("ensureSearchStatus", () => {
  it("creates one polite status region inside the search container and reuses it", () => {
    const overlay = document.createElement("div");
    const container = document.createElement("div");
    container.className = "search-container";
    overlay.append(container);
    const first = ensureSearchStatus(overlay);
    const second = ensureSearchStatus(overlay);
    expect(first).toBe(second);
    expect(first.getAttribute("role")).toBe("status");
    expect(first.parentElement).toBe(container);
    expect(overlay.querySelectorAll("[role='status']")).toHaveLength(1);
  });
});

describe("trapDialogFocus", () => {
  const setup = () => {
    const outside = document.createElement("button");
    const dialog = document.createElement("div");
    const input = document.createElement("input");
    const close = document.createElement("button");
    const result = document.createElement("a");
    result.href = "/blog/x/";
    dialog.append(input, close, result);
    document.body.append(outside, dialog);
    return { close, dialog, input, outside, result };
  };

  it("wraps Tab from the last control back to the first", () => {
    const { dialog, input, result } = setup();
    result.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapDialogFocus(event, dialog);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    const { dialog, input, result } = setup();
    input.focus();
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, cancelable: true });
    trapDialogFocus(event, dialog);
    expect(document.activeElement).toBe(result);
  });

  it("lets Tab move normally between inner controls and ignores other keys", () => {
    const { close, dialog, input } = setup();
    input.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    trapDialogFocus(tab, dialog);
    expect(tab.defaultPrevented).toBe(false);
    close.focus();
    const other = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    trapDialogFocus(other, dialog);
    expect(document.activeElement).toBe(close);
  });

  it("pulls focus back in when it has escaped the dialog", () => {
    const { dialog, input, outside } = setup();
    outside.focus();
    trapDialogFocus(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }), dialog);
    expect(document.activeElement).toBe(input);
  });
});
