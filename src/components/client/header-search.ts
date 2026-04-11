import helpers from "./header-search-helpers";

interface BlogPost {
  body?: string;
  pubDate?: string | Date;
  slug: string;
  tags?: string[];
  title: string;
}

interface SearchElements {
  searchInput: HTMLInputElement;
  searchOverlay: HTMLElement;
  searchResults: HTMLElement;
  searchToggles: NodeListOf<Element>;
}

interface SearchKeyNavOptions {
  closeSearch: () => void;
  event: KeyboardEvent;
  openSearch: () => void;
  searchInput: HTMLInputElement;
  searchOverlay: HTMLElement;
  searchResults: HTMLElement;
}

interface BindSearchEventsOptions {
  closeSearch: () => void;
  elems: SearchElements;
  openSearch: () => void;
  performSearch: (query: string) => void;
  searchClose: HTMLButtonElement;
}

/* ── Data loading ── */

const loadBlogPosts = async (): Promise<BlogPost[]> => {
  try {
    const response = await fetch("/api/search-posts.json");
    if (response.ok) {
      const text = await response.text();
      const parsed: unknown = JSON.parse(text);
      if (helpers.isBlogPostArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    /* Could not load */
  }
  return [];
};

/* ── Search logic ── */

const performSearchQuery = (
  query: string,
  blogPosts: BlogPost[],
  searchResults: HTMLElement,
): void => {
  if (!query.trim()) {
    helpers.showEmptyState(searchResults);
    return;
  }
  const lowerQuery = query.toLowerCase();
  const results = blogPosts
    .filter(
      (post) =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.body?.toLowerCase().includes(lowerQuery) === true ||
        post.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) === true,
    )
    .slice(0, helpers.MAX_SEARCH_RESULTS);
  if (results.length === 0) {
    helpers.renderNoResults(query, searchResults);
    return;
  }
  const listElement = document.createElement("ul");
  listElement.className = "search-results-content";
  listElement.setAttribute("role", "listbox");
  for (const post of results) {
    listElement.append(helpers.createSearchResultItem(post));
  }
  searchResults.replaceChildren(listElement);
};

/* ── Search overlay ── */

const openSearchOverlay = (elems: SearchElements): void => {
  elems.searchOverlay.setAttribute("aria-hidden", "false");
  elems.searchOverlay.removeAttribute("inert");
  elems.searchOverlay.classList.add("search-overlay--open");
  for (const toggleBtn of elems.searchToggles) {
    toggleBtn.setAttribute("aria-expanded", "true");
  }
  const inputWrapper = elems.searchOverlay.querySelector('[role="combobox"]');
  if (inputWrapper !== null) {
    inputWrapper.setAttribute("aria-expanded", "true");
  }
  for (const element of elems.searchOverlay.querySelectorAll('input, button, [tabindex="-1"]')) {
    element.removeAttribute("tabindex");
  }
  document.body.classList.add("search-open");
  setTimeout(() => {
    elems.searchInput.focus();
  }, helpers.SEARCH_FOCUS_DELAY_MS);
};

const closeSearchOverlay = (elems: SearchElements): void => {
  if (
    document.activeElement instanceof HTMLElement &&
    elems.searchOverlay.contains(document.activeElement)
  ) {
    document.activeElement.blur();
  }
  elems.searchOverlay.setAttribute("aria-hidden", "true");
  elems.searchOverlay.setAttribute("inert", "");
  elems.searchOverlay.classList.remove("search-overlay--open");
  for (const toggleBtn of elems.searchToggles) {
    toggleBtn.setAttribute("aria-expanded", "false");
  }
  const inputWrapper = elems.searchOverlay.querySelector('[role="combobox"]');
  if (inputWrapper !== null) {
    inputWrapper.setAttribute("aria-expanded", "false");
  }
  for (const element of elems.searchOverlay.querySelectorAll("input, button, [tabindex]")) {
    element.setAttribute("tabindex", "-1");
  }
  document.body.classList.remove("search-open");
  elems.searchInput.value = "";
  helpers.showEmptyState(elems.searchResults);
};

/* ── Event binding ── */

const bindSearchEvents = (opts: BindSearchEventsOptions): void => {
  let searchTimeout: ReturnType<typeof setTimeout> = setTimeout(helpers.noopFn, 0);
  for (const toggleBtn of opts.elems.searchToggles) {
    toggleBtn.addEventListener("click", opts.openSearch);
  }
  opts.searchClose.addEventListener("click", opts.closeSearch);
  opts.elems.searchInput.addEventListener("input", (inputEvent) => {
    clearTimeout(searchTimeout);
    const { target } = inputEvent;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const query = target.value;
    searchTimeout = setTimeout(() => {
      opts.performSearch(query);
    }, helpers.SEARCH_DEBOUNCE_MS);
  });
  document.addEventListener("keydown", (keyEvent) => {
    const navOpts: SearchKeyNavOptions = {
      closeSearch: opts.closeSearch,
      event: keyEvent,
      openSearch: opts.openSearch,
      searchInput: opts.elems.searchInput,
      searchOverlay: opts.elems.searchOverlay,
      searchResults: opts.elems.searchResults,
    };
    helpers.handleSearchKeyNavigation(navOpts);
  });
  opts.elems.searchOverlay.addEventListener("click", (clickEvent) => {
    if (clickEvent.target === opts.elems.searchOverlay) {
      opts.closeSearch();
    }
  });
};

/* ── Main entry point ── */

const initializeSearch = (): void => {
  const searchToggleEls = document.querySelectorAll(".header__search-toggle");
  const searchOverlay = document.querySelector("#search-overlay");
  const searchInput = document.querySelector(".search-input");
  const searchClose = document.querySelector(".search-close");
  const searchResults = document.querySelector("#search-results");
  if (
    searchToggleEls.length === 0 ||
    !(searchOverlay instanceof HTMLElement) ||
    !(searchInput instanceof HTMLInputElement) ||
    !(searchClose instanceof HTMLButtonElement) ||
    !(searchResults instanceof HTMLElement)
  ) {
    return;
  }
  const elems: SearchElements = {
    searchInput,
    searchOverlay,
    searchResults,
    searchToggles: searchToggleEls,
  };
  let blogPosts: BlogPost[] = [];
  const openSearch = () => {
    openSearchOverlay(elems);
  };
  const closeSearch = () => {
    closeSearchOverlay(elems);
  };
  const performSearch = (query: string) => {
    performSearchQuery(query, blogPosts, searchResults);
  };
  bindSearchEvents({
    closeSearch,
    elems,
    openSearch,
    performSearch,
    searchClose,
  });
  void (async () => {
    blogPosts = await loadBlogPosts();
  })();
};

export default initializeSearch;
