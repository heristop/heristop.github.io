// GutenKu's daily workflow commits the new card and texts at 10:00 UTC
const ROLLOVER_UTC_HOUR = 10;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const MINUTE_MS = 60_000;
const LOCALE = "en-GB";

interface HaikuDay {
  day: string;
  dayMonth: string;
  fullDate: string;
  iso: string;
  month: string;
  weekday: string;
}

interface NextVerse {
  label: string;
  progress: number;
}

interface HaikuSource {
  author?: string;
  book?: string;
  bookmoji?: string;
  title?: string;
  verses: string[];
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Today's local date, in the pieces the eyebrow and the seal set */
const haikuDay = (now: Date): HaikuDay => {
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, options).format(now);
  return {
    day: String(now.getDate()),
    dayMonth: part({ day: "numeric", month: "long" }),
    fullDate: part({ day: "numeric", month: "long", year: "numeric" }),
    iso: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    month: part({ month: "short" }),
    weekday: part({ weekday: "long" }),
  };
};

/** Time left before the next rollover, and how much of the verse's day has passed (0–1) */
const nextVerse = (now: Date): NextVerse => {
  const next = new Date(now);
  next.setUTCHours(ROLLOVER_UTC_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setTime(next.getTime() + DAY_MS);
  }
  const left = next.getTime() - now.getTime();
  const hours = Math.floor(left / HOUR_MS);
  const label =
    hours >= 1
      ? `Next verse in ${hours} h`
      : `Next verse in ${Math.max(1, Math.ceil(left / MINUTE_MS))} min`;
  return { label, progress: 1 - left / DAY_MS };
};

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
]);

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");

const lineAfter = (lines: string[], marker: RegExp) => {
  const index = lines.findIndex((line) => marker.test(line));
  return index === -1 ? undefined : lines[index + 1]?.trim() || undefined;
};

/**
 * Reads GutenKu's social post (social-preview-description.txt): the haiku's title, the riddle's
 * bookmoji hint, the answer ("📗 Book by Author") and the three verses
 */
const parseHaikuSource = (raw: string): HaikuSource => {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const title = /“([^”]+)”/.exec(raw)?.[1]?.trim();
  const answer = lines
    .find((line) => line.startsWith("📗"))
    ?.replace("📗", "")
    .trim();
  const match = answer ? /^(.+?)\s+by\s+(.+)$/i.exec(answer) : null;
  const sections = raw.split(/^~~~\s*$/m);
  const verses = (sections[2] ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    author: match?.[2]?.trim(),
    book: match?.[1] ? titleCase(match[1].trim()) : undefined,
    bookmoji: lineAfter(lines, /bookmoji/i),
    title,
    verses: verses.length === 3 ? verses : [],
  };
};

/** The first sentence of a reading, and what follows it */
const splitLead = (text: string): { body: string; lead?: string } => {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(text.trim());
  if (!match?.[1] || !match[2]) {
    return { body: text };
  }
  return { body: match[2], lead: match[1] };
};

export type { HaikuDay, HaikuSource, NextVerse };
export default { haikuDay, nextVerse, parseHaikuSource, splitLead };
