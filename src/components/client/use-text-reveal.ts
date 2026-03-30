/* eslint-disable no-duplicate-imports */
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LayoutLine } from "@chenglou/pretext";
import type { RefObject } from "react";
/* eslint-enable no-duplicate-imports */

const REVEAL_DELAY_MS = 50;
const RESIZE_DEBOUNCE_MS = 150;

const DRIFT_X_RANGE = 40;
const DRIFT_Y_MIN = 10;
const DRIFT_Y_RANGE = 20;
const DRIFT_ROTATION_RANGE = 30;
const LINE_STAGGER_MS = 120;
const CHAR_STAGGER_MS = 30;
const WORD_STAGGER_MS = 40;
const WORD_CHAR_STAGGER_MS = 20;

const SEED_FACTOR_A = 127.1;
const SEED_FACTOR_B = 311.7;
const SEED_MULTIPLIER = 43_758.5453;
const SEED_OFFSET_Y = 100;
const SEED_OFFSET_R = 200;

const HALF = 0.5;
const CHARS_PER_LINE = 20;

interface LineStyleOptions {
  durationMs: number;
  easing: string;
  index: number;
  reducedMotion: boolean;
  showAnimation: boolean;
  staggerMs: number;
}

interface CharDrift {
  char: string;
  delay: number;
  driftX: number;
  driftY: number;
  key: string;
  rotation: number;
}

interface WordDrift {
  chars: CharDrift[];
  word: string;
}

const seededRandom = (seed: number): number => {
  const val = Math.sin(seed * SEED_FACTOR_A + SEED_FACTOR_B) * SEED_MULTIPLIER;
  return val - Math.floor(val);
};

const createCharDrift = (
  seed: number,
  delay: number,
  char: string,
  key: string,
): CharDrift => ({
  char,
  delay,
  driftX: (seededRandom(seed) - HALF) * DRIFT_X_RANGE,
  driftY: -(seededRandom(seed + SEED_OFFSET_Y) * DRIFT_Y_RANGE + DRIFT_Y_MIN),
  key,
  rotation: (seededRandom(seed + SEED_OFFSET_R) - HALF) * DRIFT_ROTATION_RANGE,
});

// --- Word rejoin: fix pretext splitting words mid-character ---

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

// --- Hooks ---

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
    const rawTexts = result.lines.map((item) => item.text);
    setLines(toLayoutLines(rejoinBrokenWords(rawTexts)));
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

// --- Style helpers ---

const getLineStyle = ({
  durationMs,
  easing,
  index,
  reducedMotion,
  showAnimation,
  staggerMs,
}: LineStyleOptions) => {
  if (reducedMotion) {
    return { display: "block" as const, opacity: 1 };
  }
  if (showAnimation) {
    const delay = index * staggerMs;
    return {
      display: "block" as const,
      opacity: 1,
      transform: "translateY(0)",
      transition: `opacity ${durationMs}ms ${easing} ${delay}ms, transform ${durationMs}ms ${easing} ${delay}ms`,
    };
  }
  return {
    display: "block" as const,
    opacity: 0,
    transform: "translateY(8px)",
    transition: "none",
  };
};

// --- Char drift builders ---

const buildCharDrifts = (lines: LayoutLine[]): CharDrift[][] =>
  lines.map((line, lineIndex) =>
    Array.from(
      new Intl.Segmenter().segment(line.text),
      (seg) => seg.segment,
    ).map((char, charIndex) => {
      const seed = lineIndex * CHARS_PER_LINE + charIndex + 1;
      const delay = lineIndex * LINE_STAGGER_MS + charIndex * CHAR_STAGGER_MS;
      return createCharDrift(
        seed,
        delay,
        char,
        `${lineIndex}-${charIndex}-${char}`,
      );
    }),
  );

const buildWordDrifts = (inputText: string): WordDrift[] => {
  const words = inputText.split(/(\s+)/);
  let globalIndex = 0;
  return words.map((word, wordIndex) => {
    const chars = Array.from(
      new Intl.Segmenter().segment(word),
      (seg) => seg.segment,
    ).map((char, charIndex) => {
      const seed = globalIndex + 1;
      globalIndex += 1;
      const delay =
        wordIndex * WORD_STAGGER_MS + charIndex * WORD_CHAR_STAGGER_MS;
      return createCharDrift(
        seed,
        delay,
        char,
        `w${wordIndex}-c${charIndex}-${char}`,
      );
    });
    return { chars, word };
  });
};

// --- Smoke animation helpers ---

const getSmokeClass = (appeared: boolean, reducedMotion: boolean): string => {
  if (reducedMotion) {
    return "";
  }
  if (appeared) {
    return "haiku-char--appear";
  }
  return "haiku-char--smoke";
};

const getSmokeStyle = (
  charDrift: CharDrift,
  reducedMotion: boolean,
): React.CSSProperties => {
  if (reducedMotion) {
    return { display: "inline-block" };
  }
  return {
    "--drift-r": `${charDrift.rotation}deg`,
    "--drift-x": `${charDrift.driftX}px`,
    "--drift-y": `${charDrift.driftY}px`,
    display: "inline-block",
    transitionDelay: `${charDrift.delay}ms`,
  } as React.CSSProperties;
};

// eslint-disable-next-line no-named-export
export {
  buildCharDrifts,
  buildWordDrifts,
  getLineStyle,
  getSmokeClass,
  getSmokeStyle,
  seededRandom,
  useReducedMotion,
  useTextLayout,
  type CharDrift,
  type WordDrift,
};
