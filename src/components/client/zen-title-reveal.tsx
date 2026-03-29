import { getLineStyle, useReducedMotion, useTextLayout } from "./use-text-reveal";
import { useRef } from "react";

interface Props {
  text: string;
}

const FONT = "700 1.25em Comfortaa, sans-serif";
const FONT_SIZE_EM = 1.25;
const CSS_LINE_HEIGHT = 1.3;
const BASE_PX = 16;
const LINE_HEIGHT = CSS_LINE_HEIGHT * FONT_SIZE_EM * BASE_PX;
const STAGGER_MS = 200;
const DURATION_MS = 600;
const EASING = "cubic-bezier(0.33, 1, 0.68, 1)";

const ZenTitleReveal = ({ text }: Props) => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, FONT, LINE_HEIGHT, containerRef);
  const showAnimation = revealed && !reducedMotion;

  return (
    <h1
      ref={containerRef}
      aria-label={text}
    >
      {lines.length === 0 && text}
      {lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          aria-hidden="true"
          style={getLineStyle({ durationMs: DURATION_MS, easing: EASING, index, reducedMotion, showAnimation, staggerMs: STAGGER_MS })}
        >
          {line.text}
        </span>
      ))}
    </h1>
  );
};

export default ZenTitleReveal;
