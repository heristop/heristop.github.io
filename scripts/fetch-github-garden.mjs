// GitHub activity -> src/data/github-garden.json, the seed the garden is grown from.
//
// Run by hand (`pnpm run fetch:github`) or by CI before the build. The build itself only
// ever READS the committed JSON, so `pnpm dev` needs no network and a GitHub outage can
// never fail a build.
//
// Three levels of fallback:
//   1. a live fetch here            -> fresh
//   2. the committed JSON, untouched -> stale but real   (this script exits 0 on any error)
//   3. FALLBACK_SEED in the schema   -> always builds, needs no file at all
//
// Token-optional. With GITHUB_TOKEN the GraphQL contribution calendar gives real daily
// counts; without one, daily counts are derived from public PushEvents, which reach back
// about 90 days. Either way it is two requests.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN = "heristop";
// Fourteen days, not a hundred. Without a token the only source is the public events
// feed, and that feed is capped at 300 events for all time — for an active account most
// of which are reviews, issues and comments rather than pushes. Measured against this
// account it reaches back about three weeks; a hundred-day window was therefore eighty-odd
// days of invented quiet presented as fact. Fourteen sits comfortably inside what the feed
// can actually see, with room for a busier fortnight than usual.
const WINDOW_DAYS = 14;
// Three is the endpoint's hard ceiling: page four answers 422.
const EVENT_PAGES = 3;
const ISO_DATE_LENGTH = 10;
const MS_PER_DAY = 86_400_000;
const REQUEST_TIMEOUT_MS = 15_000;
const REPO_PAGE_SIZE = 100;

// Public events already exclude private and work repositories. This is belt and braces
// for anything that should never appear on the page regardless.
const DENY_REPOS = new Set();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/data/github-garden.json");

const isoDay = (date) => date.toISOString().slice(0, ISO_DATE_LENGTH);

// The last WINDOW_DAYS days, oldest first, ending today.
const windowDays = () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: WINDOW_DAYS }, (_unused, index) =>
    isoDay(new Date(today.getTime() - (WINDOW_DAYS - 1 - index) * MS_PER_DAY)),
  );
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "zazen-code-garden",
      ...options.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.json();
};

// repo short name -> language, so a day can be planted with the right species.
const fetchRepoLanguages = async (headers) => {
  const repos = await request(
    `https://api.github.com/users/${LOGIN}/repos?sort=pushed&per_page=${REPO_PAGE_SIZE}`,
    { headers },
  );
  const languages = new Map();
  for (const repo of repos) {
    if (typeof repo?.name === "string") {
      languages.set(repo.name, typeof repo.language === "string" ? repo.language : "");
    }
  }
  return languages;
};

// Only ever date, count, repo and language leave this script. Never commit messages:
// they can carry text that should not land on a public page.
const toDay = (date, entry, languages) => {
  if (!entry || entry.count === 0) {
    return { count: 0, date, language: "", repo: "" };
  }
  const repo = entry.repo ?? "";
  return {
    count: entry.count,
    date,
    language: languages.get(repo) ?? "",
    repo,
  };
};

// Every page, not just the first. One page of 100 events is mostly reviews and issues —
// on this account it yielded 28 pushes over 12 days, where all three pages yield 121 over
// 21. The extra two requests cost nothing against an hourly budget of sixty.
const fetchFromRest = async (headers, languages) => {
  const events = [];
  for (let page = 1; page <= EVENT_PAGES; page++) {
    try {
      const batch = await request(
        `https://api.github.com/users/${LOGIN}/events/public?per_page=${REPO_PAGE_SIZE}&page=${page}`,
        { headers },
      );
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }
      events.push(...batch);
    } catch {
      // A refused page is a ceiling, not a failure: keep what the earlier pages gave.
      break;
    }
  }
  const byDate = new Map();
  for (const event of events) {
    if (event?.type !== "PushEvent" || typeof event.created_at !== "string") {
      continue;
    }
    const repo = String(event.repo?.name ?? "").split("/").pop() ?? "";
    if (DENY_REPOS.has(repo)) {
      continue;
    }
    const date = event.created_at.slice(0, ISO_DATE_LENGTH);
    const previous = byDate.get(date) ?? { count: 0, repo };
    byDate.set(date, { count: previous.count + (event.payload?.size ?? 1), repo: previous.repo });
  }
  return byDate;
};

const CONTRIBUTIONS_QUERY = `
  query($login: String!, $from: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from) {
        contributionCalendar {
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;

const fetchFromGraphQL = async (token) => {
  // Midnight of the oldest day in the window, matching windowDays() — a mid-day timestamp
  // truncates the oldest day.
  const oldest = windowDays()[0];
  const from = new Date(`${oldest}T00:00:00Z`).toISOString();
  const body = JSON.stringify({
    query: CONTRIBUTIONS_QUERY,
    variables: { from, login: LOGIN },
  });
  const payload = await request("https://api.github.com/graphql", {
    body,
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
    method: "POST",
  });
  if (payload.errors) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  const weeks =
    payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const byDate = new Map();
  for (const week of weeks) {
    for (const day of week.contributionDays ?? []) {
      if (day.contributionCount > 0) {
        byDate.set(day.date, { count: day.contributionCount, repo: "" });
      }
    }
  }
  return byDate;
};

const main = async () => {
  const token = process.env.GITHUB_TOKEN;
  const headers = token ? { Authorization: `bearer ${token}` } : {};

  try {
    const languages = await fetchRepoLanguages(headers);

    // The calendar is the better source: real daily counts including days the events feed
    // never saw. It needs a token, so it stays optional — the window is small enough that
    // the events feed can cover it honestly on its own.
    let byDate;
    if (token) {
      try {
        byDate = await fetchFromGraphQL(token);
      } catch (error) {
        console.warn(`fetch-github-garden: calendar unavailable, using events — ${error.message}`);
        byDate = await fetchFromRest(headers, languages);
      }
    } else {
      byDate = await fetchFromRest(headers, languages);
    }

    const days = windowDays().map((date) => toDay(date, byDate.get(date), languages));
    const seed = {
      days,
      generatedAt: new Date().toISOString(),
      login: LOGIN,
      totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    };

    writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`);
    const active = days.filter((day) => day.count > 0).length;
    console.log(
      `fetch-github-garden: ${active}/${WINDOW_DAYS} active days, ` +
        `${seed.totalContributions} contributions -> ${outPath}`,
    );
  } catch (error) {
    // Level 2 of the ladder: keep whatever is already committed. Never fail the build.
    console.warn(`fetch-github-garden: keeping the committed snapshot — ${error.message}`);
  }
};

await main();
process.exit(0);
