import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { usesCoarsePointer } from "./pretext-loader";
import textReveal from "./text-reveal-motion";

const {
  buildCharDrifts,
  getCharClass,
  getSmokeStyle,
  maxAnimationEnd,
  TITLE_REVEAL_TIMING,
  useReducedMotion,
  useTextLayout,
} = textReveal;

interface Props {
  className?: string;
  font?: string;
  lineHeight?: number;
  mobileStrategy?: "characters" | "text";
  tag?: "span" | "p" | "div";
  text: string;
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

const getSimpleTextStyle = (
  appeared: boolean,
  reducedMotion: boolean,
): React.CSSProperties | undefined => {
  if (reducedMotion) {
    return undefined;
  }
  return {
    opacity: appeared ? 1 : 0,
    transition: `opacity ${SIMPLE_TEXT_DURATION_MS}ms var(--zen-ease-elegant)`,
  };
};

const SimpleTextReveal = ({ text, tag: Tag = "span", className }: Props) => {
  const [appeared, setAppeared] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (appeared || reducedMotion) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, reducedMotion]);

  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden="true" style={getSimpleTextStyle(appeared || reducedMotion, reducedMotion)}>
        {text}
      </span>
    </Tag>
  );
};

// Hovering the title (or its link) fast-forwards the running char transitions instead of
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
    target.addEventListener("pointerenter", onEnter, { once: true });
    return () => {
      target.removeEventListener("pointerenter", onEnter);
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

const CharacterTextReveal = ({
  text,
  tag: Tag = "span",
  className,
  font = DEFAULT_FONT,
  lineHeight = DEFAULT_LINE_HEIGHT,
}: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const [appeared, setAppeared] = useState(false);
  const [settled, setSettled] = useState(false);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, font, lineHeight, containerRef, !settled);

  useEffect(() => {
    if (!revealed || appeared || reducedMotion) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [revealed, appeared, reducedMotion]);

  const charsByLine = useMemo(
    () => buildCharDrifts(lines, TITLE_REVEAL_TIMING.durationMs, TITLE_REVEAL_TIMING.staggerScale),
    [lines],
  );
  const settle = useCallback(() => {
    setSettled(true);
  }, []);
  useHoverFastForward(containerRef, appeared, settled || reducedMotion, settle);

  useEffect(() => {
    if (!appeared || settled || reducedMotion || charsByLine.length === 0) {
      return;
    }
    const totalMs = maxAnimationEnd(charsByLine) + TITLE_REVEAL_TIMING.settleBufferMs;
    const timer = setTimeout(() => {
      setSettled(true);
    }, totalMs);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, settled, reducedMotion, charsByLine]);

  return (
    <Tag
      ref={(el: HTMLElement | null) => {
        containerRef.current = el;
      }}
      className={className}
      aria-label={text}
      // No paint containment: chars drift in from above and would be clipped to the box
      style={settled ? undefined : { contain: "layout style" }}
    >
      {lines.length === 0 && text}
      {settled ? (
        <span aria-hidden="true">{text}</span>
      ) : (
        charsByLine.map((lineChars, lineIndex) => (
          <span
            key={`line-${lineIndex}-${lines[lineIndex].text}`}
            aria-hidden="true"
            style={{ display: "inline" }}
          >
            {lineChars.map((charDrift) => (
              <span
                key={charDrift.key}
                className={getCharClass(settled, appeared, reducedMotion)}
                style={getSmokeStyle(charDrift, reducedMotion)}
              >
                {charDrift.char === " " && NBSP}
                {charDrift.char !== " " && charDrift.char}
              </span>
            ))}
          </span>
        ))
      )}
    </Tag>
  );
};

const ZenTextReveal = (props: Props) => {
  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    setCoarsePointer(usesCoarsePointer());
  }, []);

  if (props.mobileStrategy === "text" && coarsePointer) {
    return <SimpleTextReveal {...props} />;
  }
  return <CharacterTextReveal {...props} />;
};

export default ZenTextReveal;
