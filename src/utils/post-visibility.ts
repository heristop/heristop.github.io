// Whether a post is public: not marked as a draft and not scheduled for later. Kept free of
// astro:content so the build scripts and the unit tests can share the exact same rule.
interface PostVisibility {
  draft?: boolean;
  pubDate?: Date;
}

const isPublished = (data: PostVisibility, now: Date = new Date()) =>
  data.draft !== true && !(data.pubDate !== undefined && data.pubDate.valueOf() > now.valueOf());

export { isPublished };
export type { PostVisibility };
