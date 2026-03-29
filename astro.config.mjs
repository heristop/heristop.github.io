import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import sitemap from "@astrojs/sitemap";
import { externalLink } from "./src/plugins/externalLink";
import react from "@astrojs/react";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), sitemap(), react(), icon()],
  markdown: {
    rehypePlugins: [
      [
        externalLink,
        {
          domain: "heristop.github.io",
        },
      ],
      rehypeKatex,
    ],
    remarkPlugins: [remarkMath],
  },

  site: "https://heristop.github.io",

  viewTransitions: true,
});
