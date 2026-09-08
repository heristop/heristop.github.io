import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.5;
    localStorage.setItem("path-stones:sound", "off");
    localStorage.setItem("path-stones:music", "off");
  });
});

test("GPU board keeps React controls and survives context loss without resetting the run", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/path-of-stones/?renderer=webgl");
  const map = page.getByRole("application");
  await expect(map).toHaveAttribute("data-renderer", "webgl", { timeout: 20000 });
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible();
  await expect(page.locator(".garden-webgl canvas")).toHaveCount(1);
  await expect(page.locator(".zazen-world__pilgrim")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Walk down and right (S or down arrow)", exact: true })
    .click();
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
  const before = await page.locator("#position-announcer").textContent();
  await page.locator(".garden-webgl canvas").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("webgl2");
    if (!context) throw new Error("Expected a real WebGL2 context");
    context.getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(map).toHaveAttribute("data-renderer", "dom");
  await expect(page.locator(".garden-webgl canvas")).toHaveCount(0);
  await expect(page.locator(".zazen-world__pilgrim")).toBeVisible();
  await expect(page.locator("#position-announcer")).toHaveText(before!);
  expect(errors).toEqual([]);
});

test("unsupported WebGL falls back to a playable board", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl") || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/path-of-stones/?renderer=webgl");
  await expect(page.locator(".garden-webgl")).toHaveAttribute("data-status", "fallback");
  await expect(page.getByRole("application")).toHaveAttribute("data-renderer", "dom");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Walk down and right (S or down arrow)", exact: true })
    .click();
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
});
