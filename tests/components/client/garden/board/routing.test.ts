import { expect, it } from "vitest";
import { cheapestCrossing, cheapestRoute } from "../../../../../src/components/client/garden/board/routing";
import type { MapTile } from "../../../../../src/components/client/garden/types";

it("preserves minimum stone cost, shortest length and budgets across varied gardens", () => {
  // Independent relaxation oracle, including disconnected, free and expensive terrain.
  for (let seed = 1; seed <= 32; seed++) {
    let random = seed;
    const map: MapTile[] = Array.from({ length: 64 }, (_, i) => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const value = random % 5;
      return { posX: i % 8, posY: Math.floor(i / 8), npc: 0, decor: "",
        sprite: value < 2 ? "sand-0" : "moss-mid", walkable: i === 0 || value !== 4 };
    });
    const ranks = Array<number>(64).fill(Infinity);
    ranks[0] = 0;
    for (let pass = 0; pass < 64; pass++) {
      let changed = false;
      for (let i = 0; i < 64; i++) {
        for (let j = 0; j < 64; j++) {
          if (!map[j].walkable || Math.abs(map[i].posX - map[j].posX) + Math.abs(map[i].posY - map[j].posY) !== 1) continue;
          const next = ranks[i] + (map[j].sprite === "sand-0" ? 1001 : 1);
          if (next < ranks[j]) { ranks[j] = next; changed = true; }
        }
      }
      if (!changed) break;
    }
    for (const index of [0, 7, 27, 63]) {
      const rank = ranks[index];
      const cost = Number.isFinite(rank) ? Math.floor(rank / 1000) : undefined;
      expect(cheapestCrossing(map, map[0], map[index])).toBe(cost);
      for (const budget of [0, 1, 3, 64]) {
        const route = cheapestRoute(map, map[0], map[index], budget);
        if (cost === undefined || cost > budget) { expect(route).toBeUndefined(); continue; }
        expect(route?.cost).toBe(cost);
        expect(route?.path).toHaveLength(rank % 1000);
        let previous = map[0];
        for (const step of route!.path) {
          expect(Math.abs(step.posX - previous.posX) + Math.abs(step.posY - previous.posY)).toBe(1);
          previous = map[step.posY * 8 + step.posX];
          expect(previous.walkable).toBe(true);
        }
      }
    }
  }
});
