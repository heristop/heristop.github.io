export type SceneryKind = "tree" | "stone" | "cat" | "frog" | "fountain";
export const sceneryDuration = (kind: SceneryKind) => kind === "tree" ? 1800 : kind === "cat" ? 900 : kind === "frog" ? 700 : kind === "fountain" ? 1000 : 1400;

export const fountainSpray = (index: number, progress: number) => {
  const t = Math.max(0, Math.min(1, progress));
  const spread = index - 3;
  return {
    x: spread * t * 2.1,
    y: -Math.sin(t * Math.PI) * (8 - Math.abs(spread)) + t * 1.5,
    alpha: Math.min(1, t * 10) * (1 - t),
  };
};

export const sceneryAngle = (kind: SceneryKind, progress: number) => {
  const t = Math.max(0, Math.min(1, progress));
  return kind === "stone"
    ? Math.PI * 4 * t * t * (3 - 2 * t)
    : Math.sin(t * Math.PI * 7) * Math.sin(t * Math.PI) * (1 - t) * 0.18;
};

export const sceneryLift = (progress: number) =>
  Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI) * 7;

export const stoneShadowScale = (progress: number) => 1 - sceneryLift(progress) / 14;
