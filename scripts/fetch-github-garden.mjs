// Refresh the published snapshot; development can still run entirely offline.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN = "heristop";
const WINDOW_DAYS = 14;
const MS_PER_DAY = 86_400_000;
const outPath = join(dirname(fileURLToPath(import.meta.url)), "../src/data/github-garden.json");

export const windowDays = (now = new Date()) => {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: WINDOW_DAYS }, (_, index) =>
    new Date(today - (WINDOW_DAYS - index) * MS_PER_DAY).toISOString().slice(0, 10),
  );
};

/** @param {{ now?: Date, token?: string, fetcher?: typeof fetch }} options */
export async function fetchGarden({ now = new Date(), token, fetcher = fetch } = {}) {
  const dates = windowDays(now);
  const request = async (url, options = {}) => {
    const response = await fetcher(url, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "zazen-code-garden",
        ...(token ? { Authorization: `bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  };

  const calendar = async () => {
    if (!token) throw new Error("No contribution calendar token");
    const response = await request("https://api.github.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) { contributionsCollection(from: $from, to: $to) {
            contributionCalendar { weeks { contributionDays { date contributionCount } } }
          } }
        }`,
        variables: { login: LOGIN, from: `${dates[0]}T00:00:00Z`, to: `${dates.at(-1)}T23:59:59Z` },
      }),
    });
    if (response.errors) throw new Error("Contribution calendar unavailable");
    const entries =
      response.data?.user?.contributionsCollection?.contributionCalendar?.weeks?.flatMap(
        (week) => week.contributionDays,
      ) ?? [];
    const counts = new Map(entries.map((day) => [day.date, day.contributionCount]));
    if (!dates.every((date) => Number.isInteger(counts.get(date)) && counts.get(date) >= 0))
      throw new Error("Incomplete contribution calendar");
    return counts;
  };

  const publicActivity = async () => {
    const events = [];
    let complete = false;
    for (let page = 1; page <= 3; page++) {
      let batch;
      try {
        batch = await request(
          `https://api.github.com/users/${LOGIN}/events/public?per_page=100&page=${page}`,
        );
        if (!Array.isArray(batch)) throw new Error("Invalid public events response");
      } catch (error) {
        if (page === 1) throw error;
        break;
      }
      events.push(...batch);
      if (batch.length < 100 || batch.some((event) => event.created_at?.slice(0, 10) < dates[0])) {
        complete = true;
        break;
      }
    }
    return { events, complete };
  };

  const [calendarResult, eventsResult, reposResult] = await Promise.allSettled([
    calendar(),
    publicActivity(),
    request(`https://api.github.com/users/${LOGIN}/repos?sort=pushed&per_page=100`),
  ]);
  if (calendarResult.status === "rejected" && eventsResult.status === "rejected")
    throw new Error("Neither the calendar nor public events could be retrieved");
  const languages = new Map(
    (reposResult.status === "fulfilled" && Array.isArray(reposResult.value)
      ? reposResult.value
      : []
    )
      .filter((repo) => !repo.private)
      .map((repo) => [repo.full_name, typeof repo.language === "string" ? repo.language : ""]),
  );
  const events = eventsResult.status === "fulfilled" ? eventsResult.value.events : [];
  const byDate = new Map();
  const seen = new Set();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const date = event.created_at?.slice(0, 10);
    if (!dates.includes(date)) continue;
    const day = byDate.get(date) ?? { pushes: 0, repos: new Set() };
    if (event.type === "PushEvent") day.pushes++;
    if (typeof event.repo?.name === "string") day.repos.add(event.repo.name);
    byDate.set(date, day);
  }
  // Events can concern repositories owned by somebody else. Resolve only projects
  // actually observed in this window, with a bounded number of optional lookups.
  const projectNames = [...new Set([...byDate.values()].flatMap((day) => [...day.repos]))];
  const missing = projectNames.filter((repo) => !languages.has(repo));
  const details = await Promise.allSettled(
    missing
      .slice(0, 20)
      .map((repo) =>
        request(
          `https://api.github.com/repos/${repo.split("/").map(encodeURIComponent).join("/")}`,
        ),
      ),
  );
  details.forEach((result, index) => {
    if (
      result.status === "fulfilled" &&
      result.value.full_name === missing[index] &&
      !result.value.private
    )
      languages.set(
        missing[index],
        typeof result.value.language === "string" ? result.value.language : "",
      );
  });
  const source = calendarResult.status === "fulfilled" ? "calendar" : "events";
  const days = dates.map((date) => {
    const observed = byDate.get(date);
    const count =
      calendarResult.status === "fulfilled"
        ? calendarResult.value.get(date)
        : (observed?.pushes ?? 0);
    const projects = [...(observed?.repos ?? [])]
      .sort()
      .map((repo) => ({ repo, language: languages.get(repo) ?? "" }));
    return {
      date,
      count,
      unit: source === "calendar" ? "contributions" : "pushes",
      repo: projects[0]?.repo ?? "",
      language: projects[0]?.language ?? "",
      projects,
    };
  });
  return {
    login: LOGIN,
    generatedAt: now.toISOString(),
    checkedAt: now.toISOString(),
    source,
    fetchStatus: source === "events" ? "partial" : "fresh",
    projectsComplete:
      eventsResult.status === "fulfilled" &&
      eventsResult.value.complete &&
      projectNames.every((repo) => languages.has(repo)),
    totalContributions: days.reduce((sum, day) => sum + day.count, 0),
    days,
  };
}

/** @param {{ outputPath?: string, now?: Date, token?: string, fetcher?: typeof fetch }} options */
export async function refreshGarden({ outputPath = outPath, now = new Date(), ...options } = {}) {
  try {
    const seed = await fetchGarden({ ...options, now });
    writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`);
    console.log(
      `fetch-github-garden: ${seed.source}, ${seed.fetchStatus}, ${seed.totalContributions} ${seed.days[0].unit}`,
    );
    return seed;
  } catch {
    // Preserve the original successful timestamp and data; expose the failed attempt.
    try {
      const previous = JSON.parse(readFileSync(outputPath, "utf8"));
      if (
        !Array.isArray(previous.days) ||
        previous.days.length !== WINDOW_DAYS ||
        !previous.days.every(
          (day) => day === null || (typeof day.date === "string" && Number.isFinite(day.count)),
        ) ||
        typeof previous.generatedAt !== "string"
      )
        throw new Error("Invalid saved snapshot");
      const stale = { ...previous, fetchStatus: "stale", checkedAt: now.toISOString() };
      writeFileSync(outputPath, `${JSON.stringify(stale, null, 2)}\n`);
      console.warn("fetch-github-garden: refresh failed; retained snapshot marked stale");
      return stale;
    } catch {
      console.warn("fetch-github-garden: no usable snapshot; the page will use its sample garden");
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await refreshGarden({ token: process.env.GITHUB_TOKEN });
}
