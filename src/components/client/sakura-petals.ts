const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

export const shouldBindSakuraTouchBursts = (): boolean =>
  typeof globalThis.matchMedia !== "function" ||
  !globalThis.matchMedia(COARSE_POINTER_QUERY).matches;
