/* ── Search constants ── */
const SEARCH_FOCUS_DELAY_MS = 150;
const MAX_SEARCH_RESULTS = 6;
const SEARCH_DEBOUNCE_MS = 150;

const SEARCH_EMPTY_SVG =
  '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-empty-icon" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>';

const noopFn = () => {};

interface BlogPost {
  body?: string;
  pubDate?: string | Date;
  slug: string;
  tags?: string[];
  title: string;
}

interface SearchKeyNavOptions {
  closeSearch: () => void;
  event: KeyboardEvent;
  openSearch: () => void;
  searchInput: HTMLInputElement;
  searchOverlay: HTMLElement;
  searchResults: HTMLElement;
}

/* ── Helpers ── */

const isBlogPostArray = (value: unknown): value is BlogPost[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      typeof item === "object" && item !== null && "slug" in item && "title" in item,
  );

const formatDate = (date: string | Date): string => {
  const postDate = new Date(date);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${postDate.getDate()} ${months[postDate.getMonth()]} ${postDate.getFullYear()}`;
};

const createSearchResultLink = (post: BlogPost): HTMLAnchorElement => {
  const link = document.createElement("a");
  link.href = `/blog/${post.slug}/`;
  link.className = "search-result";
  link.tabIndex = 0;
  const contentDiv = document.createElement("div");
  contentDiv.className = "search-result-content";
  const heading = document.createElement("h3");
  heading.className = "search-result-title";
  heading.textContent = post.title;
  contentDiv.append(heading);
  if (post.pubDate !== undefined) {
    const time = document.createElement("time");
    time.className = "search-result-date";
    time.textContent = formatDate(post.pubDate);
    contentDiv.append(time);
  }
  if (post.tags !== undefined && post.tags.length > 0) {
    const tagsDiv = document.createElement("div");
    tagsDiv.className = "search-result-tags";
    for (const tag of post.tags.slice(0, 3)) {
      const tagSpan = document.createElement("span");
      tagSpan.className = "search-result-tag";
      tagSpan.textContent = tag;
      tagsDiv.append(tagSpan);
    }
    contentDiv.append(tagsDiv);
  }
  link.append(contentDiv);
  return link;
};

const createSearchResultItem = (post: BlogPost): HTMLLIElement => {
  const listItem = document.createElement("li");
  listItem.setAttribute("role", "option");
  listItem.setAttribute("aria-label", post.title);
  listItem.append(createSearchResultLink(post));
  return listItem;
};

const handleSearchShortcuts = (
  event: KeyboardEvent,
  searchOverlay: HTMLElement,
  openSearch: () => void,
  closeSearch: () => void,
): void => {
  if (event.key === "Escape" && searchOverlay.classList.contains("search-overlay--open")) {
    closeSearch();
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "k") {
    event.preventDefault();
    openSearch();
  }
};

const focusElement = (el: Element): void => {
  if (el instanceof HTMLElement) {
    el.focus();
  }
};

const handleSearchEnter = (event: KeyboardEvent): void => {
  const currentFocus = document.activeElement;
  if (
    event.key === "Enter" &&
    currentFocus instanceof HTMLElement &&
    currentFocus.classList.contains("header__search-result")
  ) {
    event.preventDefault();
    currentFocus.click();
  }
};

const handleSearchArrowNavigation = (
  event: KeyboardEvent,
  resultElements: NodeListOf<Element>,
  searchInput: HTMLInputElement,
): void => {
  const currentFocus = document.activeElement;
  let currentIndex = -1;
  if (currentFocus instanceof Element) {
    currentIndex = [...resultElements].indexOf(currentFocus);
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    currentIndex = Math.min(currentIndex + 1, resultElements.length - 1);
    const target = resultElements[currentIndex];
    if (target !== undefined) {
      focusElement(target);
    }
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (currentIndex <= 0) {
      searchInput.focus();
    } else {
      currentIndex = Math.max(currentIndex - 1, 0);
      const target = resultElements[currentIndex];
      if (target !== undefined) {
        focusElement(target);
      }
    }
  }
  handleSearchEnter(event);
};

const handleSearchKeyNavigation = (options: SearchKeyNavOptions): void => {
  handleSearchShortcuts(
    options.event,
    options.searchOverlay,
    options.openSearch,
    options.closeSearch,
  );
  if (!options.searchOverlay.classList.contains("search-overlay--open")) {
    return;
  }
  handleSearchArrowNavigation(
    options.event,
    options.searchResults.querySelectorAll(".search-result"),
    options.searchInput,
  );
};

const createNoResultsSvg = (): SVGSVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "32");
  svg.setAttribute("height", "32");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", "search-empty-icon");
  svg.setAttribute("aria-hidden", "true");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "11");
  circle.setAttribute("cy", "11");
  circle.setAttribute("r", "8");
  svg.append(circle);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m21 21-4.35-4.35");
  svg.append(path);
  return svg;
};

const renderNoResults = (query: string, searchResults: HTMLElement): void => {
  const emptyDiv = document.createElement("div");
  emptyDiv.className = "search-results-content";
  const inner = document.createElement("div");
  inner.className = "search-empty";
  inner.append(createNoResultsSvg());
  const paragraph = document.createElement("p");
  paragraph.textContent = `No reflections found for "${query}"`;
  inner.append(paragraph);
  emptyDiv.append(inner);
  searchResults.replaceChildren(emptyDiv);
};

const showEmptyState = (searchResults: HTMLElement): void => {
  const wrapper = document.createElement("div");
  wrapper.className = "search-results-content";
  const inner = document.createElement("div");
  inner.className = "search-empty";
  /* Static SVG icon (compile-time constant) - safe to set via innerHTML. */
  inner.innerHTML = SEARCH_EMPTY_SVG;
  const paragraph = document.createElement("p");
  paragraph.textContent = "Start typing to search reflections...";
  inner.append(paragraph);
  wrapper.append(inner);
  searchResults.replaceChildren(wrapper);
};

const searchHelpers = {
  MAX_SEARCH_RESULTS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_FOCUS_DELAY_MS,
  createSearchResultItem,
  handleSearchKeyNavigation,
  isBlogPostArray,
  noopFn,
  renderNoResults,
  showEmptyState,
};

export default searchHelpers;
