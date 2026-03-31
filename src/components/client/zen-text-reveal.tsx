import { useEffect, useMemo, useRef, useState } from "react";
import textReveal from "./use-text-reveal";

const { buildCharDrifts, getCharClass, getSmokeStyle, maxAnimationEnd, useReducedMotion, useTextLayout } = textReveal;

interface Props {
  className?: string;
  font?: string;
  lineHeight?: number;
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
const SETTLE_BUFFER_MS = 300;
const NBSP = "\u00A0";

const ZenTextReveal = ({ text, tag: Tag = "span", className, font = DEFAULT_FONT, lineHeight = DEFAULT_LINE_HEIGHT }: Props) => {
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

export default ZenTextReveal;
