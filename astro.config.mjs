import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { externalLink } from "./src/plugins/externalLink";
import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://heristop.github.io",
  markdown: {
    rehypePlugins: [[externalLink, {
      domain: "heristop.github.io"
    }]]
  },
  integrations: [mdx(), sitemap(), tailwind(), react()]
});