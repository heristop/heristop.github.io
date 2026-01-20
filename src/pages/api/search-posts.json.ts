import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const searchPosts = posts.map((post) => ({
    body: post.body.slice(0, 300),
    pubDate: post.data.pubDate,
    slug: post.slug,
    title: post.data.title,
  }));

  return new Response(JSON.stringify(searchPosts), {
    headers: {
      "Content-Type": "application/json",
    },
    status: 200,
  });
};
