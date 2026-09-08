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
  await page.goto("/path-of-stones/");
  const map = page.getByRole("application");
  await expect(map).toHaveAttribute("data-renderer", "webgl", { timeout: 20000 });
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({ timeout: 20000 });
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
  await expect(page.locator(".zazen-world__pilgrim")).toHaveCSS("animation-name", "none");
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
  await expect(page.locator(".garden-webgl")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /HD-2D/ })).toHaveCount(0);
  await expect(page.getByRole("application")).toHaveAttribute("data-renderer", "dom");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Walk down and right (S or down arrow)", exact: true })
    .click();
  await expect(page.locator("#position-announcer")).toContainText("2, 1");
});

test("HD-2D toggles without resetting the run and persists beyond a diagnostic URL", async ({
  page,
}) => {
  await page.goto("/path-of-stones/?renderer=webgl");
  const map = page.getByRole("application");
  await expect(map).toHaveAttribute("data-renderer", "webgl", { timeout: 20000 });
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({ timeout: 20000 });
  await page
    .getByRole("button", { name: "Walk down and right (S or down arrow)", exact: true })
    .click();
  const before = await page.locator("#position-announcer").textContent();
  await page.getByRole("button", { name: "HD-2D on", exact: true }).click();
  await expect(map).toHaveAttribute("data-renderer", "dom");
  await expect(page.locator("#position-announcer")).toHaveText(before!);
  await expect(page.locator(".garden-webgl canvas")).toHaveCount(0);
  await page.reload();
  await expect(map).toHaveAttribute("data-renderer", "dom");
  await expect(page.getByRole("button", { name: "HD-2D off", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "HD-2D off", exact: true }).click();
  await expect(map).toHaveAttribute("data-renderer", "webgl", { timeout: 20000 });
  await page.reload();
  await expect(map).toHaveAttribute("data-renderer", "webgl", { timeout: 20000 });
});

for (const renderer of ["webgl", "dom"]) {
  test(`lanterns toggle with pointer and keyboard without moving in ${renderer}`, async ({ page }) => {
    await page.goto(`/path-of-stones/?renderer=${renderer}`);
    await expect(page.locator(".zazen-world__map")).toHaveAttribute("data-renderer", renderer, { timeout: 20000 });
    const lantern = page.getByRole("button", { name: /^Extinguish lantern/ }).first();
    const name = await lantern.getAttribute("aria-label");
    const position = await page.locator("#position-announcer").textContent();
    await lantern.click();
    const unlit = page.getByRole("button", { name: name!.replace("Extinguish", "Light"), exact: true });
    await expect(unlit).toBeVisible();
    await expect(page.locator("#position-announcer")).toHaveText(position!);
    await unlit.focus();
    await unlit.press("Enter");
    await expect(page.getByRole("button", { name: name!, exact: true })).toBeVisible();
    await expect(page.locator("#position-announcer")).toHaveText(position!);
  });
}

for (const renderer of ["webgl", "dom"]) {
  test(`scenery reacts without walking in ${renderer}`, async ({ page }) => {
    await page.goto(`/path-of-stones/?renderer=${renderer}`);
    await expect(page.locator(".zazen-world__map")).toHaveAttribute("data-renderer", renderer, { timeout: 20000 });
    const position = await page.locator("#position-announcer").textContent();
    const tree = page.getByRole("button", { name: /^Rustle tree/ }).first();
    await tree.focus();
    await expect(tree).toHaveCSS("outline-style", "none");
    await expect(tree).toHaveCSS("box-shadow", "none");
    await tree.click();
    await page.getByRole("button", { name: /^Spin stone/ }).first().click();
    await expect(page.locator("#position-announcer")).toHaveText(position!);
    if (renderer === "dom") {
      await expect.poll(() => page.locator(".zazen-world__decor").evaluateAll((images) =>
        images.flatMap((image) => image.getAnimations()).filter((animation) => animation.id === "scenery-reaction").length,
      )).toBeGreaterThan(0);
    }
  });
}

for (const renderer of ["webgl", "dom"]) {
  test(`animal clicks preserve the run in ${renderer}`, async ({ page }) => {
    await page.goto(`/path-of-stones/?renderer=${renderer}`);
    await expect(page.locator(".zazen-world__map")).toHaveAttribute("data-renderer", renderer, { timeout: 20000 });
    const position = await page.locator("#position-announcer").textContent();
    await page.getByRole("button", { name: "Greet the cat", exact: true }).click();
    await page.getByRole("button", { name: "Make the frog hop", exact: true }).click();
    await expect(page.locator("#position-announcer")).toHaveText(position!);
    await expect(page.getByRole("button", { name: "Make the frog hop", exact: true })).toBeVisible();
  });
}

test("classic stone shadow shrinks at the apex while staying grounded", async ({ page }) => {
  await page.goto("/path-of-stones/?renderer=dom");
  const button = page.getByRole("button", { name: /^Spin stone/ }).first();
  await button.click();
  const scale = await page.locator(".zazen-world__stone-shadow").evaluateAll((shadows) => {
    const shadow = shadows.find((item) => item.getAnimations().length > 0)!;
    const animation = shadow.getAnimations()[0]!;
    animation.pause();
    animation.currentTime = 700;
    return new DOMMatrix(getComputedStyle(shadow).transform).a;
  });
  expect(scale).toBeCloseTo(0.5);
});

for (const renderer of ["webgl", "dom"]) {
  test(`cursor distinguishes walkable destinations in ${renderer}`, async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/path-of-stones/?renderer=${renderer}`);
    const map = page.locator(".zazen-world__map");
    await expect(map).toHaveAttribute("data-renderer", renderer, { timeout: 20000 });
    await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({ timeout: 20000 });
    const destination = page.locator('[data-scenery-key="2,1"] .zazen-world__hit');
    await destination.hover();
    await expect(map).toHaveAttribute("data-cursor", "move");
    if (!isMobile) await expect(destination).toHaveCSS("cursor", /cursor-move\.png/);
    const current = page.locator('[data-scenery-key="1,1"] .zazen-world__hit');
    await current.hover();
    await expect(map).toHaveAttribute("data-cursor", "default");
    if (!isMobile) await expect(current).toHaveCSS("cursor", /cursor-default\.png/);
  });
}
