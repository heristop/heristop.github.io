import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { settleScrollReveal } from "./scroll-reveal";
import { mountSegmentedGlide } from "./segmented-glide";

/* /tags/ as a topic index: tags with two posts or more are rows (name, a hairline bar, a mono
   count), the single-post tags one quiet line under them. Rendered on the server with the default
   view (most posts first, weekly digests left out of the counts), so the page reads fully without
   script; the island adds search ("/" focuses it), the sort and the digest switch. */

export interface TagEntry {
  tag: string;
  /* Every post with the tag, digests included */
  posts: number;
  /* The same without the weekly digests */
  essays: number;
}

interface Props {
  tags: TagEntry[];
  totalPosts: number;
  totalDigests: number;
}

type Sort = "count" | "az";

const SORTS: { value: Sort; label: string }[] = [
  { value: "count", label: "Most posts" },
  { value: "az", label: "A to Z" },
];

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

const highlight = (name: string, query: string): ReactNode => {
  const at = query ? name.indexOf(query) : -1;
  if (at === -1) {
    return name;
  }
  return (
    <>
      {name.slice(0, at)}
      <mark className="tag-index__mark">{name.slice(at, at + query.length)}</mark>
      {name.slice(at + query.length)}
    </>
  );
};

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const ZenTagIndex = ({ tags, totalPosts, totalDigests }: Props) => {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("count");
  const [withDigests, setWithDigests] = useState(false);
  // The entrance plays once, from the server markup; rows that move later just move
  const [settled, setSettled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const segRef = useRef<HTMLDivElement>(null);

  useEffect(() => (segRef.current ? mountSegmentedGlide(segRef.current) : undefined), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const view = useMemo(() => {
    const counted = tags
      .map((entry) => ({ tag: entry.tag, count: withDigests ? entry.posts : entry.essays }))
      .filter((entry) => entry.count > 0);
    const max = Math.max(1, ...counted.map((entry) => entry.count));
    const needle = query.trim().toLowerCase();
    const matches = counted.filter((entry) => entry.tag.includes(needle));
    const order =
      sort === "az"
        ? (a: { tag: string }, b: { tag: string }) => a.tag.localeCompare(b.tag)
        : (a: { tag: string; count: number }, b: { tag: string; count: number }) =>
            b.count - a.count || a.tag.localeCompare(b.tag);
    return {
      needle,
      max,
      counted,
      matches,
      rows: matches.filter((entry) => entry.count > 1).toSorted(order),
      once: matches.filter((entry) => entry.count === 1).toSorted((a, b) => a.tag.localeCompare(b.tag)),
    };
  }, [tags, query, sort, withDigests]);

  const digestOnly = tags.filter((entry) => entry.essays === 0).map((entry) => entry.tag);
  const essays = totalPosts - totalDigests;
  const status = view.needle
    ? `${plural(view.matches.length, "tag")} of ${view.counted.length} match “${view.needle}”`
    : `${plural(view.counted.length, "tag")} across ${withDigests ? plural(totalPosts, "post") : plural(essays, "essay")} · ${view.rows.length} with more than one`;

  /* Rows on screen rise in once from the server markup (--i); rows below the fold hand that
     entrance to the scroll reveal. Once the reader sorts, searches or switches, rows just move:
     nothing still waiting for its scroll entrance stays hidden */
  const touch = () => {
    setSettled(true);
    if (rootRef.current) {
      settleScrollReveal(rootRef.current);
    }
  };

  return (
    <div className="tag-index" data-settled={settled ? "true" : undefined} ref={rootRef}>
      <div className="tag-index__head">
        <p className="tag-index__status" aria-live="polite">{status}</p>
        <div className="index-seg" role="group" aria-label="Sort tags" ref={segRef}>
          <span className="index-seg__pill" aria-hidden="true" />
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="index-seg__option"
              aria-pressed={sort === option.value}
              onClick={() => {
                touch();
                setSort(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tag-index__tools">
        <label className="tag-index__search">
          <span className="sr-only">Find a tag</span>
          <svg className="tag-index__search-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            className="tag-index__input"
            type="search"
            placeholder="Find a tag"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              touch();
              setQuery(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
          <kbd className="tag-index__kbd" aria-hidden="true">/</kbd>
        </label>
        <button
          type="button"
          role="switch"
          className="tag-index__switch"
          aria-checked={withDigests}
          onClick={() => {
            touch();
            setWithDigests((on) => !on);
          }}
        >
          <span className="tag-index__switch-track" aria-hidden="true" />
          Count weekly digests
        </button>
      </div>

      <h2 className="sr-only">Topics</h2>
      {view.rows.length > 0 && (
        <ul className="tag-index__grid" data-scroll-reveal-group="">
          {view.rows.map((entry, index) => (
            <li key={entry.tag} className="tag-index__item" style={{ "--i": index } as CSSProperties}>
              <a
                className="tag-index__row"
                href={`/tags/${entry.tag}/`}
                aria-label={`${entry.tag}, ${plural(entry.count, "post")}`}
              >
                <span className="tag-index__name">{highlight(entry.tag, view.needle)}</span>
                <span
                  className="tag-index__bar"
                  style={{ "--w": `${Math.max(4, Math.round((entry.count / view.max) * 100))}%` } as CSSProperties}
                  aria-hidden="true"
                />
                <span className="tag-index__count">{entry.count}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {view.matches.length === 0 && <p className="tag-index__empty">No tag matches. Try a shorter word.</p>}

      {view.once.length > 0 && (
        <section className="tag-index__once" aria-labelledby="tags-once" data-scroll-reveal="">
          <h2 id="tags-once" className="tag-index__label">One post each</h2>
          <ul className="tag-index__once-list">
            {view.once.map((entry) => (
              <li key={entry.tag}>
                <a className="tag-index__once-link" href={`/tags/${entry.tag}/`}>{highlight(entry.tag, view.needle)}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!withDigests && totalDigests > 0 && (
        <p className="tag-index__note" data-scroll-reveal="">
          The {totalDigests} weekly digests are left out of the counts
          {digestOnly.length > 0 && (
            <>
              {", and with them "}
              {digestOnly.map((tag, index) => (
                <span key={tag}>
                  {index > 0 && (index === digestOnly.length - 1 ? " and " : ", ")}
                  <a className="tag-index__once-link tag-index__note-tag" href={`/tags/${tag}/`}>{tag}</a>
                </span>
              ))}
            </>
          )}
          . <a className="tag-index__note-link" href="/blog/?show=digests">See them on the blog <span aria-hidden="true">→</span></a>
        </p>
      )}
    </div>
  );
};

export default ZenTagIndex;
