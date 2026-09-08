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
  mermaidAwakened = false,
  ...walk
}: Walk & {
  recordKey: string;
  complete: boolean;
  summary?: boolean;
  mermaidAwakened?: boolean;
}) {
  const score = scoreWalk(walk).total;
  const record = (
    <JourneyRecord
      key={`${recordKey}-${complete ? score : "walking"}`}
      recordKey={recordKey}
      complete={complete}
      score={score}
      summary={summary}
    />
  );

  if (summary) return record;

  return (
    <details className="path-stones__journey" aria-label="Run performance and challenges">
      <summary className="path-stones__journal-toggle">
        <span>Field journal</span>
        <span className="path-stones__journal-stat">
          Score <strong>{score.toLocaleString("en-US")}</strong>
        </span>
        <span className="path-stones__journal-stat">
          Cards{" "}
          <strong>
            {Number(!!walk.catMet) + Number(!!walk.frogFreed) + Number(mermaidAwakened)} /{" "}
            {mermaidAwakened ? 3 : 2}
          </strong>
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
        <DiscoveryCollection
          mermaidAwakened={mermaidAwakened}
          catMet={!!walk.catMet}
          frogFreed={!!walk.frogFreed}
        />
        {record}
      </div>
    </details>
  );
}

function JourneyRecord({
  recordKey,
  complete,
  score,
  summary,
}: {
  recordKey: string;
  complete: boolean;
  score: number;
  summary: boolean;
}) {
  // Keep the pre-completion record for this result's lifetime, including effect replays.
  const [previous] = useState(() => readBest(recordKey));
  const best = complete ? Math.max(previous, score) : previous;
  const newRecord = complete && score > previous;

  useEffect(() => {
    if (!complete) return;
    try {
      window.localStorage.setItem(recordKey, String(Math.max(readBest(recordKey), best)));
    } catch {
      // Records are optional; private browsing must never interrupt a completed run.
    }
  }, [best, complete, recordKey]);

  return (
    <div className="path-stones__record" aria-live="polite">
      <span>{newRecord ? "New personal best" : "Garden best"}</span>
      <strong>{best || summary ? best.toLocaleString("en-US") : "—"}</strong>
      <small>{best || summary ? "Saved on this device" : "No completed run yet"}</small>
    </div>
  );
}
