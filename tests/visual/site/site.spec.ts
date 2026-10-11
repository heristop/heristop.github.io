import { expect, test } from "@playwright/test";
import {
  VOLATILE_SELECTORS,
  gotoSettled,
  headingOrder,
  preparePage,
  runAxe,
  smallTapTargets,
  unsettledReveals,
  type Theme,
} from "./helpers";

/* Every route x light/dark x 1440/390: a full-page baseline plus axe, heading order, target size
   and settled reveals. Articles are published ones (production excludes drafts). */
const ROUTES = [
  { name: "home", path: "/" },
  { name: "blog", path: "/blog/" },
  // Code blocks, a Mermaid diagram and the table of contents
  { name: "article-code", path: "/blog/2026-08-17-one-descriptor-three-ffmpeg-builds/" },
  // Inline illustrations (the ink reveal)
  { name: "article-images", path: "/blog/2026-05-26-gitlab-frontend-insights-df-slideshow/" },
  // A long table of contents
  { name: "article-toc", path: "/blog/2025-09-08-exit-vibe-coding--enter-vibe-reviewing/" },
  { name: "tags", path: "/tags/" },
  { name: "about", path: "/about" },
  { name: "projects", path: "/projects" },
  { name: "not-found", path: "/this-path-does-not-exist/", status: 404 },
] as const;

const THEMES: Theme[] = ["light", "dark"];

/* Real findings not fixed yet: reported as annotations instead of failing every run. Remove an
   entry once the product is fixed, and the check guards it again. */
const KNOWN_AXE_ISSUES = [
  {
    route: "blog",
    width: 390,
    rule: "target-size",
    node: ".blog-archive__rss-copy",
    reason:
      "touch: the padded RSS copy button (44px, negative margins) overlaps the wrapped 'browse by tag' link box",
  },
];

const WIDTHS = [
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
] as const;

for (const width of WIDTHS) {
  test.describe(`${width.name} ${width.viewport.width}`, () => {
    test.use({ viewport: width.viewport, isMobile: width.isMobile, hasTouch: width.hasTouch });

    for (const theme of THEMES) {
      for (const route of ROUTES) {
        test(`${route.name} (${theme})`, async ({ page }) => {
          await preparePage(page, theme);
          const status = await gotoSettled(page, route.path);
          expect(status, "HTTP status").toBe("status" in route ? route.status : 200);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          // The clock is frozen at midday: no dawn/dusk wash on the banner
          await expect(page.locator("html")).not.toHaveAttribute("data-daypart", /.+/);

          await test.step("reveals render settled under reduced motion", async () => {
            expect.soft(await unsettledReveals(page)).toEqual([]);
          });

          await test.step("h1 is the first heading", async () => {
            const headings = await headingOrder(page);
            expect.soft(headings[0], `heading order: ${headings.join(" ")}`).toBe("h1");
            expect.soft(headings.filter((tag) => tag === "h1"), "exactly one h1").toHaveLength(1);
          });

          await test.step("tap targets are at least 24px", async () => {
            expect.soft(await smallTapTargets(page)).toEqual([]);
          });

          await test.step("axe: no violations", async () => {
            const known = KNOWN_AXE_ISSUES.filter(
              (issue) => issue.route === route.name && issue.width === width.viewport.width,
            );
            const violations = (await runAxe(page))
              .map((violation) => ({
                ...violation,
                nodes: violation.nodes.filter(
                  (node) => !known.some((issue) => issue.rule === violation.id && node === issue.node),
                ),
              }))
              .filter((violation) => violation.nodes.length > 0);
            for (const issue of known) {
              test.info().annotations.push({ type: "known a11y issue", description: `${issue.rule} ${issue.node}: ${issue.reason}` });
            }
            expect.soft(violations).toEqual([]);
          });

          await test.step("full-page screenshot", async () => {
            await expect(page).toHaveScreenshot(`${route.name}-${theme}-${width.viewport.width}.png`, {
              fullPage: true,
              animations: "disabled",
              mask: VOLATILE_SELECTORS.map((selector) => page.locator(selector)),
            });
          });
        });
      }
    }
  });
}
