import { useCallback, useEffect, useRef, useState } from "react";
import { loadPretext, usesCoarsePointer } from "./pretext-loader";
import type { LayoutLine, prepareWithSegments } from "@chenglou/pretext";
import type { RefObject } from "react";

const REVEAL_DELAY_MS = 50;
const RESIZE_DEBOUNCE_MS = 150;
type PreparedText = ReturnType<typeof prepareWithSegments>;

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
  activeRef: RefObject<boolean>;
  containerRef: RefObject<HTMLElement | null>;
  font: string;
  lineHeight: number;
  layoutKeyRef: RefObject<string | null>;
  preparedRef: RefObject<PreparedText | null>;
  prevFontRef: RefObject<string | null>;
  prevTextRef: RefObject<string | null>;
  requestIdRef: RefObject<number>;
  setLines: (lines: LayoutLine[]) => void;
  text: string | undefined;
}

const useComputeLines = (deps: ComputeLinesDeps) => {
  const {
    activeRef,
    containerRef,
    font,
    layoutKeyRef,
    lineHeight,
    preparedRef,
    prevFontRef,
    prevTextRef,
    requestIdRef,
    setLines,
    text,
  } = deps;
  return useCallback(async () => {
    if (text === undefined || text === "" || !containerRef.current) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (usesCoarsePointer()) {
      const layoutKey = `coarse:${text}`;
      preparedRef.current = null;
      prevTextRef.current = null;
      prevFontRef.current = null;
      if (layoutKeyRef.current !== layoutKey) {
        layoutKeyRef.current = layoutKey;
        setLines(toLayoutLines([text]));
      }
      return;
    }

    const width = containerRef.current.offsetWidth;
    if (width <= 0) {
      return;
    }

    const layoutKey = `pretext:${text}\u0000${font}\u0000${lineHeight}\u0000${width}`;
    if (layoutKeyRef.current === layoutKey && preparedRef.current) {
      return;
    }

    const pretext = await loadPretext();
    if (!activeRef.current || requestIdRef.current !== requestId || !containerRef.current) {
      return;
    }

    if (prevTextRef.current !== text || prevFontRef.current !== font) {
      preparedRef.current = pretext.prepareWithSegments(text, font);
      prevTextRef.current = text;
      prevFontRef.current = font;
    }

    const prepared = preparedRef.current;
    if (!prepared) {
      return;
    }

    const result = pretext.layoutWithLines(prepared, width, lineHeight);
    const rawTexts = result.lines.map((item) => item.text);
    layoutKeyRef.current = layoutKey;
    setLines(toLayoutLines(rejoinBrokenWords(rawTexts)));
  }, [
    activeRef,
    containerRef,
    font,
    layoutKeyRef,
    lineHeight,
    preparedRef,
    prevFontRef,
    prevTextRef,
    requestIdRef,
    setLines,
    text,
  ]);
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
  const activeRef = useRef(true);
  const layoutKeyRef = useRef<string | null>(null);
  const preparedRef = useRef<PreparedText | null>(null);
  const prevTextRef = useRef<string | null>(null);
  const prevFontRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const computeLines = useComputeLines({
    activeRef,
    containerRef,
    font,
    layoutKeyRef,
    lineHeight,
    preparedRef,
    prevFontRef,
    prevTextRef,
    requestIdRef,
    setLines,
    text,
  });

  useEffect(() => {
    activeRef.current = true;
    setRevealed(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void computeLines().finally(() => {
      if (cancelled || !activeRef.current) {
        return;
      }
      timer = setTimeout(() => {
        setRevealed(true);
      }, REVEAL_DELAY_MS);
    });
    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [computeLines]);

  useEffect(() => {
    const onResize = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        void computeLines();
      }, RESIZE_DEBOUNCE_MS);
    };
    globalThis.addEventListener("resize", onResize);
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      globalThis.removeEventListener("resize", onResize);
    };
  }, [computeLines]);

  useEffect(
    () => () => {
      activeRef.current = false;
      requestIdRef.current += 1;
    },
    [],
  );

  return { lines, revealed };
};

const textRevealHooks = { useReducedMotion, useTextLayout };

export default textRevealHooks;
