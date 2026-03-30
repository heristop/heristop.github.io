import { buildCharDrifts, getSmokeClass, getSmokeStyle, maxAnimationEnd, useReducedMotion, useTextLayout } from "./use-text-reveal";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  text: string;
}

const FONT = "700 1.25em Comfortaa, sans-serif";
const FONT_SIZE_EM = 1.25;
const CSS_LINE_HEIGHT = 1.3;
const BASE_PX = 16;
const LINE_HEIGHT = CSS_LINE_HEIGHT * FONT_SIZE_EM * BASE_PX;
const APPEAR_DELAY_MS = 80;
const TITLE_DURATION_MS = 700;
const SETTLE_BUFFER_MS = 300;
const NBSP = "\u00A0";

const ZenTitleReveal = ({ text }: Props) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [appeared, setAppeared] = useState(false);
  const [settled, setSettled] = useState(false);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, FONT, LINE_HEIGHT, containerRef);

  useEffect(() => {
    if (!revealed || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [revealed, appeared, reducedMotion]);

  const charsByLine = useMemo(() => buildCharDrifts(lines, TITLE_DURATION_MS), [lines]);

  useEffect(() => {
    if (!appeared || settled || reducedMotion || charsByLine.length === 0) { return; }
    const totalMs = maxAnimationEnd(charsByLine) + SETTLE_BUFFER_MS;
    const timer = setTimeout(() => { setSettled(true); }, totalMs);
    return () => { clearTimeout(timer); };
  }, [appeared, settled, reducedMotion, charsByLine]);

  return (
    <h1
      ref={containerRef}
      aria-label={text}
    >
      {lines.length === 0 && text}
      {charsByLine.map((lineChars, lineIndex) => (
        <span
          key={`line-${lineIndex}-${lines[lineIndex].text}`}
          aria-hidden="true"
          style={{ display: "block" }}
        >
          {lineChars.map((charDrift) => (
            <span
              key={charDrift.key}
              // eslint-disable-next-line no-ternary
              className={settled ? "haiku-char--settled" : getSmokeClass(appeared, reducedMotion)}
              style={getSmokeStyle(charDrift, reducedMotion)}
            >
              {charDrift.char === " " && NBSP}
              {charDrift.char !== " " && charDrift.char}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
};

export default ZenTitleReveal;
