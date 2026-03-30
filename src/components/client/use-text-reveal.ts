/* eslint-disable no-duplicate-imports, max-lines */
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
const WAVE_FREQUENCY = 0.8;
const WAVE_AMPLITUDE = 0.3;
const DURATION_VARIATION = 0.15;
const SEED_OFFSET_DUR = 300;
const BLUR_MIN = 2;
const BLUR_EDGE_EXTRA = 3;
const DEFAULT_BASE_DURATION_MS = 900;

const segmenter = new Intl.Segmenter();

interface LineStyleOptions {
  durationMs: number;
  easing: string;
  index: number;
  reducedMotion: boolean;
  showAnimation: boolean;
  staggerMs: number;
}

interface CharDrift {
  blur: number;
  char: string;
  delay: number;
  driftX: number;
  driftY: number;
  duration: number;
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

interface CharDriftParams {
  baseDuration: number;
  blur: number;
  char: string;
  delay: number;
  key: string;
  seed: number;
}

const createCharDrift = ({
  baseDuration,
  blur,
  char,
  delay,
  key,
  seed,
}: CharDriftParams): CharDrift => {
  const durationVar =
    (seededRandom(seed + SEED_OFFSET_DUR) - HALF) * 2 * DURATION_VARIATION;
  return {
    blur,
    char,
    delay,
    driftX: (seededRandom(seed) - HALF) * DRIFT_X_RANGE,
    driftY: -(seededRandom(seed + SEED_OFFSET_Y) * DRIFT_Y_RANGE + DRIFT_Y_MIN),
    duration: Math.round(baseDuration * (1 + durationVar)),
    key,
    rotation:
      (seededRandom(seed + SEED_OFFSET_R) - HALF) * DRIFT_ROTATION_RANGE,
  };
};

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

// eslint-disable-next-line max-lines-per-function
const useTextLayout = (
  text: string | undefined,
  font: string,
  lineHeight: number,
  containerRef: RefObject<HTMLElement | null>,
) => {
  const [lines, setLines] = useState<LayoutLine[]>([]);
  const [revealed, setRevealed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const preparedRef = useRef<ReturnType<typeof prepareWithSegments> | null>(
    null,
  );
  // eslint-disable-next-line unicorn/no-useless-undefined
  const prevTextRef = useRef<string | undefined>(undefined);
  // eslint-disable-next-line unicorn/no-useless-undefined
  const prevFontRef = useRef<string | undefined>(undefined);

  const computeLines = useCallback(() => {
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

const buildCharDrifts = (
  lines: LayoutLine[],
  baseDuration = DEFAULT_BASE_DURATION_MS,
): CharDrift[][] =>
  lines.map((line, lineIndex) => {
    const chars = Array.from(
      segmenter.segment(line.text),
      (seg) => seg.segment,
    );
    const lineLen = Math.max(chars.length - 1, 1);
    return chars.map((char, charIndex) => {
      const seed = lineIndex * CHARS_PER_LINE + charIndex + 1;
      const baseDelay =
        lineIndex * LINE_STAGGER_MS + charIndex * CHAR_STAGGER_MS;
      const wave = Math.sin(charIndex * WAVE_FREQUENCY) * WAVE_AMPLITUDE;
      const delay = Math.round(baseDelay * (1 + wave));
      const edgeness = Math.abs(charIndex / lineLen - HALF) * 2;
      const blur = BLUR_MIN + edgeness * BLUR_EDGE_EXTRA;
      return createCharDrift({
        baseDuration,
        blur,
        char,
        delay,
        key: `${lineIndex}-${charIndex}-${char}`,
        seed,
      });
    });
  });

const buildWordDrifts = (
  inputText: string,
  baseDuration = DEFAULT_BASE_DURATION_MS,
): WordDrift[] => {
  const words = inputText.split(/(\s+)/);
  let globalIndex = 0;
  return words.map((word, wordIndex) => {
    const wordChars = Array.from(segmenter.segment(word), (seg) => seg.segment);
    const chars = wordChars.map((char, charIndex) => {
      const seed = globalIndex + 1;
      globalIndex += 1;
      const baseDelay =
        wordIndex * WORD_STAGGER_MS + charIndex * WORD_CHAR_STAGGER_MS;
      const wave = Math.sin(globalIndex * WAVE_FREQUENCY) * WAVE_AMPLITUDE;
      const delay = Math.round(baseDelay * (1 + wave));
      const blur = BLUR_MIN + BLUR_EDGE_EXTRA * HALF;
      return createCharDrift({
        baseDuration,
        blur,
        char,
        delay,
        key: `w${wordIndex}-c${charIndex}-${char}`,
        seed,
      });
    });
    return { chars, word };
  });
};

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
    "--char-blur": `${charDrift.blur}px`,
    "--char-delay": `${charDrift.delay}ms`,
    "--char-duration": `${charDrift.duration}ms`,
    "--drift-r": `${charDrift.rotation}deg`,
    "--drift-x": `${charDrift.driftX}px`,
    "--drift-y": `${charDrift.driftY}px`,
    display: "inline-block",
  } as React.CSSProperties;
};

const isWordDrifts = (
  drifts: CharDrift[][] | WordDrift[],
): drifts is WordDrift[] => drifts.length > 0 && "word" in drifts[0];

const maxAnimationEnd = (drifts: CharDrift[][] | WordDrift[]): number => {
  let max = 0;

  if (isWordDrifts(drifts)) {
    for (const wordDrift of drifts) {
      for (const charDrift of wordDrift.chars) {
        const end = charDrift.delay + charDrift.duration;
        if (end > max) {
          max = end;
        }
      }
    }
  } else {
    for (const line of drifts) {
      for (const charDrift of line) {
        const end = charDrift.delay + charDrift.duration;
        if (end > max) {
          max = end;
        }
      }
    }
  }
  return max;
};

// eslint-disable-next-line no-named-export
export {
  buildCharDrifts,
  buildWordDrifts,
  getLineStyle,
  getSmokeClass,
  getSmokeStyle,
  maxAnimationEnd,
  seededRandom,
  useReducedMotion,
  useTextLayout,
  type CharDrift,
  type WordDrift,
};
