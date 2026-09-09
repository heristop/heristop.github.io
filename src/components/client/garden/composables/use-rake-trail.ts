import { useEffect, useState } from "react";
import type { MapTile, Position } from "../types";
import { RAKE_TRAIL_MS, type RakeTrail } from "../rendering/rake-trail";
import { prefersReducedMotion } from "./use-step";

export default function useRakeTrail(
  map: readonly MapTile[],
  position: Position,
  activity: string,
) {
  const [previous, setPrevious] = useState({ position, activity });
  const [trails, setTrails] = useState<RakeTrail[]>([]);
  const from = previous.position;
  const dx = position.posX - from.posX;
  const dy = position.posY - from.posY;
  if (dx || dy || activity !== previous.activity) {
    setPrevious({ position, activity });
    if (activity === "ready") setTrails([]);
    else if (activity === "walk" && Math.abs(dx) + Math.abs(dy) === 1 && !prefersReducedMotion()) {
      const tile = map.find((cell) => cell.posX === from.posX && cell.posY === from.posY);
      if (tile && !tile.laid && (tile.sprite === "sand-0" || tile.sprite === "sand-1")) {
        const born = Date.now();
        setTrails([
          ...trails.filter((trail) => born - trail.born < RAKE_TRAIL_MS).slice(-3),
          { ...from, dx, dy, born },
        ]);
      }
    }
  }
  useEffect(() => {
    if (!trails.length) return;
    const timer = setTimeout(() => setTrails([]), RAKE_TRAIL_MS);
    return () => clearTimeout(timer);
  }, [trails]);
  return trails;
}
