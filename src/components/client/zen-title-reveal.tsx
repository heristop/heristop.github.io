import { buildCharDrifts, getSmokeClass, getSmokeStyle, useReducedMotion, useTextLayout } from "./use-text-reveal";
import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
}

const FONT = "700 1.25em Comfortaa, sans-serif";
const FONT_SIZE_EM = 1.25;
const CSS_LINE_HEIGHT = 1.3;
const BASE_PX = 16;
const LINE_HEIGHT = CSS_LINE_HEIGHT * FONT_SIZE_EM * BASE_PX;
const APPEAR_DELAY_MS = 80;
const NBSP = "\u00A0";

const ZenTitleReveal = ({ text }: Props) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const [appeared, setAppeared] = useState(false);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, FONT, LINE_HEIGHT, containerRef);

  useEffect(() => {
    if (!revealed || appeared || reducedMotion) { return; }
    const timer = setTimeout(() => { setAppeared(true); }, APPEAR_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [revealed, appeared, reducedMotion]);

  const charsByLine = buildCharDrifts(lines);

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
              className={getSmokeClass(appeared, reducedMotion)}
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
