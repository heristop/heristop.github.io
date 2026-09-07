import { useEffect, useState } from "react";
import Icon from "../../../icon";
import { scoreWalk } from "../../score";
import { DiscoveryCollection } from "./discovery-cards";
import type { Walk } from "../../score";

const readBest = (key: string): number => {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

export default function Journey({
  recordKey,
  complete,
  summary = false,
  ...walk
}: Walk & {
  recordKey: string;
  complete: boolean;
  summary?: boolean;
}) {
  const [best, setBest] = useState(() => readBest(recordKey));
  const [newRecord, setNewRecord] = useState(false);
  const score = scoreWalk(walk).total;

  useEffect(() => {
    if (!complete) {
      setNewRecord(false);
      return;
    }
    const previous = readBest(recordKey);
    setBest(Math.max(previous, score));
    setNewRecord(score > previous);
    try {
      window.localStorage.setItem(recordKey, String(Math.max(previous, score)));
    } catch {
      // Records are optional; private browsing must never interrupt a completed run.
    }
  }, [complete, recordKey, score]);

  if (summary) {
    return (
      <div className="path-stones__record" aria-live="polite">
        <span>{newRecord ? "New personal best" : "Garden best"}</span>
        <strong>{best.toLocaleString("en-US")}</strong>
        <small>Saved on this device</small>
      </div>
    );
  }

  return (
    <details className="path-stones__journey" aria-label="Run performance and challenges">
      <summary className="path-stones__journal-toggle">
        <span>Field journal</span>
        <span className="path-stones__journal-stat">
          Score <strong>{score.toLocaleString("en-US")}</strong>
        </span>
        <span className="path-stones__journal-stat">
          Cards <strong>{Number(!!walk.catMet) + Number(!!walk.frogFreed)} / 2</strong>
        </span>
        <Icon name="arrow-down" size={16} aria-hidden="true" />
      </summary>
      <div className="path-stones__journal-content">
        <div className="path-stones__run-score">
          <span>{complete ? "Run complete" : "Score at the shrine"}</span>
          <strong>{score.toLocaleString("en-US")}</strong>
          <small>
            {walk.steps} steps · {walk.stonesLaid} stones laid · {walk.gardenerTurns ?? 0} gardener
            turns
          </small>
        </div>
        <DiscoveryCollection catMet={!!walk.catMet} frogFreed={!!walk.frogFreed} />
        <div className="path-stones__record" aria-live="polite">
          <span>{newRecord ? "New personal best" : "Garden best"}</span>
          <strong>{best ? best.toLocaleString("en-US") : "—"}</strong>
          <small>{best ? "Saved on this device" : "No completed run yet"}</small>
        </div>
      </div>
    </details>
  );
}
