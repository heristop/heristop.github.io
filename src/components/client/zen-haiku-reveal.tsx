import React, { useCallback, useEffect, useRef, useState } from "react";
import dissolve from "./haiku-dissolve";
import textReveal from "@zazencode/ui/text-reveal-motion";
import useHaikuAnimation from "./use-haiku-animation";
import { usesCoarsePointer } from "@zazencode/ui/pretext-loader";
import type { CharDrift } from "@zazencode/ui/text-reveal-motion";
import type { CharCacheEntry } from "./haiku-dissolve";
import daily from "./haiku-daily";
import gutenku from "./gutenku-daily-api";
import type { DailyHaiku } from "./gutenku-daily-api";
import type { HaikuSource } from "./haiku-daily";
import { HaikuEyebrow, HaikuFoot, HaikuReading, useNow } from "./haiku-note";

const { getSmokeStyle, useReducedMotion } = textReveal;
const { DISSOLVE_IDLE_MS, DISSOLVE_RADIUS, processCharEntry, resetElement } = dissolve;
const { parseHaikuSource, splitLead } = daily;

interface Props {
  /** GutenKu's daily haiku endpoint; defaults to PUBLIC_GUTENKU_API (or gutenku.xyz) */
  apiUrl?: string;
  /** Fallback: GutenKu's social post (title, riddle hints, source book and verses) */
  sourceUrl?: string;
  /** Fallback: the reading as raw text, used when the API misses */
  url: string;
}

interface RevealProps {
  text: string | undefined;
}

interface HaikuData {
  /** The API's versioned card, swapped into the page's card image once it has loaded */
  cardUrl?: string;
  lead?: string;
  rolloverAt?: Date;
  source?: HaikuSource;
  text: string;
}

// Same two-frame beat as the full reveal (use-haiku-animation.ts)
const SIMPLE_APPEAR_DELAY_MS = 34;
const SIMPLE_FADE_DURATION_MS = 420;
// A stalled request must not leave the skeleton shimmering forever; past this the fallback shows
const HAIKU_FETCH_TIMEOUT_MS = 8000;

const HaikuSkeleton = () => (
  <div className="haiku-skeleton" aria-hidden="true">
    <span className="haiku-skeleton__line" style={{ width: '75%' }} />
    <span className="haiku-skeleton__line" style={{ width: '60%' }} />
    <span className="haiku-skeleton__line" style={{ width: '45%' }} />
  </div>
);

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

const FALLBACK_TEXT = "A fresh haiku will be shared here soon.";

const fetchText = async (url: string) => {
  const res = await fetch(`${url}?t=${Date.now()}`, {
    signal: AbortSignal.timeout(HAIKU_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) { throw new Error("Failed to fetch haiku"); }
  return (await res.text()).trim();
};

/* Both texts settle together, so the lead, the reading and the source arrive in one reveal. The
   lead is the haiku's title; without one it is the reading's first sentence, lifted out of it. */
const toHaikuData = (reading: PromiseSettledResult<string>, social: PromiseSettledResult<string> | undefined): HaikuData => {
  const source = social?.status === "fulfilled" ? parseHaikuSource(social.value) : undefined;
  if (reading.status !== "fulfilled" || reading.value === "") {
    return { lead: source?.title, source, text: FALLBACK_TEXT };
  }
  if (source?.title) {
    return { lead: source.title, source, text: reading.value };
  }
  const { body, lead } = splitLead(reading.value);
  return { lead, source, text: body };
};

/* The API hands over every piece already split: the title leads, the reading follows */
const fromDailyHaiku = (haiku: DailyHaiku): HaikuData => {
  const source = gutenku.toHaikuSource(haiku);
  const base = { cardUrl: haiku.cardUrl, rolloverAt: haiku.nextRolloverAt, source };
  if (source.title) {
    return { ...base, lead: source.title, text: haiku.reading };
  }
  const { body, lead } = splitLead(haiku.reading);
  return { ...base, lead, text: body };
};

const fetchFallback = async (url: string, sourceUrl: string | undefined) => {
  const [reading, social] = await Promise.allSettled([
    fetchText(url),
    ...(sourceUrl ? [fetchText(sourceUrl)] : []),
  ]);
  return reading ? toHaikuData(reading, social) : undefined;
};

const useHaikuFetch = (apiUrl: string, url: string, sourceUrl: string | undefined) => {
  const [data, setData] = useState<HaikuData | undefined>();

  useEffect(() => {
    let live = true;
    const load = async () => {
      const haiku = await gutenku.fetchDailyHaiku(apiUrl);
      const next = haiku ? fromDailyHaiku(haiku) : await fetchFallback(url, sourceUrl);
      if (live && next) { setData(next); }
    };
    void load();
    return () => { live = false; };
  }, [apiUrl, url, sourceUrl]);

  return data;
};

/* The page renders the raw GitHub card; the API's card replaces it only once it has loaded, so
   a broken or slow image never blanks the frame */
const useCardImage = (cardUrl: string | undefined) => {
  useEffect(() => {
    if (!cardUrl) { return; }
    const images = document.querySelectorAll<HTMLImageElement>("[data-haiku-card-image]");
    if (images.length === 0) { return; }
    let live = true;
    const preload = new Image();
    preload.addEventListener("load", () => {
      if (!live) { return; }
      for (const image of images) {
        image.removeAttribute("srcset");
        image.src = cardUrl;
      }
    });
    preload.src = cardUrl;
    return () => { live = false; };
  }, [cardUrl]);
};

interface CachedChar {
  entry: CharCacheEntry;
  offsetX: number;
  offsetY: number;
  parent: Element | null;
}

const useProximityDissolve = (charElsRef: React.RefObject<Map<string, HTMLSpanElement>>) => {
  const cachedChars = useRef<Map<string, CachedChar>>(new Map());
  const dissolvedKeys = useRef<Set<string>>(new Set());
  const nextDissolved = useRef<Set<string>>(new Set());
  const cacheValid = useRef(false);

  // Offsets are layout positions relative to the offsetParent: they ignore the dissolve
  // transforms and survive scrolling, so only a resize invalidates them
  useEffect(() => {
    const invalidate = () => { cacheValid.current = false; };
    globalThis.addEventListener("resize", invalidate);
    return () => {
      globalThis.removeEventListener("resize", invalidate);
    };
  }, []);

  const ensureCache = useCallback(() => {
    if (cacheValid.current && cachedChars.current.size === charElsRef.current.size) {
      return;
    }
    cachedChars.current.clear();
    for (const [key, el] of charElsRef.current.entries()) {
      cachedChars.current.set(key, {
        entry: {
          driftR: Number.parseFloat(el.style.getPropertyValue("--drift-r")) || 0,
          driftX: Number.parseFloat(el.style.getPropertyValue("--drift-x")) || 0,
          driftY: Number.parseFloat(el.style.getPropertyValue("--drift-y")) || 0,
          px: 0,
          py: 0,
        },
        offsetX: el.offsetLeft + el.offsetWidth / 2,
        offsetY: el.offsetTop + el.offsetHeight / 2,
        parent: el.offsetParent,
      });
    }
    cacheValid.current = true;
  }, [charElsRef]);

  // One rect read per offsetParent (normally a single one) maps every char to client space
  const placeChars = useCallback((): ContainerBox | null => {
    const origins = new Map<Element | null, { left: number; top: number }>();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const cached of cachedChars.current.values()) {
      let origin = origins.get(cached.parent);
      if (!origin) {
        const rect = cached.parent?.getBoundingClientRect();
        origin = rect
          ? { left: rect.left + (cached.parent?.clientLeft ?? 0), top: rect.top + (cached.parent?.clientTop ?? 0) }
          : { left: -globalThis.scrollX, top: -globalThis.scrollY };
        origins.set(cached.parent, origin);
      }
      const px = origin.left + cached.offsetX;
      const py = origin.top + cached.offsetY;
      cached.entry.px = px;
      cached.entry.py = py;
      if (px < minX) { minX = px; }
      if (py < minY) { minY = py; }
      if (px > maxX) { maxX = px; }
      if (py > maxY) { maxY = py; }
    }
    return cachedChars.current.size > 0
      ? { bottom: maxY, left: minX, right: maxX, top: minY }
      : null;
  }, []);

  const apply = useCallback((mouseX: number, mouseY: number) => {
    ensureCache();
    const box = placeChars();
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
    for (const [key, cached] of cachedChars.current.entries()) {
      processCharEntry({ cached: cached.entry, charElsRef, dissolvedKeys, key, mouseX, mouseY, nextDissolved: nextDissolved.current });
    }
    const prev = dissolvedKeys.current;
    dissolvedKeys.current = nextDissolved.current;
    nextDissolved.current = prev;
  }, [charElsRef, ensureCache, placeChars]);

  // Each hover session re-measures once, picking up late layout shifts (fonts, content)
  const reset = useCallback(() => {
    for (const key of dissolvedKeys.current) {
      const el = charElsRef.current.get(key);
      if (el) {
        resetElement(el);
      }
    }
    dissolvedKeys.current.clear();
    cacheValid.current = false;
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
  const { containerRef, reducedMotion, appeared, apply, reset } = opts;
  const rafRef = useRef<number>(0);
  const idleRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(idleRef.current);
  }, []);

  return useCallback((clientX: number, clientY: number) => {
    if (reducedMotion || !appeared) { return; }
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(reset, DISSOLVE_IDLE_MS);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      // Every layout read happens before the first style write of the frame
      const card = containerRef.current?.closest(".haiku-card");
      const rect = card instanceof HTMLElement ? card.getBoundingClientRect() : null;
      apply(clientX, clientY);
      if (card instanceof HTMLElement && rect) {
        card.style.setProperty("--mouse-x", `${clientX - rect.left}px`);
        card.style.setProperty("--mouse-y", `${clientY - rect.top}px`);
        card.classList.add("haiku-card--hover");
      }
    });
  }, [containerRef, reducedMotion, appeared, apply, reset]);
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


const getSimpleFadeStyle = (appeared: boolean, reducedMotion: boolean): React.CSSProperties | undefined => {
  if (reducedMotion) {
    return undefined;
  }
  return {
    opacity: appeared ? 1 : 0,
    transition: `opacity ${SIMPLE_FADE_DURATION_MS}ms var(--zen-ease-elegant)`,
  };
};

/* aria-label is ignored on a plain div, so the verse is read from visually hidden text exactly
   once while the animated glyphs stay aria-hidden */
const HaikuSpokenText = ({ text }: { text: string | undefined }) => (
  <span className="sr-only">{text ?? "Loading today’s verse…"}</span>
);

const SimpleHaikuReveal = ({ text }: RevealProps) => {
  const reducedMotion = useReducedMotion();
  const [appeared, setAppeared] = useState(false);

  useEffect(() => {
    if (text === undefined || appeared || reducedMotion) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, SIMPLE_APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [text, appeared, reducedMotion]);

  return (
    <div
      className="haiku-card__quote"
    >
      <HaikuSpokenText text={text} />
      {text === undefined && <HaikuSkeleton />}
      {text !== undefined && (
        <span aria-hidden="true" style={getSimpleFadeStyle(appeared || reducedMotion, reducedMotion)}>
          {text}
        </span>
      )}
    </div>
  );
};

const FullHaikuReveal = ({ text }: RevealProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const charElsRef = useRef<Map<string, HTMLSpanElement>>(new Map());
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
      onMouseMove={collapsed ? undefined : onMouseMove}
      onMouseLeave={collapsed ? undefined : onLeave}
    >
      <HaikuSpokenText text={text} />
      {text === undefined && <HaikuSkeleton />}
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

const HaikuLead = ({ lead }: { lead: string | undefined }) => {
  if (lead === undefined) {
    return <span className="haiku-skeleton__line haiku-card__lead-skeleton" aria-hidden="true" />;
  }
  return <p className="haiku-card__lead">{lead}</p>;
};

/* The margin note beside the card: date, lead, the revealed reading, then the day's footer */
const ZenHaikuReveal = ({ apiUrl = gutenku.dailyHaikuUrl(), sourceUrl, url }: Props) => {
  const data = useHaikuFetch(apiUrl, url, sourceUrl);
  const now = useNow();
  useCardImage(data?.cardUrl);
  const text = data?.text;
  const verses = data?.source?.verses ?? [];

  return (
    <>
      <HaikuEyebrow now={now} />
      {(data === undefined || data.lead !== undefined) && <HaikuLead lead={data?.lead} />}
      {verses.length > 0 && <p className="sr-only">Today’s haiku: {verses.join(" / ")}</p>}
      <HaikuReading text={text}>
        {usesCoarsePointer() ? <SimpleHaikuReveal text={text} /> : <FullHaikuReveal text={text} />}
      </HaikuReading>
      <hr className="haiku-card__rule" />
      <HaikuFoot now={now} rolloverAt={data?.rolloverAt} source={data?.source} />
    </>
  );
};

export default ZenHaikuReveal;
