import { toScreen } from "../../board/geometry";
import type { Position } from "../../types";

export default function Frog({
  position,
  hopping,
  offsetX,
  offsetY,
}: {
  position: Position;
  hopping: boolean;
  offsetX: number;
  offsetY: number;
}) {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);
  return (
    <div
      className="zazen-world__frog-actor"
      data-hopping={hopping || undefined}
      data-position={`${position.posX},${position.posY}`}
      style={{ left: 0, top: 0, translate: `${left}px ${top}px` }}
      aria-hidden="true"
    >
      <span className="zazen-world__frog-shadow" />
      <img src="/images/zazen/decors/frog-life.png" srcSet="/images/zazen/hd/decors/frog-life.png 4x" className="zazen-world__decor" alt="" />
    </div>
  );
}
