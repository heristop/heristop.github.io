import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const searchPosts = posts.map((post) => ({
    title: post.data.title,
    slug: post.slug,
    pubDate: post.data.pubDate,
    body: post.body.slice(0, 300), // First 300 chars for search
  }));

  return new Response(JSON.stringify(searchPosts), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
