// Tag numbers for /tags/ and /tags/<tag>/, computed at build. Weekly digests carry the same four
// tags every week, so each tag counts its posts both with and without them: the pages lead with
// the essays and keep the digest totals one switch away.
import { isDigest, type IndexPost } from "./blog-index";

export interface TagStat {
  tag: string;
  /* Every post with the tag, digests included */
  posts: number;
  /* Posts that are not weekly digests */
  essays: number;
}

const tagsOf = (post: IndexPost): string[] => post.data.tags ?? [];

export const tagStats = (posts: readonly IndexPost[]): TagStat[] => {
  const stats = new Map<string, TagStat>();
  for (const post of posts) {
    const digest = isDigest(post);
    for (const tag of new Set(tagsOf(post))) {
      const stat = stats.get(tag) ?? { tag, posts: 0, essays: 0 };
      stat.posts += 1;
      stat.essays += digest ? 0 : 1;
      stats.set(tag, stat);
    }
  }
  return [...stats.values()];
};

/* The order /tags/ opens on: most essays first, then A to Z; tags that only exist on digests
   close the list */
export const byEssays = (a: TagStat, b: TagStat): number =>
  b.essays - a.essays || b.posts - a.posts || a.tag.localeCompare(b.tag);

/* Tags that share posts with this one, most shared first. Counted on essays, so the digest's
   fixed four tags don't crowd out real neighbours, unless the tag lives on digests alone. */
export const relatedTags = (
  posts: readonly IndexPost[],
  tag: string,
  limit = 10,
): { tag: string; count: number }[] => {
  const tagged = posts.filter((post) => tagsOf(post).includes(tag));
  const essays = tagged.filter((post) => !isDigest(post));
  const pool = essays.length > 0 ? essays : tagged;
  const counts = new Map<string, number>();
  for (const post of pool) {
    for (const other of new Set(tagsOf(post))) {
      if (other !== tag) {
        counts.set(other, (counts.get(other) ?? 0) + 1);
      }
    }
  }
  return [...counts]
    .map(([name, count]) => ({ tag: name, count }))
    .toSorted((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
};

/* The tag after this one in the /tags/ order, wrapping around */
export const nextTag = (stats: readonly TagStat[], tag: string): TagStat | undefined => {
  const ordered = stats.toSorted(byEssays);
  const index = ordered.findIndex((stat) => stat.tag === tag);
  if (index === -1 || ordered.length < 2) {
    return undefined;
  }
  return ordered[(index + 1) % ordered.length];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const stamp = (date: Date): string =>
  `${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;

/* "Aug 2024 to Jun 2026", or one month when they all share it */
export const dateSpan = (posts: readonly IndexPost[]): string | undefined => {
  const dates = posts
    .flatMap((post) => (post.data.pubDate ? [post.data.pubDate] : []))
    .toSorted((a, b) => a.valueOf() - b.valueOf());
  const first = dates[0];
  const last = dates.at(-1);
  if (!first || !last) {
    return undefined;
  }
  return stamp(first) === stamp(last) ? stamp(last) : `${stamp(first)} to ${stamp(last)}`;
};
