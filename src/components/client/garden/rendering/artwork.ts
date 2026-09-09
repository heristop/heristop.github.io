import type { MapTile } from "../types";

const VARIED_GROUNDS = new Set([
  "sand-0",
  "sand-1",
  "sand-moss",
  "moss-mid",
  "moss-deep",
  "gravel-edge",
]);
export const groundArtwork = (tile: MapTile) => {
  if (!VARIED_GROUNDS.has(tile.sprite)) return tile.sprite;
  const hash = Math.imul(tile.posX + 1, 73856093) ^ Math.imul(tile.posY + 1, 19349663);
  const variant = ((hash >>> 8) ^ hash) & 3;
  return variant ? `${tile.sprite}-v${variant}` : tile.sprite;
};

// Small tufts record activity on raked beds without making the sand look traversable.
// Shared by the DOM and GPU renderers; these never affect collision or paving costs.
export const activityMarks = (tile: MapTile): readonly { x: number; y: number }[] => {
  if (!tile.day?.count || !["sand-0", "sand-1"].includes(tile.sprite) || tile.laid) return [];
  const amount = tile.day.count >= 9 ? 9 : tile.day.count >= 4 ? 6 : 3;
  return Array.from({ length: amount }, (_, i) => {
    const u = 4 + ((i * 7 + tile.posX * 3) % 24);
    const v = 4 + ((i * 11 + tile.posY * 5) % 24);
    return { x: 32 + u - v, y: Math.floor((u + v) / 2) };
  });
};
