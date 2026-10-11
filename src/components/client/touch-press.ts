// Where the finger lands on a card, _touch.scss blooms a faint ink wash (like a drop on washi),
// so the press answers from the point of contact rather than the card's centre. Only the
// coordinates come from here; the drawing, timing and reduced-motion handling stay in CSS.
const PRESSABLE = ".zen-card, .latest-posts__item";
const COARSE_POINTER = "(pointer: coarse)";

let installed = false;

const onPointerDown = (event: PointerEvent): void => {
  if (event.pointerType !== "touch" || !(event.target instanceof Element)) {
    return;
  }
  const surface = event.target.closest<HTMLElement>(PRESSABLE);
  if (surface === null) {
    return;
  }
  const rect = surface.getBoundingClientRect();
  surface.style.setProperty("--press-x", `${Math.round(event.clientX - rect.left)}px`);
  surface.style.setProperty("--press-y", `${Math.round(event.clientY - rect.top)}px`);
};

const initializeTouchPress = (): void => {
  if (installed || !globalThis.matchMedia?.(COARSE_POINTER).matches) {
    return;
  }
  installed = true;
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
};

export default initializeTouchPress;
