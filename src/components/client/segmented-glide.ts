/* Magnetic segmented control (.index-seg: the /blog/ filter, the /tags/ sort). The selected
   background is one pill that glides to the pressed option, the way the header's nav highlight
   follows the pointer (header-init.ts). The move is a CSS transition on transform and width, so a
   second click mid-glide retargets from where the pill is. On hover it leans a few pixels toward
   the hovered option. Arrow keys move the selection (and the pill) between options.

   The page owns the selection: it sets aria-pressed, and the pill follows any change to it. Until
   the pill is placed (or without script) each pressed option draws its own background. */

const LEAN_PX = 3;
const REDUCED = "(prefers-reduced-motion: reduce)";

const optionsOf = (root: HTMLElement): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>(".index-seg__option"),
];

const pressedOf = (root: HTMLElement): HTMLButtonElement | undefined =>
  optionsOf(root).find((option) => option.getAttribute("aria-pressed") === "true");

// A React island renders its own pill (React must own every node it reconciles)
const pillOf = (root: HTMLElement): HTMLElement => {
  const existing = root.querySelector<HTMLElement>(".index-seg__pill");
  if (existing) {
    return existing;
  }
  const pill = document.createElement("span");
  pill.className = "index-seg__pill";
  pill.setAttribute("aria-hidden", "true");
  root.prepend(pill);
  return pill;
};

export const mountSegmentedGlide = (root: HTMLElement): (() => void) => {
  if (root.dataset.glide === "true") {
    return () => {};
  }
  root.dataset.glide = "true";

  const glide = pillOf(root);

  const still = () => globalThis.matchMedia?.(REDUCED).matches === true;
  let lean = 0;

  const place = (instant = false) => {
    const target = pressedOf(root);
    if (!target) {
      glide.style.opacity = "0";
      return;
    }
    if (instant) {
      glide.style.transition = "none";
    }
    glide.style.width = `${target.offsetWidth}px`;
    glide.style.transform = `translateX(${target.offsetLeft + lean}px)`;
    glide.style.opacity = "";
    if (instant) {
      // Commit the jump before the transition comes back
      void glide.offsetWidth;
      glide.style.transition = "";
    }
  };

  const onEnter = (event: Event) => {
    const option = (event.target as Element | null)?.closest<HTMLButtonElement>(
      ".index-seg__option",
    );
    const target = pressedOf(root);
    if (!option || !target || still()) {
      return;
    }
    const next = option === target ? 0 : Math.sign(option.offsetLeft - target.offsetLeft) * LEAN_PX;
    if (next !== lean) {
      lean = next;
      place();
    }
  };

  const onLeave = () => {
    if (lean !== 0) {
      lean = 0;
      place();
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    const options = optionsOf(root);
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) {
      return;
    }
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(current + step + options.length) % options.length];
    next?.focus();
    next?.click();
  };

  // Whoever changes the selection, the pill follows
  const pressedWatch = new MutationObserver(() => {
    lean = 0;
    place();
  });
  pressedWatch.observe(root, {
    attributes: true,
    attributeFilter: ["aria-pressed"],
    subtree: true,
  });

  // Font swaps and resizes change the options' widths: follow without gliding
  const sizeWatch =
    typeof ResizeObserver === "function" ? new ResizeObserver(() => place(true)) : undefined;
  sizeWatch?.observe(root);

  root.addEventListener("pointerover", onEnter);
  root.addEventListener("pointerleave", onLeave);
  root.addEventListener("keydown", onKey);

  place(true);
  requestAnimationFrame(() => {
    root.dataset.glideReady = "true";
  });

  return () => {
    pressedWatch.disconnect();
    sizeWatch?.disconnect();
    root.removeEventListener("pointerover", onEnter);
    root.removeEventListener("pointerleave", onLeave);
    root.removeEventListener("keydown", onKey);
    delete root.dataset.glide;
  };
};

export const mountSegmentedGlides = (scope: ParentNode = document): (() => void) => {
  const teardowns = [...scope.querySelectorAll<HTMLElement>(".index-seg")].map(mountSegmentedGlide);
  return () => {
    for (const teardown of teardowns) {
      teardown();
    }
  };
};
