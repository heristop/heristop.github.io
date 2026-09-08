import { useEffect, useRef } from "react";
import { STONE_COUNT } from "../../schema";

// The end of a walk that cannot be finished. It is deliberately not the finale in another
// colour: the finale is warm and arrives slowly, and this is cool and arrives at once,
// because the one thing a losing screen must never do is make you wait to try again.
//
// The button is the point. Everything above it exists to explain, in one sentence, why
// the garden stopped — a loss the player cannot account for reads as a bug.

interface Props {
  stonesFound: number;
  stonesLaid: number;
  steps: number;
  onReplay: () => void;
}

const ZazenDefeatOverlay = ({ stonesFound, stonesLaid, steps, onReplay }: Props) => {
  const replayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    replayRef.current?.focus();
  }, []);

  // The board is still behind this and still scrollable without it, which lets a stray
  // wheel event carry the garden out from under a dialog you cannot dismiss by scrolling.
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
      className="path-stones__defeat"
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-stones-defeat-title"
    >
      <div className="path-stones__defeat-card">
        <p className="path-stones__defeat-mark" aria-hidden="true">
          ◇
        </p>
        <h2 className="path-stones__defeat-title" id="path-stones-defeat-title">
          The garden wins this round
        </h2>
        <p className="path-stones__defeat-line">
          All three refills are spent. No stone, shrine or frog rescue is within reach. Collect
          stones earlier and keep your return path short.
        </p>
        <dl className="path-stones__defeat-tally">
          <div>
            <dt>Stones gathered</dt>
            <dd>
              {stonesFound} / {STONE_COUNT}
            </dd>
          </div>
          <div>
            <dt>Stones laid</dt>
            <dd>{stonesLaid}</dd>
          </div>
          <div>
            <dt>Steps taken</dt>
            <dd>{steps}</dd>
          </div>
        </dl>
        <button
          type="button"
          className="path-stones__defeat-replay"
          ref={replayRef}
          onClick={onReplay}
        >
          Try a new route
        </button>
        <p className="path-stones__defeat-hint">
          Four rounds. Three refills. A better route is waiting.
        </p>
      </div>
    </div>
  );
};

export default ZazenDefeatOverlay;
