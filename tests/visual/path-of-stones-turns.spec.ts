import { canReachNextReward } from "../components/client/garden/model";
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseGardenSeed } from "../components/client/garden/model";
import { buildGarden, randomizeFrog } from "../components/client/garden/model";
import { chooseRakeTargets, rakePaths } from "../components/client/garden/model";
import {
  cheapestRoute,
  canPaveTile,
  layStoneAt,
  collectStoneAt,
  activateShrine,
  manhattan,
  tileAt,
} from "../components/client/garden/model";
import type { Position } from "../components/client/garden/model";

// These snapshots and sprite assertions exercise the classic renderer.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("path-stones:hd2d", "off"));
});
const seed = parseGardenSeed(
  JSON.parse(readFileSync(new URL("../../src/data/github-garden.json", import.meta.url), "utf8")),
);

for (const exhaust of [false, true]) {
  test(
    exhaust
      ? "loses after wasting all refills and can restart"
      : "finishes a long route through multiple gardener turns",
    async ({ page }) => {
      test.setTimeout(90000);
      await page.emulateMedia({ reducedMotion: exhaust ? "reduce" : "no-preference" });
      await page.addInitScript(() => {
        Math.random = () => 0.5;
      });
      await page.goto("/path-of-stones/");
      await expect(page.getByRole("application")).toBeVisible();
      await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
        timeout: 20000,
      });
      const layout = randomizeFrog(buildGarden(seed), 0.5);
      const opening = chooseRakeTargets(layout.map, [], layout.start, 1, {
        budget: layout.stoneBudget + 6,
        limit: 1,
        from: { posX: 0, posY: 3 },
      });
      let gardenerPosition = opening.at(-1) ?? { posX: 0, posY: 3 };
      let map = rakePaths(layout.map, layout.map, opening);
      let position = layout.start;
      let supply = layout.stoneBudget;
      let frogFreed = false;
      let trail: Position[] = [];
      let turns = 0;
      let steps = 0;
      const remaining = [...layout.stones].sort(
        (a, b) =>
          cheapestRoute(map, position, b, 1000)!.cost - cheapestRoute(map, position, a, 1000)!.cost,
      );
      remaining.push(layout.shrine);
      const refreshFrog = async () => {
        if (frogFreed) return;
        const value = await page.locator(".zazen-world__frog-actor").getAttribute("data-position");
        const [posX, posY] = value!.split(",").map(Number);
        map = map.map((tile) =>
          tile.posX === posX && tile.posY === posY
            ? { ...tile, decor: "frog" }
            : manhattan(tile, layout.frog) === 0
              ? { ...tile, decor: "" }
              : tile,
        );
        layout.frog = { posX, posY };
      };
      while (remaining.length && steps < 400) {
        await refreshFrog();
        // Deliberately spend two turns exploring sand before pursuing the relics.
        const detour =
          turns < (exhaust ? 100 : 2)
            ? map
                .filter((tile) => canPaveTile(tile) && tile.stone === undefined)
                .map((tile) => ({ tile, route: cheapestRoute(map, position, tile, 1000) }))
                .find(
                  ({ route }) =>
                    route &&
                    route.cost >= supply &&
                    route.path.every(
                      (step) =>
                        tileAt(map, step)?.stone === undefined && manhattan(step, layout.frog) > 1,
                    ),
                )?.tile
            : undefined;
        const freeGoals = [
          ...remaining,
          ...(!frogFreed
            ? [
                { posX: layout.frog.posX - 1, posY: layout.frog.posY },
                { posX: layout.frog.posX + 1, posY: layout.frog.posY },
                { posX: layout.frog.posX, posY: layout.frog.posY - 1 },
                { posX: layout.frog.posX, posY: layout.frog.posY + 1 },
              ]
            : []),
        ];
        const target =
          supply === 0
            ? freeGoals.find((goal) => cheapestRoute(map, position, goal, 0)?.cost === 0)!
            : (detour ?? remaining[0]);
        const route = cheapestRoute(map, position, target, 1000)!;
        expect(route).toBeDefined();
        for (const next of route.path) {
          await refreshFrog();
          const tile = tileAt(map, next)!;
          if (canPaveTile(tile)) {
            supply--;
            map = layStoneAt(map, next);
            trail.push(next);
          }
          if (!frogFreed && manhattan(next, layout.frog) <= 1) {
            frogFreed = true;
            supply += 2;
            map = map.map((tile) =>
              manhattan(tile, layout.frog) === 0 ? { ...tile, decor: "", transformed: true } : tile,
            );
          }
          if (tile.stone !== undefined) {
            supply++;
            map = collectStoneAt(map, tile.stone);
            const index = remaining.findIndex((stone) => manhattan(stone, next) === 0);
            if (index >= 0) remaining.splice(index, 1);
            if (remaining.length === 1) map = activateShrine(map, layout.shrine);
          }
          const key =
            next.posX > position.posX
              ? "ArrowDown"
              : next.posX < position.posX
                ? "ArrowUp"
                : next.posY > position.posY
                  ? "ArrowLeft"
                  : "ArrowRight";
          const gardenerBefore =
            supply === 0 && !exhaust
              ? await page.locator(".zazen-world__gardener-actor").getAttribute("data-position")
              : null;
          await page.keyboard.press(key);
          position = next;
          steps++;
          await expect(page.locator("#position-announcer")).toHaveText(
            `Pilgrim is at position ${next.posX}, ${next.posY}`,
          );
          // Counterattacks can spend an extra stone on arrival. Observe the wallet
          // rather than maintaining a second copy of the combat rules in this test.
          const wallet = await page
            .locator('[aria-label$="stepping stones left to lay"]')
            .getAttribute("aria-label");
          supply = Number.parseInt(wallet!, 10);
          if (remaining.length === 1 && manhattan(next, layout.shrine) === 0) {
            remaining.pop();
            break;
          }
          if (supply === 0) {
            if (
              turns === 3 &&
              canReachNextReward(map, position, 0, frogFreed ? undefined : layout.frog)
            ) {
              if (manhattan(next, target) !== 0 && !canPaveTile(tile)) continue;
              break;
            }
            if (turns === 3) {
              expect(exhaust).toBe(true);
              const loss = page.getByRole("dialog", { name: "The garden wins this round" });
              await expect(loss).toBeVisible();
              await loss.screenshot({
                path: `/tmp/path-stones-check/challenge-loss-${test.info().project.name}.png`,
              });
              await loss.getByRole("button", { name: "Try a new route" }).click();
              await expect(page.locator('.path-stones__turn[data-phase="player"]')).toContainText(
                "Round 1 / 4",
              );
              await expect(page.getByLabel("0 of 5 stones gathered")).toBeVisible();
              return;
            }
            turns++;
            const targets = chooseRakeTargets(map, trail, position, turns, {
              budget: 2 * (4 - turns),
              from: gardenerPosition,
            });
            if (!exhaust)
              await expect(page.locator('.path-stones__turn[data-phase="gardener"]')).toBeVisible();
            if (!exhaust && targets.length && turns === 2) {
              await expect(page.locator('[data-rake="marked"]')).toHaveCount(targets.length);
              const gardener = page.locator(".zazen-world__gardener-actor");
              await expect(gardener).toHaveAttribute("data-activity", "walk");
              await expect(gardener).not.toHaveAttribute("data-position", gardenerBefore!);
              await expect(gardener).toHaveAttribute("data-activity", "rake", { timeout: 15000 });
              await page.locator(".zazen-world__map-wrapper").screenshot({
                path: `/tmp/path-stones-check/gardener-working-${test.info().project.name}.png`,
              });
            }
            gardenerPosition = targets.at(-1) ?? gardenerPosition;
            map = rakePaths(map, layout.map, targets);
            trail = trail.filter(
              (position) => !targets.some((target) => manhattan(target, position) === 0),
            );
            supply = 2;
            await expect(page.locator('.path-stones__turn[data-phase="player"]')).toBeVisible({
              timeout: 30000,
            });
            await expect(page.getByLabel("2 stepping stones left to lay")).toBeVisible();
            break;
          }
        }
      }
      expect(exhaust, "the wasteful route should lose before the shrine").toBe(false);
      expect(steps).toBeLessThan(400);
      expect(turns).toBeGreaterThan(1);
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("dialog").locator("dt").filter({ hasText: "Garden rhythm" }),
      ).toBeVisible({ timeout: 10000 });
    },
  );
}

test("the gardener opens the game and hands over without spending a refill", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/path-of-stones/");
  const turn = page.locator(".path-stones__turn");
  await expect(turn).toHaveAttribute("data-phase", "gardener");
  await expect(page.locator(".path-stones__turn-announcement strong")).toHaveText(
    "Gardener’s Turn",
  );
  const supply = await page
    .locator('[aria-label$="stepping stones left to lay"]')
    .getAttribute("aria-label");
  const start = await page.locator("#position-announcer").textContent();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#position-announcer")).toHaveText(start!);
  await expect(page.locator(".zazen-world__gardener-actor")).toHaveAttribute(
    "data-activity",
    "walk",
    {
      timeout: 15000,
    },
  );
  await expect(turn).toHaveAttribute("data-phase", "player", { timeout: 20000 });
  await expect(page.getByLabel(supply!)).toBeVisible();
  await expect(turn).toContainText("ROUND 1 / 4", { ignoreCase: true });
});
