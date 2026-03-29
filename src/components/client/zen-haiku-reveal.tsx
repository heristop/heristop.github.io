import { getLineStyle, useReducedMotion, useTextLayout } from "./use-text-reveal";
import { useEffect, useRef, useState } from "react";

interface Props {
  url: string;
}

const FONT = "500 0.92rem Comfortaa, cursive";
const FONT_SIZE_REM = 0.92;
const CSS_LINE_HEIGHT = 1.65;
const BASE_PX = 16;
const LINE_HEIGHT = CSS_LINE_HEIGHT * FONT_SIZE_REM * BASE_PX;
const STAGGER_MS = 300;
const DURATION_MS = 600;
const EASING = "cubic-bezier(0.33, 1, 0.68, 1)";

const ZenHaikuReveal = ({ url }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | undefined>();
  const reducedMotion = useReducedMotion();
  const { lines, revealed } = useTextLayout(text, FONT, LINE_HEIGHT, containerRef);

  useEffect(() => {
    const fetchHaiku = async () => {
      try {
        const res = await fetch(`${url}?t=${Date.now()}`);
        if (!res.ok) {
          throw new Error("Failed to fetch haiku");
        }
        const value = await res.text();
        setText(value.trim());
      } catch {
        setText("A fresh haiku will be shared here soon.");
      }
    };

    void fetchHaiku();
  }, [url]);

  const showAnimation = revealed && !reducedMotion;

  return (
    <div
      ref={containerRef}
      className="haiku-card__quote"
      aria-label={text ?? "Loading today's verse..."}
    >
      {text === undefined && "Loading today's verse..."}
      {text !== undefined && lines.length === 0 && text}
      {lines.map((line, index) => (
        <span
          key={`${index}-${line.text}`}
          aria-hidden="true"
          style={getLineStyle({ durationMs: DURATION_MS, easing: EASING, index, reducedMotion, showAnimation, staggerMs: STAGGER_MS })}
        >
          {line.text}
        </span>
      ))}
    </div>
  );
};

export default ZenHaikuReveal;
