import { getCollection } from "astro:content";
import { isPublished } from "./post-visibility";

// The single gate for every place that lists or builds posts. A production build drops drafts and
// posts dated in the future (relative to the build); dev keeps them so the author can preview.
const getPublishedPosts = async (includeUnpublished: boolean = !import.meta.env.PROD) => {
  const now = new Date();
  return getCollection("blog", (post) => includeUnpublished || isPublished(post.data, now));
};

export { getPublishedPosts };
