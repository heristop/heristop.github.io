/* Scroll reveal: content below the fold settles into place as it scrolls in, once.

   Markup API (styles in `_scroll-reveal.scss`):
     data-scroll-reveal               this element rises in (opacity + a few px of travel)
     data-scroll-reveal="fade"        opacity only (rules, wide media)
     data-scroll-reveal="settle"      opacity + a breath of scale (cards, players, diagrams)
     data-scroll-reveal-group[=…]     each element child is an item, with the group's variant
   Siblings that enter together follow one another, 50ms apart, six steps at most.

   Only this script ever hides anything, through `data-scroll-reveal-state`:
     pending   below the fold, waiting for its turn
     entering  playing (a transition back to the element's own styles)
     shown     at rest for good (kept, so an item that also had a CSS entrance never replays it)
   Without scripts, under reduced motion, in an automated browser (screenshots) or for anything
   already on screen when the page arrives, nothing is hidden. */

export const REVEAL_ATTR = "data-scroll-reveal";
export const GROUP_ATTR = "data-scroll-reveal-group";
export const STATE_ATTR = "data-scroll-reveal-state";
export const DELAY_PROPERTY = "--scroll-reveal-delay";

export const DURATION_MS = 420;
export const STAGGER_MS = 50;
// Six steps at most: the seventh item of a long list never waits more than the sixth
export const MAX_STAGGER_STEPS = 6;
// Items start below the fold so the motion is under way as they come into view
export const LEAD_FRACTION = 0.15;
// Entering above this line of the viewport means a jump (anchor, find, restore), not a scroll
export const ARRIVAL_LINE = 0.6;
// Faster than this (px/ms) the reader is flicking past: content is simply there
export const FAST_SCROLL = 2.5;
// How far ahead (in viewports) a fling settles what it is about to pass
export const FLING_REACH = 4;
const VELOCITY_WINDOW_MS = 150;
const SETTLE_SLACK_MS = 60;
const WAITING = `[${STATE_ATTR}="pending"], [${STATE_ATTR}="entering"]`;

const show = (el: HTMLElement) => {
  el.setAttribute(STATE_ATTR, "shown");
  el.style.removeProperty(DELAY_PROPERTY);
};

/* Sets down at once everything still waiting or playing under `root`: when the reader filters,
   sorts or searches, rows just move, they never wait for the observer or replay an entrance */
export const settleScrollReveal = (root: ParentNode): void => {
  for (const el of root.querySelectorAll<HTMLElement>(WAITING)) {
    show(el);
  }
};

export const staggerDelay = (index: number): number =>
  Math.min(index, MAX_STAGGER_STEPS - 1) * STAGGER_MS;

/* Every element the page asked to reveal, in document order, each once */
export const collectTargets = (doc: Document): HTMLElement[] => {
  const targets = new Set<HTMLElement>();
  for (const el of doc.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}], [${GROUP_ATTR}] > *`)) {
    if (!el.hasAttribute(GROUP_ATTR)) {
      targets.add(el);
    }
  }
  return [...targets];
};

/* Already on screen or above it (first paint, a restored scroll, the body a view transition just
   brought in): shown as is, never hidden then replayed */
export const isSeen = (rect: { top: number }, viewportHeight: number): boolean =>
  rect.top < viewportHeight * (1 + LEAD_FRACTION);

/* Whether an entering item should play, or simply be there */
export const shouldAnimate = (
  rect: { top: number },
  viewportHeight: number,
  velocity: number,
): boolean => velocity < FAST_SCROLL && rect.top >= viewportHeight * ARRIVAL_LINE;

// Siblings entering in the same frame (a group's items, a run of paragraphs) follow one another
const staggerKey = (el: Element): Element => el.parentElement ?? el;

interface MountOptions {
  doc?: Document;
  win?: Window & typeof globalThis;
}

/* Wires the reveals for the current page and returns its teardown. */
export const mountScrollReveal = ({
  doc = document,
  win = window,
}: MountOptions = {}): (() => void) => {
  const noop = () => {};
  if (
    typeof win.IntersectionObserver !== "function" ||
    win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    win.navigator?.webdriver === true
  ) {
    return noop;
  }

  const pending = new Set<HTMLElement>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let lastY = win.scrollY;
  let lastTime = win.performance.now();

  const settle = (el: HTMLElement) => {
    pending.delete(el);
    show(el);
  };

  const play = (el: HTMLElement, delay: number) => {
    pending.delete(el);
    if (delay > 0) {
      el.style.setProperty(DELAY_PROPERTY, `${delay}ms`);
    }
    el.setAttribute(STATE_ATTR, "entering");
    // The timer is the source of truth: transitionend never fires for a hidden or detached item
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        if (el.getAttribute(STATE_ATTR) === "entering") {
          settle(el);
        }
      },
      delay + DURATION_MS + SETTLE_SLACK_MS,
    );
    timers.add(timer);
  };

  // Scroll speed between two observer callbacks close in time; unknown (0) after a pause
  const sampleVelocity = (): number => {
    const now = win.performance.now();
    const y = win.scrollY;
    const elapsed = now - lastTime;
    const velocity =
      elapsed > 0 && elapsed < VELOCITY_WINDOW_MS ? Math.abs(y - lastY) / elapsed : 0;
    lastY = y;
    lastTime = now;
    return velocity;
  };

  const observer = new win.IntersectionObserver(
    (entries) => {
      // Settled from outside meanwhile (a filter, a sort): nothing left to play
      for (const el of pending) {
        if (el.getAttribute(STATE_ATTR) !== "pending") {
          pending.delete(el);
          observer.unobserve(el);
        }
      }
      const entering = entries.filter(
        (entry) => entry.isIntersecting && pending.has(entry.target as HTMLElement),
      );
      if (entering.length === 0) {
        return;
      }
      const velocity = sampleVelocity();
      const viewportHeight = win.innerHeight;
      const slots = new Map<Element, number>();
      for (const entry of entering) {
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        if (!shouldAnimate(entry.boundingClientRect, viewportHeight, velocity)) {
          settle(el);
          continue;
        }
        const group = staggerKey(el);
        const index = slots.get(group) ?? 0;
        slots.set(group, index + 1);
        play(el, staggerDelay(index));
      }
      /* Jumped past (End key, an anchor, a restored scroll): what lies above is already read, at
         rest. During a fling, what lies a few screens ahead is set down too, before it flies by */
      const ahead = velocity >= FAST_SCROLL ? viewportHeight * FLING_REACH : 0;
      for (const el of pending) {
        const box = el.getBoundingClientRect();
        if (box.bottom <= 0 || box.top < ahead) {
          observer.unobserve(el);
          settle(el);
        }
      }
    },
    { rootMargin: `20% 0px ${LEAD_FRACTION * 100}% 0px` },
  );

  // Read every box first, then write: one layout pass for the whole page
  const targets = collectTargets(doc).filter((el) => !el.hasAttribute(STATE_ATTR));
  const viewportHeight = win.innerHeight;
  const boxes = targets.map((el) => el.getBoundingClientRect());
  targets.forEach((el, index) => {
    const box = boxes[index];
    if (!box || isSeen(box, viewportHeight)) {
      return;
    }
    el.setAttribute(STATE_ATTR, "pending");
    pending.add(el);
    observer.observe(el);
  });

  return () => {
    observer.disconnect();
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
    // Whatever was still waiting is shown, so a torn-down page never keeps hidden content
    settleScrollReveal(doc);
    pending.clear();
  };
};
