import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAW_DURATION_MS,
  MAX_CONCURRENT,
  PAIR_STAGGER_MS,
  isInView,
  isInkEligible,
  mountInkReveal,
  resetInkMemory,
  staggerDelays,
} from "../../../src/components/client/ink-reveal";

const img = (attrs: string, wrap = (html: string) => `<div class="post-page">${html}</div>`) => {
  document.body.innerHTML = wrap(`<img ${attrs} />`);
  return document.querySelector("img") as HTMLImageElement;
};

const PHOTO = 'src="/images/posts/a/1.webp" width="800" height="500" alt="A garden"';

describe("isInkEligible", () => {
  it("accepts an article illustration", () => {
    expect(isInkEligible(img(PHOTO))).toBe(true);
    expect(
      isInkEligible(img(PHOTO, (h) => `<div class="post-page"><div class="img-container"><figure class="img-figure">${h}</figure></div></div>`)),
    ).toBe(true);
  });

  it("ignores images outside the article prose", () => {
    expect(isInkEligible(img(PHOTO, (h) => `<header class="site-header">${h}</header>`))).toBe(false);
    expect(isInkEligible(img(PHOTO, (h) => `<div class="path-of-stones">${h}</div>`))).toBe(false);
    expect(isInkEligible(img(PHOTO, (h) => `<div class="post-page"><nav class="post-page__pager">${h}</nav></div>`))).toBe(false);
  });

  it("ignores images inside links, diagrams and opted-out blocks", () => {
    expect(isInkEligible(img(PHOTO, (h) => `<div class="post-page"><a href="/x">${h}</a></div>`))).toBe(false);
    expect(isInkEligible(img(PHOTO, (h) => `<div class="post-page"><div class="mermaid">${h}</div></div>`))).toBe(false);
    expect(isInkEligible(img(`${PHOTO} data-ink-skip`))).toBe(false);
  });

  it("ignores icons, vectors, animated images, mermaid renders and banners", () => {
    expect(isInkEligible(img('src="/icons/github.svg" width="200" height="200"'))).toBe(false);
    expect(isInkEligible(img('src="/images/posts/a/diagram.svg" width="800" height="500"'))).toBe(false);
    expect(isInkEligible(img('src="/images/posts/a/loop.gif" width="800" height="500"'))).toBe(false);
    expect(isInkEligible(img('src="/images/posts/a/mermaid-workflow.webp" width="800" height="500"'))).toBe(false);
    expect(isInkEligible(img(`${PHOTO} class="site-header__banner-image"`))).toBe(false);
    expect(isInkEligible(img(`${PHOTO} class="about__avatar"`))).toBe(false);
    expect(isInkEligible(img(`${PHOTO} class="emoji"`))).toBe(false);
  });

  it("ignores tiny images, by their intrinsic size, else by the rendered box", () => {
    expect(isInkEligible(img('src="/images/posts/a/b.webp" width="64" height="64"'))).toBe(false);
    // A lazy image not loaded yet may lay out small: its attributes still say what it is
    expect(isInkEligible(img(PHOTO), { width: 75, height: 60 })).toBe(true);
    expect(isInkEligible(img('src="/images/posts/a/b.webp"'), { width: 400, height: 300 })).toBe(true);
    expect(isInkEligible(img('src="/images/posts/a/b.webp"'), { width: 90, height: 90 })).toBe(false);
    expect(isInkEligible(img('src="/images/posts/a/b.webp"'))).toBe(false);
  });
});

describe("staggerDelays", () => {
  it("draws a side-by-side pair one after the other, and lone images at once", () => {
    document.body.innerHTML = `
      <div class="img-container"><figure><img id="a" /></figure><figure><img id="b" /></figure></div>
      <div class="img-container"><figure><img id="c" /></figure></div>`;
    const [a, b, c] = ["#a", "#b", "#c"].map((s) => document.querySelector(s) as Element);
    const delays = staggerDelays([a, b, c]);
    expect(delays.get(a)).toBe(0);
    expect(delays.get(b)).toBe(PAIR_STAGGER_MS);
    expect(delays.get(c)).toBe(0);
  });
});

describe("isInView", () => {
  it("counts any overlap with the viewport", () => {
    expect(isInView({ top: 790, bottom: 1200 }, 800)).toBe(true);
    expect(isInView({ top: -300, bottom: 5 }, 800)).toBe(true);
    expect(isInView({ top: 900, bottom: 1300 }, 800)).toBe(false);
    expect(isInView({ top: -300, bottom: 0 }, 800)).toBe(false);
  });
});

/* ── Observer wiring ── */

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

class FakeObserver {
  static last: FakeObserver;
  observed = new Set<Element>();
  options: IntersectionObserverInit | undefined;
  constructor(
    public callback: Callback,
    options?: IntersectionObserverInit,
  ) {
    this.options = options;
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  enter(...els: Element[]) {
    this.callback(els.map((target) => ({ target, isIntersecting: true })));
  }
}

const setRect = (el: Element, top: number, height = 400) => {
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + height, left: 0, right: 600, width: 600, height }) as DOMRect;
};

const fakeWindow = (matches: Record<string, boolean> = {}) =>
  ({
    IntersectionObserver: FakeObserver,
    innerHeight: 800,
    location: { pathname: "/blog/a/" },
    matchMedia: (query: string) => ({ matches: matches[query] ?? false }),
  }) as unknown as Window & typeof globalThis;

const article = (count: number, pair = false) => {
  const figures = Array.from(
    { length: count },
    (_, i) => `<figure class="img-figure"><img id="i${i}" src="/images/posts/a/${i}.webp" width="800" height="500" /></figure>`,
  );
  document.body.innerHTML = `<div class="post-page">${
    pair ? `<div class="img-container">${figures.join("")}</div>` : figures.join("")
  }</div>`;
  const imgs = [...document.querySelectorAll("img")];
  for (const el of imgs) {
    Object.defineProperty(el, "complete", { value: true });
  }
  return imgs;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("mountInkReveal", () => {
  beforeEach(() => {
    resetInkMemory();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks below-the-fold images as sketches and leaves visible ones alone", () => {
    const [visible, below] = article(2);
    setRect(visible, 100);
    setRect(below, 1400);
    mountInkReveal({ doc: document, win: fakeWindow() });
    expect(visible.hasAttribute("data-ink")).toBe(false);
    expect(below.getAttribute("data-ink")).toBe("pending");
    expect(FakeObserver.last.observed.has(below)).toBe(true);
    expect(FakeObserver.last.options).toMatchObject({ threshold: 0.25, rootMargin: "0px 0px -10% 0px" });
  });

  it("draws once on entry, unobserves, then hands the image back", async () => {
    const [image] = article(1);
    setRect(image, 1400);
    mountInkReveal({ doc: document, win: fakeWindow() });
    vi.useFakeTimers();
    setRect(image, 500);
    FakeObserver.last.enter(image);
    await vi.waitFor(() => expect(image.getAttribute("data-ink")).toBe("drawing"));
    expect(FakeObserver.last.observed.has(image)).toBe(false);
    vi.advanceTimersByTime(DRAW_DURATION_MS + 100);
    expect(image.hasAttribute("data-ink")).toBe(false);
  });

  it("staggers a pair entering together", async () => {
    const [a, b] = article(2, true);
    setRect(a, 1400);
    setRect(b, 1400);
    mountInkReveal({ doc: document, win: fakeWindow() });
    setRect(a, 500);
    setRect(b, 500);
    FakeObserver.last.enter(a, b);
    await flush();
    expect(a.style.getPropertyValue("--ink-delay")).toBe("0ms");
    expect(b.style.getPropertyValue("--ink-delay")).toBe(`${PAIR_STAGGER_MS}ms`);
  });

  it("caps concurrent drawings and finishes queued ones that scrolled away", async () => {
    const images = article(MAX_CONCURRENT + 2);
    for (const el of images) {
      setRect(el, 1400);
    }
    mountInkReveal({ doc: document, win: fakeWindow() });
    vi.useFakeTimers();
    for (const el of images) {
      setRect(el, 500);
    }
    const [lastQueued] = images.slice(-1);
    FakeObserver.last.enter(...images);
    await vi.waitFor(() =>
      expect(images.filter((el) => el.getAttribute("data-ink") === "drawing")).toHaveLength(MAX_CONCURRENT),
    );
    setRect(lastQueued, -900);
    vi.advanceTimersByTime(DRAW_DURATION_MS + 400);
    expect(lastQueued.hasAttribute("data-ink")).toBe(false);
    expect(images.some((el) => el.getAttribute("data-ink") === "drawing")).toBe(true);
  });

  it("never replays an image already drawn on this page", async () => {
    const [image] = article(1);
    setRect(image, 1400);
    const teardown = mountInkReveal({ doc: document, win: fakeWindow() });
    vi.useFakeTimers();
    setRect(image, 500);
    FakeObserver.last.enter(image);
    await vi.waitFor(() => expect(image.getAttribute("data-ink")).toBe("drawing"));
    vi.advanceTimersByTime(DRAW_DURATION_MS + 100);
    teardown();

    // Back to the article: a fresh document with the same image, below the fold again
    const [again] = article(1);
    setRect(again, 1400);
    mountInkReveal({ doc: document, win: fakeWindow() });
    expect(again.hasAttribute("data-ink")).toBe(false);
  });

  it("does nothing under reduced motion", () => {
    const [image] = article(1);
    setRect(image, 1400);
    const teardown = mountInkReveal({
      doc: document,
      win: fakeWindow({ "(prefers-reduced-motion: reduce)": true }),
    });
    expect(image.hasAttribute("data-ink")).toBe(false);
    teardown();
  });

  it("stops listening on teardown", async () => {
    const [image] = article(1);
    setRect(image, 1400);
    const teardown = mountInkReveal({ doc: document, win: fakeWindow() });
    const observer = FakeObserver.last;
    teardown();
    expect(observer.observed.size).toBe(0);
    setRect(image, 500);
    observer.enter(image);
    await flush();
    expect(image.getAttribute("data-ink")).toBe("pending");
  });
});
