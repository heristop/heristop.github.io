import { expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchGarden, refreshGarden, windowDays } from "../../scripts/fetch-github-garden.mjs";

const now = new Date("2026-09-10T00:01:00Z");
const dates = windowDays(now);
const event = (id: string, date: string, type = "PushEvent", repo = "heristop/current") => ({
  id,
  created_at: `${date}T12:00:00Z`,
  type,
  repo: { name: repo },
});
const response = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;
const calendar = (counts = dates.map((date, i) => ({ date, contributionCount: i }))) => ({
  data: {
    user: {
      contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: counts }] } },
    },
  },
});

it("uses fourteen completed UTC days across month, year and leap-day boundaries", () => {
  expect(dates).toHaveLength(14);
  expect(dates[0]).toBe("2026-08-27");
  expect(dates.at(-1)).toBe("2026-09-09");
  expect(windowDays(new Date("2026-09-10T23:59:59Z"))).toEqual(dates);
  expect(windowDays(new Date("2026-01-01T01:00:00Z"))[0]).toBe("2025-12-18");
  expect(windowDays(new Date("2024-03-01T00:00:00Z")).at(-1)).toBe("2024-02-29");
});

it("combines calendar counts with real recent public projects without inventing languages", async () => {
  const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
    if (String(url).endsWith("graphql")) {
      expect(JSON.parse(options!.body as string).variables).toMatchObject({
        from: "2026-08-27T00:00:00Z",
        to: "2026-09-09T23:59:59Z",
      });
      return response(calendar());
    }
    if (String(url).endsWith("/repos/other/project"))
      return response({ full_name: "other/project", language: "Python" });
    if (String(url).includes("/repos?"))
      return response([
        { full_name: "heristop/current", language: "TypeScript" },
        { full_name: "heristop/old", language: "PHP" },
      ]);
    return response([
      event("1", dates[1]),
      event("1", dates[1]),
      event("2", dates[1], "PullRequestEvent", "other/project"),
      event("3", "2026-09-10"),
    ]);
  });
  const seed = await fetchGarden({ now, token: "test-token", fetcher });
  expect(seed).toMatchObject({
    source: "calendar",
    fetchStatus: "fresh",
    projectsComplete: true,
    totalContributions: 91,
  });
  expect(seed.days[1]).toMatchObject({
    count: 1,
    unit: "contributions",
    projects: [
      { repo: "heristop/current", language: "TypeScript" },
      { repo: "other/project", language: "Python" },
    ],
  });
  expect(seed.days[0].projects).toEqual([]);
  expect(JSON.stringify(seed)).not.toContain("PHP");
});

it("labels event fallback as partial pushes, paginates, deduplicates and excludes today", async () => {
  const batch = Array.from({ length: 100 }, (_, i) => event(String(i), dates[2]));
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes("/repos?")) return response([]);
    if (new URL(String(url)).searchParams.get("page") === "1") return response(batch);
    return response([
      batch[0],
      event("new", dates[3]),
      event("today", "2026-09-10"),
      event("old", "2026-08-26"),
    ]);
  });
  const seed = await fetchGarden({ now, fetcher });
  expect(seed).toMatchObject({ source: "events", fetchStatus: "partial", totalContributions: 101 });
  expect(seed.days[2]).toMatchObject({ count: 100, unit: "pushes" });
  expect(
    fetcher.mock.calls.filter(([url]) => String(url).includes("/events/public?")),
  ).toHaveLength(2);
});

it("keeps calendar counts when project metadata fails", async () => {
  const seed = await fetchGarden({
    now,
    token: "test-token",
    fetcher: async (url) =>
      response(String(url).endsWith("graphql") ? calendar() : {}, String(url).endsWith("graphql")),
  });
  expect(seed.projectsComplete).toBe(false);
  expect(seed.totalContributions).toBe(91);
  expect(seed.days.every((day) => day.projects.length === 0)).toBe(true);
});

it("detects truncated public history and retains a successful timestamp after a later failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "garden-fetch-"));
  const outputPath = join(dir, "garden.json");
  try {
    const seed = await refreshGarden({
      now,
      outputPath,
      fetcher: async (url) =>
        response(
          String(url).includes("/repos?")
            ? []
            : Array.from({ length: 100 }, (_, i) => event(`${url}-${i}`, dates[5])),
        ),
    });
    expect(seed.projectsComplete).toBe(false);
    expect(seed.fetchStatus).toBe("partial");
    const failed = await refreshGarden({
      now: new Date("2026-09-11T05:00:00Z"),
      outputPath,
      fetcher: async () => {
        throw new Error("offline");
      },
    });
    expect(failed).toMatchObject({
      generatedAt: now.toISOString(),
      checkedAt: "2026-09-11T05:00:00.000Z",
      fetchStatus: "stale",
      days: seed.days,
    });
    expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(failed);
    writeFileSync(outputPath, "broken");
    expect(
      await refreshGarden({
        now,
        outputPath,
        fetcher: async () => {
          throw new Error("offline");
        },
      }),
    ).toBeUndefined();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects an incomplete calendar and uses only events it could actually retrieve", async () => {
  const seed = await fetchGarden({
    now,
    token: "test",
    fetcher: async (url) => {
      if (String(url).endsWith("graphql")) return response(calendar([]));
      if (String(url).includes("/repos?")) return response({ invalid: true });
      if (new URL(String(url)).searchParams.get("page") === "2") throw new Error("timeout");
      return response(Array.from({ length: 100 }, (_, i) => event(String(i), dates[0])));
    },
  });
  expect(seed).toMatchObject({
    source: "events",
    fetchStatus: "partial",
    projectsComplete: false,
    totalContributions: 100,
  });
});
