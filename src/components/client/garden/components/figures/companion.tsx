import type { Position } from "../../types";
import { toScreen } from "../../board/geometry";

// The freed woman stays on the frog’s original tile.

// She is drawn from the same 24x40 cell as the pilgrim, so she takes his anchor: the
// diamond's front vertex at y = 32, less the sprite's own footing at y = 37.
const ANCHOR_X = 20;
const ANCHOR_Y = -5;

interface Props {
  position: Position;
  walking: boolean;
  transforming: boolean;
  aquatic?: boolean;
  facingLeft: boolean;
  offsetX: number;
  offsetY: number;
}

const ZazenCompanion = ({
  position,
  walking,
  transforming,
  aquatic = false,
  facingLeft,
  offsetX,
  offsetY,
}: Props) => {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);

  return (
    <div
      className={
        walking
          ? "zazen-world__companion zazen-world__companion--walking"
          : "zazen-world__companion"
      }
      data-aquatic={aquatic || undefined}
      data-transforming={transforming || undefined}
      data-position={`${position.posX},${position.posY}`}
      aria-hidden="true"
      style={{
        left: `${left + ANCHOR_X}px`,
        top: `${top + ANCHOR_Y}px`,
      }}
    >
      <span
        className={
          aquatic
            ? "zazen-world__companion-sprite zazen-world__mermaid-sprite"
            : "zazen-world__companion-sprite zazen-world__npc-2-sprite"
        }
        // Mirrored rather than drawn twice. A horizontal flip is the one transform pixel
        // art survives intact — every pixel lands on another pixel.
        style={{ scale: facingLeft ? "-1 1" : undefined }}
      />
    </div>
  );
};

export default ZazenCompanion;
