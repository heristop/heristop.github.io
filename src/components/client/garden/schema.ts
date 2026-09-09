// The garden is a 12x12 board. The outer ring is authored landscape; the inner 10x10 is
// the record.
//
// Each of the last fourteen completed UTC days owns a bed of seven or eight tiles.
// Public events can be incomplete; snapshot metadata makes that limitation explicit.
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
  unit?: "contributions" | "pushes";
  projects?: readonly { repo: string; language: string }[];
}

interface GardenSeed {
  source?: "calendar" | "events" | "sample";
  fetchStatus?: "fresh" | "partial" | "stale";
  checkedAt?: string;
  projectsComplete?: boolean;
  generatedAt: string;
  login: string;
  totalContributions: number;
  days: readonly (GardenDay | null)[];
}

// Hand-authored stand-in. Phase A runs on this, and it stays the offline fallback
// afterwards, so it must look deliberate rather than arbitrary.
const FALLBACK_PATTERN = [0, 2, 5, 3, 0, 1, 4, 7, 2, 0, 3, 6, 11, 4];

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
      language: "",
      repo: "",
    };
  });

const FALLBACK_SEED: GardenSeed = {
  source: "sample",
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
    ...(raw.unit === "contributions" || raw.unit === "pushes" ? { unit: raw.unit } : {}),
    ...(Array.isArray(raw.projects)
      ? {
          projects: raw.projects
            .filter(isRecord)
            .filter((project) => typeof project.repo === "string" && project.repo !== "")
            .map((project) => ({
              repo: project.repo as string,
              language: typeof project.language === "string" ? project.language : "",
            })),
        }
      : {}),
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
    ...(raw.source === "calendar" || raw.source === "events" || raw.source === "sample"
      ? { source: raw.source }
      : {}),
    ...(raw.fetchStatus === "fresh" || raw.fetchStatus === "partial" || raw.fetchStatus === "stale"
      ? { fetchStatus: raw.fetchStatus }
      : {}),
    ...(typeof raw.checkedAt === "string" ? { checkedAt: raw.checkedAt } : {}),
    ...(typeof raw.projectsComplete === "boolean"
      ? { projectsComplete: raw.projectsComplete }
      : {}),
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
