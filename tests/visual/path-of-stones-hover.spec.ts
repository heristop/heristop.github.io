import { expect, test } from "@playwright/test";

// These snapshots and sprite assertions exercise the classic renderer.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("path-stones:hd2d", "off"));
});

for (const width of [1440, 760, 583]) {
  test(`keeps the board stationary during route hover at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/path-of-stones/");
    await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
      timeout: 20000,
    });
    const board = page.locator(".zazen-world__map-wrapper");
    await board.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const baseline = (await board.boundingBox())!;
    const quote = page.locator(".path-stones__quote > span:last-child");
    const hits = page.locator(".zazen-world__tile--payable .zazen-world__hit");
    let priced = 0;
    for (let index = 0; index < (await hits.count()); index += 4) {
      const box = await hits.nth(index).boundingBox();
      if (!box || box.y < 0 || box.y > 960 || box.x < 0 || box.x > width - 64) continue;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      if ((await quote.textContent())?.includes("This way:")) priced++;
      const current = (await board.boundingBox())!;
      expect(Math.abs(current.y - baseline.y)).toBeLessThan(1);
      expect(Math.abs(current.x - baseline.x)).toBeLessThan(1);
      await page.mouse.move(0, 0);
    }
    expect(priced).toBeGreaterThan(0);
  });
}
