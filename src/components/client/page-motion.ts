/* Page transition choreography for the ClientRouter: which way the page travels, and which
   clicked title morphs into the next page's heading. `_motion.scss` reads the attributes set here. */

export type NavDirection = "forward" | "back" | "next" | "prev" | "none";
export type HistoryDirection = "forward" | "back";

// Header navigation order: siblings slide toward the side their link sits on
const NAV_ORDER = ["/", "/blog/", "/tags/", "/projects/", "/about/"];
const DATED_SLUG = /^\/blog\/(\d{4}-\d{2}-\d{2})/;

export const normalizePath = (path: string): string => (path.endsWith("/") ? path : `${path}/`);

// The home page sits on the same level as the other top-level pages; posts and tag pages go one deeper
export const pageDepth = (path: string): number =>
  Math.max(1, normalizePath(path).split("/").filter(Boolean).length);

interface DirectionInput {
  from: string;
  to: string;
  history?: HistoryDirection;
  rel?: string | null;
}

const siblingDirection = (from: string, to: string, history: HistoryDirection): NavDirection => {
  const fromIndex = NAV_ORDER.indexOf(from);
  const toIndex = NAV_ORDER.indexOf(to);
  if (fromIndex !== -1 && toIndex !== -1) {
    return toIndex > fromIndex ? "next" : "prev";
  }
  // Posts are named by date: an older post lies to the left, as on the pager
  const fromDate = DATED_SLUG.exec(from)?.[1];
  const toDate = DATED_SLUG.exec(to)?.[1];
  if (fromDate && toDate && fromDate !== toDate) {
    return toDate < fromDate ? "prev" : "next";
  }
  return history === "back" ? "prev" : "next";
};

/* Deeper pages rise from below and shallower ones settle from above; siblings slide sideways.
   Derived from the two paths, so a history traversal mirrors the click that led there. */
export const getNavDirection = ({
  from,
  to,
  history = "forward",
  rel,
}: DirectionInput): NavDirection => {
  const fromPath = normalizePath(from);
  const toPath = normalizePath(to);
  if (fromPath === toPath) {
    return "none";
  }
  if (rel === "prev" || rel === "next") {
    return rel;
  }
  const delta = pageDepth(toPath) - pageDepth(fromPath);
  if (delta !== 0) {
    return delta > 0 ? "forward" : "back";
  }
  return siblingDirection(fromPath, toPath, history);
};

const POST_PATH = /^\/blog\/[^/]+\/$/;

/* Shared elements only travel when a post is opened or left: between two lists every row would
   fly to its card at once and the eye would have no single place to go */
export const morphsPosts = (from: string, to: string): boolean =>
  POST_PATH.test(normalizePath(from)) || POST_PATH.test(normalizePath(to));

/* ── Shared-title morph ── */

const TITLE_SELECTOR = ".site-layout__meta-title [data-reveal]";
const SOURCE_TITLE_SELECTOR =
  ".blog-card__title, .post-page__pager-title, .latest-posts__title, h3, h2";
export const MORPH_CLASS = "post-morph";

export const pageTitleName = (doc: Document): string | undefined => {
  const name = doc.querySelector<HTMLElement>(TITLE_SELECTOR)?.style.viewTransitionName;
  return name && name !== "none" ? name : undefined;
};

const findNamed = (doc: Document, name: string): HTMLElement | undefined => {
  for (const el of doc.querySelectorAll<HTMLElement>("[style*='view-transition-name']")) {
    if (el.style.viewTransitionName === name) {
      return el;
    }
  }
  return undefined;
};

export const isInViewport = (
  el: Element,
  view = { height: innerHeight, width: innerWidth },
): boolean => {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < view.height && rect.left < view.width;
};

const nameElement = (el: HTMLElement, name: string) => {
  el.style.viewTransitionName = name;
  el.style.setProperty("view-transition-class", MORPH_CLASS);
};

/* Before the swap (old page still on screen): make sure exactly one visible element carries the
   incoming heading's name. Returns whether the heading will arrive by morph, in which case it
   must render visible rather than hide for its own per-char reveal. */
export const claimTitleMorph = (
  current: Document,
  incoming: Document,
  source?: Element | null,
): boolean => {
  const name = pageTitleName(incoming);
  if (!name) {
    return false;
  }
  let origin = findNamed(current, name);
  if (!origin && source) {
    const title = source.matches(SOURCE_TITLE_SELECTOR)
      ? source
      : source.querySelector(SOURCE_TITLE_SELECTOR);
    if (title instanceof HTMLElement) {
      nameElement(title, name);
      origin = title;
    }
  }
  if (!origin) {
    return false;
  }
  if (!isInViewport(origin)) {
    // A morph from off-screen would fly across the page; let the heading reveal instead
    origin.style.viewTransitionName = "none";
    return false;
  }
  return true;
};

/* Leaving a post for a list (back, or the "all reflections" link): the post's heading returns
   to its own row or card when the list shows one. */
export const claimReturnMorph = (current: Document, incoming: Document, fromPath: string): void => {
  const name = pageTitleName(current);
  if (!name || findNamed(incoming, name)) {
    return;
  }
  const link = [...incoming.querySelectorAll<HTMLAnchorElement>("main a[href]")].find(
    (anchor) => normalizePath(anchor.getAttribute("href") ?? "") === normalizePath(fromPath),
  );
  const title = link?.querySelector<HTMLElement>(SOURCE_TITLE_SELECTOR);
  if (title) {
    nameElement(title, name);
  }
};
