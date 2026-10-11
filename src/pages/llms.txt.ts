import type { APIRoute } from "astro";
import { getPublishedPosts } from "../utils/posts";
import {
  GITHUB_URL,
  LINKEDIN_URL,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from "../consts";

// llms.txt (https://llmstxt.org): a plain Markdown map of the site for language models and answer
// engines, generated from the collection so it never drifts from what is published.
const DIGEST = /weekly-digest/;

export const GET: APIRoute = async () => {
  const posts = (await getPublishedPosts()).toSorted(
    (postA, postB) => (postB.data.pubDate?.valueOf() ?? 0) - (postA.data.pubDate?.valueOf() ?? 0),
  );

  const line = (post: (typeof posts)[number]) => {
    const date = post.data.pubDate?.toISOString().slice(0, 10);
    const when = date ? ` (${date})` : "";
    return `- [${post.data.title}](${SITE_URL}/blog/${post.id}/)${when}: ${post.data.description}`;
  };

  const articles = posts.filter((post) => !DIGEST.test(post.id)).map(line);
  const digests = posts.filter((post) => DIGEST.test(post.id)).map(line);

  const body = [
    `# ${SITE_TITLE}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `Written by ${SITE_AUTHOR} (heristop), Chapter Lead / Principal Engineer at Carrefour in Paris. ` +
      `Posts are first-hand accounts of building software with AI coding agents, frontend engineering ` +
      `and developer tooling. Profiles: ${GITHUB_URL}, ${LINKEDIN_URL}.`,
    "",
    "## Articles",
    "",
    ...articles,
    "",
    "## Pages",
    "",
    `- [About ${SITE_AUTHOR}](${SITE_URL}/about/): background, role and links`,
    `- [Blog archive](${SITE_URL}/blog/): every post by year`,
    `- [Topics](${SITE_URL}/tags/): posts grouped by tag`,
    `- [Projects](${SITE_URL}/projects/): side projects and apps`,
    `- [RSS feed](${SITE_URL}/rss.xml)`,
    "",
    "## Optional",
    "",
    ...digests,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
