import type { Position } from "../types";

export const RAKE_TRAIL_MS = 800;
export interface RakeTrail extends Position {
  dx: number;
  dy: number;
  born: number;
}

// Short parallel furrows in the ground plane, aligned with the step just taken.
export function rakeGrooves(trail: RakeTrail): number[][] {
  const x = trail.dx - trail.dy;
  const y = (trail.dx + trail.dy) / 2;
  return [-4, 0, 4].map((offset) => {
    const cx = 32 - y * offset;
    const cy = 16 + (x * offset) / 2;
    return [
      cx - x * 11,
      cy - y * 11,
      cx + x * 9,
      cy + y * 9,
      cx + x * 9,
      cy + y * 9 + 0.7,
      cx - x * 11,
      cy - y * 11 + 0.7,
    ];
  });
}
