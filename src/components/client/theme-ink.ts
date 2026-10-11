/* Changing gardens: a drop of sumi falls from the theme button and soaks across the washi until
   the whole page is night. Going back, the ink draws itself back into the button and the paper
   underneath is dawn again: the same path in reverse, so the change is spatial, not a cut.

   The drop is a View Transition of the root: the new (dark) snapshot is revealed through a
   growing, organic mask; on the way back the old (dark) snapshot is masked down to nothing. The
   mask is a raster blob drawn once on a canvas: an irregular rim (a few slow lobes plus fibre-fine
   jitter) with a soft feathered edge. Scaling a bitmap is cheap on the compositor, and its edge
   softens as it spreads, the way a bleed widens on wet paper. */

export type InkDirection = "spread" | "recede";

/* The blob's rim never comes closer to the centre than this fraction of the mask's side; the
   mask is sized so that this inner radius still reaches the farthest corner */
export const INK_INNER_RADIUS = 0.28;
export const INK_SPREAD_MS = 720;
export const INK_RECEDE_MS = 600;
/* The drop gathers for a beat, soaks out quickly, then slows as the paper drinks the last of it */
export const INK_SPREAD_EASE = "cubic-bezier(0.5, 0.05, 0.2, 1)";
/* Drawn back: the rim comes into view at once (its first stretch is off screen), then gathers
   slowly into the button */
export const INK_RECEDE_EASE = "cubic-bezier(0.33, 0.85, 0.4, 1)";
export const INK_CLASS = "theme-transition";
export const INK_RECEDE_CLASS = "theme-transition--recede";
export const INK_MASK_PROPERTY = "--theme-ink-mask";

const MASK_PX = 768;
const BASE_RADIUS = 0.37;
/* [amplitude, lobes] pairs: slow swells, then finer wobble; summed amplitude stays < 0.07 */
const LOBES: readonly (readonly [number, number])[] = [
  [0.024, 3],
  [0.017, 5],
  [0.01, 11],
  [0.005, 23],
];

export interface InkPoint {
  x: number;
  y: number;
}

export const inkOrigin = (rect: Pick<DOMRect, "left" | "top" | "width" | "height">): InkPoint => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

/* Distance from the origin to the farthest viewport corner */
export const inkReach = ({ x, y }: InkPoint, width: number, height: number): number =>
  Math.hypot(Math.max(x, width - x), Math.max(y, height - y));

/* Side of the square mask whose inner rim just covers that corner */
export const inkMaskSize = (reach: number): number => Math.ceil(reach / INK_INNER_RADIUS);

/* Keyframes for the masked snapshot. Size and position move together, so the drop stays centred
   on the button whatever the easing does in between. */
export const inkKeyframes = (
  { x, y }: InkPoint,
  size: number,
  direction: InkDirection,
): Keyframe[] => {
  const drop = { maskSize: "0px 0px", maskPosition: `${x}px ${y}px` };
  const page = {
    maskSize: `${size}px ${size}px`,
    maskPosition: `${x - size / 2}px ${y - size / 2}px`,
  };
  return direction === "spread" ? [drop, page] : [page, drop];
};

/* Radius of the blob at angle `theta`, as a fraction of the mask side */
export const inkRimRadius = (theta: number, phases: readonly number[], jitter = 0): number =>
  LOBES.reduce(
    (radius, [amplitude, lobes], index) =>
      radius + amplitude * Math.sin(lobes * theta + (phases[index] ?? 0)),
    BASE_RADIUS,
  ) + jitter;

let maskUrl: string | undefined;

/* Draws the blob once and hands it to CSS as a custom property on <html> */
export const ensureInkMask = (doc: Document = document): boolean => {
  if (maskUrl) {
    return true;
  }
  try {
    const canvas = doc.createElement("canvas");
    canvas.width = MASK_PX;
    canvas.height = MASK_PX;
    const context = canvas.getContext("2d");
    if (!context) {
      return false;
    }
    const phases = LOBES.map(() => Math.random() * Math.PI * 2);
    const steps = 360;
    const centre = MASK_PX / 2;
    context.filter = `blur(${MASK_PX * 0.006}px)`;
    context.fillStyle = "#000";
    context.beginPath();
    for (let step = 0; step <= steps; step++) {
      const theta = (step / steps) * Math.PI * 2;
      const jitter = (Math.random() - 0.5) * 0.004;
      const radius = inkRimRadius(theta, phases, jitter) * MASK_PX;
      const px = centre + Math.cos(theta) * radius;
      const py = centre + Math.sin(theta) * radius;
      if (step === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    }
    context.closePath();
    context.fill();
    maskUrl = `url(${canvas.toDataURL("image/png")})`;
    doc.documentElement.style.setProperty(INK_MASK_PROPERTY, maskUrl);
    return true;
  } catch {
    return false;
  }
};

/* Runs `commit` inside an ink View Transition from `origin`. Resolves once the page is settled. */
export const runInkTransition = (
  commit: () => void,
  origin: InkPoint,
  direction: InkDirection,
): Promise<void> => {
  const root = document.documentElement;
  const masked = ensureInkMask();
  root.classList.add(INK_CLASS);
  root.classList.toggle(INK_RECEDE_CLASS, direction === "recede");
  const done = () => {
    root.classList.remove(INK_CLASS, INK_RECEDE_CLASS);
  };
  const transition = document.startViewTransition(commit);
  transition.ready
    .then(() => {
      if (!masked) {
        // No canvas to draw the drop with: a short, quiet cross-fade instead
        root.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 150,
          easing: "ease-out",
          fill: "both",
          pseudoElement: "::view-transition-new(root)",
        });
        return;
      }
      const size = inkMaskSize(inkReach(origin, innerWidth, innerHeight));
      root.animate(inkKeyframes(origin, size, direction), {
        duration: direction === "spread" ? INK_SPREAD_MS : INK_RECEDE_MS,
        easing: direction === "spread" ? INK_SPREAD_EASE : INK_RECEDE_EASE,
        fill: "both",
        pseudoElement:
          direction === "spread" ? "::view-transition-new(root)" : "::view-transition-old(root)",
      });
    })
    .catch(() => undefined);
  return transition.finished.then(done, done);
};
