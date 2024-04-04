import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://heristop.github.io",
  integrations: [mdx(), sitemap()],
  routes: ["/:category/:year/:month/:day/:title.html"],
});
