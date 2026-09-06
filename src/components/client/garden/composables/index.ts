// The composables: React hooks, and the only things in the module that hold state across
// renders. Kept apart from ./components because the distinction is load-bearing — a
// component here takes props and draws, a composable owns a piece of the running game.
export { default as useZazenGame } from "./use-game";
export type { UseZazenGameOptions, ZazenGameState } from "./use-game";
export { default as useZazenStep, prefersReducedMotion } from "./use-step";
export { default as useZazenAudio } from "./use-audio";
