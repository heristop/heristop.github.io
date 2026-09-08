import type { Position } from "../../types";
import { toScreen } from "../../board/geometry";

// Half the pilgrim's height, and a quarter of the area he was as scenery. A cat standing
// as tall as the man walking past it is not a cat, it is a bear.
const CELL = 24;
// The tile's front vertex sits at (32, 32) of its 64px cell, and the cat's feet are at
// row 22 of his own — so he stands where the pilgrim stands, on the same ground line.
const ANCHOR_X = 20;
const ANCHOR_Y = 10;

interface Props {
  position: Position;
  walking: boolean;
  facingLeft: boolean;
  greeting: boolean;
  offsetX: number;
  offsetY: number;
}

// His own layer rather than a tile's decor, because decor cannot move between tiles: it
// belongs to the tile that drew it. Anything that walks has to live above the grid.

const ZazenCat = ({ position, walking, facingLeft, greeting, offsetX, offsetY }: Props) => {
  const { left, top } = toScreen(position.posX, position.posY, offsetX, offsetY);

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
        left: 0,
        translate: `${left + ANCHOR_X}px ${top + ANCHOR_Y}px`,
        // Mirrored rather than drawn twice. A horizontal flip is the one transform pixel
        // art survives intact — every pixel lands on another pixel.
        scale: facingLeft ? "-1 1" : undefined,
        top: 0,
      }}
    />
  );
};

export default ZazenCat;
export { CELL as CAT_CELL };
