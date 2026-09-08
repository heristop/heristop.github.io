import { useEffect, useRef, useState } from "react";
import type { Position } from "../types";
import { prefersReducedMotion } from "./use-step";

// Shared by followers so their gait ends with the 460ms position transition.
export default function useStride(position: Position): boolean {
  const previous = useRef(position);
  const [walking, setWalking] = useState(false);
  const { posX, posY } = position;
  useEffect(() => {
    const moved = previous.current.posX !== posX || previous.current.posY !== posY;
    previous.current = { posX, posY };
    if (!moved || prefersReducedMotion()) {
      setWalking(false);
      return;
    }
    setWalking(true);
    const timer = setTimeout(() => setWalking(false), 460);
    return () => clearTimeout(timer);
  }, [posX, posY]);
  return walking;
}
