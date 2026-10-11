/* Table of contents for long articles: marks the section being read (aria-current plus a rose
   tick that slides to it) and lets the rail go once the article has ended.

   Nothing runs per scroll frame. An IntersectionObserver watches the band above a reading line in
   the upper part of the viewport; each time a heading enters or leaves it (or a scroll ends), the
   current section is re-derived from the heading positions, which is the only layout read. */

// Where reading happens: a heading above this line has been entered
const READING_LINE = 0.3;

export const currentSection = (tops: readonly number[], line: number): number => {
  let current = -1;
  for (const [index, top] of tops.entries()) {
    if (top > line) {
      break;
    }
    current = index;
  }
  return current;
};

const placeTick = (nav: Element, link: HTMLElement | undefined) => {
  const tick = nav.querySelector<HTMLElement>(".post-toc__tick");
  if (!tick) {
    return;
  }
  if (!link || link.offsetParent === null) {
    tick.removeAttribute("data-visible");
    return;
  }
  // Centred on the link's first line, so a wrapped title keeps its tick at the start
  const lineHeight = Number.parseFloat(getComputedStyle(link).lineHeight) || link.offsetHeight;
  tick.style.transform = `translateY(${link.offsetTop + lineHeight / 2}px)`;
  tick.dataset.visible = "";
};

export const initPostToc = (signal: AbortSignal) => {
  const tocs = [...document.querySelectorAll<HTMLElement>("[data-post-toc]")];
  if (tocs.length === 0) {
    return;
  }
  const slugs = [
    ...new Set(
      tocs.flatMap((toc) =>
        [...toc.querySelectorAll<HTMLElement>("[data-toc-slug]")].map(
          (link) => link.dataset.tocSlug ?? "",
        ),
      ),
    ),
  ];
  const headings = slugs
    .map((slug) => document.getElementById(slug))
    .filter((heading): heading is HTMLElement => heading !== null);
  if (headings.length === 0) {
    return;
  }

  let active: string | undefined;
  const render = () => {
    for (const toc of tocs) {
      let activeLink: HTMLElement | undefined;
      for (const link of toc.querySelectorAll<HTMLElement>("[data-toc-slug]")) {
        if (link.dataset.tocSlug === active) {
          link.setAttribute("aria-current", "location");
          activeLink = link;
        } else {
          link.removeAttribute("aria-current");
        }
      }
      placeTick(toc, activeLink);
    }
  };

  const update = () => {
    const line = globalThis.innerHeight * READING_LINE;
    const index = currentSection(
      headings.map((heading) => heading.getBoundingClientRect().top),
      line,
    );
    const next = index === -1 ? undefined : headings[index]?.id;
    if (next !== active) {
      active = next;
      render();
    }
  };

  // Headings report when they enter or leave the band above the reading line; a jump (a TOC link,
  // a hash, Home/End) can land without any heading changing state, so the end of every scroll
  // re-checks once as well
  const lineObserver = new IntersectionObserver(update, {
    rootMargin: `0px 0px -${100 - READING_LINE * 100}% 0px`,
  });
  for (const heading of headings) {
    lineObserver.observe(heading);
  }
  globalThis.addEventListener("scrollend", update, { passive: true, signal });

  // The rail has nothing left to point at once the article's closing share row is on screen
  const rail = document.querySelector<HTMLElement>(".post-toc--rail");
  const end = document.querySelector(".post-page__share-bottom");
  let endObserver: IntersectionObserver | undefined;
  if (rail && end) {
    endObserver = new IntersectionObserver(([entry]) => {
      rail.toggleAttribute(
        "data-ended",
        Boolean(entry && entry.boundingClientRect.top < globalThis.innerHeight),
      );
    });
    endObserver.observe(end);
  }

  // The disclosure's links have no layout until it opens; the rail's until the breakpoint flips
  for (const toc of tocs) {
    toc.addEventListener("toggle", render, { signal });
  }
  globalThis.matchMedia("(width >= 90rem)").addEventListener("change", render, { signal });

  signal.addEventListener("abort", () => {
    lineObserver.disconnect();
    endObserver?.disconnect();
  });
  update();
};
