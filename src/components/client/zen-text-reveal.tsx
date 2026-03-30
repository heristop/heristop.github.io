import { buildCharDrifts, getSmokeClass, getSmokeStyle, useReducedMotion, useTextLayout } from "./use-text-reveal";
import { useEffect, useRef, useState } from "react";

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
const NBSP = "\u00A0";

const ZenTextReveal = ({ text, tag: Tag = "span", className, font = DEFAULT_FONT, lineHeight = DEFAULT_LINE_HEIGHT }: Props) => {
  const containerRef = useRef<HTMLElement>(null);
  const [appeared, setAppeared] = useState(false);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, font, lineHeight, containerRef);

  useEffect(() => {
    if (!revealed || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [revealed, appeared, reducedMotion]);

  const charsByLine = buildCharDrifts(lines);

  return (
    <Tag
      ref={(el: HTMLElement | null) => { containerRef.current = el; }}
      className={className}
      aria-label={text}
    >
      {lines.length === 0 && text}
      {charsByLine.map((lineChars, lineIndex) => (
        <span
          key={`line-${lineIndex}-${lines[lineIndex].text}`}
          aria-hidden="true"
          style={{ display: "inline" }}
        >
          {lineChars.map((charDrift) => (
            <span
              key={charDrift.key}
              className={getSmokeClass(appeared, reducedMotion)}
              style={getSmokeStyle(charDrift, reducedMotion)}
            >
              {charDrift.char === " " && NBSP}
              {charDrift.char !== " " && charDrift.char}
            </span>
          ))}
        </span>
      ))}
    </Tag>
  );
};

export default ZenTextReveal;
