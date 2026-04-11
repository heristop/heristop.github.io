import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ZenTextReveal from "./zen-text-reveal";
import textReveal from "./use-text-reveal";
import type { HaikuEntry } from "./zazen-world-types";

const { useReducedMotion } = textReveal;

const LINE_STAGGER_MS = 500;
const RETURN_REVEAL_MS = 5000;
const FINALE_FONT = "italic 1.2rem Georgia, serif";
const FINALE_LINE_HEIGHT = 1.2 * 16 * 1.6;

interface DelayedMountProps {
  children: ReactNode;
  delayMs: number;
}

const DelayedMount = ({ children, delayMs }: DelayedMountProps) => {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(reducedMotion || delayMs === 0);

  useEffect(() => {
    if (reducedMotion || mounted || delayMs === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setMounted(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [delayMs, mounted, reducedMotion]);

  if (!mounted) {
    return null;
  }
  return <>{children}</>;
};

interface Props {
  lines: readonly HaikuEntry[];
  onReturn?: () => void;
}

const ZazenFinaleOverlay = ({ lines, onReturn }: Props) => {
  const reducedMotion = useReducedMotion();
  const [returnVisible, setReturnVisible] = useState(reducedMotion);
  const returnRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (returnVisible) {
      return;
    }
    if (reducedMotion) {
      setReturnVisible(true);
      return;
    }
    const timer = setTimeout(() => {
      setReturnVisible(true);
    }, RETURN_REVEAL_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [reducedMotion, returnVisible]);

  useEffect(() => {
    if (!returnVisible) {
      return;
    }
    returnRef.current?.focus();
  }, [returnVisible]);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        returnRef.current?.click();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
    };
  }, []);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const prevBodyOverflow = body.style.overflow;
    const prevRootOverflow = root.style.overflow;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBodyOverflow;
      root.style.overflow = prevRootOverflow;
    };
  }, []);

  return (
    <div
      className="path-stones__finale"
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-stones-finale-title"
    >
      <h2 id="path-stones-finale-title" className="sr-only">
        The path is complete
      </h2>
      <div className="path-stones__finale-poem">
        {lines.map((entry, index) => (
          <DelayedMount key={entry.stoneIndex} delayMs={index * LINE_STAGGER_MS}>
            <ZenTextReveal
              text={entry.text}
              tag="p"
              className="path-stones__finale-line"
              font={FINALE_FONT}
              lineHeight={FINALE_LINE_HEIGHT}
            />
          </DelayedMount>
        ))}
      </div>
      {returnVisible && (
        <a
          ref={returnRef}
          className="path-stones__finale-return"
          href="/"
          data-astro-prefetch
          onClick={onReturn}
        >
          Return
        </a>
      )}
    </div>
  );
};

export default ZazenFinaleOverlay;
