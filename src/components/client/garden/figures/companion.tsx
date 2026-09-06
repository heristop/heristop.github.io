import { useEffect, useState } from "react";
import type { Position } from "../types";
import { toScreen } from "../board/geometry";

// The woman who was a frog, once she is walking.
//
// She could have stayed what she is at the moment of the transformation — an npc drawn
// into a tile — and that would have been the cheaper thing. But a figure parented to a
// tile cannot move between tiles: the tile owns her, and the tile is not going anywhere.
// So the instant she stands up she leaves the grid entirely and joins the pilgrim and the
// cat on the layer above it, which is the layer for things that walk.

// She is drawn from the same 24x40 cell as the pilgrim, so she takes his anchor: the
// diamond's front vertex at y = 32, less the sprite's own footing at y = 37.
const ANCHOR_X = 20;
const ANCHOR_Y = -5;
const STRIDE_MS = 460;

interface Props {
  position: Position;
  facingLeft: boolean;
  offsetX: number;
  offsetY: number;
}

const ZazenCompanion = ({ position, facingLeft, offsetX, offsetY }: Props) => {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);

  // She has one frame, so there is no walk cycle to run — but she still leans into a step
  // and settles out of it, which is enough to read as walking rather than gliding.
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    setWalking(true);
    const timer = setTimeout(() => {
      setWalking(false);
    }, STRIDE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [position.posX, position.posY]);

  return (
    <div
      className={
        walking
          ? "zazen-world__companion zazen-world__companion--walking"
          : "zazen-world__companion"
      }
      aria-hidden="true"
      style={{
        left: `${left + ANCHOR_X}px`,
        top: `${top + ANCHOR_Y}px`,
      }}
    >
      <img
        src="/images/zazen/persos/npc-2.png"
        alt=""
        className="zazen-world__companion-sprite"
        // Mirrored rather than drawn twice. A horizontal flip is the one transform pixel
        // art survives intact — every pixel lands on another pixel.
        style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}
      />
    </div>
  );
};

export default ZazenCompanion;
