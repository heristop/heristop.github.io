import { createPortraitRenderer } from "./footer-portrait-renderer";

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function mountFooterPortrait(element: HTMLElement): () => void {
  const portrait = element.querySelector("img");
  const canvas = element.querySelector("canvas");
  if (!portrait || !canvas) return () => {};

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = matchMedia("(hover: hover) and (pointer: fine)");
  const events = new AbortController();
  const { signal } = events;
  const position = { x: 0, y: 0 },
    target = { x: 0, y: 0 };
  let renderer: ReturnType<typeof createPortraitRenderer> | undefined;
  let box = portrait.getBoundingClientRect();
  let frame = 0,
    lastTime = 0;
  let inView = false,
    loading = false,
    disposed = false;
  const enabled = () =>
    inView && !disposed && !document.hidden && !motion.matches && pointer.matches;

  function center() {
    cancelAnimationFrame(frame);
    frame = 0;
    position.x = position.y = target.x = target.y = 0;
    renderer?.draw(0, 0);
  }

  function measure() {
    if (!inView) return;
    box = (portrait!.hidden ? canvas! : portrait!).getBoundingClientRect();
    renderer?.resize(box.width, window.devicePixelRatio);
    renderer?.draw(position.x, position.y);
  }

  function tick(time: number) {
    frame = 0;
    if (!enabled()) return;
    const elapsed = Math.min(64, Math.max(0, time - lastTime));
    lastTime = time;
    const amount = 1 - Math.exp(-elapsed / 48);
    position.x += (target.x - position.x) * amount;
    position.y += (target.y - position.y) * amount;
    const settled = Math.abs(target.x - position.x) + Math.abs(target.y - position.y) < 0.001;
    if (settled) Object.assign(position, target);
    renderer?.draw(position.x, position.y);
    if (!settled) frame = requestAnimationFrame(tick);
  }

  function animate() {
    if (!frame && (position.x !== target.x || position.y !== target.y)) {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  async function load() {
    if (loading || renderer || !enabled()) return;
    loading = true;
    try {
      await portrait!.decode();
      if (disposed) return;
      renderer = createPortraitRenderer(canvas!, portrait!);
      canvas!.hidden = false;
      portrait!.hidden = true;
      measure();
      preferencesChanged();
    } catch {
      // The server-rendered image remains usable when canvas or loading fails.
      canvas!.hidden = true;
      portrait!.hidden = false;
    } finally {
      loading = false;
    }
  }

  function preferencesChanged() {
    if (!enabled()) center();
    const useCanvas = Boolean(renderer) && !motion.matches && pointer.matches;
    canvas!.hidden = !useCanvas;
    portrait!.hidden = useCanvas;
    if (useCanvas) measure();
    if (enabled()) void load();
  }

  const observer =
    typeof IntersectionObserver === "undefined"
      ? undefined
      : new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          if (inView) {
            measure();
            void load();
          } else center();
        });
  if (observer) observer.observe(element);
  else {
    inView = true;
    void load();
  }

  document.addEventListener(
    "pointermove",
    (event) => {
      if (!renderer || !enabled() || event.pointerType === "touch") return;
      target.x = clamp((event.clientX - box.left - box.width * 0.5) / (box.width * 0.62));
      target.y = clamp((event.clientY - box.top - box.height * 0.39) / (box.height * 0.65));
      animate();
    },
    { passive: true, signal },
  );
  document.addEventListener(
    "pointerleave",
    () => {
      if (!renderer || !enabled()) return;
      target.x = target.y = 0;
      animate();
    },
    { signal },
  );
  document.addEventListener("visibilitychange", preferencesChanged, { signal });
  window.addEventListener("blur", center, { signal });
  window.addEventListener("resize", measure, { passive: true, signal });
  window.addEventListener("scroll", measure, { passive: true, signal });
  motion.addEventListener("change", preferencesChanged);
  pointer.addEventListener("change", preferencesChanged);

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    events.abort();
    observer?.disconnect();
    motion.removeEventListener("change", preferencesChanged);
    pointer.removeEventListener("change", preferencesChanged);
  };
}
