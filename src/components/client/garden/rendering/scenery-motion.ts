export type SceneryKind = "tree" | "stone";
export const sceneryDuration = (kind: SceneryKind) => kind === "tree" ? 1800 : 1400;

export const sceneryAngle = (kind: SceneryKind, progress: number) => {
  const t = Math.max(0, Math.min(1, progress));
  return kind === "stone"
    ? Math.PI * 6 * (1 - (1 - t) ** 3)
    : Math.sin(t * Math.PI * 7) * Math.sin(t * Math.PI) * (1 - t) * 0.18;
};
