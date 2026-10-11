import { describe, expect, it } from "vitest";
import {
  frontmatterDate,
  isDraft,
  isIndexablePage,
  sitemapLastmod,
} from "../../src/plugins/sitemap-lastmod";

const post = (lines: string) =>
  `---\ntitle: "A post"\n${lines}\n---\n\nupdatedDate: 1999-01-01 in the body`;

describe("frontmatterDate", () => {
  it("reads quoted and unquoted dates from the frontmatter only", () => {
    expect(frontmatterDate(post(`pubDate: "2026-09-06"`), "pubDate")?.toISOString()).toBe(
      "2026-09-06T00:00:00.000Z",
    );
    expect(frontmatterDate(post(`pubDate: '2014-02-04'`), "pubDate")?.getUTCFullYear()).toBe(2014);
    expect(frontmatterDate(post(`pubDate: 2024-05-15`), "updatedDate")).toBeUndefined();
  });
});

describe("sitemapLastmod", () => {
  const dates = new Map([
    ["older", new Date("2024-01-01")],
    ["newer", new Date("2026-01-01")],
  ]);
  const serialize = sitemapLastmod(dates);

  it("dates a post with its own date", () => {
    expect(serialize({ url: "https://example.dev/blog/older/" }).lastmod).toBe(
      "2024-01-01T00:00:00.000Z",
    );
  });

  it("dates a listing with the newest post", () => {
    expect(serialize({ url: "https://example.dev/tags/ai/" }).lastmod).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});

describe("isIndexablePage", () => {
  it("drops the redirect stub and the 404", () => {
    expect(isIndexablePage("https://example.dev/path/")).toBe(false);
    expect(isIndexablePage("https://example.dev/404/")).toBe(false);
    expect(isIndexablePage("https://example.dev/path-of-stones/")).toBe(true);
  });
});

describe("isDraft", () => {
  it("reads draft: true from the frontmatter only", () => {
    expect(isDraft(post("draft: true"))).toBe(true);
    expect(isDraft(post("draft: false"))).toBe(false);
    expect(isDraft("---\ntitle: x\n---\ndraft: true")).toBe(false);
  });
});
