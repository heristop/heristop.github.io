// The garden's website API. Offline tools use the separate headless.ts entry.
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
// The host page also loads index.scss once, outside the React hydration graph.
//
// `tests/architecture.test.ts` keeps website imports on this entry and restricts
// headless.ts to the offline simulation tools, so a page cannot reach into the model.

export { default as ZazenWorld } from "./world";
export { FALLBACK_SEED, STONE_COUNT, WINDOW_DAYS, parseGardenSeed } from "./schema";
export type { GardenDay, GardenSeed } from "./schema";
