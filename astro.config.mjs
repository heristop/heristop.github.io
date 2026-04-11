import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import sitemap from "@astrojs/sitemap";
import { externalLink } from "./src/plugins/external-link";
import react from "@astrojs/react";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), sitemap(), react(), icon()],
  markdown: {
    shikiConfig: {
      theme: "rose-pine",
      wrap: false,
    },
    rehypePlugins: [
      [
        externalLink,
        {
          domain: "heristop.github.io",
        },
      ],
      rehypeKatex,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "prepend",
          properties: {
            className: ["heading-anchor"],
            ariaLabel: "Link to this section",
          },
          content: {
            type: "text",
            value: "#",
          },
        },
      ],
    ],
    remarkPlugins: [remarkMath],
  },

  site: "https://heristop.github.io",

  viewTransitions: true,
});
