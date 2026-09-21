import { getViteConfig } from "astro/config";

// Renders .astro components through Astro's container API. Loaded as a vitest
// project from the root config, so `include` resolves against this directory.
export default getViteConfig({
  test: {
    name: "astro-components",
    environment: "node",
    include: ["*.test.ts"],
  },
});
