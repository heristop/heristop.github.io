// The /blog/ index: posts grouped by year, essays kept as rows and each year's run of weekly
// digests folded into one entry. Pure data shaping, so the page only renders and the rules
// (what counts as a digest, how an issue is labelled) are tested on their own.

export type PostKind = "essay" | "digest";

export interface IndexPost {
  id: string;
  data: {
    title: string;
    pubDate?: Date;
    tags?: string[];
  };
}

export interface DigestIssue<P extends IndexPost> {
  post: P;
  emoji?: string;
  label: string;
}

export type YearEntry<P extends IndexPost> =
  | { type: "post"; kind: PostKind; post: P }
  | { type: "digests"; issues: DigestIssue<P>[]; range: string };

export interface IndexYear<P extends IndexPost> {
  year: string;
  essays: number;
  digests: number;
  entries: YearEntry<P>[];
}

const DIGEST_TAG = "weekly-digest";
const DIGEST_TITLE = /weekly\s+digest/i;
// Everything up to and including "Weekly Digest", then the separator before the week
const DIGEST_PREFIX = /^.*?weekly\s+digest\s*/i;
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*/u;
const LEADING_SEPARATOR = /^[-–—:·]\s*/;
// A year with a single digest keeps it as an ordinary row: a fold that hides one item is noise
const MIN_FOLD = 2;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const isDigest = (post: IndexPost): boolean =>
  (post.data.tags ?? []).includes(DIGEST_TAG) || DIGEST_TITLE.test(post.data.title);

export const kindOf = (post: IndexPost): PostKind => (isDigest(post) ? "digest" : "essay");

/* "Frontend Development Weekly Digest 🧘 - Weeks 2-3" → { emoji: "🧘", label: "Weeks 2-3" } */
export const digestIssue = <P extends IndexPost>(post: P): DigestIssue<P> => {
  let rest = post.data.title.replace(DIGEST_PREFIX, "").trim();
  const emoji = LEADING_EMOJI.exec(rest)?.[1];
  if (emoji) {
    rest = rest.slice(LEADING_EMOJI.exec(rest)?.[0].length ?? 0);
  }
  const label = rest.replace(LEADING_SEPARATOR, "").trim();
  return { post, emoji, label: label || post.data.title };
};

const monthStamp = (date: Date): string => MONTHS[date.getUTCMonth()] ?? "";

/* "Jan to Sep 2025", or "Sep 2025" when every issue shares a month */
export const issueRange = (dates: Date[], year: string): string => {
  const sorted = dates.toSorted((a, b) => a.valueOf() - b.valueOf());
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) {
    return year;
  }
  const from = monthStamp(first);
  const to = monthStamp(last);
  return from === to ? `${to} ${year}` : `${from} to ${to} ${year}`;
};

/* Newest year first, newest post first; the digest fold sits where the year's newest digest
   would have been, so the list stays in date order */
export const buildBlogIndex = <P extends IndexPost>(posts: readonly P[]): IndexYear<P>[] => {
  const sorted = posts.toSorted(
    (a, b) => (b.data.pubDate?.valueOf() ?? 0) - (a.data.pubDate?.valueOf() ?? 0),
  );
  const byYear = new Map<string, P[]>();
  for (const post of sorted) {
    const year = String(post.data.pubDate?.getUTCFullYear() ?? "Undated");
    byYear.set(year, [...(byYear.get(year) ?? []), post]);
  }

  return [...byYear].map(([year, yearPosts]) => {
    const digests = yearPosts.filter(isDigest);
    const fold = digests.length >= MIN_FOLD;
    const entries: YearEntry<P>[] = [];
    let folded = false;

    for (const post of yearPosts) {
      const kind = kindOf(post);
      if (kind === "digest" && fold) {
        if (!folded) {
          folded = true;
          entries.push({
            type: "digests",
            issues: digests.map((digest) => digestIssue(digest)),
            range: issueRange(
              digests.flatMap((digest) => (digest.data.pubDate ? [digest.data.pubDate] : [])),
              year,
            ),
          });
        }
        continue;
      }
      entries.push({ type: "post", kind, post });
    }

    return { year, essays: yearPosts.length - digests.length, digests: digests.length, entries };
  });
};

/* "06 Sep": day and month only, the year is the rail's */
export const rowDate = (date: Date): string =>
  `${String(date.getUTCDate()).padStart(2, "0")} ${monthStamp(date)}`;
