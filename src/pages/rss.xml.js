import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { getPublishedPosts } from "../utils/posts";
import rss from "@astrojs/rss";

/**
 * Feed readers resolve nothing against the site: root-relative src/href become absolute URLs.
 * @param {string} html
 * @param {string | URL} site
 */
const absolutize = (html, site) =>
  html.replaceAll(/(\s(?:src|href|poster)=")(\/(?!\/)[^"]*)"/g, (_, attribute, path) => {
    return `${attribute}${new URL(path, site).href}"`;
  });

/**
 * @param {{ site: string }} context
 */
export const GET = async (context) => {
  const posts = (await getPublishedPosts()).toSorted(
    (postA, postB) => (postB.data.pubDate?.valueOf() ?? 0) - (postA.data.pubDate?.valueOf() ?? 0),
  );
  const { site } = context;

  // Full-text feed: the description stays the summary, content:encoded carries the rendered article.
  // Only the fields RSS knows are passed, so a new frontmatter key never leaks into the XML.
  return rss({
    customData: "<language>en</language>",
    description: SITE_DESCRIPTION,
    items: posts.map((post) => ({
      categories: post.data.tags,
      content: absolutize(post.rendered?.html ?? "", site),
      description: post.data.description,
      link: `/blog/${post.id}/`,
      pubDate: post.data.pubDate,
      title: post.data.title,
    })),
    site,
    title: SITE_TITLE,
    trailingSlash: true,
  });
};
