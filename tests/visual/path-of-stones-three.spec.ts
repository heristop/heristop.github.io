import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("path-stones:sound", "off");
    localStorage.setItem("path-stones:music", "off");
  });
});

test("Three renders, accepts movement, and switches back to Pixi without restarting", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/path-of-stones/?renderer=three");
  const board = page.locator('.garden-webgl[data-status="ready"]');
  await expect(board).toHaveAttribute("data-engine", "three", { timeout: 30000 });
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({ timeout: 45000 });
  const lantern = page.getByRole("button", { name: /^Extinguish lantern/ }).first();
  const lanternName = await lantern.getAttribute("aria-label");
  await lantern.click();
  await page.getByRole("button", { name: lanternName!.replace("Extinguish", "Light"), exact: true }).click();
  await expect(page.getByRole("button", { name: lanternName!, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Walk down and right (S or down arrow)", exact: true }).click();
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
  await page.getByRole("button", { name: "3D prototype", exact: true }).click();
  await expect(board).toHaveAttribute("data-engine", "pixi", { timeout: 30000 });
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
  await page.getByRole("button", { name: "Try 3D", exact: true }).click();
  await expect(board).toHaveAttribute("data-engine", "three", { timeout: 30000 });
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
  await expect(page.locator(".garden-webgl canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("Three context loss leaves the game playable through the DOM fallback", async ({ page }) => {
  await page.goto("/path-of-stones/?renderer=three");
  await expect(page.locator('.garden-webgl[data-status="ready"]')).toHaveAttribute("data-engine", "three", { timeout: 30000 });
  const before = await page.locator("#position-announcer").textContent();
  await page.locator(".garden-webgl canvas").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("webgl2");
    if (!context) throw new Error("Expected WebGL2");
    context.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.locator(".zazen-world__map")).toHaveAttribute("data-renderer", "dom");
  await expect(page.locator(".garden-webgl canvas")).toHaveCount(0);
  await expect(page.locator(".zazen-world__pilgrim")).toBeVisible();
  await expect(page.locator("#position-announcer")).toHaveText(before!);
});
