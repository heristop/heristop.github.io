import { expect, it } from "vitest";
import {
  activityLabel,
  gardenFingerprint,
  snapshotStatus,
} from "../../../../src/components/client/garden/activity";
import { FALLBACK_SEED, parseGardenSeed } from "../../../../src/components/client/garden/schema";
import { buildGarden, randomizeFrog } from "../../../../src/components/client/garden/board/terrain";
import { activityMarks } from "../../../../src/components/client/garden/rendering/artwork";
import { canPaveTile, isWalkableTile } from "../../../../src/components/client/garden/board/rules";

it("keeps terrain, species, rewards and record identity stable across metadata refreshes", () => {
  const first = {
    ...FALLBACK_SEED,
    days: FALLBACK_SEED.days.map((day) => ({ ...day!, count: 20, language: "PHP" })),
  };
  const updated = {
    ...first,
    generatedAt: "2030-01-01T23:00:00Z",
    totalContributions: 999,
    days: first.days.map((day) => ({ ...day, language: "TypeScript", repo: "new/repo" })),
  };
  const terrain = (seed: typeof first) =>
    buildGarden(seed).map.map(({ day: _day, ...tile }) => tile);
  expect(terrain(updated)).toEqual(terrain(first));
  expect(gardenFingerprint(updated)).toBe(gardenFingerprint(first));
  expect(
    new Set(
      buildGarden(first)
        .map.filter((tile) => tile.day && tile.decor)
        .map((tile) => tile.decor),
    ).size,
  ).toBeGreaterThan(3);
  expect(gardenFingerprint({ ...first, days: [null, ...first.days.slice(1)] })).not.toBe(
    gardenFingerprint(first),
  );
  expect(
    terrain({ ...first, days: first.days.map((day) => ({ ...day, date: "2026-09-10" })) }),
  ).not.toEqual(terrain(first));
});

it("parses source, freshness and real projects, ignoring malformed optional metadata", () => {
  const parsed = parseGardenSeed({
    ...FALLBACK_SEED,
    source: "calendar",
    fetchStatus: "stale",
    checkedAt: "2026-09-10",
    projectsComplete: false,
    days: FALLBACK_SEED.days.map((day) => ({
      ...day,
      unit: "pushes",
      projects: [
        null,
        {},
        { repo: "real/project", language: "Rust" },
        { repo: "unknown/lang", language: 4 },
      ],
    })),
  });
  expect(parsed).toMatchObject({
    source: "calendar",
    fetchStatus: "stale",
    checkedAt: "2026-09-10",
    projectsComplete: false,
  });
  expect(parsed.days[0]).toMatchObject({
    unit: "pushes",
    projects: [
      { repo: "real/project", language: "Rust" },
      { repo: "unknown/lang", language: "" },
    ],
  });
  expect(
    parseGardenSeed({ ...parsed, source: "fake", fetchStatus: "invalid" }).source,
  ).toBeUndefined();
  expect(parseGardenSeed({ ...parsed, source: "events", fetchStatus: "partial" }).source).toBe(
    "events",
  );
  expect(parseGardenSeed({ ...parsed, fetchStatus: "fresh" }).fetchStatus).toBe("fresh");
});

it("reports freshness, saved errors, partial counts and sample data honestly", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const seed = {
    ...FALLBACK_SEED,
    source: "calendar" as const,
    days: FALLBACK_SEED.days.map((day) => ({ ...day!, date: "2026-09-09" })),
  };
  expect(snapshotStatus(seed, now)).toBe("Activity up to date");
  expect(snapshotStatus(FALLBACK_SEED, now)).toContain("Sample");
  expect(snapshotStatus({ ...seed, days: [] }, now)).toContain("Older");
  expect(snapshotStatus({ ...seed, days: FALLBACK_SEED.days }, now)).toContain("Older");
  expect(snapshotStatus({ ...seed, fetchStatus: "stale" }, now)).toContain("Refresh failed");
  expect(snapshotStatus({ ...seed, source: "events" }, now)).toContain("public push counts");
  expect(snapshotStatus({ ...seed, fetchStatus: "partial" }, now)).toContain("Partial");
  expect(snapshotStatus({ ...seed, projectsComplete: false }, now)).toContain(
    "details unavailable",
  );
  for (const count of [0, 1, 2]) {
    expect(activityLabel({ ...seed.days[0], count })).toBe(
      ["no contributions", "1 contribution", "2 contributions"][count],
    );
    expect(activityLabel({ ...seed.days[0], count, unit: "pushes" })).toBe(
      ["no pushes", "1 push", "2 pushes"][count],
    );
  }
});

it("shows activity on raked beds in both renderers without changing their traversability", () => {
  const base = { posX: 5, posY: 5, walkable: true, sprite: "sand-0", decor: "", npc: 0 };
  expect(activityMarks(base)).toEqual([]);
  for (const [count, expected] of [
    [0, 0],
    [1, 3],
    [4, 6],
    [9, 9],
  ]) {
    const tile = { ...base, day: { ...FALLBACK_SEED.days[0]!, count } };
    const marks = activityMarks(tile);
    expect(marks).toHaveLength(expected);
    expect(isWalkableTile(tile)).toBe(false);
    expect(canPaveTile(tile)).toBe(true);
    expect(activityMarks({ ...tile, laid: true })).toEqual([]);
    expect(activityMarks({ ...tile, sprite: "moss-mid" })).toEqual([]);
    for (const { x, y } of marks)
      expect(Math.abs(x - 32) / 32 + Math.abs(y - 16) / 16).toBeLessThan(1);
  }
});

it("never places the frog on a shrine, relic or start", () => {
  for (let variant = 0; variant < 8; variant++) {
    const seed = {
      ...FALLBACK_SEED,
      login: `balance-${variant}`,
      days: FALLBACK_SEED.days.map((day, i) => ({
        ...day!,
        date: `2026-08-${String(i + 1).padStart(2, "0")}`,
        count: i === 6 ? 1 : 0,
      })),
    };
    const layout = buildGarden(seed);
    for (const roll of [0, 0.2, 0.5, 0.9]) {
      const changed = randomizeFrog(layout, roll);
      expect(changed.frog).not.toEqual(changed.shrine);
      expect(changed.frog).not.toEqual(changed.start);
      expect(changed.stones).not.toContainEqual(changed.frog);
    }
  }
});
