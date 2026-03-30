/* eslint-disable no-duplicate-imports, id-length */
import { buildWordDrifts, getSmokeStyle, maxAnimationEnd, useReducedMotion } from "./use-text-reveal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharDrift } from "./use-text-reveal";
/* eslint-enable no-duplicate-imports */

interface Props {
  url: string;
}

const DISSOLVE_RADIUS = 80;
const DISSOLVE_RADIUS_SQ = DISSOLVE_RADIUS * DISSOLVE_RADIUS;
const APPEAR_DELAY_MS = 200;
const DISSOLVE_OPACITY_FACTOR = 0.85;
const DISSOLVE_DRIFT_FACTOR = 0.6;
const DISSOLVE_ROTATION_FACTOR = 0.4;
const DISSOLVE_SCALE_FACTOR = 0.08;
const DISSOLVE_BLUR_MAX = 1.2;
const DISSOLVE_EASE_POWER = 1.5;
const DISSOLVE_TRANSITION = "opacity 120ms ease, transform 120ms ease, filter 120ms ease, color 120ms ease";
const RECOVER_TRANSITION = "opacity 650ms var(--zen-ease-spring), transform 650ms var(--zen-ease-spring), filter 650ms var(--zen-ease-spring), color 650ms var(--zen-ease-spring)";
const HAIKU_BASE_DURATION_MS = 1000;
const BREATHE_BUFFER_MS = 300;
const ACCENT_COLOR = "#c2185b";
const DISSOLVE_COLOR_PCT_MAX = 60;

const applyDissolveToElement = (el: HTMLSpanElement, intensity: number) => {
  const driftX = Number.parseFloat(el.style.getPropertyValue("--drift-x")) || 0;
  const driftY = Number.parseFloat(el.style.getPropertyValue("--drift-y")) || 0;
  const driftR = Number.parseFloat(el.style.getPropertyValue("--drift-r")) || 0;
  const eased = intensity ** DISSOLVE_EASE_POWER;
  const scale = 1 - eased * DISSOLVE_SCALE_FACTOR;
  const colorPct = Math.round(eased * DISSOLVE_COLOR_PCT_MAX);

  el.style.opacity = `${1 - eased * DISSOLVE_OPACITY_FACTOR}`;
  el.style.transform = `translate(${driftX * eased * DISSOLVE_DRIFT_FACTOR}px, ${driftY * eased * DISSOLVE_DRIFT_FACTOR}px) rotate(${driftR * eased * DISSOLVE_ROTATION_FACTOR}deg) scale(${scale})`;
  el.style.filter = `blur(${eased * DISSOLVE_BLUR_MAX}px)`;
  el.style.color = `color-mix(in oklch, currentColor ${100 - colorPct}%, ${ACCENT_COLOR} ${colorPct}%)`;
  el.style.transition = DISSOLVE_TRANSITION;
};

const resetElement = (el: HTMLSpanElement) => {
  el.style.opacity = "1";
  el.style.transform = "translate(0, 0) rotate(0deg) scale(1)";
  el.style.filter = "blur(0)";
  el.style.color = "";
  el.style.transition = RECOVER_TRANSITION;
};

const CharSpan = ({ charDrift, charClass, reducedMotion, onRef }: {
  charClass: string;
  charDrift: CharDrift;
  onRef: (key: string, el: HTMLSpanElement | null) => void;
  reducedMotion: boolean;
}) => (
  <span
    key={charDrift.key}
    ref={(el) => { onRef(charDrift.key, el); }}
    className={charClass}
    style={getSmokeStyle(charDrift, reducedMotion)}
  >
    {charDrift.char}
  </span>
);

const WordSpan = ({ word, chars, charClass, reducedMotion, onRef }: {
  charClass: string;
  chars: CharDrift[];
  onRef: (key: string, el: HTMLSpanElement | null) => void;
  reducedMotion: boolean;
  word: string;
}) => {
  const key = chars[0]?.key ?? word;
  if (/^\s+$/.test(word)) { return <span key={key}>{" "}</span>; }
  return (
    <span key={key} style={{ display: "inline", whiteSpace: "nowrap" }}>
      {chars.map((cd) => (
        <CharSpan key={cd.key} charDrift={cd} charClass={charClass} reducedMotion={reducedMotion} onRef={onRef} />
      ))}
    </span>
  );
};

const useHaikuFetch = (url: string) => {
  const [text, setText] = useState<string | undefined>();

  useEffect(() => {
    const fetchHaiku = async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`);
        if (!res.ok) { throw new Error("Failed to fetch haiku"); }
        const value = await res.text();
        setText(value.trim());
      } catch {
        setText("A fresh haiku will be shared here soon.");
      }
    };
    void fetchHaiku();
  }, [url]);

  return text;
};

// eslint-disable-next-line max-lines-per-function
const useProximityDissolve = (charElsRef: React.RefObject<Map<string, HTMLSpanElement>>) => {
  const cachedCenters = useRef<Map<string, { x: number; y: number }>>(new Map());
  const dissolvedKeys = useRef<Set<string>>(new Set());
  const cacheValid = useRef(false);

  useEffect(() => {
    const invalidate = () => { cacheValid.current = false; };
    globalThis.addEventListener("resize", invalidate);
    globalThis.addEventListener("scroll", invalidate);
    return () => {
      globalThis.removeEventListener("resize", invalidate);
      globalThis.removeEventListener("scroll", invalidate);
    };
  }, []);

  const ensureCache = useCallback(() => {
    if (cacheValid.current) {
      return;
    }
    cachedCenters.current.clear();
    for (const [key, el] of charElsRef.current.entries()) {
      const rect = el.getBoundingClientRect();
      cachedCenters.current.set(key, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    cacheValid.current = true;
  }, [charElsRef]);

  const apply = useCallback((mouseX: number, mouseY: number) => {
    ensureCache();
    const nextDissolved = new Set<string>();

    for (const [key, center] of cachedCenters.current.entries()) {
      const deltaX = mouseX - center.x;
      const deltaY = mouseY - center.y;
      const distSq = deltaX * deltaX + deltaY * deltaY;

      if (distSq >= DISSOLVE_RADIUS_SQ) {
        if (dissolvedKeys.current.has(key)) {
          const el = charElsRef.current.get(key);
          if (el) {
            resetElement(el);
          }
        }
        // eslint-disable-next-line no-continue
        continue;
      }

      const el = charElsRef.current.get(key);
      if (!el) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const intensity = 1 - Math.sqrt(distSq) / DISSOLVE_RADIUS;
      applyDissolveToElement(el, intensity);
      nextDissolved.add(key);
    }
    dissolvedKeys.current = nextDissolved;
  }, [charElsRef, ensureCache]);

  const reset = useCallback(() => {
    for (const key of dissolvedKeys.current) {
      const el = charElsRef.current.get(key);
      if (el) {
        resetElement(el);
      }
    }
    dissolvedKeys.current.clear();
  }, [charElsRef]);

  return { apply, reset };
};

interface CardPointerOptions {
  appeared: boolean;
  apply: (mx: number, my: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  reset: () => void;
}

const useCardPointer = ({ containerRef, reducedMotion, appeared, apply, reset }: CardPointerOptions) => {
  const rafRef = useRef<number>(0);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (reducedMotion || !appeared) { return; }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const card = containerRef.current?.closest(".haiku-card");
      if (card instanceof HTMLElement) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mouse-x", `${clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${clientY - rect.top}px`);
        card.classList.add("haiku-card--hover");
      }
      apply(clientX, clientY);
    });
  }, [containerRef, reducedMotion, appeared, apply]);

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    handleMove(event.clientX, event.clientY);
  }, [handleMove]);

  const onTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch !== undefined) { handleMove(touch.clientX, touch.clientY); }
  }, [handleMove]);

  const onLeave = useCallback(() => {
    const card = containerRef.current?.closest(".haiku-card");
    if (card instanceof HTMLElement) { card.classList.remove("haiku-card--hover"); }
    reset();
  }, [containerRef, reset]);

  return { onLeave, onMouseMove, onTouchMove };
};

// eslint-disable-next-line max-lines-per-function
const ZenHaikuReveal = ({ url }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const charElsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [appeared, setAppeared] = useState(false);
  const [breathing, setBreathing] = useState(false);
  const reducedMotion = useReducedMotion();
  const text = useHaikuFetch(url);
  const { apply, reset } = useProximityDissolve(charElsRef);
  const { onLeave, onMouseMove, onTouchMove } = useCardPointer({ appeared, apply, containerRef, reducedMotion, reset });

  useEffect(() => {
    if (text === undefined || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [text, appeared, reducedMotion]);

  const words = useMemo(() => {
    if (text !== undefined && text !== "") { return buildWordDrifts(text, HAIKU_BASE_DURATION_MS); }
    return [];
  }, [text]);

  useEffect(() => {
    if (!appeared || breathing || reducedMotion || words.length === 0) { return; }
    const totalMs = maxAnimationEnd(words) + BREATHE_BUFFER_MS;
    const timer = setTimeout(() => { setBreathing(true); }, totalMs);
    return () => { clearTimeout(timer); };
  }, [appeared, breathing, reducedMotion, words]);

  const setCharRef = useCallback((key: string, el: HTMLSpanElement | null) => {
    if (el) { charElsRef.current.set(key, el); }
    else { charElsRef.current.delete(key); }
  }, []);

  let charClass = "haiku-char--smoke";
  if (reducedMotion) { charClass = ""; }
  else if (breathing) { charClass = "haiku-char--breathe"; }
  else if (appeared) { charClass = "haiku-char--appear"; }

  return (
    <div
      ref={containerRef}
      className="haiku-card__quote"
      aria-label={text ?? "Loading today's verse..."}
      onMouseMove={onMouseMove}
      onMouseLeave={onLeave}
      onTouchMove={onTouchMove}
      onTouchEnd={onLeave}
    >
      {text === undefined && "Loading today's verse..."}
      {text !== undefined && words.length > 0 && (
        <span aria-hidden="true">
          {words.map(({ word, chars }) => (
            <WordSpan key={chars[0]?.key ?? word} word={word} chars={chars} charClass={charClass} reducedMotion={reducedMotion} onRef={setCharRef} />
          ))}
        </span>
      )}
    </div>
  );
};

export default ZenHaikuReveal;
