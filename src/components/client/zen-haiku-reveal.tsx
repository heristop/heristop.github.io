/* eslint-disable no-duplicate-imports */
import { buildWordDrifts, getSmokeStyle, useReducedMotion } from "./use-text-reveal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharDrift } from "./use-text-reveal";
/* eslint-enable no-duplicate-imports */

interface Props {
  url: string;
}

const DISSOLVE_RADIUS = 80;
const APPEAR_DELAY_MS = 200;
const DISSOLVE_OPACITY_FACTOR = 0.85;
const DISSOLVE_DRIFT_FACTOR = 0.6;
const DISSOLVE_ROTATION_FACTOR = 0.4;
const DISSOLVE_BLUR_MAX = 2.5;
const DISSOLVE_TRANSITION = "opacity 120ms ease, transform 120ms ease, filter 120ms ease";
const RECOVER_TRANSITION = "opacity 500ms var(--zen-ease-elegant), transform 500ms var(--zen-ease-elegant), filter 500ms var(--zen-ease-elegant)";

const applyDissolveToElement = (el: HTMLSpanElement, intensity: number) => {
  const driftX = Number.parseFloat(el.style.getPropertyValue("--drift-x")) || 0;
  const driftY = Number.parseFloat(el.style.getPropertyValue("--drift-y")) || 0;
  const driftR = Number.parseFloat(el.style.getPropertyValue("--drift-r")) || 0;

  el.style.opacity = `${1 - intensity * DISSOLVE_OPACITY_FACTOR}`;
  el.style.transform = `translate(${driftX * intensity * DISSOLVE_DRIFT_FACTOR}px, ${driftY * intensity * DISSOLVE_DRIFT_FACTOR}px) rotate(${driftR * intensity * DISSOLVE_ROTATION_FACTOR}deg)`;
  el.style.filter = `blur(${intensity * DISSOLVE_BLUR_MAX}px)`;
  el.style.transition = DISSOLVE_TRANSITION;
};

const resetElement = (el: HTMLSpanElement) => {
  el.style.opacity = "1";
  el.style.transform = "translate(0, 0) rotate(0deg)";
  el.style.filter = "blur(0)";
  el.style.transition = RECOVER_TRANSITION;
};

// Extracted component to reduce JSX nesting depth
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

const useProximityDissolve = (charElsRef: React.RefObject<Map<string, HTMLSpanElement>>) => {
  const apply = useCallback((mouseX: number, mouseY: number) => {
    for (const el of charElsRef.current.values()) {
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dist = Math.hypot(mouseX - centerX, mouseY - centerY);
      const intensity = Math.max(0, 1 - dist / DISSOLVE_RADIUS);

      if (intensity > 0) {
        applyDissolveToElement(el, intensity);
      } else {
        resetElement(el);
      }
    }
  }, [charElsRef]);

  const reset = useCallback(() => {
    for (const el of charElsRef.current.values()) {
      resetElement(el);
    }
  }, [charElsRef]);

  return { apply, reset };
};

interface CardMouseOptions {
  appeared: boolean;
  apply: (mx: number, my: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  reducedMotion: boolean;
  reset: () => void;
}

const useCardMouse = ({ containerRef, reducedMotion, appeared, apply, reset }: CardMouseOptions) => {
  const rafRef = useRef<number>(0);

  const onMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !appeared) { return; }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const card = containerRef.current?.closest(".haiku-card");
      if (card instanceof HTMLElement) {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
        card.classList.add("haiku-card--hover");
      }
      apply(event.clientX, event.clientY);
    });
  }, [containerRef, reducedMotion, appeared, apply]);

  const onLeave = useCallback(() => {
    const card = containerRef.current?.closest(".haiku-card");
    if (card instanceof HTMLElement) { card.classList.remove("haiku-card--hover"); }
    reset();
  }, [containerRef, reset]);

  return { onLeave, onMove };
};

const ZenHaikuReveal = ({ url }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const charElsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [appeared, setAppeared] = useState(false);
  const reducedMotion = useReducedMotion();
  const text = useHaikuFetch(url);
  const { apply, reset } = useProximityDissolve(charElsRef);
  const { onLeave, onMove } = useCardMouse({ appeared, apply, containerRef, reducedMotion, reset });

  useEffect(() => {
    if (text === undefined || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [text, appeared, reducedMotion]);

  const words = useMemo(() => {
    if (text !== undefined && text !== "") { return buildWordDrifts(text); }
    return [];
  }, [text]);

  const setCharRef = useCallback((key: string, el: HTMLSpanElement | null) => {
    if (el) { charElsRef.current.set(key, el); }
    else { charElsRef.current.delete(key); }
  }, []);

  let charClass = "haiku-char--smoke";
  if (reducedMotion) { charClass = ""; }
  else if (appeared) { charClass = "haiku-char--appear"; }

  return (
    <div
      ref={containerRef}
      className="haiku-card__quote"
      aria-label={text ?? "Loading today's verse..."}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
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
