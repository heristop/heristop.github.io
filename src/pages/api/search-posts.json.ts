import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const BODY_PREVIEW_LENGTH = 300;

// eslint-disable-next-line no-named-export, prefer-default-export
export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const searchPosts = posts.map((post) => ({
    body: (post.body ?? "").slice(0, BODY_PREVIEW_LENGTH),
    pubDate: post.data.pubDate,
    slug: post.id,
    title: post.data.title,
  }));

  return Response.json(searchPosts);
};
