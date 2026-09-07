import { GRID_SIZE } from "../schema";
import type { MapTile, Position } from "../types";
import { manhattan } from "./geometry";
import { cheapestCrossing } from "./routing";
import { tourCompletes } from "./terrain";
import { tileAt, findWalkablePath, canPaveTile } from "./rules";

export const GARDENER_REFILL = 2;
export const GARDENER_STEP_MS = 240;
export const GARDENER_RAKE_MS = 720;
export type GardenerAction = { kind: "walk" | "rake"; position: Position };

export const planGardenerTurn = (
  map: readonly MapTile[],
  from: Position,
  targets: readonly Position[],
  player: Position,
): GardenerAction[] => {
  // The gardener can cross sand, but respects water, scenery and the player's tile.
  const ground = map.map((tile) => ({
    ...tile,
    sprite: canPaveTile(tile) ? "stone-slab" : tile.sprite,
    walkable: tile.walkable && manhattan(tile, player) !== 0,
  }));
  const actions: GardenerAction[] = [];
  let position = from;
  for (const target of targets) {
    const path = findWalkablePath(ground, position, target);
    if (!path) continue;
    actions.push(...path.map((step) => ({ kind: "walk" as const, position: step })), {
      kind: "rake",
      position: target,
    });
    position = target;
  }
  return actions;
};

// Target useful approaches, not arbitrary old slabs. Never remove a discovery or structure.
export const chooseRakeTargets = (
  map: readonly MapTile[],
  trail: readonly Position[],
  player: Position,
  turnNumber = 1,
  options: { budget?: number; limit?: number; from?: Position } = {},
): Position[] => {
  const stones = map.filter((tile) => tile.stone !== undefined);
  const shrine = map.find((tile) => tile.shrine !== undefined);
  const goals = stones.length ? stones : shrine ? [shrine] : [];
  if (!goals.length) return [];
  if (
    options.budget !== undefined &&
    shrine &&
    !tourCompletes(map, player, stones, shrine, options.budget)
  )
    return [];
  let working = [...map];
  const selected: Position[] = [];
  const limit = options.limit ?? (turnNumber > 1 ? 3 : 2);
  for (let index = 0; index < limit; index++) {
    const before = goals.map((goal) => cheapestCrossing(working, player, goal) ?? 1000);
    const candidates = working.filter(
      (tile) =>
        (tile.laid ||
          tile.sprite.startsWith("moss") ||
          tile.sprite === "sand-moss" ||
          (tile.sprite === "gravel-edge" &&
            tile.posX > 0 &&
            tile.posX < GRID_SIZE - 1 &&
            tile.posY > 0 &&
            tile.posY < GRID_SIZE - 1)) &&
        tile.walkable &&
        manhattan(tile, player) > 1 &&
        tile.decor === "" &&
        tile.npc === 0 &&
        tile.stone === undefined &&
        !tile.shrine &&
        !tile.gathered &&
        !tile.transformed &&
        !selected.some((target) => manhattan(tile, target) === 0),
    );
    const ranked = candidates
      .map((tile) => {
        const changed = working.map((cell) =>
          cell === tile ? { ...cell, sprite: "sand-0", laid: false } : cell,
        );
        const addedCost = goals.reduce(
          (sum, goal, goalIndex) =>
            sum +
            Math.max(0, (cheapestCrossing(changed, player, goal) ?? 1000) - before[goalIndex]),
          0,
        );
        const proximity = Math.min(...goals.map((goal) => manhattan(tile, goal)));
        return {
          tile,
          changed,
          score:
            addedCost * 100 +
            20 / (1 + proximity) +
            (trail.some((step) => manhattan(step, tile) === 0) ? 1 : 0),
        };
      })
      .sort((a, b) => b.score - a.score);
    const from = selected.at(-1) ?? options.from;
    const best = ranked.find((candidate) => {
      if (from && !planGardenerTurn(working, from, [candidate.tile], player).length) return false;
      return (
        options.budget === undefined ||
        !shrine ||
        tourCompletes(candidate.changed, player, stones, shrine, options.budget)
      );
    });
    if (!best) break;
    selected.push({ posX: best.tile.posX, posY: best.tile.posY });
    working = best.changed;
  }
  return selected;
};

export const rakePaths = (
  map: readonly MapTile[],
  original: readonly MapTile[],
  targets: readonly Position[],
): MapTile[] =>
  map.map((tile) => {
    if (!targets.some((target) => manhattan(tile, target) === 0)) return tile;
    return {
      ...tile,
      laid: false,
      sprite: tileAt(original, tile)?.sprite === "sand-1" ? "sand-1" : "sand-0",
    };
  });
