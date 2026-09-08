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
