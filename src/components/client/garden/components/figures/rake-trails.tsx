import { toScreen } from "../../board/geometry";
import { rakeGrooves, type RakeTrail } from "../../rendering/rake-trail";

export default function RakeTrails({
  trails,
  offsetX,
  offsetY,
}: {
  trails: readonly RakeTrail[];
  offsetX: number;
  offsetY: number;
}) {
  return trails.map((trail) => {
    const { left, top } = toScreen(trail.posX, trail.posY, offsetX, offsetY);
    return (
      <svg
        key={`${trail.born}:${trail.posX},${trail.posY}`}
        className="zazen-world__rake-trail"
        viewBox="0 0 64 32"
        width="64"
        height="32"
        style={{ left, top }}
        aria-hidden="true"
      >
        {rakeGrooves(trail).map((points, i) => (
          <polygon key={i} points={points.join(" ")} fill="#89714e" />
        ))}
        <g className="zazen-world__rake-trail-dust" fill="#ead5ad">
          <ellipse cx="27" cy="15" rx="2.5" ry="1.2" />
          <ellipse cx="35" cy="18" rx="3" ry="1.5" />
        </g>
      </svg>
    );
  });
}
