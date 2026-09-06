import type { Direction, MapTile, MoveResult, Position } from "../types";
import { applyDirectionOffset } from "./geometry";

const STONE_DECOR = "stone-marker";
const SHRINE_SPRITE_ACTIVE = "shrine-active";
const LAID_STONE_SPRITE = "stone-slab";

// Raked sand. A dry garden's sand is combed into lines and you do not walk through it —
// which is the whole rule the game now turns on, because sand is what a day with no
// commits leaves behind. Everything else underfoot is firm: moss, gravel, slab, plank,
// the shrine's dais, and any stone you have laid yourself.
const RAKED_SAND = new Set(["sand-0", "sand-1"]);

const isRakedSand = (tile: MapTile): boolean => RAKED_SAND.has(tile.sprite);

// Whether anything is standing in the way, regardless of what the ground is made of. A
// stone marker sits on open ground — you step onto it to gather it. Everything else in
// the decor layer blocks.
const isClear = (tile: MapTile): boolean =>
  tile.walkable && tile.npc === 0 && (tile.decor === "" || tile.decor === STONE_DECOR);

const isWalkableTile = (tile: MapTile): boolean => isClear(tile) && !isRakedSand(tile);

// Sand you are allowed to pave. Water and the gate are not: no number of stones buys a
// way through them, and a crossing that pretended otherwise would be a lie the generator
// could not honour.
const canPaveTile = (tile: MapTile): boolean => isClear(tile) && isRakedSand(tile);

// Laying a stone is permanent. The garden remembers where you chose to cross, which is
// what makes the choice cost something.
const layStoneAt = (map: readonly MapTile[], position: Position): MapTile[] =>
  map.map((tile) =>
    tile.posX === position.posX && tile.posY === position.posY
      ? { ...tile, laid: true, sprite: LAID_STONE_SPRITE }
      : tile,
  );

const tileAt = (map: readonly MapTile[], position: Position): MapTile | undefined =>
  map.find((tile) => tile.posX === position.posX && tile.posY === position.posY);

const performMove = (
  direction: Direction,
  from: Position,
  map: readonly MapTile[],
): MoveResult | undefined => {
  const next = applyDirectionOffset(direction, from.posX, from.posY);
  const target = tileAt(map, next);
  if (!target || !isWalkableTile(target)) {
    return undefined;
  }
  return { newMap: [...map], newPosition: next };
};

const positionKey = (position: Position): string => `${position.posX},${position.posY}`;

// Shortest walkable route from `from` to `to`, excluding the tile you start on. Used to
// walk the pilgrim to a tile the player picked rather than one they stepped toward.
// Returns undefined when the target cannot be reached on foot.
const findWalkablePath = (
  map: readonly MapTile[],
  from: Position,
  to: Position,
): Position[] | undefined => {
  const targetKey = positionKey(to);
  if (positionKey(from) === targetKey) {
    return [];
  }
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const parents = new Map<string, Position>();
  const seen = new Set<string>([positionKey(from)]);
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    for (const direction of ["N", "E", "S", "W"] as const) {
      const next = applyDirectionOffset(direction, current.posX, current.posY);
      const nextKey = positionKey(next);
      const tile = byKey.get(nextKey);
      if (!tile || seen.has(nextKey) || !isWalkableTile(tile)) {
        continue;
      }
      seen.add(nextKey);
      parents.set(nextKey, current);
      if (nextKey === targetKey) {
        const path: Position[] = [];
        let cursor: Position | undefined = next;
        while (cursor && positionKey(cursor) !== positionKey(from)) {
          path.unshift(cursor);
          cursor = parents.get(positionKey(cursor));
        }
        return path;
      }
      queue.push(next);
    }
  }
  return undefined;
};

const collectStoneAt = (map: readonly MapTile[], stoneIndex: number): MapTile[] =>
  map.map((tile) => {
    if (tile.stone !== stoneIndex) {
      return tile;
    }
    const next: MapTile = { ...tile, decor: "", gathered: true };
    delete next.stone;
    return next;
  });

const activateShrine = (map: readonly MapTile[], shrine: Position): MapTile[] =>
  map.map((tile) =>
    tile.posX === shrine.posX && tile.posY === shrine.posY
      ? { ...tile, shrine: "active", sprite: SHRINE_SPRITE_ACTIVE }
      : tile,
  );

const KEY_DIRECTIONS: Record<string, Direction> = {
  a: "W",
  arrowdown: "S",
  arrowleft: "W",
  arrowright: "E",
  arrowup: "N",
  d: "E",
  s: "S",
  w: "N",
};

const handleKeyDirection = (ev: KeyboardEvent, move: (dir: Direction) => void): void => {
  const direction = KEY_DIRECTIONS[ev.key.toLowerCase()];
  if (!direction) {
    return;
  }
  ev.preventDefault();
  move(direction);
};

export {
  LAID_STONE_SPRITE,
  STONE_DECOR,
  activateShrine,
  canPaveTile,
  collectStoneAt,
  findWalkablePath,
  handleKeyDirection,
  isRakedSand,
  isWalkableTile,
  layStoneAt,
  performMove,
  tileAt,
};
