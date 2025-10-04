import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import sitemap from "@astrojs/sitemap";
import { externalLink } from "./src/plugins/externalLink";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://heristop.github.io",

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [
        externalLink,
        {
          domain: "heristop.github.io",
        },
      ],
      rehypeKatex,
    ],
  },

  integrations: [mdx(), sitemap(), react()],
});