import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARRIVAL_LINE,
  DELAY_PROPERTY,
  DURATION_MS,
  FAST_SCROLL,
  MAX_STAGGER_STEPS,
  STAGGER_MS,
  STATE_ATTR,
  collectTargets,
  isSeen,
  settleScrollReveal,
  mountScrollReveal,
  shouldAnimate,
  staggerDelay,
} from "../../../src/components/client/scroll-reveal";

const VIEWPORT = 800;

class FakeObserver {
  static last: FakeObserver | undefined;
  observed = new Set<Element>();
  disconnected = false;
  constructor(public callback: IntersectionObserverCallback) {
    FakeObserver.last = this;
  }
  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.disconnected = true;
    this.observed.clear();
  }
  /* Delivers entries for elements now intersecting, at the given top */
  fire(...items: { el: Element; top: number }[]) {
    const entries = items.map(({ el, top }) => ({
      target: el,
      isIntersecting: true,
      boundingClientRect: { top, bottom: top + 100 } as DOMRect,
    })) as unknown as IntersectionObserverEntry[];
    this.callback(entries, this as unknown as IntersectionObserver);
  }
}

/* Lays out `[data-top]` elements at that offset from the viewport's top */
const place = (el: Element, top: number) => {
  el.setAttribute("data-top", String(top));
};

const rects = () => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const top = Number(this.getAttribute("data-top") ?? 0);
    return { top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100 } as DOMRect;
  });
};

interface WinOptions {
  reduce?: boolean;
  webdriver?: boolean;
  observer?: boolean;
}

let now = 0;
let scrollY = 0;

const fakeWin = ({ reduce = false, webdriver = false, observer = true }: WinOptions = {}) =>
  ({
    IntersectionObserver: observer ? FakeObserver : undefined,
    matchMedia: (query: string) => ({ matches: reduce && query.includes("reduce") }),
    navigator: { webdriver },
    innerHeight: VIEWPORT,
    get scrollY() {
      return scrollY;
    },
    performance: { now: () => now },
  }) as unknown as Window & typeof globalThis;

const state = (el: Element) => el.getAttribute(STATE_ATTR);

beforeEach(() => {
  vi.useFakeTimers();
  rects();
  now = 0;
  scrollY = 0;
  FakeObserver.last = undefined;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("helpers", () => {
  it("caps the stagger so a long list never waits", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(2)).toBe(2 * STAGGER_MS);
    expect(staggerDelay(40)).toBe((MAX_STAGGER_STEPS - 1) * STAGGER_MS);
  });

  it("treats what is on screen, just below it or above it as already seen", () => {
    expect(isSeen({ top: -2000 }, VIEWPORT)).toBe(true);
    expect(isSeen({ top: 300 }, VIEWPORT)).toBe(true);
    expect(isSeen({ top: VIEWPORT + 40 }, VIEWPORT)).toBe(true);
    expect(isSeen({ top: VIEWPORT * 2 }, VIEWPORT)).toBe(false);
  });

  it("plays only for items arriving from below at reading speed", () => {
    expect(shouldAnimate({ top: VIEWPORT }, VIEWPORT, 0.5)).toBe(true);
    expect(shouldAnimate({ top: VIEWPORT * ARRIVAL_LINE - 1 }, VIEWPORT, 0)).toBe(false);
    expect(shouldAnimate({ top: -50 }, VIEWPORT, 0)).toBe(false);
    expect(shouldAnimate({ top: VIEWPORT }, VIEWPORT, FAST_SCROLL + 1)).toBe(false);
  });

  it("collects marked items and group children once, in document order, never the group", () => {
    document.body.innerHTML = `
      <p id="a" data-scroll-reveal></p>
      <ul id="g" data-scroll-reveal-group><li id="b"></li><li id="c" data-scroll-reveal></li></ul>`;
    expect(collectTargets(document).map((el) => el.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mountScrollReveal", () => {
  const page = () => {
    document.body.innerHTML = `
      <h2 id="seen" data-scroll-reveal></h2>
      <ul data-scroll-reveal-group>
        <li id="one"></li><li id="two"></li><li id="three"></li>
      </ul>
      <p id="far" data-scroll-reveal></p>`;
    const get = (id: string) => document.getElementById(id) as HTMLElement;
    place(get("seen"), 100);
    place(get("one"), 1800);
    place(get("two"), 1800);
    place(get("three"), 1900);
    place(get("far"), 4000);
    return get;
  };

  it("leaves what is already on screen at rest and hides only what lies below", () => {
    const get = page();
    mountScrollReveal({ doc: document, win: fakeWin() });
    expect(state(get("seen"))).toBeNull();
    expect(state(get("one"))).toBe("pending");
    expect(state(get("far"))).toBe("pending");
    expect(FakeObserver.last?.observed.has(get("seen"))).toBe(false);
  });

  it("reveals once, staggering siblings that enter together, then hands back the element", () => {
    const get = page();
    mountScrollReveal({ doc: document, win: fakeWin() });
    const observer = FakeObserver.last as FakeObserver;
    now = 1000;
    scrollY = 1000;
    observer.fire({ el: get("one"), top: VIEWPORT }, { el: get("two"), top: VIEWPORT });

    expect(state(get("one"))).toBe("entering");
    expect(state(get("two"))).toBe("entering");
    expect(get("one").style.getPropertyValue(DELAY_PROPERTY)).toBe("");
    expect(get("two").style.getPropertyValue(DELAY_PROPERTY)).toBe(`${STAGGER_MS}ms`);
    expect(observer.observed.has(get("one"))).toBe(false);

    vi.advanceTimersByTime(STAGGER_MS + DURATION_MS + 100);
    expect(state(get("one"))).toBe("shown");
    expect(state(get("two"))).toBe("shown");
    expect(get("two").style.getPropertyValue(DELAY_PROPERTY)).toBe("");

    // A second intersection never replays it
    observer.fire({ el: get("one"), top: VIEWPORT });
    expect(state(get("one"))).toBe("shown");
  });

  it("shows items at rest when they arrive by a jump or a fast fling", () => {
    const get = page();
    mountScrollReveal({ doc: document, win: fakeWin() });
    const observer = FakeObserver.last as FakeObserver;

    // Anchor jump: lands mid-viewport
    now = 1000;
    scrollY = 1500;
    observer.fire({ el: get("one"), top: 200 });
    expect(state(get("one"))).toBe("shown");

    // Fling: 3000px in 50ms
    now = 1050;
    scrollY = 4500;
    observer.fire({ el: get("far"), top: VIEWPORT });
    expect(state(get("far"))).toBe("shown");
  });

  it("settles what was skipped above the viewport once something below is reached", () => {
    const get = page();
    mountScrollReveal({ doc: document, win: fakeWin() });
    place(get("one"), -1500);
    place(get("two"), -1500);
    place(get("three"), -1400);
    now = 5000;
    scrollY = 3300;
    FakeObserver.last?.fire({ el: get("far"), top: VIEWPORT });
    expect(state(get("one"))).toBe("shown");
    expect(state(get("three"))).toBe("shown");
    expect(state(get("far"))).toBe("entering");
  });

  it("hides nothing under reduced motion, in an automated browser or without IntersectionObserver", () => {
    for (const options of [{ reduce: true }, { webdriver: true }, { observer: false }]) {
      const get = page();
      mountScrollReveal({ doc: document, win: fakeWin(options) });
      expect(state(get("one"))).toBeNull();
      expect(state(get("far"))).toBeNull();
    }
  });

  it("tears down: stops observing, cancels timers and shows whatever was still waiting", () => {
    const get = page();
    const teardown = mountScrollReveal({ doc: document, win: fakeWin() });
    const observer = FakeObserver.last as FakeObserver;
    now = 1000;
    observer.fire({ el: get("one"), top: VIEWPORT });
    teardown();
    expect(observer.disconnected).toBe(true);
    expect(state(get("one"))).toBe("shown");
    expect(state(get("far"))).toBe("shown");
    vi.advanceTimersByTime(DURATION_MS * 2);
    expect(state(get("one"))).toBe("shown");
  });

  it("skips items another mount already holds, so a re-run never double-observes", () => {
    page();
    mountScrollReveal({ doc: document, win: fakeWin() });
    const first = FakeObserver.last as FakeObserver;
    mountScrollReveal({ doc: document, win: fakeWin() });
    expect(first.observed.size).toBe(4);
    expect(FakeObserver.last?.observed.size).toBe(0);
  });
});

describe("flings", () => {
  it("sets down what lies a few screens ahead before it flies past", () => {
    document.body.innerHTML = `
      <p id="a" data-scroll-reveal></p><p id="b" data-scroll-reveal></p><p id="c" data-scroll-reveal></p>`;
    const [a, b, c] = ["a", "b", "c"].map((id) => document.getElementById(id) as HTMLElement);
    place(a, 1500);
    place(b, 2500);
    place(c, 20_000);
    mountScrollReveal({ doc: document, win: fakeWin() });
    now = 20;
    scrollY = 900;
    place(b, 1600);
    place(c, 19_100);
    FakeObserver.last?.fire({ el: a, top: VIEWPORT });
    expect(state(a)).toBe("shown");
    expect(state(b)).toBe("shown");
    expect(state(c)).toBe("pending");
  });
});

describe("settleScrollReveal", () => {
  it("sets down a filtered list at once, and the observer never replays it", () => {
    document.body.innerHTML = `
      <ol id="list" data-scroll-reveal-group><li id="a"></li><li id="b"></li></ol>
      <p id="out" data-scroll-reveal></p>`;
    const [a, b, out] = ["a", "b", "out"].map((id) => document.getElementById(id) as HTMLElement);
    place(a, 1500);
    place(b, 1600);
    place(out, 3000);
    mountScrollReveal({ doc: document, win: fakeWin() });
    settleScrollReveal(document.getElementById("list") as HTMLElement);
    expect(state(a)).toBe("shown");
    expect(state(b)).toBe("shown");
    expect(state(out)).toBe("pending");
    now = 1000;
    FakeObserver.last?.fire({ el: a, top: VIEWPORT }, { el: out, top: VIEWPORT });
    expect(state(a)).toBe("shown");
    expect(state(out)).toBe("entering");
    expect(FakeObserver.last?.observed.has(a)).toBe(false);
  });
});
