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
