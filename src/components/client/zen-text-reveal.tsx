import { useEffect, useMemo, useRef, useState } from "react";
import { usesCoarsePointer } from "./pretext-loader";
import textReveal from "./use-text-reveal";

const { buildCharDrifts, getCharClass, getSmokeStyle, maxAnimationEnd, useReducedMotion, useTextLayout } = textReveal;

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
const TEXT_DURATION_MS = 800;
const SIMPLE_TEXT_DURATION_MS = 420;
const SETTLE_BUFFER_MS = 300;
const NBSP = "\u00A0";

const getSimpleTextStyle = (appeared: boolean, reducedMotion: boolean): React.CSSProperties | undefined => {
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

const CharacterTextReveal = ({ text, tag: Tag = "span", className, font = DEFAULT_FONT, lineHeight = DEFAULT_LINE_HEIGHT }: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const [appeared, setAppeared] = useState(false);
  const [settled, setSettled] = useState(false);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, font, lineHeight, containerRef);

  useEffect(() => {
    if (!revealed || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [revealed, appeared, reducedMotion]);

  const charsByLine = useMemo(() => buildCharDrifts(lines, TEXT_DURATION_MS), [lines]);

  useEffect(() => {
    if (!appeared || settled || reducedMotion || charsByLine.length === 0) { return; }
    const totalMs = maxAnimationEnd(charsByLine) + SETTLE_BUFFER_MS;
    const timer = setTimeout(() => { setSettled(true); }, totalMs);
    return () => { clearTimeout(timer); };
  }, [appeared, settled, reducedMotion, charsByLine]);

  return (
    <Tag
      ref={(el: HTMLElement | null) => { containerRef.current = el; }}
      className={className}
      aria-label={text}
      style={settled ? undefined : { contain: "content" as const }}
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
  if (props.mobileStrategy === "text" && usesCoarsePointer()) {
    return <SimpleTextReveal {...props} />;
  }
  return <CharacterTextReveal {...props} />;
};

export default ZenTextReveal;
