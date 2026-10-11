import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isPublished } from "../utils/post-visibility";

// The sitemap integration runs outside the content layer, so post dates are read from the
// frontmatter directly. Only `updatedDate` / `pubDate` matter: a crawler uses <lastmod> to decide
// what to recrawl, and a date that changes on every build (the build time) teaches it to ignore it.

interface SitemapItem {
  url: string;
  lastmod?: string;
}

const frontmatterDate = (source: string, key: "pubDate" | "updatedDate") => {
  const frontmatter = source.split(/^---\s*$/m)[1] ?? "";
  const line = new RegExp(`^${key}:\\s*["']?(\\d{4}-\\d{2}-\\d{2}[^"'\\s]*)["']?\\s*$`, "m");
  const match = frontmatter.match(line);
  if (!match) {
    return undefined;
  }
  const date = new Date(match[1]);
  return Number.isNaN(date.valueOf()) ? undefined : date;
};

const isDraft = (source: string) => /^draft:\s*true\s*$/m.test(source.split(/^---\s*$/m)[1] ?? "");

// Slug -> last meaningful change, for every post the build publishes (same rule as getPublishedPosts,
// so a draft or a scheduled post never sets a listing's lastmod)
const readPostDates = (directory: string, now: Date = new Date()) => {
  const dates = new Map<string, Date>();
  for (const file of readdirSync(directory)) {
    if (!/\.mdx?$/.test(file)) {
      continue;
    }
    const source = readFileSync(join(directory, file), "utf8");
    if (
      !isPublished({ draft: isDraft(source), pubDate: frontmatterDate(source, "pubDate") }, now)
    ) {
      continue;
    }
    const date = frontmatterDate(source, "updatedDate") ?? frontmatterDate(source, "pubDate");
    if (date) {
      dates.set(file.replace(/\.mdx?$/, ""), date);
    }
  }
  return dates;
};

// A post page carries its own date; a listing (home, archive, tag) changes when its newest post does
const sitemapLastmod = (dates: Map<string, Date>) => {
  const newest = [...dates.values()].reduce<Date | undefined>(
    (latest, date) => (!latest || date > latest ? date : latest),
    undefined,
  );

  return <Item extends SitemapItem>(item: Item): Item & { lastmod?: string } => {
    const slug = new URL(item.url).pathname.match(/^\/blog\/([^/]+)\/?$/)?.[1];
    const date = slug ? dates.get(slug) : newest;
    return date ? { ...item, lastmod: date.toISOString() } : item;
  };
};

// Redirect stubs and the 404 are not pages a search engine should be asked to index
const isIndexablePage = (page: string) => {
  const { pathname } = new URL(page);
  return !/^\/(404|path)\/?$/.test(pathname);
};

export { frontmatterDate, isDraft, isIndexablePage, readPostDates, sitemapLastmod };
