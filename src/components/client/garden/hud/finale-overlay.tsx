import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import ZenTextReveal from "../../zen-text-reveal";
import textReveal from "../../use-text-reveal";
import type { HaikuEntry } from "../types";
import { scoreWalk } from "../state/score";

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
  steps: number;
  stonesLaid: number;
  stonesLeft: number;
  frogFreed?: boolean;
  catMet?: boolean;
  onReturn?: () => void;
  onWalkAgain?: () => void;
}

const SCORE_REVEAL_MS = 2600;

const ZazenFinaleOverlay = ({
  lines,
  steps,
  stonesLaid,
  stonesLeft,
  frogFreed,
  catMet,
  onReturn,
  onWalkAgain,
}: Props) => {
  const score = scoreWalk({ catMet, frogFreed, steps, stonesLaid, stonesLeft });
  const reducedMotion = useReducedMotion();
  const [returnVisible, setReturnVisible] = useState(reducedMotion);
  // Two refs, because the two jobs pulled apart: focus lands on the primary action, but
  // Escape has always meant "leave", and pointing it at a button that starts a new walk
  // would make the exit key the one that traps you here.
  const firstActionRef = useRef<HTMLButtonElement>(null);
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
    (firstActionRef.current ?? returnRef.current)?.focus();
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
      {/* The poem first, then the reckoning. Reversing them turns the ending into a
          results screen with a poem attached, which is the wrong way round for a garden. */}
      <DelayedMount delayMs={lines.length * LINE_STAGGER_MS + SCORE_REVEAL_MS}>
        <div className="path-stones__tally">
          <p className="path-stones__tally-rank">{score.rank}</p>
          <dl className="path-stones__tally-lines">
            {score.lines.map((line) => (
              <div className="path-stones__tally-row" key={line.label}>
                <dt>
                  {line.label}
                  <span>{line.detail}</span>
                </dt>
                <dd>{line.points}</dd>
              </div>
            ))}
          </dl>
          <p className="path-stones__tally-total">
            <span>Total</span>
            <b>{score.total}</b>
          </p>
        </div>
      </DelayedMount>
      {/* A score you cannot improve on is a score nobody reads twice. Walking again is
          the primary of the two — it keeps you in the garden — so it leads, and Return
          is set as the quiet way out beside it. */}
      {returnVisible && (
        <div className="path-stones__finale-actions">
          {onWalkAgain && (
            <button
              type="button"
              className="path-stones__finale-return path-stones__finale-return--primary"
              ref={firstActionRef}
              onClick={onWalkAgain}
            >
              Walk again
            </button>
          )}
          <a
            className="path-stones__finale-return"
            href="/"
            ref={returnRef}
            data-astro-prefetch
            onClick={onReturn}
          >
            Return
          </a>
        </div>
      )}
    </div>
  );
};

export default ZazenFinaleOverlay;
