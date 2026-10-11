/* Ink reveal: an article's illustrations are drawn as they scroll into view. Each one waits as a
   faint pencil sketch; when it enters, a brush lays the ink along a diagonal, then the colour soaks
   in like a wash on paper. The look lives in `_ink-reveal.scss`, keyed by `data-ink`:
     pending  the sketch, waiting for its turn
     drawing  the ritual is playing (brush, wash, settle)
   Once played the attribute is removed, so the image is back to its ordinary styles. */

export const INK_SCOPE = ".post-page";
export const MIN_INK_SIZE = 120;
export const MAX_CONCURRENT = 3;
export const PAIR_STAGGER_MS = 80;
export const DRAW_DURATION_MS = 1100;
export const DRAW_DURATION_COARSE_MS = 860;

const INK_ATTR = "data-ink";

// Chrome around the prose, cards and diagrams keep their own presentation
const EXCLUDED_ANCESTORS = [
  "a",
  "picture[data-ink-skip]",
  "[data-ink-skip]",
  ".mermaid",
  ".mermaid-wide",
  ".post-page__meta",
  ".post-page__tags-slot",
  ".post-page__share",
  ".post-page__share-bottom",
  ".post-page__pager",
  ".site-header",
  ".path-of-stones",
].join(", ");

const EXCLUDED_CLASS = /(?:^|[\s_-])(?:emoji|avatar|icon|banner)(?:$|[\s_-])/i;
// Icons, vector diagrams, and anything that moves on its own (a sketch filter would freeze it)
const EXCLUDED_SRC =
  /(?:^data:|\/icons\/|\.svg(?:$|[?#])|\.gif(?:$|[?#])|\.apng(?:$|[?#])|mermaid)/i;

interface Size {
  width: number;
  height: number;
}

const attributeSize = (img: HTMLImageElement): Size => ({
  width: Number(img.getAttribute("width")) || 0,
  height: Number(img.getAttribute("height")) || 0,
});

/* Whether an image belongs to the drawing ritual. Size comes from the width/height attributes the
   build writes (a lazy image not loaded yet can lay out far smaller than it will be); `rendered`,
   its laid-out box, stands in only when they are missing. */
export const isInkEligible = (img: HTMLImageElement, rendered?: Size): boolean => {
  if (!img.closest(INK_SCOPE) || img.closest(EXCLUDED_ANCESTORS)) {
    return false;
  }
  const src = img.currentSrc || img.getAttribute("src") || "";
  if (!src || EXCLUDED_SRC.test(src) || EXCLUDED_CLASS.test(img.className)) {
    return false;
  }
  const intrinsic = attributeSize(img);
  const size = intrinsic.width > 0 && intrinsic.height > 0 ? intrinsic : (rendered ?? intrinsic);
  return size.width >= MIN_INK_SIZE && size.height >= MIN_INK_SIZE;
};

/* Images that enter together inside one `.img-container` (a side-by-side pair) are drawn by the
   same hand, one after the other: each sibling starts PAIR_STAGGER_MS after the previous one. */
export const staggerDelays = (images: readonly Element[]): Map<Element, number> => {
  const delays = new Map<Element, number>();
  const seen = new Map<Element, number>();
  for (const img of images) {
    const group = img.closest(".img-container") ?? img;
    const index = seen.get(group) ?? 0;
    seen.set(group, index + 1);
    delays.set(img, index * PAIR_STAGGER_MS);
  }
  return delays;
};

export const isInView = (rect: { top: number; bottom: number }, viewportHeight: number): boolean =>
  rect.bottom > 0 && rect.top < viewportHeight;

/* Images already drawn this session, per page, so going back to an article never replays them */
const drawnKeys = new Set<string>();
const keyOf = (img: HTMLImageElement, path: string) => `${path}|${img.getAttribute("src") ?? ""}`;

export const resetInkMemory = (): void => drawnKeys.clear();

interface MountOptions {
  doc?: Document;
  win?: Window & typeof globalThis;
}

/* Wires the ritual for the current page and returns its teardown. */
export const mountInkReveal = ({
  doc = document,
  win = window,
}: MountOptions = {}): (() => void) => {
  const noop = () => {};
  if (
    typeof win.IntersectionObserver !== "function" ||
    win.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return noop;
  }

  const path = win.location.pathname;
  const coarse = win.matchMedia?.("(pointer: coarse)").matches ?? false;
  const duration = coarse ? DRAW_DURATION_COARSE_MS : DRAW_DURATION_MS;

  const queue: { img: HTMLImageElement; delay: number }[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const active = new Set<HTMLImageElement>();
  let disposed = false;

  const settle = (img: HTMLImageElement) => {
    img.removeAttribute(INK_ATTR);
    img.style.removeProperty("--ink-delay");
    drawnKeys.add(keyOf(img, path));
  };

  const finish = (img: HTMLImageElement) => {
    if (!active.delete(img)) {
      return;
    }
    settle(img);
    pump();
  };

  const play = (img: HTMLImageElement, delay: number) => {
    active.add(img);
    img.style.setProperty("--ink-delay", `${delay}ms`);
    img.setAttribute(INK_ATTR, "drawing");
    // The timer is the source of truth: animationend never fires for a hidden or detached image
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        finish(img);
      },
      delay + duration + 60,
    );
    timers.add(timer);
  };

  const ready = (img: HTMLImageElement): Promise<void> =>
    img.complete ? Promise.resolve() : img.decode().catch(() => undefined);

  function pump() {
    while (!disposed && active.size < MAX_CONCURRENT && queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        break;
      }
      // Scrolled past while waiting its turn: no one is watching, so it is simply finished
      if (!isInView(next.img.getBoundingClientRect(), win.innerHeight)) {
        settle(next.img);
        continue;
      }
      play(next.img, next.delay);
    }
  }

  const observer = new win.IntersectionObserver(
    (entries) => {
      const entering = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target as HTMLImageElement);
      if (entering.length === 0) {
        return;
      }
      const delays = staggerDelays(entering);
      for (const img of entering) {
        observer.unobserve(img);
        void ready(img).then(() => {
          if (disposed || img.getAttribute(INK_ATTR) !== "pending") {
            return;
          }
          queue.push({ img, delay: delays.get(img) ?? 0 });
          pump();
        });
      }
    },
    { threshold: 0.25, rootMargin: "0px 0px -10% 0px" },
  );

  // Read every box first, then write: one layout pass for the whole article
  const images = [...doc.querySelectorAll<HTMLImageElement>(`${INK_SCOPE} img`)];
  const boxes = images.map((img) => img.getBoundingClientRect());
  images.forEach((img, index) => {
    const box = boxes[index];
    if (!box || !isInkEligible(img, box)) {
      return;
    }
    /* Already on screen (first paint, or the body a view transition just brought in) or drawn
       before: shown as is, never drawn over content the reader has already seen */
    if (drawnKeys.has(keyOf(img, path)) || isInView(box, win.innerHeight)) {
      drawnKeys.add(keyOf(img, path));
      return;
    }
    img.setAttribute(INK_ATTR, "pending");
    observer.observe(img);
  });

  return () => {
    disposed = true;
    observer.disconnect();
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
    queue.length = 0;
    active.clear();
  };
};
