import { expect, test } from "@playwright/test";

test("mobile controls fit beside turn status and recenter both axes", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch layout is specific to phones");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".path-stones__turn-announcement")).toHaveCount(0);
  const stage = page.locator(".path-stones__stage");
  const pan = page.locator(".zazen-world__map-wrapper");
  const button = page.getByRole("button", {
    name: "Walk down and right (S or down arrow)",
    exact: true,
  });
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(56);
  expect(box!.height).toBeGreaterThanOrEqual(56);
  const bounds = await pan.boundingBox();
  expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.57);
  await button.tap();
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
  await pan.evaluate((el) => {
    el.scrollLeft = 10000;
    el.scrollTop = 10000;
  });
  await page.getByRole("button", { name: /Find pilgrim/ }).tap();
  const visible = await pan.evaluate((el) => {
    const actor = el.querySelector(".zazen-world__pilgrim")!.getBoundingClientRect();
    const viewport = el.getBoundingClientRect();
    return (
      actor.left >= viewport.left &&
      actor.right <= viewport.right &&
      actor.top >= viewport.top &&
      actor.bottom <= viewport.bottom
    );
  });
  expect(visible).toBe(true);
  await stage.screenshot({ path: "/tmp/path-stones-check/mobile-touch.png" });
});
