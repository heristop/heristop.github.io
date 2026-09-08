export type SceneryKind = "tree" | "stone";
export const sceneryDuration = (kind: SceneryKind) => kind === "tree" ? 1800 : 1400;

export const sceneryAngle = (kind: SceneryKind, progress: number) => {
  const t = Math.max(0, Math.min(1, progress));
  return kind === "stone"
    ? Math.PI * 4 * t * t * (3 - 2 * t)
    : Math.sin(t * Math.PI * 7) * Math.sin(t * Math.PI) * (1 - t) * 0.18;
};

export const sceneryLift = (progress: number) =>
  Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 7;
