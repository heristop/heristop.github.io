import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
const seedData = JSON.parse(
  readFileSync(new URL("../../src/data/github-garden.json", import.meta.url), "utf8"),
);
import { parseGardenSeed } from "../components/client/garden/model";
import {
  buildGarden,
  cheapestRoute,
  canPaveTile,
  layStoneAt,
  collectStoneAt,
  activateShrine,
  tileAt,
  manhattan,
  STONE_REFUEL,
} from "../components/client/garden/model";
import type { MapTile, Position } from "../components/client/garden/model";

import { randomizeFrog } from "../components/client/garden/model";

import { chooseRakeTargets, rakePaths } from "../components/client/garden/model";
const layout = randomizeFrog(buildGarden(parseGardenSeed(seedData)), 0.5);
const opening = chooseRakeTargets(layout.map, [], layout.start, 1, {
  budget: layout.stoneBudget + 6,
  limit: 1,
  from: { posX: 0, posY: 3 },
});
function solve(
  map: MapTile[],
  from: Position,
  wallet: number,
  frogFreed = false,
  turns = 0,
  trail: Position[] = [],
  gardenerPosition: Position = opening.at(-1) ?? { posX: 0, posY: 3 },
): Position[] | undefined {
  const targets = map.filter((tile) => tile.stone !== undefined);
  if (!targets.length)
    return cheapestRoute(activateShrine(map, layout.shrine), from, layout.shrine, wallet)?.path;
  for (const target of targets) {
    const route = cheapestRoute(map, from, target, wallet + 2 * (3 - turns));
    if (!route) continue;
    let ground = map;
    let supply = wallet;
    let frog = frogFreed;
    let visits = turns;
    let laid = [...trail];
    let caretaker = gardenerPosition;
    let blocked = false;
    for (const position of route.path) {
      if (canPaveTile(tileAt(ground, position)!)) {
        if (supply === 0) {
          blocked = true;
          break;
        }
        ground = layStoneAt(ground, position);
        laid.push(position);
        supply--;
      }
      const landed = tileAt(ground, position)!;
      if (landed.stone !== undefined) {
        supply += STONE_REFUEL;
        ground = collectStoneAt(ground, landed.stone);
      }
      if (!frog && manhattan(position, layout.frog) <= 1) {
        frog = true;
        supply += 2;
      }
      if (supply === 0 && visits < 3) {
        visits++;
        const targets = chooseRakeTargets(ground, laid, position, visits, {
          budget: 2 * (4 - visits),
          from: caretaker,
        });
        caretaker = targets.at(-1) ?? caretaker;
        ground = rakePaths(ground, layout.map, targets);
        laid = laid.filter((step) => !targets.some((target) => manhattan(step, target) === 0));
        supply = 2;
      }
    }
    if (blocked) continue;
    const rest = solve(ground, target, supply, frog, visits, laid, caretaker);
    if (rest) return [...route.path, ...rest];
  }
}

test.beforeEach(async ({ page }) => {
  // Pin run randomness so visual baselines retain the same frog placement.
  await page.addInitScript(() => {
    Math.random = () => 0.5;
  });
});

test("completes the garden, saves a record, and replays", async ({ page, browserName }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  const route = solve(rakePaths(layout.map, layout.map, opening), layout.start, layout.stoneBudget);
  expect(route).toBeDefined();
  let from = layout.start;
  for (const next of route!) {
    const key =
      next.posX > from.posX
        ? "ArrowDown"
        : next.posX < from.posX
          ? "ArrowUp"
          : next.posY > from.posY
            ? "ArrowLeft"
            : "ArrowRight";
    await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible();
    await page.keyboard.press(key);
    await expect(page.locator("#position-announcer")).toHaveText(
      `Pilgrim is at position ${next.posX}, ${next.posY}`,
    );
    from = next;
  }
  const finale = page.getByRole("dialog");
  await expect(finale).toBeVisible();
  await expect(finale.getByText("Total", { exact: true })).toBeVisible();
  await expect(finale.locator(".path-stones__finale-line")).toHaveCount(5);
  await expect(finale.getByText("New personal best")).toBeVisible();
  if (browserName === "chromium") await expect(finale).toHaveScreenshot("garden-victory.png");
  await finale.getByRole("button", { name: "Walk again" }).click();
  await expect(page.getByLabel("0 of 5 stones gathered")).toBeVisible();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved on this device")).toBeVisible();
  expect(errors).toEqual([]);
});

test("keeps the player visible when resized to a phone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/path-of-stones/");
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () =>
      page.locator(".zazen-world__pilgrim").evaluate((el) => {
        const player = el.getBoundingClientRect();
        const frame = document.querySelector(".zazen-world__map-wrapper")!.getBoundingClientRect();
        return player.left >= frame.left && player.right <= frame.right;
      }),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("idle time does not spend player steps", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto("/path-of-stones/");
  await expect(page.getByRole("application")).toBeVisible();
  await page.clock.fastForward(20000);
  await expect(page.getByText("0 steps · 0 stones laid")).toBeVisible();
});

test("moves by tapping a tile and offers sound and restart controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 15000,
  });
  const sound = page.getByRole("button", { name: "Sound on" });
  await sound.click();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator('.zazen-world__tile[role="button"] .zazen-world__hit').first().click();
  await expect(page.getByText(/1 steps ·/)).toBeVisible();
  await page.getByRole("button", { name: "Restart run" }).click();
  await expect(page.getByText("0 steps · 0 stones laid")).toBeVisible();
});

test("keeps the desktop board compact and centered on wide monitors", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop layout regression");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  for (const width of [1280, 1920, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () =>
        page.locator(".zazen-world__map-wrapper").evaluate((el) => {
          const board = el.getBoundingClientRect();
          const controls = document.querySelector(".zazen-world__compass")!.getBoundingClientRect();
          return (
            board.width === 768 &&
            Math.abs(board.left + board.width / 2 - innerWidth / 2) < 2 &&
            controls.left > board.right &&
            controls.top >= board.top &&
            controls.bottom <= board.bottom
          );
        }),
      )
      .toBe(true);
  }
});

test("restart moves the frog without duplicating it", async ({ page }) => {
  await page.goto("/path-of-stones/");
  const frog = page.locator('img[src$="/frog.png"]');
  await expect(frog).toHaveCount(1);
  const tileIndex = () =>
    frog.evaluate((image) =>
      Array.from(document.querySelectorAll(".zazen-world__tile-image")).indexOf(
        image.parentElement!,
      ),
    );
  const before = await tileIndex();
  await page.getByRole("button", { name: /restart run/i }).click();
  await expect(frog).toHaveCount(1);
  await expect.poll(tileIndex).not.toBe(before);
});

test("identifies the GitHub owner and provides a keyboard-dismissible field guide", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator(".path-stones__attribution a")).toHaveAttribute(
    "href",
    "https://github.com/heristop",
  );
  await expect(page.locator(".path-stones__attribution")).toContainText("@heristop");
  const help = page.locator(".stone-game-help");
  await help.locator("summary").click();
  await expect(help.locator("h2")).toHaveText("Five stones. Four rounds.");
  await expect(help.locator("li")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(help).not.toHaveAttribute("open");
  await expect(help.locator("summary")).toBeFocused();
  await expect(page.locator(".path-stones__source time")).toHaveAttribute(
    "datetime",
    /\d{4}-\d{2}-\d{2}/,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("keeps instructions readable without overflowing the page", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.getByRole("application")).toBeVisible();
  for (const selector of [
    ".path-stones__tools button",
    ".path-stones__turn small",
    ".path-stones__source p",
    ".path-stones__heat-readout",
  ]) {
    const size = await page
      .locator(selector)
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(15);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("finds the pilgrim after panning away without spending a move", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/path-of-stones/");
  await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
    timeout: 20000,
  });
  const frame = page.locator(".zazen-world__map-wrapper");
  await frame.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.getByRole("button", { name: /Find pilgrim/ }).click();
  await expect
    .poll(async () =>
      page.locator(".zazen-world__pilgrim").evaluate((el) => {
        const player = el.getBoundingClientRect();
        const frame = document.querySelector(".zazen-world__map-wrapper")!.getBoundingClientRect();
        return player.left >= frame.left && player.right <= frame.right;
      }),
    )
    .toBe(true);
  await expect(page.getByRole("application")).toBeFocused();
  await expect(page.getByText("0 steps · 0 stones laid")).toBeVisible();
});

test("remembers the sound setting across reloads", async ({ page }) => {
  await page.goto("/path-of-stones/");
  await page.getByRole("button", { name: "Sound on" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Sound off" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound on" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
