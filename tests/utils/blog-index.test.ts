import { describe, expect, it } from "vitest";
import {
  buildBlogIndex,
  digestIssue,
  isDigest,
  issueRange,
  rowDate,
  type IndexPost,
} from "../../src/utils/blog-index";

const post = (id: string, date: string, title: string, tags: string[] = []): IndexPost => ({
  id,
  data: { title, pubDate: new Date(date), tags },
});

const digest = (id: string, date: string, suffix: string) =>
  post(id, date, `Frontend Development Weekly Digest ${suffix}`, ["frontend", "weekly-digest"]);

describe("isDigest", () => {
  it("recognises a digest by its tag", () => {
    expect(isDigest(post("a", "2024-01-01", "Anything", ["weekly-digest"]))).toBe(true);
  });

  it("recognises a digest by its title when the tag is missing", () => {
    expect(isDigest(post("a", "2024-01-01", "Frontend Development Weekly Digest 🧘 - Week 2"))).toBe(true);
  });

  it("keeps essays as essays", () => {
    expect(isDigest(post("a", "2024-01-01", "One Descriptor, Three FFmpeg Builds", ["rust"]))).toBe(false);
  });
});

describe("digestIssue", () => {
  it("keeps the emoji apart and the week as the label", () => {
    const issue = digestIssue(digest("a", "2026-01-19", "🧘 - Weeks 2-3"));
    expect(issue.emoji).toBe("🧘");
    expect(issue.label).toBe("Weeks 2-3");
  });

  it("keeps inner separators of the label", () => {
    expect(digestIssue(digest("a", "2024-01-04", "🌸 - Week 52 - 1")).label).toBe("Week 52 - 1");
  });

  it("falls back to the title when nothing follows the prefix", () => {
    const issue = digestIssue(post("a", "2024-01-04", "Weekly Digest", ["weekly-digest"]));
    expect(issue.label).toBe("Weekly Digest");
    expect(issue.emoji).toBeUndefined();
  });
});

describe("issueRange", () => {
  it("spans the first to the last month", () => {
    expect(issueRange([new Date("2025-09-29"), new Date("2025-01-27")], "2025")).toBe("Jan to Sep 2025");
  });

  it("names a single month once", () => {
    expect(issueRange([new Date("2025-09-08"), new Date("2025-09-29")], "2025")).toBe("Sep 2025");
  });
});

describe("rowDate", () => {
  it("pads the day and drops the year", () => {
    expect(rowDate(new Date("2026-09-06"))).toBe("06 Sep");
  });
});

describe("buildBlogIndex", () => {
  const years = buildBlogIndex([
    post("e1", "2025-11-28", "Observatory", ["frontend"]),
    digest("d1", "2025-09-29", "🍵 - Weeks 38-39"),
    post("e2", "2025-09-10", "MCP", ["mcp"]),
    digest("d2", "2025-06-10", "🌸 - Weeks 21-23"),
    digest("d3", "2026-01-19", "🧘 - Weeks 2-3"),
    post("e3", "2026-09-06", "Agents", ["ai"]),
    post("old", "2014-02-04", "ExtJS", ["php"]),
  ]);

  it("lists years newest first, with their counts", () => {
    expect(years.map(({ year, essays, digests }) => [year, essays, digests])).toEqual([
      ["2026", 1, 1],
      ["2025", 2, 2],
      ["2014", 1, 0],
    ]);
  });

  it("keeps a lone digest as an ordinary row", () => {
    expect(years[0]?.entries.map((entry) => entry.type === "post" && [entry.kind, entry.post.id])).toEqual([
      ["essay", "e3"],
      ["digest", "d3"],
    ]);
  });

  it("folds a year's digests into one entry where the newest one was", () => {
    const entries = years[1]?.entries ?? [];
    expect(entries.map((entry) => entry.type)).toEqual(["post", "digests", "post"]);
    const fold = entries[1];
    expect(fold?.type === "digests" && fold.issues.map((issue) => issue.post.id)).toEqual(["d1", "d2"]);
    expect(fold?.type === "digests" && fold.range).toBe("Jun to Sep 2025");
  });
});
