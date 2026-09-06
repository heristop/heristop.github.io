import { useEffect, useRef, useState } from "react";
import type { Direction, Position } from "../types";
import { directionFromDelta } from "../board/geometry";

const STEP_DURATION_MS = 200;

// Ping-pong so the walk reads as a stride rather than a loop with a visible seam.
const WALK_FRAMES = [0, 1, 2, 1];

interface ZazenStep {
  renderPosition: Position;
  facing: Direction;
  frame: number;
  moving: boolean;
}

// Checked in JS, not only in CSS. A CSS media query cannot stop a rAF tween — it would
// keep running and keep committing state, just without a transition to show for it.
const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

// Smoothstep. Gentle enough to read as a considered step rather than a slide.
const ease = (t: number): number => t * t * (3 - 2 * t);

const useZazenStep = (position: Position): ZazenStep => {
  const [renderPosition, setRenderPosition] = useState<Position>(position);
  const [facing, setFacing] = useState<Direction>("S");
  const [progress, setProgress] = useState(1);
  const previous = useRef<Position>(position);
  const rafRef = useRef<number | undefined>(undefined);

  const { posX, posY } = position;

  useEffect(() => {
    const from = previous.current;
    if (from.posX === posX && from.posY === posY) {
      return;
    }
    const to = { posX, posY };
    previous.current = to;

    const direction = directionFromDelta(from, to);
    if (direction) {
      setFacing(direction);
    }

    if (prefersReducedMotion()) {
      setRenderPosition(to);
      setProgress(1);
      return;
    }

    const startedAt = Date.now();
    setProgress(0);

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const t = Math.min(1, elapsed / STEP_DURATION_MS);
      const eased = ease(t);
      setProgress(t);
      if (t < 1) {
        setRenderPosition({
          posX: from.posX + (to.posX - from.posX) * eased,
          posY: from.posY + (to.posY - from.posY) * eased,
        });
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // Land exactly on the tile. Never leave the pilgrim on a fractional coordinate.
      setRenderPosition(to);
    };

    rafRef.current = requestAnimationFrame(tick);

    // The loop runs only while a step is in flight, and is cancelled if another step
    // starts or the component unmounts. There is no permanent rAF loop anywhere here —
    // the idle bob is CSS.
    return () => {
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [posX, posY]);

  const moving = progress < 1;

  return {
    facing,
    frame: moving ? WALK_FRAMES[Math.floor(progress * WALK_FRAMES.length) % WALK_FRAMES.length] : 0,
    moving,
    renderPosition,
  };
};

export default useZazenStep;
export type { ZazenStep };
export { prefersReducedMotion, STEP_DURATION_MS };
