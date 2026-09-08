import type { Position } from "../../types";
import { toScreen } from "../../board/geometry";

interface Props {
  position: Position;
  activity: "idle" | "ready" | "walk" | "rake" | "attack";
  facingLeft: boolean;
  offsetX: number;
  offsetY: number;
}

export default function Gardener({ position, activity, facingLeft, offsetX, offsetY }: Props) {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);
  return (
    <div
      className="zazen-world__gardener-actor"
      data-activity={activity}
      data-position={`${position.posX},${position.posY}`}
      aria-hidden="true"
      style={{ left: 0, top: 0, translate: `${left + 16}px ${top - 5}px`, zIndex: 2 }}
    >
      <span className="zazen-world__gardener-label">GARDENER</span>
      <span
        className="zazen-world__gardener-sprite"
        style={{ scale: facingLeft ? "-1 1" : undefined }}
      />
      {activity === "rake" && <span className="zazen-world__gardener-sweep" />}
    </div>
  );
}
