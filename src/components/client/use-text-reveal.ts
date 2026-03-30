import type { LayoutLine } from "@chenglou/pretext";
import textRevealHooks from "./text-reveal-hooks";

const { useReducedMotion, useTextLayout } = textRevealHooks;

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

interface CharDriftParams {
  baseDuration: number;
  blur: number;
  char: string;
  delay: number;
  key: string;
  seed: number;
}

const seededRandom = (seed: number): number => {
  const val = Math.sin(seed * SEED_FACTOR_A + SEED_FACTOR_B) * SEED_MULTIPLIER;
  return val - Math.floor(val);
};

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

const getCharClass = (
  settled: boolean,
  appeared: boolean,
  reducedMotion: boolean,
): string => {
  if (settled) {
    return "haiku-char--settled";
  }
  return getSmokeClass(appeared, reducedMotion);
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

const textRevealExports = {
  buildCharDrifts,
  buildWordDrifts,
  getCharClass,
  getLineStyle,
  getSmokeClass,
  getSmokeStyle,
  maxAnimationEnd,
  seededRandom,
  useReducedMotion,
  useTextLayout,
};

export default textRevealExports;
export type { CharDrift, WordDrift };
