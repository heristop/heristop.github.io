const COARSE_POINTER_QUERY = "(hover: none) and (pointer: coarse)";

type PretextModule = typeof import("@chenglou/pretext");

let pretextModulePromise: Promise<PretextModule> | null = null;

const hasMatchMedia = (): boolean => typeof globalThis.matchMedia === "function";

export const usesCoarsePointer = (): boolean =>
  hasMatchMedia() && globalThis.matchMedia(COARSE_POINTER_QUERY).matches;

export const loadPretext = (): Promise<PretextModule> => {
  pretextModulePromise ??= import("@chenglou/pretext");
  return pretextModulePromise;
};
