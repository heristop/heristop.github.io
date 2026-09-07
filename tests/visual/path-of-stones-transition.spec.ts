import { expect, test } from "@playwright/test";

test.describe("Garden page transitions", () => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    test(`enters, returns and supports browser history (${reducedMotion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/");
      await page.evaluate(() => {
        const state = window as typeof window & {
          gardenVisit?: number;
          gardenTransitions?: string[];
        };
        state.gardenVisit = 1;
        state.gardenTransitions = [];
        document.addEventListener("astro:after-swap", () => {
          state.gardenTransitions?.push(
            document.documentElement.dataset.gardenTransition ?? "missing",
          );
        });
      });
      const gardenLink = page
        .getByRole("link", { name: "Garden", exact: true })
        .filter({ visible: true })
        .first();
      await gardenLink.click();
      await expect(page.getByRole("application", { name: /game world map/i })).toBeVisible();
      await expect(page.locator("html")).not.toHaveAttribute("data-garden-transition");
      await page.getByRole("link", { name: "Zazen Code", exact: true }).click();
      await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
      await expect(page.locator("html")).not.toHaveAttribute("data-garden-transition");
      await page.goBack();
      await expect(page.getByRole("application", { name: /game world map/i })).toBeVisible();
      await expect(page.locator("html")).not.toHaveAttribute("data-garden-transition");
      const state = await page.evaluate(() => {
        const state = window as typeof window & {
          gardenVisit?: number;
          gardenTransitions?: string[];
        };
        return { visit: state.gardenVisit, transitions: state.gardenTransitions };
      });
      expect(state).toEqual({ visit: 1, transitions: ["enter", "leave", "enter"] });
      expect(errors).toEqual([]);
    });
  }
});
