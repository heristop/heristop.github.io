/* Bottom-sheet drag physics, kept free of the DOM so the feel can be pinned down in tests.
   Offsets are in px, positive = towards the bottom edge (closing); velocities in px/s. */

/* Below this width the mobile menu is a bottom sheet; from it up, the dropdown under the bar */
export const SHEET_QUERY = "(width < 37.5rem)";

// Finger travel before a press on a row becomes a drag (Apple's ~10px hysteresis)
export const DRAG_SLOP_PX = 8;

// A release this fast decides on its own, whatever the distance travelled
const FLICK_VELOCITY = 500;

// Only the last stretch of the gesture says where the finger is going
const VELOCITY_WINDOW_MS = 100;

/* Progressive resistance past a bound: the further the overshoot, the less the sheet follows,
   approaching the full dimension but never reaching it */
export const rubberband = (overshoot: number, dimension: number, constant = 0.55): number => {
  if (overshoot <= 0 || dimension <= 0) {
    return 0;
  }
  return (overshoot * dimension * constant) / (dimension + constant * overshoot);
};

/* Finger travel → sheet offset. Downward it is glued to the finger (1:1); upward there is
   nothing more to show, so it gives a little and resists */
export const sheetOffset = (deltaY: number, height: number): number =>
  deltaY >= 0 ? deltaY : -rubberband(-deltaY, height);

/* Where a release would come to rest under scroll-like deceleration (Apple's projection) */
export const projectMomentum = (velocity: number, decelerationRate = 0.998): number =>
  ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);

/* Close or snap back. A clear flick wins outright; otherwise the projected resting point must
   pass half the sheet. A sheet moving back up never closes, however far it was pulled. */
export const shouldDismiss = (offset: number, velocity: number, height: number): boolean => {
  if (velocity >= FLICK_VELOCITY) {
    return true;
  }
  if (velocity <= -FLICK_VELOCITY / 5) {
    return false;
  }
  return offset + projectMomentum(velocity) > height / 2;
};

/* Duration that lets the ease-out curve leave at the finger's speed, so release has no seam.
   cubic-bezier(0.22, 1, 0.36, 1) starts at a slope of 1 / 0.22: the first frames run ≈4.5× the
   average speed. Clamped so a slow drag still finishes promptly and a fast one stays visible. */
const EASE_OUT_START_SLOPE = 1 / 0.22;
export const handoffDuration = (
  distance: number,
  velocity: number,
  min = 120,
  max = 280,
): number => {
  const speed = Math.abs(velocity);
  if (distance <= 0 || speed < 1) {
    return max;
  }
  const ms = ((EASE_OUT_START_SLOPE * distance) / speed) * 1000;
  return Math.round(Math.min(max, Math.max(min, ms)));
};

interface Sample {
  y: number;
  t: number;
}

/* Recent pointer positions → release velocity (px/s), from the last ~100ms only */
export const createVelocityTracker = () => {
  let samples: Sample[] = [];
  return {
    reset(y: number, t: number): void {
      samples = [{ y, t }];
    },
    add(y: number, t: number): void {
      samples.push({ y, t });
      const cutoff = t - VELOCITY_WINDOW_MS;
      while (samples.length > 2 && (samples[0]?.t ?? t) < cutoff) {
        samples.shift();
      }
    },
    velocity(now: number): number {
      const first = samples[0];
      const last = samples.at(-1);
      // A finger that stopped before lifting carries no momentum
      if (!first || !last || last === first || now - last.t > VELOCITY_WINDOW_MS) {
        return 0;
      }
      const dt = last.t - first.t;
      return dt > 0 ? ((last.y - first.y) / dt) * 1000 : 0;
    },
  };
};
