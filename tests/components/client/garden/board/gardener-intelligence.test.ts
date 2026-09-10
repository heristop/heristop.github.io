import { expect, it } from "vitest";
import {
  chooseGardenerPlan,
  planGardenerTurn,
  rememberGardenerRake,
  resolveGardenerWeights,
  DEFAULT_GARDENER_WEIGHTS,
} from "../../../../../src/components/client/garden/board/gardener";
import type { MapTile } from "../../../../../src/components/client/garden/types";
const tile = (x: number, y: number, extra: Partial<MapTile> = {}): MapTile => ({
  posX: x,
  posY: y,
  sprite: "moss-mid",
  walkable: true,
  decor: "",
  npc: 0,
  ...extra,
});
const corridor = () => Array.from({ length: 8 }, (_, x) => tile(x, 2, x === 7 ? { stone: 0 } : {}));

it("keeps the mandatory nearest approach but avoids repeating optional work", () => {
  const map = corridor();
  const memory = { recentRakes: [{ position: map[5], turn: 1 }] };
  const result = chooseGardenerPlan(map, [], map[0], 2, {
    limit: 2,
    from: map[3],
    memory,
    weights: { repetition: 20, walking: 0.1, bends: 0.1, variation: 0 },
  });
  expect(result.targets.at(-1)).toEqual({ posX: 6, posY: 2 });
  expect(result.targets).not.toContainEqual({ posX: 5, posY: 2 });
  expect(result.targets).toHaveLength(2);
  expect(result.candidates).toBeGreaterThan(1);
});

it("uses the nearest approach even if its recent history makes it unattractive", () => {
  const map = corridor();
  const result = chooseGardenerPlan(map, [], map[0], 2, {
    limit: 1,
    memory: { recentRakes: [{ position: map[6], turn: 1 }] },
    weights: { repetition: 100 },
  });
  expect(result.targets).toEqual([{ posX: 6, posY: 2 }]);
});

it("avoids a detour for optional work that leaves an equally cheap approach open", () => {
  const map = Array.from({ length: 9 }, (_, i) =>
    tile(i % 3, Math.floor(i / 3), i === 5 ? { stone: 0 } : {}),
  );
  // The direct approach must be raked, but either outer row remains free.
  // Adding one optional rake cannot increase the player's paving cost.
  const result = chooseGardenerPlan(map, [], map[3], 2, {
    from: map[4],
    limit: 2,
    weights: { work: 2, walking: 0.05, bends: 0.1, cohesion: 0.05, variation: 0 },
  });
  expect(result.targets).toEqual([{ posX: 1, posY: 1 }]);
  expect(result.metrics.walking).toBe(0);
});

it("simplifies the chosen plan without promoting a longer, more aggressive alternative", () => {
  const rows = [
    "###__s#s###",
    "__sssssssss",
    "#.ssssss*ss",
    "_.......s..",
    "__sss......",
    "ssss##.##.#",
    "_ss...*....",
    "#sssss.....",
    "#s###...#.#",
    "#*ssssHss*s",
    "#ss.....sss",
  ];
  const map = rows.flatMap((row, y) =>
    [...row].map((cell, x) =>
      tile(x, y, {
        walkable: cell !== "#",
        sprite: cell === "s" ? "sand-0" : cell === "_" ? "stone-slab" : "moss-mid",
        ...(cell === "*" ? { stone: y * 11 + x } : {}),
        ...(cell === "H" ? { shrine: "locked" as const } : {}),
      }),
    ),
  );
  const result = chooseGardenerPlan(map, [], { posX: 2, posY: 3 }, 2, {
    from: { posX: 1, posY: 10 },
    budget: 4,
    memory: { recentRakes: [], heading: "N" },
  });
  // The selected two-rake plan can lose its detour. Discarding that plan entirely
  // would promote three rakes, fourteen steps and increased paving pressure.
  expect(result.targets).toEqual([{ posX: 6, posY: 5 }]);
  expect(result.metrics).toMatchObject({ pressure: 0, walking: 10, bends: 3 });
});

it("keeps shortest walks while avoiding a reversal of the previous heading", () => {
  const map = Array.from({ length: 9 }, (_, i) => tile(i % 3, Math.floor(i / 3)));
  const actions = planGardenerTurn(map, map[0], [map[8]], { posX: 9, posY: 9 }, "W");
  expect(actions[0]).toEqual({ kind: "walk", position: { posX: 0, posY: 1 } });
  expect(actions.filter((a) => a.kind === "walk")).toHaveLength(4);
  expect(actions.at(-1)).toEqual({ kind: "rake", position: map[8] });
});

it("clamps experimental weights and replaces non-finite values with the shipped profile", () => {
  const weights = resolveGardenerWeights({
    pressure: -20,
    variation: 100,
    bends: NaN,
    work: Infinity,
  });
  expect(weights.pressure).toBe(1);
  expect(weights.variation).toBe(0.15);
  expect(weights.bends).toBe(DEFAULT_GARDENER_WEIGHTS.bends);
  expect(weights.work).toBe(DEFAULT_GARDENER_WEIGHTS.work);
});

it("bounds recent work, refreshes its age, and never mutates old memory", () => {
  const old = {
    recentRakes: [
      { position: { posX: 2, posY: 2 }, turn: 0 },
      { position: { posX: 3, posY: 2 }, turn: 1 },
    ],
  };
  const next = rememberGardenerRake(old, { posX: 3, posY: 2 }, 3);
  expect(next.recentRakes).toEqual([{ position: { posX: 3, posY: 2 }, turn: 3 }]);
  expect(old.recentRakes).toHaveLength(2);
});

it("replays the same decision without Math.random and rejects unsafe or empty plans", () => {
  const map = corridor();
  const options = { seed: 73, limit: 3, from: map[2] };
  expect(chooseGardenerPlan(map, [], map[0], 2, options)).toEqual(
    chooseGardenerPlan(map, [], map[0], 2, options),
  );
  expect(chooseGardenerPlan(map, [], map[0], 2, { limit: 0 }).targets).toEqual([]);
  map[7] = { ...map[7], stone: undefined };
  expect(chooseGardenerPlan(map, [], map[0]).targets).toEqual([]);
});

it("records executed rakes rather than planned ones, and clears memory on restart", async () => {
  const { initialState, makeReducer } =
    await import("../../../../../src/components/client/garden/composables/use-game");
  const { buildGarden } = await import("../../../../../src/components/client/garden/board/terrain");
  const { FALLBACK_SEED } = await import("../../../../../src/components/client/garden/schema");
  const layout = buildGarden(FALLBACK_SEED);
  const reduce = makeReducer(layout);
  let state = initialState(layout);
  expect(state.gardenerMemory.recentRakes).toEqual([]);
  while (state.phase === "gardener") state = reduce(state, { type: "advanceGardener" });
  expect(state.gardenerMemory.recentRakes).toHaveLength(1);
  expect(state.gardenerMemory.heading).toBeDefined();
  const reset = reduce(state, { type: "restart", frogRoll: 0.5 });
  expect(reset.gardenerMemory).toEqual({ recentRakes: [] });
});
