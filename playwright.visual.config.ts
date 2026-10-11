import { defineConfig, devices } from "@playwright/test";

/*
 * Visual + accessibility baselines, kept out of `pnpm test` (Vitest) and the pre-commit hook.
 *   pnpm test:visual          site + garden
 *   pnpm test:visual:site     tests/visual/site: 7 routes x light/dark x 1440/390, axe, headings, targets
 *   pnpm test:visual:garden   packages/path-of-stones/tests/visual (Chromium)
 *   pnpm test:visual:update   regenerate the screenshot baselines
 *
 * Both run against the production build: by default the site is built and served with
 * `astro preview` on :4340, so baselines match what ships (drafts excluded, optimised images).
 * A server already answering on VISUAL_BASE_URL is reused instead, so
 * `pnpm exec astro preview --port 4340` once and rerun without rebuilding.
 * `--ignore-lock` keeps `astro preview` in the foreground (it daemonises otherwise).
 */
const PREVIEW_PORT = 4340;
const baseURL = process.env.VISUAL_BASE_URL || `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  reporter: process.env.CI
    ? "github"
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report/visual" }]],
  outputDir: "test-results/visual",
  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "site",
      testDir: "./tests/visual/site",
      snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}-{platform}{ext}",
      expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002 } },
      use: {
        ...devices["Desktop Chrome"],
        reducedMotion: "reduce",
        timezoneId: "Europe/Paris",
        locale: "en-GB",
      },
    },
    {
      name: "garden",
      // The garden boots WebGL; parallel boards (or the site pages running alongside) starve its
      // main thread in headless Chromium (multi-second GPU stalls), which then reads as
      // timeouts and DOM fallbacks. So it runs alone, after the site, one test at a time.
      workers: 1,
      dependencies: ["site"],
      testDir: "./packages/path-of-stones/tests/visual",
      // Same files as the package's own config (project "chromium"), so either runner reads them
      snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-chromium-{platform}{ext}",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec astro build && pnpm exec astro preview --port ${PREVIEW_PORT} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
