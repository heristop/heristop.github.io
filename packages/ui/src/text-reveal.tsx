import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { usesCoarsePointer } from "./pretext-loader";
import textReveal from "./text-reveal-motion";

const {
  buildTitleCharDrifts,
  getCharClass,
  getSmokeStyle,
  maxAnimationEnd,
  TITLE_REVEAL_TIMING,
  useTextLayout,
} = textReveal;

interface Props {
  className?: string;
  font?: string;
  lineDisplay?: "inline" | "block";
  lineHeight?: number;
  // Lay lines out with the element's own computed font instead of `font`/`lineHeight`, so a
  // responsive CSS size (clamp, media queries) never drifts from the measured line breaks
  measureFont?: boolean;
  mobileStrategy?: "characters" | "text";
  // sessionStorage key: when set, the reveal plays once per session and renders settled after
  revealOnce?: string;
  // Offset for staggering several titles (e.g. list rows) against each other
  startDelayMs?: number;
  // A page heading that scripts focus after a client-side navigation renders its tabindex on the
  // server, so the attribute is there before hydration instead of being added under React
  tabIndex?: number;
  tag?: "span" | "p" | "div" | "h1";
  text: string;
  viewTransitionName?: string;
}

const FONT_SIZE = 0.9;
const BODY_LINE_HEIGHT = 1.5;
const BASE_PX = 16;
const DEFAULT_FONT = `400 ${FONT_SIZE}rem Comfortaa, sans-serif`;
const DEFAULT_LINE_HEIGHT = FONT_SIZE * BODY_LINE_HEIGHT * BASE_PX;
const APPEAR_DELAY_MS = 80;
const SIMPLE_TEXT_DURATION_MS = 420;
const NBSP = "\u00A0";
const HOVER_PLAYBACK_RATE = 4;
const LAYOUT_FALLBACK_MS = 1000;

// Hovering or focusing the title (or its link) fast-forwards the running char transitions instead of
// making the reader wait; CSS can't retime a transition already in flight, the Web Animations API can
const useHoverFastForward = (
  containerRef: RefObject<HTMLElement | null>,
  appeared: boolean,
  done: boolean,
  onFinished: () => void,
) => {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (done || hovered) {
      return;
    }
    const el = containerRef.current;
    const target = el?.closest("a") ?? el;
    if (!target) {
      return;
    }
    const onEnter = () => {
      setHovered(true);
    };
    // Keyboard readers tabbing onto the link should not wait for the reveal either
    target.addEventListener("pointerenter", onEnter, { once: true });
    target.addEventListener("focusin", onEnter, { once: true });
    return () => {
      target.removeEventListener("pointerenter", onEnter);
      target.removeEventListener("focusin", onEnter);
    };
  }, [containerRef, done, hovered]);

  useEffect(() => {
    const el = containerRef.current;
    if (!hovered || !appeared || done || !el || typeof el.getAnimations !== "function") {
      return;
    }
    const animations = el.getAnimations({ subtree: true });
    if (animations.length === 0) {
      return;
    }
    for (const animation of animations) {
      animation.updatePlaybackRate(HOVER_PLAYBACK_RATE);
    }
    let cancelled = false;
    void Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (!cancelled) {
          onFinished();
        }
      },
      () => {
        // Cancelled when the chars unmount; the settle timer covers it
      },
    );
    return () => {
      cancelled = true;
    };
  }, [appeared, containerRef, done, hovered, onFinished]);
};

type RevealPhase = "pending" | "play" | "settled";

const prefersReducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const readSession = (key: string): boolean => {
  try {
    return globalThis.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
};

const writeSession = (key: string) => {
  try {
    globalThis.sessionStorage.setItem(key, "1");
  } catch {
    // Private mode: the reveal simply plays again next time
  }
};

// Keys claimed by this page load, so every title of a list plays together the first time
const claimedThisLoad = new Set<string>();

// The reveal only plays from a hidden state: pages hide `[data-reveal="pending"]` before first
// paint when a reveal is wanted. Text the reader can already see (later visits, a view-transition
// morph, the CSS failsafe, reduced motion) is never blanked and replayed.
const useRevealPhase = (containerRef: RefObject<HTMLElement | null>, revealOnce?: string) => {
  const [phase, setPhase] = useState<RevealPhase>("pending");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const hidden = Number.parseFloat(getComputedStyle(el).opacity) < 0.01;
    const played =
      revealOnce !== undefined && !claimedThisLoad.has(revealOnce) && readSession(revealOnce);
    if (!hidden || played || prefersReducedMotion()) {
      setPhase("settled");
      return;
    }
    if (revealOnce !== undefined) {
      claimedThisLoad.add(revealOnce);
      writeSession(revealOnce);
    }
    setPhase("play");
  }, [containerRef, revealOnce]);

  return [phase, setPhase] as const;
};

interface MeasuredFont {
  font: string;
  lineHeight: number;
}

const LINE_HEIGHT_NORMAL = 1.2;

const readElementFont = (el: HTMLElement): MeasuredFont => {
  const style = getComputedStyle(el);
  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight = Number.parseFloat(style.lineHeight);
  return {
    font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
    lineHeight: Number.isFinite(lineHeight) ? lineHeight : fontSize * LINE_HEIGHT_NORMAL,
  };
};

const useMeasuredFont = (
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): MeasuredFont | null => {
  const [measured, setMeasured] = useState<MeasuredFont | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) {
      return;
    }
    const update = () => {
      const next = readElementFont(el);
      setMeasured((prev) =>
        prev?.font === next.font && prev.lineHeight === next.lineHeight ? prev : next,
      );
    };
    update();
    // A clamp()/vw size changes with the viewport
    globalThis.addEventListener("resize", update);
    return () => {
      globalThis.removeEventListener("resize", update);
    };
  }, [containerRef, enabled]);

  return measured;
};

const getRevealAttr = (phase: RevealPhase, hasChars: boolean): string => {
  if (phase === "play") {
    // Keep the box hidden (without the failsafe) until the chars exist to fade in
    return hasChars ? "play" : "loading";
  }
  return phase;
};

const SimpleTextReveal = ({
  text,
  tag: Tag = "span",
  className,
  revealOnce,
  startDelayMs = 0,
  tabIndex,
  viewTransitionName,
}: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const [appeared, setAppeared] = useState(false);
  const [phase] = useRevealPhase(containerRef, revealOnce);
  const playing = phase === "play";

  useEffect(() => {
    if (!playing || appeared) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [playing, appeared]);

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        containerRef.current = el;
      }}
      className={className}
      tabIndex={tabIndex}
      aria-label={text}
      data-reveal={phase}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      <span
        aria-hidden="true"
        style={
          playing
            ? {
                opacity: appeared ? 1 : 0,
                transition: `opacity ${SIMPLE_TEXT_DURATION_MS}ms var(--zen-ease-elegant) ${startDelayMs}ms`,
              }
            : undefined
        }
      >
        {text}
      </span>
    </Tag>
  );
};

const CharacterTextReveal = ({
  text,
  tag: Tag = "span",
  className,
  font = DEFAULT_FONT,
  lineDisplay = "inline",
  lineHeight = DEFAULT_LINE_HEIGHT,
  measureFont = false,
  revealOnce,
  startDelayMs = 0,
  tabIndex,
  viewTransitionName,
}: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const [appeared, setAppeared] = useState(false);
  const measured = useMeasuredFont(containerRef, measureFont);
  const [phase, setPhase] = useRevealPhase(containerRef, revealOnce);
  const settled = phase === "settled";
  const playing = phase === "play";
  // Hold layout until the element's font is known, or lines would break at the fallback size
  const layoutText = measureFont && !measured ? undefined : text;
  const { lines, revealed } = useTextLayout(
    layoutText,
    measured?.font ?? font,
    measured?.lineHeight ?? lineHeight,
    containerRef,
    playing,
  );

  useEffect(() => {
    if (!playing || !revealed || appeared) {
      return;
    }
    if (lines.length === 0) {
      // `revealed` can be stale for a commit while a new layout is pending; only give up
      // (and show the plain text) if no lines arrive at all
      const fallback = setTimeout(() => {
        setPhase("settled");
      }, LAYOUT_FALLBACK_MS);
      return () => {
        clearTimeout(fallback);
      };
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [playing, revealed, appeared, lines.length, setPhase]);

  const charsByLine = useMemo(
    () => buildTitleCharDrifts(lines, startDelayMs),
    [lines, startDelayMs],
  );
  const settle = useCallback(() => {
    setPhase("settled");
  }, [setPhase]);
  useHoverFastForward(containerRef, appeared, !playing, settle);

  useEffect(() => {
    if (!appeared || !playing || charsByLine.length === 0) {
      return;
    }
    const totalMs = maxAnimationEnd(charsByLine) + TITLE_REVEAL_TIMING.settleBufferMs;
    const timer = setTimeout(() => {
      setPhase("settled");
    }, totalMs);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, playing, charsByLine, setPhase]);

  const showChars = playing && lines.length > 0;
  const style: React.CSSProperties = {
    ...(viewTransitionName ? { viewTransitionName } : {}),
    // No paint containment: chars drift in from above and would be clipped to the box
    ...(showChars ? { contain: "layout style" } : {}),
  };

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        containerRef.current = el;
      }}
      className={className}
      tabIndex={tabIndex}
      aria-label={text}
      data-reveal={getRevealAttr(phase, showChars)}
      style={style}
    >
      {showChars ? (
        charsByLine.map((lineChars, lineIndex) => (
          <span
            key={`line-${lineIndex}-${lines[lineIndex].text}`}
            aria-hidden="true"
            style={{ display: lineDisplay }}
          >
            {lineChars.map((charDrift) => (
              <span
                key={charDrift.key}
                className={getCharClass(settled, appeared, false)}
                style={getSmokeStyle(charDrift, false)}
              >
                {charDrift.char === " " && NBSP}
                {charDrift.char !== " " && charDrift.char}
              </span>
            ))}
          </span>
        ))
      ) : (
        <span aria-hidden="true">{text}</span>
      )}
    </Tag>
  );
};

// Both strategies share the same pending markup, so the strategy can be picked on the first
// client render without a hydration mismatch or a remount that would replay the reveal
const ZenTextReveal = (props: Props) => {
  const [coarsePointer] = useState(
    () => props.mobileStrategy === "text" && typeof window !== "undefined" && usesCoarsePointer(),
  );

  if (coarsePointer) {
    return <SimpleTextReveal {...props} />;
  }
  return <CharacterTextReveal {...props} />;
};

export default ZenTextReveal;
