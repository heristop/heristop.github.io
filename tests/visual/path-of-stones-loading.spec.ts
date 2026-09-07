import { expect, test } from "@playwright/test";

test("shows the styled fallback before JavaScript and removes it after hydration", async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  try {
    await page.goto("/path-of-stones/", { waitUntil: "commit" });
    const loading = page.getByRole("status", { name: "Opening the garden", exact: true });
    await expect(loading).toBeVisible();
    await expect(loading.getByRole("heading", { name: "Path of Stones" })).toBeVisible();
    await expect(loading.getByRole("link", { name: /try again/i })).toBeVisible();
    const textColor = await loading
      .locator(".garden-loading__message")
      .evaluate((node) => getComputedStyle(node).color);
    expect(textColor).toBe("rgb(240, 219, 172)");
    if (browserName === "chromium") await expect(loading).toHaveScreenshot("garden-loading.png");
    release();
    await expect(page.getByRole("application")).toBeVisible();
    await expect(loading).toHaveCount(0);
  } finally {
    release();
  }
});
