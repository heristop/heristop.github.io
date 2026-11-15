import type { HaikuSource } from "./haiku-daily";

// The GutenKu server: its REST routes share the host that serves /graphql
const DEFAULT_GUTENKU_API = "https://gutenku.xyz";
// Short enough that the raw GitHub fallback still lands while the skeleton is on screen
const DAILY_HAIKU_TIMEOUT_MS = 4000;

interface DailyHaikuBook {
  author: string;
  emoticons: string;
  title: string;
}

/** GET /api/daily-haiku */
interface DailyHaiku {
  book: DailyHaikuBook;
  cardUrl: string;
  date: string;
  nextRolloverAt?: Date;
  publishedAt: string;
  reading: string;
  title: string;
  verses: string[];
}

interface FetchOptions {
  timeoutMs?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/* The card lands in an <img src>: only an absolute http(s) URL is taken */
const httpUrl = (value: unknown) => {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
};

const instant = (value: unknown) => {
  const date = new Date(text(value));
  return text(value) !== "" && Number.isFinite(date.getTime()) ? date : undefined;
};

/** The endpoint under a base host; PUBLIC_GUTENKU_API overrides the production one */
const dailyHaikuUrl = (base: string | undefined = import.meta.env.PUBLIC_GUTENKU_API) =>
  `${(base?.trim() || DEFAULT_GUTENKU_API).replace(/\/+$/, "")}/api/daily-haiku`;

/** Checks the payload: anything without a reading or a usable card counts as a miss */
const parseDailyHaiku = (payload: unknown): DailyHaiku | undefined => {
  if (!isRecord(payload) || !isRecord(payload.book)) {
    return undefined;
  }
  const cardUrl = httpUrl(payload.cardUrl);
  const reading = text(payload.reading);
  if (!cardUrl || reading === "") {
    return undefined;
  }
  const verses = Array.isArray(payload.verses) ? payload.verses.map(text).filter(Boolean) : [];
  return {
    book: {
      author: text(payload.book.author),
      emoticons: text(payload.book.emoticons),
      title: text(payload.book.title),
    },
    cardUrl,
    date: text(payload.date),
    nextRolloverAt: instant(payload.nextRolloverAt),
    publishedAt: text(payload.publishedAt),
    reading,
    title: text(payload.title),
    verses,
  };
};

/**
 * Today's haiku from GutenKu, or undefined on any miss (network error, 404 before the first
 * publication, timeout, a non-JSON answer or an unexpected shape) so the caller can fall back
 */
const fetchDailyHaiku = async (
  url: string = dailyHaikuUrl(),
  { timeoutMs = DAILY_HAIKU_TIMEOUT_MS }: FetchOptions = {},
): Promise<DailyHaiku | undefined> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return undefined;
    }
    return parseDailyHaiku(await res.json());
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
};

/** The source note (title, book, bookmoji, verses) straight from the API, no caption parsing */
const toHaikuSource = (haiku: DailyHaiku): HaikuSource => ({
  author: haiku.book.author || undefined,
  book: haiku.book.title || undefined,
  bookmoji: haiku.book.emoticons || undefined,
  title: haiku.title || undefined,
  verses: haiku.verses.length === 3 ? haiku.verses : [],
});

export type { DailyHaiku, DailyHaikuBook };
export default {
  DAILY_HAIKU_TIMEOUT_MS,
  DEFAULT_GUTENKU_API,
  dailyHaikuUrl,
  fetchDailyHaiku,
  parseDailyHaiku,
  toHaikuSource,
};
