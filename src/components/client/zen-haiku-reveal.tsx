import React, { useCallback, useEffect, useRef, useState } from "react";
import dissolve from "./haiku-dissolve";
import textReveal from "./use-text-reveal";
import useHaikuAnimation from "./use-haiku-animation";
import type { CharDrift } from "./use-text-reveal";
import type { CharCacheEntry } from "./haiku-dissolve";

const { getSmokeStyle } = textReveal;
const { processCharEntry, resetElement } = dissolve;

interface Props {
  url: string;
}

const DISSOLVE_RADIUS = 80;

interface ContainerBox {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const CharSpan = React.memo(({ charDrift, charClass, reducedMotion, onRef }: {
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
));

const WordSpan = React.memo(({ word, chars, charClass, reducedMotion, onRef }: {
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
});

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
  const cachedEntries = useRef<Map<string, CharCacheEntry>>(new Map());
  const containerBox = useRef<ContainerBox | null>(null);
  const dissolvedKeys = useRef<Set<string>>(new Set());
  const nextDissolved = useRef<Set<string>>(new Set());
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
    cachedEntries.current.clear();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [key, el] of charElsRef.current.entries()) {
      const rect = el.getBoundingClientRect();
      const px = rect.left + rect.width / 2;
      const py = rect.top + rect.height / 2;
      if (px < minX) { minX = px; }
      if (py < minY) { minY = py; }
      if (px > maxX) { maxX = px; }
      if (py > maxY) { maxY = py; }
      cachedEntries.current.set(key, {
        driftR: Number.parseFloat(el.style.getPropertyValue("--drift-r")) || 0,
        driftX: Number.parseFloat(el.style.getPropertyValue("--drift-x")) || 0,
        driftY: Number.parseFloat(el.style.getPropertyValue("--drift-y")) || 0,
        px,
        py,
      });
    }
    containerBox.current = cachedEntries.current.size > 0
      ? { bottom: maxY, left: minX, right: maxX, top: minY }
      : null;
    cacheValid.current = true;
  }, [charElsRef]);

  const apply = useCallback((mouseX: number, mouseY: number) => {
    ensureCache();
    const box = containerBox.current;
    if (box &&
      (mouseX < box.left - DISSOLVE_RADIUS ||
       mouseX > box.right + DISSOLVE_RADIUS ||
       mouseY < box.top - DISSOLVE_RADIUS ||
       mouseY > box.bottom + DISSOLVE_RADIUS)) {
      for (const key of dissolvedKeys.current) {
        const el = charElsRef.current.get(key);
        if (el) { resetElement(el); }
      }
      dissolvedKeys.current.clear();
      return;
    }

    nextDissolved.current.clear();
    for (const [key, cached] of cachedEntries.current.entries()) {
      processCharEntry({ cached, charElsRef, dissolvedKeys, key, mouseX, mouseY, nextDissolved: nextDissolved.current });
    }
    const prev = dissolvedKeys.current;
    dissolvedKeys.current = nextDissolved.current;
    nextDissolved.current = prev;
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

const useHandleMove = (opts: CardPointerOptions) => {
  const { containerRef, reducedMotion, appeared, apply } = opts;
  const rafRef = useRef<number>(0);

  return useCallback((clientX: number, clientY: number) => {
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
};

const useTouchEvents = (
  containerRef: React.RefObject<HTMLDivElement | null>,
  handleMove: (cx: number, cy: number) => void,
  onLeave: () => void,
) => {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) { return; }

    let touchStart: { px: number; py: number } | undefined;
    let touchActive = false;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch !== undefined) {
        touchStart = { px: touch.clientX, py: touch.clientY };
        touchActive = false;
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch === undefined) { return; }
      if (!touchActive && touchStart) {
        const dx = Math.abs(touch.clientX - touchStart.px);
        const dy = Math.abs(touch.clientY - touchStart.py);
        if (dy > dx) { return; }
        touchActive = true;
      }
      if (touchActive) {
        if (event.cancelable) { event.preventDefault(); }
        handleMove(touch.clientX, touch.clientY);
      }
    };

    const onTouchEnd = () => {
      touchStart = undefined;
      touchActive = false;
      onLeave();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, handleMove, onLeave]);
};

const useCardPointer = (opts: CardPointerOptions) => {
  const { containerRef, reset } = opts;
  const handleMove = useHandleMove(opts);

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    handleMove(event.clientX, event.clientY);
  }, [handleMove]);

  const onLeave = useCallback(() => {
    const card = containerRef.current?.closest(".haiku-card");
    if (card instanceof HTMLElement) { card.classList.remove("haiku-card--hover"); }
    reset();
  }, [containerRef, reset]);

  useTouchEvents(containerRef, handleMove, onLeave);

  return { onLeave, onMouseMove };
};


const ZenHaikuReveal = ({ url }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const charElsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
  const text = useHaikuFetch(url);
  const { appeared, autoSettled, charClass, reducedMotion, words } = useHaikuAnimation(text);
  const { apply, reset } = useProximityDissolve(charElsRef);
  const { onLeave, onMouseMove } = useCardPointer({ appeared, apply, containerRef, reducedMotion, reset });

  const setCharRef = useCallback((key: string, el: HTMLSpanElement | null) => {
    if (el) { charElsRef.current.set(key, el); }
    else { charElsRef.current.delete(key); }
  }, []);

  const collapsed = autoSettled || reducedMotion;

  return (
    <div
      ref={containerRef}
      className="haiku-card__quote"
      aria-label={text ?? "Loading today's verse..."}
      onMouseMove={collapsed ? undefined : onMouseMove}
      onMouseLeave={collapsed ? undefined : onLeave}
    >
      {text === undefined && (
        <div className="haiku-skeleton" aria-hidden="true">
          <span className="haiku-skeleton__line" style={{ width: '75%' }} />
          <span className="haiku-skeleton__line" style={{ width: '60%' }} />
          <span className="haiku-skeleton__line" style={{ width: '45%' }} />
        </div>
      )}
      {text !== undefined && words.length > 0 && (
        collapsed ? (
          <span aria-hidden="true">{text}</span>
        ) : (
          <span aria-hidden="true">
            {words.map(({ word, chars }) => (
              <WordSpan key={chars[0]?.key ?? word} word={word} chars={chars} charClass={charClass} reducedMotion={reducedMotion} onRef={setCharRef} />
            ))}
          </span>
        )
      )}
    </div>
  );
};

export default ZenHaikuReveal;
