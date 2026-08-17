// Renders scripts/banner-ffmpeg-builds.html to the article's banner image.
//   node scripts/render-banner.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(
  here,
  "../public/images/posts/2026-08-17-one-descriptor-three-ffmpeg-builds/one-to-three-banner.png",
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1680, height: 480 }, deviceScaleFactor: 2 });
await page.goto(`file://${path.resolve(here, "banner-ffmpeg-builds.html")}`);
// Webfonts load over the network; without this the card renders in a fallback stack.
await page.waitForFunction(() => document.fonts.ready.then(() => document.fonts.status === "loaded"));
await page.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
