import { useEffect, useState } from "react";
import Icon from "../../../icon";

type Props = {
  phase: string;
  round: number;
  opening: boolean;
  paused?: boolean;
};

export default function TurnAnnouncement(props: Props) {
  return (
    <TimedTurnAnnouncement key={`${props.phase}-${props.round}-${props.opening}`} {...props} />
  );
}

function TimedTurnAnnouncement({ phase, round, opening, paused }: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(timer);
  }, [paused]);
  if (!visible || phase === "lost" || paused) return null;
  const gardener = phase === "gardener";
  return (
    <div
      className="path-stones__turn-announcement"
      data-side={gardener ? "gardener" : "player"}
      aria-hidden="true"
    >
      <div
        className="path-stones__turn-standard"
        data-round={["I", "II", "III", "IV"][Math.min(3, Math.max(0, round - 1))]}
      >
        <span className="path-stones__turn-crest">
          <Icon name={gardener ? "feather" : "compass"} size={24} />
        </span>
        <span className="path-stones__turn-kicker">
          {opening ? "Opening move" : `Round ${round} · Path of Stones`}
        </span>
        <strong>{gardener ? "Gardener’s Turn" : "Your Turn"}</strong>
        <span className="path-stones__turn-motto">
          {gardener ? "The garden closes its paths" : "Choose your crossing"}
        </span>
      </div>
    </div>
  );
}
