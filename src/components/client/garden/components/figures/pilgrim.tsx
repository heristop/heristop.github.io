import type { Direction, Position } from "../../types";
import { toScreen } from "../../board/geometry";

// Cell size of one frame in the pilgrim sheet, and the sheet's facing order.
const CELL_WIDTH = 24;
const CELL_HEIGHT = 40;
const FACING_ROW: Record<Direction, number> = { E: 2, N: 3, S: 0, W: 1 };

// The tile cell is 64x64 with the diamond's top face on rows 0-31, so its centre is at
// (32, 16). Decor and the pilgrim both stand at the diamond's front vertex, y = 32.
// The sprite is 24 wide with its feet at y = 37, hence 32 - 12 across and 32 - 37 down.
const ANCHOR_X = 20;
const ANCHOR_Y = -5;

interface Props {
  renderPosition: Position;
  facing: Direction;
  frame: number;
  moving: boolean;
  offsetX: number;
  offsetY: number;
}

// Its own absolutely positioned layer rather than an <img> inside a tile: you cannot
// tween a sprite between two DOM parents, so a tile-parented pilgrim can never move
// smoothly. Keeping it out of the grid also means tile memoisation is untouched by
// animation state.
const ZazenPilgrim = ({ renderPosition, facing, frame, moving, offsetX, offsetY }: Props) => {
  const { left, top } = toScreen(renderPosition.posX, renderPosition.posY, offsetX, offsetY);
  const spriteClass = moving
    ? "zazen-world__pilgrim-sprite"
    : "zazen-world__pilgrim-sprite zazen-world__pilgrim-sprite--idle";

  // Two elements, not one. The idle bob is on the inner sprite because it switches on and
  // off as he walks; the arrival fade is on the outer box because it must play exactly
  // once. Sharing an element meant every step removed the idle rule, which handed the
  // element back to the delayed arrival animation — and its `both` fill held opacity at 0
  // through the delay, so he blinked out for over a second each time he set off.
  return (
    <div
      className="zazen-world__pilgrim"
      aria-hidden="true"
      style={{
        height: `${CELL_HEIGHT}px`,
        left: 0,
        top: 0,
        translate: `${left + ANCHOR_X}px ${top + ANCHOR_Y}px`,
        width: `${CELL_WIDTH}px`,
      }}
    >
      <div
        className={spriteClass}
        style={{
          backgroundPosition: `-${frame * CELL_WIDTH}px -${FACING_ROW[facing] * CELL_HEIGHT}px`,
        }}
      />
    </div>
  );
};

export default ZazenPilgrim;
export { ANCHOR_X as PILGRIM_ANCHOR_X, CELL_HEIGHT, CELL_WIDTH, FACING_ROW };
