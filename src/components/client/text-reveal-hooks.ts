import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutLine } from "@chenglou/pretext";
import type { RefObject } from "react";

const REVEAL_DELAY_MS = 50;
const RESIZE_DEBOUNCE_MS = 150;

// Pretext can split a word across lines at a non-space boundary; merge the orphan back
const rejoinBrokenWords = (rawLines: string[]): string[] => {
  const rejoined: string[] = [];
  let carry = "";
  for (let idx = 0; idx < rawLines.length; idx++) {
    let line = carry + rawLines[idx];
    carry = "";
    const next = rawLines[idx + 1];
    if (next !== undefined && !line.endsWith(" ") && !next.startsWith(" ")) {
      const lastSpace = line.lastIndexOf(" ");
      if (lastSpace > 0) {
        carry = line.slice(lastSpace + 1);
        line = line.slice(0, lastSpace);
      }
    }
    rejoined.push(line);
  }
  if (carry) {
    rejoined[rejoined.length - 1] += ` ${carry}`;
  }
  return rejoined;
};

const toLayoutLines = (texts: string[]): LayoutLine[] => {
  const emptyPos = { graphemeIndex: 0, segmentIndex: 0 };
  return texts.map((text) => ({
    end: emptyPos,
    start: emptyPos,
    text,
    width: 0,
  }));
};

const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };
    mq.addEventListener("change", handler);
    return () => {
      mq.removeEventListener("change", handler);
    };
  }, []);

  return reduced;
};

interface ComputeLinesDeps {
  containerRef: RefObject<HTMLElement | null>;
  font: string;
  lineHeight: number;
  preparedRef: RefObject<ReturnType<typeof prepareWithSegments> | null>;
  prevFontRef: RefObject<string | null>;
  prevTextRef: RefObject<string | null>;
  setLines: (lines: LayoutLine[]) => void;
  text: string | undefined;
}

const useComputeLines = (deps: ComputeLinesDeps) => {
  const { text, font, lineHeight, containerRef, preparedRef, prevTextRef, prevFontRef, setLines } =
    deps;
  return useCallback(() => {
    if (text === undefined || text === "" || !containerRef.current) {
      return;
    }

    if (prevTextRef.current !== text || prevFontRef.current !== font) {
      preparedRef.current = prepareWithSegments(text, font);
      prevTextRef.current = text;
      prevFontRef.current = font;
    }

    const prepared = preparedRef.current;
    if (!prepared) {
      return;
    }

    const width = containerRef.current.offsetWidth;
    if (width <= 0) {
      return;
    }

    const result = layoutWithLines(prepared, width, lineHeight);
    const rawTexts = result.lines.map((item) => item.text);
    setLines(toLayoutLines(rejoinBrokenWords(rawTexts)));
  }, [text, font, lineHeight, containerRef, preparedRef, prevTextRef, prevFontRef, setLines]);
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
  const preparedRef = useRef<ReturnType<typeof prepareWithSegments> | null>(null);
  const prevTextRef = useRef<string | null>(null);
  const prevFontRef = useRef<string | null>(null);

  const computeLines = useComputeLines({
    containerRef,
    font,
    lineHeight,
    preparedRef,
    prevFontRef,
    prevTextRef,
    setLines,
    text,
  });

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

const textRevealHooks = { useReducedMotion, useTextLayout };

export default textRevealHooks;
