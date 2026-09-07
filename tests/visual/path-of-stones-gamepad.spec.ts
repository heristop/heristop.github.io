import { expect, test } from "@playwright/test";

test("a controller walks, opens help, changes sound and disconnects safely", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const pad = {
      id: "Standard test pad",
      index: 0,
      mapping: "standard",
      connected: true,
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => (pad.connected ? [pad] : []) });
    window.addEventListener("test-pad", (event) => {
      const detail = (event as CustomEvent).detail;
      pad.axes = detail.axes ?? [0, 0];
      pad.buttons = pad.buttons.map((button, index) => ({
        ...button,
        pressed: index === detail.button,
      }));
      if (detail.connected !== undefined) pad.connected = detail.connected;
    });
  });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("Controller connected", { exact: true })).toBeVisible();
  const input = async (detail: { axes?: number[]; button?: number; connected?: boolean }) => {
    await page.evaluate(
      (detail) => window.dispatchEvent(new CustomEvent("test-pad", { detail })),
      detail,
    );
    await page.waitForTimeout(70);
  };
  const announcer = page.locator("#position-announcer");
  const before = await announcer.textContent();
  await input({ axes: [0, -1] });
  await input({});
  await expect(announcer).not.toHaveText(before!);
  await input({ button: 9 });
  await input({});
  await expect(page.locator(".stone-game-help")).toHaveAttribute("open");
  const paused = await announcer.textContent();
  await input({ axes: [1, 0] });
  await input({});
  await expect(announcer).toHaveText(paused!);
  await input({ button: 1 });
  await input({});
  await expect(page.locator(".stone-game-help")).not.toHaveAttribute("open");
  await input({ button: 2 });
  await input({});
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();
  await expect(page.locator(".path-stones__turn-announcement")).toHaveCount(0);
  await page
    .locator(".path-stones__input-hint")
    .screenshot({ path: `/tmp/path-stones-check/controller-${test.info().project.name}.png` });
  await input({ connected: false });
  await expect(page.getByText("Controller ready · press a button on your gamepad")).toBeVisible();
});
