import { expect, test } from "@playwright/test";

test("keeps the tactical composition readable across screen sizes", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".path-stones__turn-announcement")).toHaveCount(0);
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
      const day = await page.locator(".path-stones__day").boundingBox();
      const heat = await page.locator(".path-stones__heat").boundingBox();
      expect(Math.abs(day!.y - heat!.y)).toBeLessThan(1);
      expect(Math.abs(day!.height - heat!.height)).toBeLessThan(1);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
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
