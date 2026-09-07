import { expect, test } from "@playwright/test";

test("discovery hints are readable, toggleable and do not move the pilgrim", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".path-stones__turn-announcement")).toHaveCount(0);
  const pilgrim = page.getByRole("application").getByText(/Pilgrim is at position/);
  const position = await pilgrim.textContent();
  const journal = page.locator(".path-stones__journey");
  await expect(journal).not.toHaveAttribute("open", "");
  await expect(page.locator(".garden-collection")).toBeHidden();
  expect((await journal.boundingBox())!.height).toBeLessThan(90);
  await journal.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".garden-collection")).toBeVisible();
  const cat = page.getByRole("button", { name: "How to discover The Familiar" });
  await cat.click();
  await expect(cat).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#garden-card-details")).toContainText(
    "Walk next to the wandering cat",
  );
  const frog = page.getByRole("button", { name: "How to discover The Enchanted" });
  await frog.click();
  await expect(cat).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#garden-card-details")).toContainText("2 stones to lay");
  await page
    .locator(".garden-collection")
    .screenshot({ path: `/tmp/path-stones-check/polished-cards-${test.info().project.name}.png` });
  await frog.click();
  await expect(page.locator("#garden-card-details")).toBeHidden();
  await expect(pilgrim).toHaveText(position!);
  const bounds = await page.locator(".garden-collection").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await journal.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".garden-collection")).toBeHidden();
  await expect(pilgrim).toHaveText(position!);
});
