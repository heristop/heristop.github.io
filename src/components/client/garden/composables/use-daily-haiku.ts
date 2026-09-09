import { useEffect, useState } from "react";

export const ZEN_DAILY_URL =
  "https://raw.githubusercontent.com/heristop/gutenku/main/assets/social-preview-description.txt";

export function parseZenDailyPoem(text: string): readonly string[] | undefined {
  // GutenKu publishes the card's original verses between its second and third
  // separators. The other blocks contain book hints, translations and hashtags.
  const sections = text.replace(/\r\n?/g, "\n").split(/^[ \t]*~~~[ \t]*$/m);
  if (sections.length < 4) return;
  const lines = sections[2]
    .trim()
    .split("\n")
    .map((line) => line.trim());
  if (lines.length !== 3 || lines.some((line) => !line || line.length > 200)) return;
  return lines;
}

export default function useDailyHaiku(finaleOpen: boolean): readonly string[] | undefined {
  const day = new Date().toISOString().slice(0, 10);
  const [poem, setPoem] = useState<{ day: string; lines: readonly string[] }>();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    // Preload during play and refresh at the finale, including a run spanning midnight.
    void fetch(`${ZEN_DAILY_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const lines = parseZenDailyPoem(await response.text());
        if (lines && !controller.signal.aborted) setPoem({ day, lines });
      })
      .catch(() => {
        // The garden's original poem remains available without the daily service.
      })
      .finally(() => clearTimeout(timer));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [day, finaleOpen]);
  return poem?.day === day ? poem.lines : undefined;
}
