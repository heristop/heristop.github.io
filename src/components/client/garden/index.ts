// The garden's public API, and the only door into it.
//
// Everything under this directory is one feature: an isometric game grown from a GitHub
// contribution history. It is arranged by what a thing IS, because that is what decides
// where it may be used:
//
//   board/       the world model. Pure TypeScript, no React, no DOM — geometry, terrain,
//                the walkability rules, and the pathfinder that prices a crossing.
//   composables/ the hooks. The only things here that hold state across renders.
//   components/  what is drawn. Presentational: props in, pixels out, no game state.
//   schema, types, score  the module's own contracts, pure and shared by all three.
//
// The rest of the site sees a React island and the handful of exports needed to give it a
// seed, which is the entire surface area the page actually uses.
//
// The point of a door is that there is only one. `tests/architecture.test.ts` fails the
// build if anything outside this directory imports past it, because a barrel nobody is
// obliged to use is a suggestion, and a suggestion is how you end up with the page
// importing a pathfinder.

export { default as ZazenWorld } from "./world";
export { FALLBACK_SEED, STONE_COUNT, WINDOW_DAYS, parseGardenSeed } from "./schema";
export type { GardenDay, GardenSeed } from "./schema";
