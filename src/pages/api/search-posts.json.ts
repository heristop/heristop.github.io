import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const BODY_PREVIEW_LENGTH = 300;

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const searchPosts = posts.map((post) => ({
    body: (post.body ?? "").slice(0, BODY_PREVIEW_LENGTH),
    pubDate: post.data.pubDate,
    slug: post.id,
    tags: post.data.tags ?? [],
    title: post.data.title,
  }));

  return Response.json(searchPosts);
};
