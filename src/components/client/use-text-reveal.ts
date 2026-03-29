/* eslint-disable no-duplicate-imports */
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutLine } from "@chenglou/pretext";
import type { RefObject } from "react";
/* eslint-enable no-duplicate-imports */

const REVEAL_DELAY_MS = 50;
const RESIZE_DEBOUNCE_MS = 150;

interface LineStyleOptions {
  showAnimation: boolean;
  reducedMotion: boolean;
  index: number;
  durationMs: number;
  easing: string;
  staggerMs: number;
}

const useReducedMotion = () => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };
    mq.addEventListener("change", handler);
    return () => {
      mq.removeEventListener("change", handler);
    };
  }, []);

  return reducedMotion;
};

const useTextLayout = (
  text: string | undefined,
  font: string,
  lineHeight: number,
  containerRef: RefObject<HTMLElement | null>,
) => {
  const [lines, setLines] = useState<LayoutLine[]>([]);
  const [revealed, setRevealed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computeLines = useCallback(() => {
    if (text === undefined || text === "" || !containerRef.current) {
      return;
    }
    const width = containerRef.current.offsetWidth;
    if (width <= 0) {
      return;
    }
    const prepared = prepareWithSegments(text, font);
    const result = layoutWithLines(prepared, width, lineHeight);
    setLines(result.lines);
  }, [text, font, lineHeight, containerRef]);

  useEffect(() => {
    computeLines();
    const timer = setTimeout(() => {
      setRevealed(true);
    }, REVEAL_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [computeLines]);

  useEffect(() => {
    const onResize = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(computeLines, RESIZE_DEBOUNCE_MS);
    };
    globalThis.addEventListener("resize", onResize);
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      globalThis.removeEventListener("resize", onResize);
    };
  }, [computeLines]);

  return { lines, revealed };
};

const getLineStyle = ({
  showAnimation,
  reducedMotion,
  index,
  durationMs,
  easing,
  staggerMs,
}: LineStyleOptions) => {
  if (reducedMotion) {
    return { display: "block" as const, opacity: 1 };
  }
  if (showAnimation) {
    return {
      display: "block" as const,
      opacity: 1,
      transform: "translateY(0)",
      transition: `opacity ${durationMs}ms ${easing} ${index * staggerMs}ms, transform ${durationMs}ms ${easing} ${index * staggerMs}ms`,
    };
  }
  return {
    display: "block" as const,
    opacity: 0,
    transform: "translateY(8px)",
    transition: "none",
  };
};

// eslint-disable-next-line no-named-export
export { getLineStyle, useReducedMotion, useTextLayout };
