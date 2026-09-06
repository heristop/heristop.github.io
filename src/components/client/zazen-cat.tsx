import { useEffect, useState } from "react";
import type { Position } from "./zazen-garden-types";
import { toScreen } from "./zazen-world-geometry";

// Half the pilgrim's height, and a quarter of the area he was as scenery. A cat standing
// as tall as the man walking past it is not a cat, it is a bear.
const CELL = 24;
// The tile's front vertex sits at (32, 32) of its 64px cell, and the cat's feet are at
// row 22 of his own — so he stands where the pilgrim stands, on the same ground line.
const ANCHOR_X = 20;
const ANCHOR_Y = 10;

interface Props {
  position: Position;
  facingLeft: boolean;
  greeting: boolean;
  offsetX: number;
  offsetY: number;
}

// His own layer rather than a tile's decor, because decor cannot move between tiles: it
// belongs to the tile that drew it. Anything that walks has to live above the grid.
// How long the slide between tiles takes, matched to the CSS transition. The walk cycle
// runs for exactly this long and not a frame more.
const STRIDE_MS = 460;

const ZazenCat = ({ position, facingLeft, greeting, offsetX, offsetY }: Props) => {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);

  // Legs only while there is ground going past. The walk cycle used to run forever, so a
  // cat sitting still was pedalling on the spot — which is the one thing that makes a
  // sprite read as a sprite rather than as an animal.
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

  const classes = ["zazen-world__cat"];
  if (walking) {
    classes.push("zazen-world__cat--walking");
  }
  if (greeting) {
    classes.push("zazen-world__cat--greeting");
  }

  return (
    <div
      className={classes.join(" ")}
      aria-hidden="true"
      style={{
        left: `${left + ANCHOR_X}px`,
        // Mirrored rather than drawn twice. A horizontal flip is the one transform pixel
        // art survives intact — every pixel lands on another pixel.
        transform: facingLeft ? "scaleX(-1)" : undefined,
        top: `${top + ANCHOR_Y}px`,
      }}
    />
  );
};

export default ZazenCat;
export { CELL as CAT_CELL };
