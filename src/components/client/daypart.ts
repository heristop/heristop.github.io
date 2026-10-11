/* Time-of-day wash on the header banner. The head script in BaseHead.astro mirrors daypartFor
   inline (it runs before first paint, before any module loads); tests hold the two together. */

export type Daypart = "dawn" | "dusk";

// Local hours, start inclusive, end exclusive: dawn 5:00–8:59, dusk 17:00–19:59
export const DAWN_HOURS = [5, 9] as const;
export const DUSK_HOURS = [17, 20] as const;

export const daypartFor = (hour: number): Daypart | undefined => {
  if (hour >= DAWN_HOURS[0] && hour < DAWN_HOURS[1]) {
    return "dawn";
  }
  if (hour >= DUSK_HOURS[0] && hour < DUSK_HOURS[1]) {
    return "dusk";
  }
  return undefined;
};
