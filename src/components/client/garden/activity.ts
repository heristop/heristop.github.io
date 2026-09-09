import type { GardenDay, GardenSeed } from "./schema";

// Metadata and refresh timestamps must not reshuffle terrain or erase a best score.
export const gardenFingerprint = (seed: GardenSeed): string =>
  JSON.stringify([5, seed.login, seed.days.map((day) => (day ? [day.date, day.count] : null))]);

export const activityLabel = (day: GardenDay): string => {
  const noun = day.unit === "pushes" ? "push" : "contribution";
  const plural = day.unit === "pushes" ? "pushes" : "contributions";
  return day.count === 0 ? `no ${plural}` : `${day.count} ${day.count === 1 ? noun : plural}`;
};

export const snapshotStatus = (seed: GardenSeed, now = new Date()): string => {
  if (seed.source === "sample") return "Sample garden · GitHub data unavailable";
  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86400000,
  )
    .toISOString()
    .slice(0, 10);
  const lastDay = seed.days.at(-1)?.date;
  if (seed.fetchStatus === "stale") return "Refresh failed · showing saved activity";
  if (!lastDay || lastDay < yesterday) return "Older snapshot · awaiting a refresh";
  if (seed.source === "events" || seed.fetchStatus === "partial")
    return "Partial activity · public push counts";
  if (seed.projectsComplete === false)
    return "Contributions updated · some project details unavailable";
  return "Activity up to date";
};
