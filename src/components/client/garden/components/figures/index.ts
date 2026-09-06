// Everything that walks. Each one is its own absolutely positioned layer above the grid,
// because a sprite parented to a tile belongs to that tile and can never leave it.
export { default as ZazenPilgrim, PILGRIM_ANCHOR_X } from "./pilgrim";
export { default as ZazenCat, CAT_CELL } from "./cat";
export { default as ZazenCompanion } from "./companion";
