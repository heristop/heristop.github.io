import { expect, test } from "@playwright/test";

// These snapshots and sprite assertions exercise the classic renderer.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("path-stones:hd2d", "off"));
});

test("keeps the tactical composition readable across screen sizes", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".path-stones__turn-announcement")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const sizes = isMobile ? [390, 700] : [1024, 1200, 1280, 1920];
  for (const width of sizes) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of [
      ".path-stones__mission",
      ".path-stones__turn",
      ".path-stones__gauges",
      ".path-stones__stage",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    }
    if (width >= 900) {
      // Compare one layout snapshot, not two frames separated by a font/resize update.
      const difference = await page.evaluate(() => {
        const day = document.querySelector(".path-stones__day")!.getBoundingClientRect();
        const heat = document.querySelector(".path-stones__heat")!.getBoundingClientRect();
        return { y: Math.abs(day.y - heat.y), height: Math.abs(day.height - heat.height) };
      });
      expect(difference.y).toBeLessThan(1);
      expect(difference.height).toBeLessThan(1);
    }
    if (width <= 700) {
      const board = await page.locator(".path-stones__stage").boundingBox();
      const objective = await page.locator(".path-stones__mission").boundingBox();
      expect(board!.y).toBeLessThan(objective!.y);
    }
  }
  const image = await page.request.get("/images/zazen/sanctuary-dawn.webp");
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/webp");
});

test("animates animal sprite cells and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/path-of-stones/");
  const pilgrim = page.locator(".zazen-world__pilgrim-sprite--idle");
  await expect(pilgrim).toHaveCSS("background-image", /pilgrim-idle\.png/);
  await expect(pilgrim).toHaveCSS("animation-name", "path-stones-pilgrim-rest");
  const frog = page.locator('img[src$="/frog-life.png"]');
  const koi = page.locator('img[src$="/koi-life.png"]').first();
  await expect(frog).toBeVisible({ timeout: 20000 });
  for (const actor of [frog, koi]) {
    await expect(actor).toHaveCSS("object-fit", "none");
    await expect.poll(() => actor.evaluate((el) => el.getAnimations().length)).toBeGreaterThan(0);
    const cell = await actor.evaluate((el) => ({
      width: (el as HTMLElement).offsetWidth,
      height: (el as HTMLElement).offsetHeight,
    }));
    expect(cell).toEqual({ width: 32, height: 64 });
  }
  const swimming = page.locator(".zazen-world__koi").first();
  await expect(swimming).toHaveCSS("animation-name", "koi-cruise");
  await expect(swimming.locator(".zazen-world__koi-surface")).toHaveCSS(
    "animation-name",
    "koi-refraction",
  );
  await expect(koi).toHaveCSS("opacity", "0.8");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(swimming).toHaveCSS("animation-name", "none");
  await expect(swimming.locator(".zazen-world__koi-surface")).toHaveCSS("animation-name", "none");
  await expect(pilgrim).toHaveCSS("animation-name", "none");
  for (const actor of [frog, koi]) {
    await expect(actor).toHaveCSS("animation-name", "none");
    await expect(actor).toHaveCSS("object-position", "0px 0px");
  }
});

test("marks gardener work with a contour while preserving the ground texture", async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/path-of-stones/");
  await expect(page.getByRole("application")).toBeVisible();
  const working = page.locator(".zazen-world__tile[data-working]");
  for (let step = 0; step < 120 && (await working.count()) === 0; step++) {
    await page.clock.runFor(100);
  }
  await expect(working).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const styles = await working.evaluate((el) => ({
    filter: getComputedStyle(el.querySelector(".zazen-world__tile-image")!).filter,
    border: getComputedStyle(el.querySelector(".zazen-world__hit")!, "::after").clipPath,
    animation: getComputedStyle(el.querySelector(".zazen-world__hit")!, "::after").animationName,
  }));
  expect(styles.filter).not.toContain("sepia");
  expect(styles.border).toContain("polygon");
  expect(styles.animation).toBe("none");
  await page.locator(".zazen-world__map-wrapper").screenshot({
    path: `/tmp/path-stones-check/gardener-contour-${test.info().project.name}.png`,
  });
});

test("uses pixel bird poses and quiet clouds with reduced-motion support", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/path-of-stones/");
  const bird = page.locator(".zazen-world__bird-body").first();
  const cloud = page.locator(".zazen-world__cloud").first();
  await expect(bird).toHaveCSS("background-image", /bird-flight\.png/);
  await expect(bird).toHaveCSS("image-rendering", "pixelated");
  await expect(bird).toHaveCSS("animation-name", "garden-bird-poses");
  await expect(cloud).toHaveCSS("animation-name", "garden-cloud");
  await expect(page.locator(".zazen-world__sky")).toHaveCSS("pointer-events", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(bird).toHaveCSS("animation-name", "none");
  await expect(cloud).toHaveCSS("animation-name", "none");
});

test("keeps the pilgrim on its tile when reduced motion disables decorative transforms", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible();
  const position = () => page.locator('.zazen-world__pilgrim').evaluate((actor) => {
    const board = actor.closest('.zazen-world__map')!.getBoundingClientRect();
    const rect = actor.getBoundingClientRect();
    return { x: rect.x - board.x, y: rect.y - board.y };
  });
  const before = await position();
  expect(before.x).toBeGreaterThan(0);
  expect(before.y).toBeGreaterThan(0);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#position-announcer')).toHaveText('Pilgrim is at position 2, 1');
  await expect.poll(async () => (await position()).x - before.x).toBeCloseTo(32, 0);
  await expect.poll(async () => (await position()).y - before.y).toBeCloseTo(16, 0);
});
