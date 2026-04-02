import { useEffect, useMemo, useState } from "react";
import type { WordDrift } from "./use-text-reveal";
import dissolve from "./haiku-dissolve";
import textReveal from "./use-text-reveal";

const { buildWordDrifts, maxAnimationEnd, useReducedMotion } = textReveal;
const { getHaikuCharClass } = dissolve;

const APPEAR_DELAY_MS = 200;
const HAIKU_BASE_DURATION_MS = 1000;
const BREATHE_BUFFER_MS = 300;
const BREATHE_TIMEOUT_MS = 12_000;

interface HaikuAnimationResult {
  appeared: boolean;
  autoSettled: boolean;
  charClass: string;
  reducedMotion: boolean;
  words: WordDrift[];
}

const useAppearTimer = (text: string | undefined, reducedMotion: boolean) => {
  const [appeared, setAppeared] = useState(false);

  useEffect(() => {
    if (text === undefined || appeared || reducedMotion) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, appeared, reducedMotion]);

  return appeared;
};

const useBreathePhase = (
  appeared: boolean,
  reducedMotion: boolean,
  words: WordDrift[],
) => {
  const [breathing, setBreathing] = useState(false);
  const [autoSettled, setAutoSettled] = useState(false);

  useEffect(() => {
    if (!appeared || breathing || reducedMotion || words.length === 0) {
      return;
    }
    const isMobileTouch = globalThis.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;
    const totalMs = maxAnimationEnd(words) + BREATHE_BUFFER_MS;
    if (isMobileTouch) {
      const timer = setTimeout(() => {
        setAutoSettled(true);
      }, totalMs);
      return () => {
        clearTimeout(timer);
      };
    }
    const timer = setTimeout(() => {
      setBreathing(true);
    }, totalMs);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, breathing, reducedMotion, words]);

  useEffect(() => {
    if (!breathing || autoSettled || reducedMotion) {
      return;
    }
    const timer = setTimeout(() => {
      setAutoSettled(true);
    }, BREATHE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [breathing, autoSettled, reducedMotion]);

  return { autoSettled, breathing };
};

const useHaikuAnimation = (text: string | undefined): HaikuAnimationResult => {
  const reducedMotion = useReducedMotion();
  const appeared = useAppearTimer(text, reducedMotion);

  const words = useMemo(() => {
    if (text !== undefined && text !== "") {
      return buildWordDrifts(text, HAIKU_BASE_DURATION_MS);
    }
    return [];
  }, [text]);

  const { autoSettled, breathing } = useBreathePhase(
    appeared,
    reducedMotion,
    words,
  );

  let charClass = "haiku-char--settled";
  if (!autoSettled) {
    charClass = getHaikuCharClass(reducedMotion, breathing, appeared);
  }

  return { appeared, autoSettled, charClass, reducedMotion, words };
};

export default useHaikuAnimation;
