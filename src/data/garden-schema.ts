// The garden is a 12x12 board. The outer ring is authored landscape; the inner 10x10 is
// the record.
//
// A tile is no longer a day. Without a GitHub token the only history available is the
// public events feed, which for an active account reaches back about three weeks and no
// further — so a hundred-day garden was ninety days of invented quiet dressed as fact.
// The window is fourteen days now, comfortably inside what that feed can actually see,
// and each day owns a run of seven tiles along the boustrophedon snake instead of a
// single square. The garden keeps its size; a day is simply a bed rather than a tile, and
// because the snake keeps consecutive days adjacent a streak still renders as one
// unbroken run of moss.
const GRID_SIZE = 12;
const DATA_COLS = 10;
const DATA_ROWS = 10;
const DATA_TILES = DATA_COLS * DATA_ROWS;
const WINDOW_DAYS = 14;
const STONE_COUNT = 5;

// Which day a tile belongs to, and the tile at the heart of a day's bed. Spread by
// proportion rather than a fixed run length, because 100 does not divide by 14 — days get
// seven tiles or eight, and nobody can tell which from looking.
const dayForTile = (tileIndex: number): number =>
  Math.min(WINDOW_DAYS - 1, Math.floor((tileIndex * WINDOW_DAYS) / DATA_TILES));

const firstTileOfDay = (day: number): number => Math.ceil((day * DATA_TILES) / WINDOW_DAYS);

const tileForDay = (day: number): number => {
  const first = firstTileOfDay(day);
  const last = Math.ceil(((day + 1) * DATA_TILES) / WINDOW_DAYS) - 1;
  return Math.floor((first + last) / 2);
};

interface GardenDay {
  date: string;
  count: number;
  language: string;
  repo: string;
}

interface GardenSeed {
  generatedAt: string;
  login: string;
  totalContributions: number;
  days: readonly (GardenDay | null)[];
}

// Hand-authored stand-in. Phase A runs on this, and it stays the offline fallback
// afterwards, so it must look deliberate rather than arbitrary.
const FALLBACK_PATTERN = [0, 2, 5, 3, 0, 1, 4, 7, 2, 0, 3, 6, 11, 4];

const FALLBACK_LANGUAGES = ["TypeScript", "TypeScript", "JavaScript", "PHP", "Astro"];
const FALLBACK_START_YEAR = 2026;
const FALLBACK_START_MONTH = 4;
const FALLBACK_START_DAY = 28;
const ISO_DATE_LENGTH = 10;

const buildFallbackDays = (): readonly (GardenDay | null)[] =>
  FALLBACK_PATTERN.map((count, index) => {
    const day = new Date(Date.UTC(FALLBACK_START_YEAR, FALLBACK_START_MONTH, FALLBACK_START_DAY));
    day.setUTCDate(day.getUTCDate() + index);
    return {
      count,
      date: day.toISOString().slice(0, ISO_DATE_LENGTH),
      language: count === 0 ? "" : FALLBACK_LANGUAGES[index % FALLBACK_LANGUAGES.length],
      repo: count === 0 ? "" : "zazen-code",
    };
  });

const FALLBACK_SEED: GardenSeed = {
  days: buildFallbackDays(),
  generatedAt: "2026-05-28T00:00:00.000Z",
  login: "heristop",
  totalContributions: FALLBACK_PATTERN.reduce((sum, count) => sum + count, 0),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseDay = (raw: unknown): GardenDay | null | undefined => {
  if (raw === null) {
    return null;
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  const { date, count, language, repo } = raw;
  if (typeof date !== "string" || typeof count !== "number" || !Number.isFinite(count)) {
    return undefined;
  }
  return {
    count: Math.max(0, Math.trunc(count)),
    date,
    language: typeof language === "string" ? language : "",
    repo: typeof repo === "string" ? repo : "",
  };
};

// Never throws. A malformed data file must degrade to a playable garden, not break the page.
const parseGardenSeed = (raw: unknown): GardenSeed => {
  if (!isRecord(raw)) {
    return FALLBACK_SEED;
  }
  const { generatedAt, login, totalContributions, days } = raw;
  if (!Array.isArray(days) || days.length !== WINDOW_DAYS) {
    return FALLBACK_SEED;
  }
  const parsedDays: (GardenDay | null)[] = [];
  for (const entry of days) {
    const day = parseDay(entry);
    if (day === undefined) {
      return FALLBACK_SEED;
    }
    parsedDays.push(day);
  }
  return {
    days: parsedDays,
    generatedAt: typeof generatedAt === "string" ? generatedAt : "",
    login: typeof login === "string" ? login : "",
    totalContributions:
      typeof totalContributions === "number" && Number.isFinite(totalContributions)
        ? totalContributions
        : 0,
  };
};

export type { GardenDay, GardenSeed };
export {
  DATA_COLS,
  DATA_ROWS,
  DATA_TILES,
  FALLBACK_SEED,
  GRID_SIZE,
  STONE_COUNT,
  WINDOW_DAYS,
  dayForTile,
  firstTileOfDay,
  parseGardenSeed,
  tileForDay,
};
