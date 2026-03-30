import { SITE_DESCRIPTION, SITE_TITLE } from "../consts";
import { getCollection } from "astro:content";
import rss from "@astrojs/rss";

/**
 * @param {{ site: string }} context
 */
// eslint-disable-next-line no-named-export, prefer-default-export
export const GET = async (context) => {
  const posts = await getCollection("blog");
  const { site } = context;

  return rss({
    description: SITE_DESCRIPTION, items: posts.map((post) => ({
      ...post.data,
      link: `/blog/${post.id}/`,
    })), site, title: SITE_TITLE,
  });
};
