import { describe, expect, it } from "vitest";
import { dateSpan, nextTag, relatedTags, tagStats } from "../../src/utils/tag-index";
import type { IndexPost } from "../../src/utils/blog-index";

const post = (id: string, date: string, tags: string[], title = id): IndexPost => ({
  id,
  data: { title, pubDate: new Date(date), tags },
});
const digest = (id: string, date: string) =>
  post(id, date, ["frontend", "weekly-digest", "javascript", "css"], "Frontend Development Weekly Digest 🧘 - Week 2");

const POSTS = [
  post("a", "2026-06-03", ["ai", "opinion"]),
  post("b", "2026-01-27", ["ai", "opinion", "game"]),
  post("c", "2024-08-30", ["ai", "pix-me"]),
  post("d", "2024-05-15", ["javascript", "performance"]),
  digest("w1", "2024-01-12"),
  digest("w2", "2025-01-27"),
];

describe("tagStats", () => {
  it("counts posts with and without the digests", () => {
    const stats = new Map(tagStats(POSTS).map((stat) => [stat.tag, stat]));
    expect(stats.get("ai")).toEqual({ tag: "ai", posts: 3, essays: 3 });
    expect(stats.get("javascript")).toEqual({ tag: "javascript", posts: 3, essays: 1 });
    expect(stats.get("css")).toEqual({ tag: "css", posts: 2, essays: 0 });
  });
});

describe("relatedTags", () => {
  it("ranks the tags sharing essays with this one", () => {
    expect(relatedTags(POSTS, "ai")).toEqual([
      { tag: "opinion", count: 2 },
      { tag: "game", count: 1 },
      { tag: "pix-me", count: 1 },
    ]);
  });

  it("leaves the digests' fixed tags out when the tag has essays", () => {
    expect(relatedTags(POSTS, "javascript")).toEqual([{ tag: "performance", count: 1 }]);
  });

  it("falls back to the digests for a digest-only tag", () => {
    expect(relatedTags(POSTS, "css").map((item) => item.tag)).toEqual(["frontend", "javascript", "weekly-digest"]);
  });
});

describe("nextTag", () => {
  it("follows the /tags/ order and wraps around", () => {
    const stats = tagStats(POSTS);
    expect(nextTag(stats, "ai")?.tag).toBe("opinion");
    expect(nextTag(stats, "weekly-digest")?.tag).toBe("ai");
  });
});

describe("dateSpan", () => {
  it("runs from the first month to the last", () => {
    expect(dateSpan(POSTS.slice(0, 3))).toBe("Aug 2024 to Jun 2026");
    expect(dateSpan([POSTS[0] as IndexPost])).toBe("Jun 2026");
  });
});
