import { useEffect, useState } from "react";
import Icon from "../../../icon";

export default function TurnAnnouncement({
  phase,
  round,
  opening,
}: {
  phase: string;
  round: number;
  opening: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(timer);
  }, [phase, round, opening]);
  if (!visible || phase === "lost") return null;
  const gardener = phase === "gardener";
  return (
    <div
      key={`${phase}-${round}-${opening}`}
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
