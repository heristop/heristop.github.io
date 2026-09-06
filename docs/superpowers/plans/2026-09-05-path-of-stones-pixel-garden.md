# Path of Stones Pixel Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/path` as an isometric 2D pixel game drawn in the site's own palette, whose terrain and planting are generated from the author's recent public GitHub activity.

**Architecture:** Two committed generator scripts (art, data) produce reviewable artifacts that the build consumes; the game itself is a chain of pure functions — `GardenSeed → seeded RNG → MapTile[]` — with rendering and animation layered on top. Phase A builds the whole pipeline against a hard-coded `FALLBACK_SEED`; Phase B only swaps that seed's source for a fetched file, so there is no throwaway code path.

**Tech Stack:** Astro 7 (static), React 19 island (`client:only`), TypeScript, SCSS, Vitest + Testing Library, Playwright, `sharp` (already a devDependency) for PNG emission, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-05-path-of-stones-design.md`

## Global Constraints

- Package manager is **pnpm**. Never `npm`.
- Isometric geometry is frozen: `TILE_HALF_WIDTH = 32`, `TILE_HALF_HEIGHT = 16`, 64×32 diamond drawn in a 64×64 cell, `GRID_SIZE = 12`.
- Palette is fixed at exactly these seventeen values. No other colour may appear in any sprite:
  `sand #f2ece0 #e6dccb #d4c7b2` · `moss #a8b295 #8b9a78 #6d7d5c` · `water #c3cbc9 #93a3a3 #6a7c80` · `stone #cdbfba #a8968f #7d6c68` · `rose #c2566e #9b3f56 #6e2b3e` · `ink #4a4038 #2e2721`
- Rose is reserved for stones, the shrine, and sakura only.
- Pixel art: 2:1 isometric slope (2px horizontal per 1px vertical), one light direction (top-left), no anti-aliasing on sprite edges, no partial alpha except a deliberate contact shadow.
- Sprites author at 1x, display at **integer scale only**, `image-rendering: pixelated`.
- `prefers-reduced-motion` must be honoured in **both** CSS and JS. CSS alone will not stop a rAF tween.
- Exactly **5** stones, always. The haiku has five lines and the loop depends on it.
- Commit data may influence **appearance only**, never walkability.
- Never print raw commit messages to the page.
- No runtime GitHub fetch. Everything is baked at build time.
- Accessibility is a non-regression requirement: `role="application"`, the `aria-live` announcer, per-tile `role="button"` with labels, `sr-only` instructions, and compass tooltips all survive.
- Lint before every commit: `pnpm lint` and `pnpm style:lint` must pass.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `src/components/client/zazen-rng.ts` | Deterministic PRNG + string hash. No other logic. |
| `src/data/garden-schema.ts` | `GardenSeed`/`GardenDay` types, `parseGardenSeed()`, `FALLBACK_SEED`, grid constants. |
| `src/components/client/zazen-world-geometry.ts` | Iso projection, tile constants, map dimensions, direction deltas. Pure. |
| `src/components/client/zazen-world-rules.ts` | Movement, walkability, stone collection, shrine activation, key handling. Pure. |
| `src/components/client/zazen-world-terrain.ts` | `GardenSeed` → `GardenLayout`. Day mapping, planting, stone placement, reachability repair. Pure. |
| `src/components/client/use-zazen-step.ts` | Walk animation state: facing, frame, interpolated position. |
| `src/components/client/zazen-pilgrim.tsx` | The pilgrim as its own positioned layer. |
| `scripts/generate-zazen-art.mjs` | Palette + pixel maps → PNGs. |
| `scripts/zazen-art/palette.mjs` | The seventeen colours, shared by generator and docs. |
| `scripts/zazen-art/sprites.mjs` | Pixel maps for every sprite. |
| `scripts/fetch-github-garden.mjs` | GitHub fetch → `src/data/github-garden.json`. Network only. |
| `src/data/github-garden.json` | Committed data artifact / offline fallback. |
| `tests/visual/path.spec.ts` | Playwright snapshot of `/path`, seed pinned. |

**Modified**

| Path | Change |
|---|---|
| `src/components/client/zazen-world-helpers.ts` | Becomes a re-export barrel during the refactor; deleted in Task 12. |
| `src/components/client/use-zazen-game.ts` | Takes a seed; player position becomes explicit state. |
| `src/components/client/zazen-world.tsx` | Presentation only; pilgrim extracted; integer scaling. |
| `src/components/client/world.scss` | Repainted to the new palette; pixel-rendering; reduced-motion. |
| `src/components/client/zazen-world-types.ts` | `MapTile` reshaped. |
| `src/pages/path.astro` | Reads the seed, passes it as an island prop. |
| `package.json` | `generate:art`, `fetch:github` scripts. |
| `.github/workflows/astro-gh-pages.yml` | Fetch step + daily cron. |
| `tests/components/client/zazen-world-helpers.test.ts` | Re-pointed at the split modules. |
| `public/images/zazen/**` | 28 borrowed GIFs deleted, ~26 generated PNGs added. |

---

# Phase A — new skin, new feel

Ships alone. At the end of Phase A `/path` is a proper pixel game running on `FALLBACK_SEED`.

---

### Task 1: Deterministic RNG

Replaces the `Math.random()` calls in `getProceduralTerrain`, which currently make the garden different on every page load and make snapshot testing impossible.

**Files:**
- Create: `src/components/client/zazen-rng.ts`
- Test: `tests/components/client/zazen-rng.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `createRng(seed: number): () => number` — successive calls return floats in `[0, 1)`
  - `hashString(value: string): number` — FNV-1a 32-bit, returns an unsigned integer

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/client/zazen-rng.test.ts
import { describe, expect, it } from "vitest";
import { createRng, hashString } from "../../../src/components/client/zazen-rng";

describe("createRng", () => {
  it("returns the same sequence for the same seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("returns a different sequence for a different seed", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("is stable for the same input", () => {
    expect(hashString("2026-09-05")).toBe(hashString("2026-09-05"));
  });

  it("differs for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const hash = hashString("heristop");
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/zazen-rng.test.ts`
Expected: FAIL — cannot resolve `src/components/client/zazen-rng`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/client/zazen-rng.ts

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

// mulberry32. Chosen over Math.random because the garden must be identical for a given
// seed: that is what makes it "yours", and what makes Playwright snapshots possible.
const createRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
};

const hashString = (value: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
};

export { createRng, hashString };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/zazen-rng.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/client/zazen-rng.ts tests/components/client/zazen-rng.test.ts
git commit -m "feat(path): add deterministic rng for garden generation"
```

---

### Task 2: Garden seed schema and fallback

The contract between build-time data and the game. Phase A runs entirely on `FALLBACK_SEED`; Phase B replaces only where the seed comes from.

**Files:**
- Create: `src/data/garden-schema.ts`
- Test: `tests/data/garden-schema.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `DATA_COLS = 10`, `DATA_ROWS = 10`, `DATA_TILES = 100`, `STONE_COUNT = 5`, `GRID_SIZE = 12`
  - `interface GardenDay { date: string; count: number; language: string; repo: string }`
  - `interface GardenSeed { generatedAt: string; login: string; totalContributions: number; days: readonly (GardenDay | null)[] }` — `days` has exactly `DATA_TILES` entries, oldest first, left-padded with `null` when history is short
  - `FALLBACK_SEED: GardenSeed`
  - `parseGardenSeed(raw: unknown): GardenSeed` — returns `FALLBACK_SEED` for anything malformed, never throws

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/garden-schema.test.ts
import { describe, expect, it } from "vitest";
import {
  DATA_TILES,
  FALLBACK_SEED,
  parseGardenSeed,
} from "../../src/data/garden-schema";

describe("FALLBACK_SEED", () => {
  it("has exactly one entry per data tile", () => {
    expect(FALLBACK_SEED.days).toHaveLength(DATA_TILES);
  });

  it("contains at least five days with commits so stones can be placed", () => {
    const active = FALLBACK_SEED.days.filter((day) => day !== null && day.count > 0);
    expect(active.length).toBeGreaterThanOrEqual(5);
  });
});

describe("parseGardenSeed", () => {
  it("falls back when given nothing", () => {
    expect(parseGardenSeed(undefined)).toBe(FALLBACK_SEED);
    expect(parseGardenSeed(null)).toBe(FALLBACK_SEED);
  });

  it("falls back when days is the wrong length", () => {
    const raw = { generatedAt: "2026-09-05", login: "x", totalContributions: 1, days: [] };
    expect(parseGardenSeed(raw)).toBe(FALLBACK_SEED);
  });

  it("falls back when a day is malformed", () => {
    const days = Array.from({ length: DATA_TILES }, () => ({ date: "2026-01-01", count: "lots" }));
    const raw = { generatedAt: "2026-09-05", login: "x", totalContributions: 1, days };
    expect(parseGardenSeed(raw)).toBe(FALLBACK_SEED);
  });

  it("accepts a well-formed seed and normalises missing optional fields", () => {
    const days = Array.from({ length: DATA_TILES }, (_unused, index) => ({
      date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
      count: index % 12,
    }));
    const raw = { generatedAt: "2026-09-05", login: "heristop", totalContributions: 42, days };
    const parsed = parseGardenSeed(raw);
    expect(parsed).not.toBe(FALLBACK_SEED);
    expect(parsed.login).toBe("heristop");
    expect(parsed.days).toHaveLength(DATA_TILES);
    expect(parsed.days[3]).toEqual({ date: "2026-01-04", count: 3, language: "", repo: "" });
  });

  it("accepts nulls in days for padding", () => {
    const days: unknown[] = Array.from({ length: DATA_TILES }, () => null);
    const raw = { generatedAt: "2026-09-05", login: "x", totalContributions: 0, days };
    expect(parseGardenSeed(raw).days.every((day) => day === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/data/garden-schema.test.ts`
Expected: FAIL — cannot resolve `src/data/garden-schema`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/garden-schema.ts

// The garden is a 12x12 board. The outer ring is authored landscape; the inner 10x10 is
// one tile per day of recent history, oldest first.
const GRID_SIZE = 12;
const DATA_COLS = 10;
const DATA_ROWS = 10;
const DATA_TILES = DATA_COLS * DATA_ROWS;
const STONE_COUNT = 5;

interface GardenDay {
  date: string;
  count: number;
  language: string;
  repo: string;
}

interface GardenSeed {
  generatedAt: string;
  login: string;
  totalContributions: number;
  days: readonly (GardenDay | null)[];
}

// Hand-authored stand-in. Phase A runs on this, and it stays the offline/never-fetched
// fallback afterwards, so it must look deliberate rather than arbitrary.
const FALLBACK_PATTERN = [
  0, 0, 2, 5, 3, 0, 0, 1, 4, 7, 0, 0, 3, 6, 2, 0, 1, 5, 9, 2,
  0, 0, 1, 4, 8, 3, 0, 0, 2, 6, 11, 4, 0, 0, 1, 3, 7, 2, 0, 0,
  5, 9, 3, 1, 0, 0, 2, 6, 12, 5, 0, 0, 1, 4, 8, 2, 0, 0, 3, 7,
  2, 0, 0, 1, 5, 10, 4, 0, 0, 2, 6, 3, 0, 0, 1, 4, 9, 3, 0, 0,
  2, 7, 13, 5, 0, 0, 1, 3, 8, 2, 0, 0, 4, 6, 2, 0, 1, 5, 10, 6,
];

const FALLBACK_LANGUAGES = ["TypeScript", "TypeScript", "JavaScript", "PHP", "Astro"];

const buildFallbackDays = (): readonly (GardenDay | null)[] =>
  FALLBACK_PATTERN.map((count, index) => {
    const day = new Date(Date.UTC(2026, 4, 28));
    day.setUTCDate(day.getUTCDate() + index);
    return {
      count,
      date: day.toISOString().slice(0, 10),
      language: count === 0 ? "" : FALLBACK_LANGUAGES[index % FALLBACK_LANGUAGES.length],
      repo: count === 0 ? "" : "zazen-code",
    };
  });

const FALLBACK_SEED: GardenSeed = {
  days: buildFallbackDays(),
  generatedAt: "2026-05-28T00:00:00.000Z",
  login: "heristop",
  totalContributions: FALLBACK_PATTERN.reduce((sum, count) => sum + count, 0),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseDay = (raw: unknown): GardenDay | null | undefined => {
  if (raw === null) {
    return null;
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  const { date, count, language, repo } = raw;
  if (typeof date !== "string" || typeof count !== "number" || !Number.isFinite(count)) {
    return undefined;
  }
  return {
    count: Math.max(0, Math.trunc(count)),
    date,
    language: typeof language === "string" ? language : "",
    repo: typeof repo === "string" ? repo : "",
  };
};

// Never throws. A malformed data file must degrade to a playable garden, not break the page.
const parseGardenSeed = (raw: unknown): GardenSeed => {
  if (!isRecord(raw)) {
    return FALLBACK_SEED;
  }
  const { generatedAt, login, totalContributions, days } = raw;
  if (!Array.isArray(days) || days.length !== DATA_TILES) {
    return FALLBACK_SEED;
  }
  const parsedDays: (GardenDay | null)[] = [];
  for (const entry of days) {
    const day = parseDay(entry);
    if (day === undefined) {
      return FALLBACK_SEED;
    }
    parsedDays.push(day);
  }
  return {
    days: parsedDays,
    generatedAt: typeof generatedAt === "string" ? generatedAt : "",
    login: typeof login === "string" ? login : "",
    totalContributions:
      typeof totalContributions === "number" && Number.isFinite(totalContributions)
        ? totalContributions
        : 0,
  };
};

export type { GardenDay, GardenSeed };
export {
  DATA_COLS,
  DATA_ROWS,
  DATA_TILES,
  FALLBACK_SEED,
  GRID_SIZE,
  STONE_COUNT,
  parseGardenSeed,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/data/garden-schema.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/data/garden-schema.ts tests/data/garden-schema.test.ts
git commit -m "feat(path): add garden seed schema with offline fallback"
```

---

### Task 3: Reshape MapTile and split out geometry

`zazen-world-helpers.ts` currently mixes terrain generation, geometry, movement rules and keyboard handling in 379 lines. This task extracts the geometry and reshapes `MapTile` so walkability stops being inferred from a filename substring (`tile.img.includes("eau")`).

**Files:**
- Create: `src/components/client/zazen-world-geometry.ts`
- Modify: `src/components/client/zazen-world-types.ts`
- Modify: `src/components/client/zazen-world-helpers.ts` (re-export the moved symbols so nothing else breaks yet)
- Test: `tests/components/client/zazen-world-geometry.test.ts`

**Interfaces:**
- Consumes: `GRID_SIZE` from `src/data/garden-schema`
- Produces:
  - `TILE_HALF_WIDTH = 32`, `TILE_HALF_HEIGHT = 16`, `TILE_FULL_WIDTH = 64`, `TILE_FULL_HEIGHT_WITH_PADDING = 90`
  - `interface Position { posX: number; posY: number }`
  - `toScreen(posX: number, posY: number, offsetX: number, offsetY: number): { left: number; top: number }` — accepts fractional coordinates so the walk tween can interpolate
  - `calculateMapDimensions(map: readonly MapTile[]): { width: number; height: number; offsetX: number; offsetY: number }`
  - `applyDirectionOffset(direction: Direction, posX: number, posY: number): Position`
  - `directionFromDelta(from: Position, to: Position): Direction | undefined`
  - `manhattan(a: Position, b: Position): number`
- New `MapTile` shape:
  ```ts
  interface MapTile {
    posX: number;
    posY: number;
    sprite: string;      // ground sprite name, e.g. "sand-0" | "moss-mid" | "water-still"
    walkable: boolean;   // explicit; replaces img.includes("eau") sniffing
    decor: string;       // "" or decor sprite name
    npc: number;         // 0 = none. Was `perso`; the player no longer lives here.
    stone?: number;
    shrine?: "locked" | "active";
    day?: GardenDay;
  }
  ```

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/client/zazen-world-geometry.test.ts
import { describe, expect, it } from "vitest";
import type { MapTile } from "../../../src/components/client/zazen-world-types";
import {
  TILE_FULL_WIDTH,
  applyDirectionOffset,
  calculateMapDimensions,
  directionFromDelta,
  manhattan,
  toScreen,
} from "../../../src/components/client/zazen-world-geometry";

const tile = (posX: number, posY: number): MapTile => ({
  decor: "",
  npc: 0,
  posX,
  posY,
  sprite: "sand-0",
  walkable: true,
});

describe("toScreen", () => {
  it("projects the origin to the offset-corrected origin", () => {
    expect(toScreen(0, 0, 0, 0)).toEqual({ left: 0, top: 0 });
  });

  it("moves one tile east by half a tile width and half a tile height", () => {
    expect(toScreen(1, 0, 0, 0)).toEqual({ left: 32, top: 16 });
  });

  it("interpolates fractional coordinates for the walk tween", () => {
    expect(toScreen(0.5, 0, 0, 0)).toEqual({ left: 16, top: 8 });
  });

  it("subtracts the map offsets", () => {
    expect(toScreen(1, 1, 10, 20)).toEqual({ left: -10, top: 12 });
  });
});

describe("calculateMapDimensions", () => {
  it("spans a single tile by exactly one tile box", () => {
    const dims = calculateMapDimensions([tile(1, 1)]);
    expect(dims.width).toBe(TILE_FULL_WIDTH);
    expect(dims.offsetX).toBe(0);
  });

  it("grows with the map", () => {
    const small = calculateMapDimensions([tile(1, 1), tile(2, 2)]);
    const large = calculateMapDimensions([tile(1, 1), tile(6, 6)]);
    expect(large.height).toBeGreaterThan(small.height);
  });
});

describe("applyDirectionOffset", () => {
  it("maps each direction to the documented axis change", () => {
    expect(applyDirectionOffset("N", 5, 5)).toEqual({ posX: 4, posY: 5 });
    expect(applyDirectionOffset("S", 5, 5)).toEqual({ posX: 6, posY: 5 });
    expect(applyDirectionOffset("E", 5, 5)).toEqual({ posX: 5, posY: 4 });
    expect(applyDirectionOffset("W", 5, 5)).toEqual({ posX: 5, posY: 6 });
  });
});

describe("directionFromDelta", () => {
  it("recognises the four adjacent tiles", () => {
    const from = { posX: 5, posY: 5 };
    expect(directionFromDelta(from, { posX: 4, posY: 5 })).toBe("N");
    expect(directionFromDelta(from, { posX: 6, posY: 5 })).toBe("S");
    expect(directionFromDelta(from, { posX: 5, posY: 4 })).toBe("E");
    expect(directionFromDelta(from, { posX: 5, posY: 6 })).toBe("W");
  });

  it("returns undefined for non-adjacent tiles", () => {
    expect(directionFromDelta({ posX: 5, posY: 5 }, { posX: 7, posY: 5 })).toBeUndefined();
    expect(directionFromDelta({ posX: 5, posY: 5 }, { posX: 6, posY: 6 })).toBeUndefined();
  });
});

describe("manhattan", () => {
  it("sums the axis distances", () => {
    expect(manhattan({ posX: 1, posY: 1 }, { posX: 4, posY: 3 })).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/zazen-world-geometry.test.ts`
Expected: FAIL — cannot resolve `zazen-world-geometry`

- [ ] **Step 3: Rewrite the types**

Replace the whole of `src/components/client/zazen-world-types.ts`:

```ts
import type { GardenDay } from "../../data/garden-schema";

interface Position {
  posX: number;
  posY: number;
}

interface MapTile extends Position {
  // Ground sprite basename, resolved to /images/zazen/sol/<sprite>.png
  sprite: string;
  // Explicit, so nothing has to infer passability from a filename.
  walkable: boolean;
  // "" or a decor sprite basename, resolved to /images/zazen/decors/<decor>.png
  decor: string;
  // Decorative NPCs only. The player is a separate layer and is not stored on tiles.
  npc: number;
  stone?: number;
  shrine?: "locked" | "active";
  day?: GardenDay;
}

type Direction = "N" | "E" | "S" | "W";

interface MoveResult {
  newMap: MapTile[];
  newPosition: Position;
}

interface HaikuEntry {
  stoneIndex: number;
  text: string;
  day?: GardenDay;
}

export type { Direction, HaikuEntry, MapTile, MoveResult, Position };
```

- [ ] **Step 4: Write the geometry module**

```ts
// src/components/client/zazen-world-geometry.ts
import type { Direction, MapTile, Position } from "./zazen-world-types";

// Frozen: a 64x32 diamond drawn inside a 64x64 cell. Every sprite is authored to this.
const TILE_HALF_WIDTH = 32;
const TILE_HALF_HEIGHT = 16;
const TILE_FULL_WIDTH = 64;
const TILE_FULL_HEIGHT_WITH_PADDING = 90;

// Fractional coordinates are legal: the walk tween interpolates between two tiles.
const toScreen = (
  posX: number,
  posY: number,
  offsetX: number,
  offsetY: number,
): { left: number; top: number } => ({
  left: (posX - posY) * TILE_HALF_WIDTH - offsetX,
  top: (posX + posY) * TILE_HALF_HEIGHT - offsetY,
});

const calculateMapDimensions = (
  map: readonly MapTile[],
): { height: number; width: number; offsetX: number; offsetY: number } => {
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let minY = Infinity;

  for (const tile of map) {
    const { left, top } = toScreen(tile.posX, tile.posY, 0, 0);
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, left);
    minY = Math.min(minY, top);
    maxY = Math.max(maxY, top);
  }

  return {
    height: maxY - minY + TILE_FULL_HEIGHT_WITH_PADDING,
    offsetX: minX,
    offsetY: minY,
    width: maxX - minX + TILE_FULL_WIDTH,
  };
};

const applyDirectionOffset = (direction: Direction, posX: number, posY: number): Position => {
  switch (direction) {
    case "N": {
      return { posX: posX - 1, posY };
    }
    case "S": {
      return { posX: posX + 1, posY };
    }
    case "E": {
      return { posX, posY: posY - 1 };
    }
    case "W": {
      return { posX, posY: posY + 1 };
    }
  }
};

const directionFromDelta = (from: Position, to: Position): Direction | undefined => {
  const dx = to.posX - from.posX;
  const dy = to.posY - from.posY;
  if (dx === -1 && dy === 0) {
    return "N";
  }
  if (dx === 1 && dy === 0) {
    return "S";
  }
  if (dx === 0 && dy === -1) {
    return "E";
  }
  if (dx === 0 && dy === 1) {
    return "W";
  }
  return undefined;
};

const manhattan = (a: Position, b: Position): number =>
  Math.abs(a.posX - b.posX) + Math.abs(a.posY - b.posY);

export {
  TILE_FULL_HEIGHT_WITH_PADDING,
  TILE_FULL_WIDTH,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  applyDirectionOffset,
  calculateMapDimensions,
  directionFromDelta,
  manhattan,
  toScreen,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/zazen-world-geometry.test.ts`
Expected: PASS, 11 tests

- [ ] **Step 6: Commit**

The rest of the app is still broken at this point — that is expected and resolved by Task 5. Commit the isolated, passing module.

```bash
git add src/components/client/zazen-world-geometry.ts src/components/client/zazen-world-types.ts tests/components/client/zazen-world-geometry.test.ts
git commit -m "refactor(path): extract iso geometry and make walkability explicit"
```

---

### Task 4: Split out movement rules

**Files:**
- Create: `src/components/client/zazen-world-rules.ts`
- Test: `tests/components/client/zazen-world-rules.test.ts`

**Interfaces:**
- Consumes: `applyDirectionOffset` from `zazen-world-geometry`; `MapTile`, `Direction`, `MoveResult`, `Position` from `zazen-world-types`
- Produces:
  - `isWalkableTile(tile: MapTile): boolean`
  - `tileAt(map: readonly MapTile[], position: Position): MapTile | undefined`
  - `performMove(direction: Direction, from: Position, map: readonly MapTile[]): MoveResult | undefined` — returns `undefined` when blocked. Unlike the old version it no longer mutates `perso` on tiles; the map is returned unchanged and only `newPosition` matters to the caller.
  - `collectStoneAt(map: readonly MapTile[], stoneIndex: number): MapTile[]`
  - `activateShrine(map: readonly MapTile[], shrine: Position): MapTile[]`
  - `handleKeyDirection(ev: KeyboardEvent, move: (dir: Direction) => void): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/client/zazen-world-rules.test.ts
import { describe, expect, it, vi } from "vitest";
import type { MapTile } from "../../../src/components/client/zazen-world-types";
import {
  activateShrine,
  collectStoneAt,
  handleKeyDirection,
  isWalkableTile,
  performMove,
  tileAt,
} from "../../../src/components/client/zazen-world-rules";

const tile = (posX: number, posY: number, over: Partial<MapTile> = {}): MapTile => ({
  decor: "",
  npc: 0,
  posX,
  posY,
  sprite: "sand-0",
  walkable: true,
  ...over,
});

const grid = (): MapTile[] => [
  tile(1, 1),
  tile(1, 2),
  tile(2, 1, { sprite: "water-still", walkable: false }),
  tile(2, 2, { decor: "pine" }),
];

describe("isWalkableTile", () => {
  it("accepts plain ground", () => {
    expect(isWalkableTile(tile(1, 1))).toBe(true);
  });

  it("rejects unwalkable ground", () => {
    expect(isWalkableTile(tile(1, 1, { walkable: false }))).toBe(false);
  });

  it("rejects a tile occupied by an npc", () => {
    expect(isWalkableTile(tile(1, 1, { npc: 2 }))).toBe(false);
  });

  it("rejects a tile blocked by decor but allows a stone marker", () => {
    expect(isWalkableTile(tile(1, 1, { decor: "pine" }))).toBe(false);
    expect(isWalkableTile(tile(1, 1, { decor: "stone-marker", stone: 0 }))).toBe(true);
  });
});

describe("tileAt", () => {
  it("finds a tile by position", () => {
    expect(tileAt(grid(), { posX: 1, posY: 2 })?.posY).toBe(2);
  });

  it("returns undefined off the map", () => {
    expect(tileAt(grid(), { posX: 9, posY: 9 })).toBeUndefined();
  });
});

describe("performMove", () => {
  it("moves west onto walkable ground", () => {
    const result = performMove("W", { posX: 1, posY: 1 }, grid());
    expect(result?.newPosition).toEqual({ posX: 1, posY: 2 });
  });

  it("refuses to move onto water", () => {
    expect(performMove("S", { posX: 1, posY: 1 }, grid())).toBeUndefined();
  });

  it("refuses to move off the map", () => {
    expect(performMove("N", { posX: 1, posY: 1 }, grid())).toBeUndefined();
  });

  it("refuses to move onto blocking decor", () => {
    expect(performMove("S", { posX: 1, posY: 2 }, grid())).toBeUndefined();
  });
});

describe("collectStoneAt", () => {
  it("clears the marker and the stone index", () => {
    const map = [tile(3, 3, { decor: "stone-marker", stone: 2 })];
    const next = collectStoneAt(map, 2);
    expect(next[0].decor).toBe("");
    expect(next[0].stone).toBeUndefined();
  });

  it("leaves other stones alone", () => {
    const map = [tile(3, 3, { decor: "stone-marker", stone: 1 })];
    expect(collectStoneAt(map, 2)[0].stone).toBe(1);
  });
});

describe("activateShrine", () => {
  it("switches the shrine sprite and state", () => {
    const map = [tile(4, 4, { shrine: "locked", sprite: "shrine-locked" })];
    const next = activateShrine(map, { posX: 4, posY: 4 });
    expect(next[0].shrine).toBe("active");
    expect(next[0].sprite).toBe("shrine-active");
  });
});

describe("handleKeyDirection", () => {
  it("maps wasd and arrows to directions", () => {
    const cases: [string, string][] = [
      ["w", "N"], ["ArrowUp", "N"],
      ["s", "S"], ["ArrowDown", "S"],
      ["a", "W"], ["ArrowLeft", "W"],
      ["d", "E"], ["ArrowRight", "E"],
    ];
    for (const [key, direction] of cases) {
      const move = vi.fn();
      const preventDefault = vi.fn();
      handleKeyDirection({ key, preventDefault } as unknown as KeyboardEvent, move);
      expect(move).toHaveBeenCalledWith(direction);
      expect(preventDefault).toHaveBeenCalled();
    }
  });

  it("ignores unrelated keys", () => {
    const move = vi.fn();
    handleKeyDirection(
      { key: "q", preventDefault: vi.fn() } as unknown as KeyboardEvent,
      move,
    );
    expect(move).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/zazen-world-rules.test.ts`
Expected: FAIL — cannot resolve `zazen-world-rules`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/client/zazen-world-rules.ts
import type { Direction, MapTile, MoveResult, Position } from "./zazen-world-types";
import { applyDirectionOffset } from "./zazen-world-geometry";

const STONE_DECOR = "stone-marker";
const SHRINE_SPRITE_ACTIVE = "shrine-active";

// A stone marker sits on walkable ground — you step onto it to gather it. Everything
// else in the decor layer blocks.
const isWalkableTile = (tile: MapTile): boolean =>
  tile.walkable && tile.npc === 0 && (tile.decor === "" || tile.decor === STONE_DECOR);

const tileAt = (map: readonly MapTile[], position: Position): MapTile | undefined =>
  map.find((tile) => tile.posX === position.posX && tile.posY === position.posY);

const performMove = (
  direction: Direction,
  from: Position,
  map: readonly MapTile[],
): MoveResult | undefined => {
  const next = applyDirectionOffset(direction, from.posX, from.posY);
  const target = tileAt(map, next);
  if (!target || !isWalkableTile(target)) {
    return undefined;
  }
  return { newMap: [...map], newPosition: next };
};

const collectStoneAt = (map: readonly MapTile[], stoneIndex: number): MapTile[] =>
  map.map((tile) => {
    if (tile.stone !== stoneIndex) {
      return tile;
    }
    const next: MapTile = { ...tile, decor: "" };
    delete next.stone;
    return next;
  });

const activateShrine = (map: readonly MapTile[], shrine: Position): MapTile[] =>
  map.map((tile) =>
    tile.posX === shrine.posX && tile.posY === shrine.posY
      ? { ...tile, shrine: "active", sprite: SHRINE_SPRITE_ACTIVE }
      : tile,
  );

const KEY_DIRECTIONS: Record<string, Direction> = {
  arrowdown: "S",
  arrowleft: "W",
  arrowright: "E",
  arrowup: "N",
  a: "W",
  d: "E",
  s: "S",
  w: "N",
};

const handleKeyDirection = (ev: KeyboardEvent, move: (dir: Direction) => void): void => {
  const direction = KEY_DIRECTIONS[ev.key.toLowerCase()];
  if (!direction) {
    return;
  }
  ev.preventDefault();
  move(direction);
};

export {
  STONE_DECOR,
  activateShrine,
  collectStoneAt,
  handleKeyDirection,
  isWalkableTile,
  performMove,
  tileAt,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/zazen-world-rules.test.ts`
Expected: PASS, 14 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/client/zazen-world-rules.ts tests/components/client/zazen-world-rules.test.ts
git commit -m "refactor(path): extract movement rules into their own module"
```

---

### Task 5: Terrain generation from a seed

The heart of the plan. Turns a `GardenSeed` into a board, and guarantees the board is winnable no matter what the data says.

**Files:**
- Create: `src/components/client/zazen-world-terrain.ts`
- Delete: `src/components/client/zazen-world-helpers.ts`
- Rewrite: `tests/components/client/zazen-world-helpers.test.ts` → `tests/components/client/zazen-world-terrain.test.ts`
- Test: `tests/components/client/zazen-world-terrain.test.ts`

**Interfaces:**
- Consumes: `createRng`, `hashString` from `zazen-rng`; `DATA_COLS`, `DATA_ROWS`, `DATA_TILES`, `GRID_SIZE`, `STONE_COUNT`, `GardenSeed`, `GardenDay` from `src/data/garden-schema`; `isWalkableTile`, `STONE_DECOR` from `zazen-world-rules`; `manhattan` from `zazen-world-geometry`
- Produces:
  - `dayIndexToCell(index: number): { col: number; row: number }` — boustrophedon
  - `cellToPosition(col: number, row: number): Position` — inner field is offset by the 1-tile authored border
  - `groundForCount(count: number): string` — sprite basename
  - `interface GardenLayout { map: MapTile[]; start: Position; stones: readonly Position[]; shrine: Position }`
  - `buildGarden(seed: GardenSeed): GardenLayout`
  - `HAIKU_LINES: readonly string[]` — the five lines, moved here from the old `STONES` constant

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/client/zazen-world-terrain.test.ts
import { describe, expect, it } from "vitest";
import type { GardenDay, GardenSeed } from "../../../src/data/garden-schema";
import { DATA_TILES, FALLBACK_SEED, STONE_COUNT } from "../../../src/data/garden-schema";
import type { MapTile, Position } from "../../../src/components/client/zazen-world-types";
import { isWalkableTile } from "../../../src/components/client/zazen-world-rules";
import {
  HAIKU_LINES,
  buildGarden,
  cellToPosition,
  dayIndexToCell,
  groundForCount,
} from "../../../src/components/client/zazen-world-terrain";

const seedWith = (counts: readonly number[]): GardenSeed => ({
  days: Array.from({ length: DATA_TILES }, (_unused, index): GardenDay | null =>
    counts[index] === undefined
      ? null
      : { count: counts[index], date: `2026-01-01`, language: "TypeScript", repo: "zazen-code" },
  ),
  generatedAt: "2026-09-05T00:00:00.000Z",
  login: "test",
  totalContributions: counts.reduce((sum, count) => sum + count, 0),
});

const reachableFrom = (map: readonly MapTile[], start: Position): Set<string> => {
  const key = (p: Position) => `${p.posX},${p.posY}`;
  const byKey = new Map(map.map((tile) => [key(tile), tile]));
  const seen = new Set<string>([key(start)]);
  const queue: Position[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as Position;
    const neighbours: Position[] = [
      { posX: current.posX - 1, posY: current.posY },
      { posX: current.posX + 1, posY: current.posY },
      { posX: current.posX, posY: current.posY - 1 },
      { posX: current.posX, posY: current.posY + 1 },
    ];
    for (const next of neighbours) {
      const id = key(next);
      const tile = byKey.get(id);
      if (!tile || seen.has(id) || !isWalkableTile(tile)) {
        continue;
      }
      seen.add(id);
      queue.push(next);
    }
  }
  return seen;
};

describe("dayIndexToCell", () => {
  it("runs the first row left to right", () => {
    expect(dayIndexToCell(0)).toEqual({ col: 0, row: 0 });
    expect(dayIndexToCell(9)).toEqual({ col: 9, row: 0 });
  });

  it("runs the second row right to left, so consecutive days stay adjacent", () => {
    expect(dayIndexToCell(10)).toEqual({ col: 9, row: 1 });
    expect(dayIndexToCell(19)).toEqual({ col: 0, row: 1 });
  });

  it("keeps every consecutive pair of days orthogonally adjacent", () => {
    for (let index = 0; index < DATA_TILES - 1; index++) {
      const a = dayIndexToCell(index);
      const b = dayIndexToCell(index + 1);
      const distance = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
      expect(distance).toBe(1);
    }
  });
});

describe("cellToPosition", () => {
  it("offsets the data field inside the authored border", () => {
    expect(cellToPosition(0, 0)).toEqual({ posX: 1, posY: 1 });
    expect(cellToPosition(9, 9)).toEqual({ posX: 10, posY: 10 });
  });
});

describe("groundForCount", () => {
  it("reads a quiet day as raked sand, never water", () => {
    expect(groundForCount(0)).toBe("sand-0");
  });

  it("climbs the moss ramp with activity", () => {
    expect(groundForCount(2)).toBe("sand-moss");
    expect(groundForCount(6)).toBe("moss-mid");
    expect(groundForCount(20)).toBe("moss-deep");
  });
});

describe("buildGarden", () => {
  it("is deterministic for the same seed", () => {
    expect(buildGarden(FALLBACK_SEED).map).toEqual(buildGarden(FALLBACK_SEED).map);
  });

  it("places exactly five stones", () => {
    expect(buildGarden(FALLBACK_SEED).stones).toHaveLength(STONE_COUNT);
  });

  it("has one haiku line per stone", () => {
    expect(HAIKU_LINES).toHaveLength(STONE_COUNT);
  });

  it("spreads stones at least three tiles apart", () => {
    const { stones } = buildGarden(FALLBACK_SEED);
    for (let i = 0; i < stones.length; i++) {
      for (let j = i + 1; j < stones.length; j++) {
        const distance =
          Math.abs(stones[i].posX - stones[j].posX) + Math.abs(stones[i].posY - stones[j].posY);
        expect(distance).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("places the shrine on the newest day", () => {
    const { shrine, map } = buildGarden(FALLBACK_SEED);
    const tile = map.find((t) => t.posX === shrine.posX && t.posY === shrine.posY);
    expect(tile?.shrine).toBe("locked");
  });

  it("never turns a zero-commit day into water", () => {
    const { map } = buildGarden(seedWith(Array.from({ length: DATA_TILES }, () => 0)));
    const inner = map.filter(
      (t) => t.posX >= 1 && t.posX <= 10 && t.posY >= 1 && t.posY <= 10,
    );
    expect(inner.every((t) => !t.sprite.startsWith("water"))).toBe(true);
  });

  it("still places five stones when the history is empty", () => {
    const empty = seedWith([]);
    expect(buildGarden(empty).stones).toHaveLength(STONE_COUNT);
  });

  it("still places five stones when only one day has commits", () => {
    const counts = Array.from({ length: DATA_TILES }, () => 0);
    counts[42] = 9;
    expect(buildGarden(seedWith(counts)).stones).toHaveLength(STONE_COUNT);
  });

  it("keeps every stone and the shrine reachable, for many shapes of history", () => {
    const shapes: readonly (readonly number[])[] = [
      Array.from({ length: DATA_TILES }, () => 0),
      Array.from({ length: DATA_TILES }, () => 30),
      Array.from({ length: DATA_TILES }, (_u, i) => (i % 7 === 0 ? 15 : 0)),
      Array.from({ length: DATA_TILES }, (_u, i) => (i < 50 ? 0 : 12)),
      Array.from({ length: DATA_TILES }, (_u, i) => (i % 2 === 0 ? 1 : 0)),
      [],
    ];
    for (const counts of shapes) {
      const { map, start, stones, shrine } = buildGarden(seedWith(counts));
      const seen = reachableFrom(map, start);
      for (const stone of stones) {
        expect(seen.has(`${stone.posX},${stone.posY}`)).toBe(true);
      }
      expect(seen.has(`${shrine.posX},${shrine.posY}`)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/zazen-world-terrain.test.ts`
Expected: FAIL — cannot resolve `zazen-world-terrain`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/client/zazen-world-terrain.ts
import type { GardenDay, GardenSeed } from "../../data/garden-schema";
import { DATA_COLS, DATA_ROWS, DATA_TILES, GRID_SIZE, STONE_COUNT } from "../../data/garden-schema";
import type { MapTile, Position } from "./zazen-world-types";
import { STONE_DECOR, isWalkableTile } from "./zazen-world-rules";
import { createRng, hashString } from "./zazen-rng";
import { manhattan } from "./zazen-world-geometry";

const BORDER = 1;
const MIN_STONE_SEPARATION = 3;
const PLANT_CHANCE = 0.55;
const BORDER_DECOR_CHANCE = 0.45;

const HAIKU_LINES: readonly string[] = [
  "A path of stones —",
  "each one a breath held still",
  "between the pine and pond.",
  "Evening light remembers",
  "the river's oldest vow.",
];

// Each language gets its own species, so the planting is legible rather than decorative.
const PLANT_BY_LANGUAGE: Record<string, string> = {
  Astro: "reed",
  JavaScript: "maple",
  PHP: "pine",
  Python: "bamboo-b",
  Rust: "rock-mound",
  TypeScript: "bamboo-a",
  Vue: "maple",
};
const DEFAULT_PLANT = "reed";

// Boustrophedon: rows alternate direction so consecutive days are always adjacent, which
// makes a commit streak render as one unbroken mossy trail. Row-major would break that
// adjacency at every row wrap.
const dayIndexToCell = (index: number): { col: number; row: number } => {
  const row = Math.floor(index / DATA_COLS);
  const withinRow = index % DATA_COLS;
  return { col: row % 2 === 0 ? withinRow : DATA_COLS - 1 - withinRow, row };
};

const cellToPosition = (col: number, row: number): Position => ({
  posX: col + BORDER,
  posY: row + BORDER,
});

const groundForCount = (count: number): string => {
  if (count <= 0) {
    return "sand-0";
  }
  if (count <= 3) {
    return "sand-moss";
  }
  if (count <= 8) {
    return "moss-mid";
  }
  return "moss-deep";
};

const isInnerCell = (posX: number, posY: number): boolean =>
  posX >= BORDER && posX < BORDER + DATA_COLS && posY >= BORDER && posY < BORDER + DATA_ROWS;

// The outer ring is authored landscape, not data: it frames the garden, holds the pond,
// and keeps the data field away from the map edge.
const buildBorderTile = (posX: number, posY: number, rng: () => number): MapTile => {
  const isPondSide = posY >= GRID_SIZE - 2;
  if (isPondSide) {
    return { decor: "", npc: 0, posX, posY, sprite: "water-still", walkable: false };
  }
  const decorate = rng() < BORDER_DECOR_CHANCE;
  const options = ["pine", "rock-small", "reed", "maple"];
  return {
    decor: decorate ? options[Math.floor(rng() * options.length)] : "",
    npc: 0,
    posX,
    posY,
    sprite: rng() < 0.5 ? "gravel-edge" : "sand-1",
    walkable: true,
  };
};

const buildDataTile = (day: GardenDay | null, position: Position, rng: () => number): MapTile => {
  const count = day?.count ?? 0;
  const sprite = groundForCount(count);
  const plant =
    count >= 9 && rng() < PLANT_CHANCE
      ? (PLANT_BY_LANGUAGE[day?.language ?? ""] ?? DEFAULT_PLANT)
      : "";
  const tile: MapTile = {
    decor: plant,
    npc: 0,
    posX: position.posX,
    posY: position.posY,
    sprite,
    walkable: true,
  };
  if (day) {
    tile.day = day;
  }
  return tile;
};

// Greedy pick of the busiest days, spread out so the five stones do not clump. Top-up
// passes guarantee exactly STONE_COUNT stones even for an empty history — the haiku has
// five lines and the game loop depends on that count.
const pickStoneIndices = (days: readonly (GardenDay | null)[]): number[] => {
  const ranked = days
    .map((day, index) => ({ count: day?.count ?? 0, index }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index);

  const chosen: number[] = [];
  const accepts = (index: number, separation: number): boolean => {
    const candidate = cellToPosition(dayIndexToCell(index).col, dayIndexToCell(index).row);
    return chosen.every((other) => {
      const cell = dayIndexToCell(other);
      return manhattan(candidate, cellToPosition(cell.col, cell.row)) >= separation;
    });
  };

  for (const entry of ranked) {
    if (chosen.length === STONE_COUNT) {
      break;
    }
    if (accepts(entry.index, MIN_STONE_SEPARATION)) {
      chosen.push(entry.index);
    }
  }

  // Not enough busy days: fill from a fixed sweep of the field, then relax the spacing.
  for (const separation of [MIN_STONE_SEPARATION, 1]) {
    for (let index = 0; index < DATA_TILES && chosen.length < STONE_COUNT; index++) {
      if (!chosen.includes(index) && accepts(index, separation)) {
        chosen.push(index);
      }
    }
  }

  return chosen.slice(0, STONE_COUNT);
};

const positionKey = (position: Position): string => `${position.posX},${position.posY}`;

const neighboursOf = (position: Position): Position[] => [
  { posX: position.posX - 1, posY: position.posY },
  { posX: position.posX + 1, posY: position.posY },
  { posX: position.posX, posY: position.posY - 1 },
  { posX: position.posX, posY: position.posY + 1 },
];

const reachableSet = (map: readonly MapTile[], start: Position): Set<string> => {
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const seen = new Set<string>([positionKey(start)]);
  const queue: Position[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as Position;
    for (const next of neighboursOf(current)) {
      const key = positionKey(next);
      const tile = byKey.get(key);
      if (!tile || seen.has(key) || !isWalkableTile(tile)) {
        continue;
      }
      seen.add(key);
      queue.push(next);
    }
  }
  return seen;
};

// Data decides how the garden LOOKS; this decides that it can still be WALKED. Without
// it a quiet fortnight could wall a stone off and the game would be silently unwinnable.
const carvePathTo = (map: MapTile[], start: Position, target: Position): void => {
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const parents = new Map<string, string>();
  const seen = new Set<string>([positionKey(start)]);
  const queue: Position[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    if (positionKey(current) === positionKey(target)) {
      break;
    }
    for (const next of neighboursOf(current)) {
      const key = positionKey(next);
      if (seen.has(key) || !byKey.has(key)) {
        continue;
      }
      seen.add(key);
      parents.set(key, positionKey(current));
      queue.push(next);
    }
  }

  let cursor: string | undefined = positionKey(target);
  while (cursor !== undefined && cursor !== positionKey(start)) {
    const tile = byKey.get(cursor);
    if (tile && !isWalkableTile(tile)) {
      tile.walkable = true;
      tile.npc = 0;
      if (tile.decor !== STONE_DECOR) {
        tile.decor = "";
      }
      if (tile.sprite.startsWith("water")) {
        tile.sprite = "sand-0";
      }
    }
    cursor = parents.get(cursor);
  }
};

interface GardenLayout {
  map: MapTile[];
  start: Position;
  stones: readonly Position[];
  shrine: Position;
}

const buildGarden = (seed: GardenSeed): GardenLayout => {
  const rng = createRng(hashString(`${seed.login}:${seed.generatedAt}:${seed.totalContributions}`));
  const map: MapTile[] = [];

  for (let posX = 0; posX < GRID_SIZE; posX++) {
    for (let posY = 0; posY < GRID_SIZE; posY++) {
      map.push(
        isInnerCell(posX, posY)
          ? buildDataTile(
              seed.days[(posY - BORDER) * DATA_COLS + (posX - BORDER)] ?? null,
              { posX, posY },
              rng,
            )
          : buildBorderTile(posX, posY, rng),
      );
    }
  }

  // Data tiles are addressed by day index, so re-key them through the boustrophedon map.
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  for (let index = 0; index < DATA_TILES; index++) {
    const { col, row } = dayIndexToCell(index);
    const position = cellToPosition(col, row);
    const tile = byKey.get(positionKey(position));
    if (!tile) {
      continue;
    }
    const rebuilt = buildDataTile(seed.days[index] ?? null, position, rng);
    Object.assign(tile, rebuilt);
  }

  const stoneIndices = pickStoneIndices(seed.days);
  const stones: Position[] = [];
  stoneIndices.forEach((dayIndex, stoneIndex) => {
    const { col, row } = dayIndexToCell(dayIndex);
    const position = cellToPosition(col, row);
    const tile = byKey.get(positionKey(position));
    if (!tile) {
      return;
    }
    tile.decor = STONE_DECOR;
    tile.stone = stoneIndex;
    tile.walkable = true;
    stones.push(position);
  });

  const lastCell = dayIndexToCell(DATA_TILES - 1);
  const shrine = cellToPosition(lastCell.col, lastCell.row);
  const shrineTile = byKey.get(positionKey(shrine));
  if (shrineTile) {
    shrineTile.decor = "";
    shrineTile.shrine = "locked";
    shrineTile.sprite = "shrine-locked";
    shrineTile.walkable = true;
  }

  const firstCell = dayIndexToCell(0);
  const start = cellToPosition(firstCell.col, firstCell.row);
  const startTile = byKey.get(positionKey(start));
  if (startTile) {
    startTile.decor = "";
    startTile.walkable = true;
  }

  const reached = reachableSet(map, start);
  for (const target of [...stones, shrine]) {
    if (!reached.has(positionKey(target))) {
      carvePathTo(map, start, target);
    }
  }

  return { map, shrine, start, stones };
};

export type { GardenLayout };
export {
  HAIKU_LINES,
  buildGarden,
  cellToPosition,
  dayIndexToCell,
  groundForCount,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/zazen-world-terrain.test.ts`
Expected: PASS, 14 tests. If the reachability property test fails for a shape, the bug is in `carvePathTo` — fix the carve, never the assertion.

- [ ] **Step 5: Delete the old helpers module and its test**

```bash
git rm src/components/client/zazen-world-helpers.ts tests/components/client/zazen-world-helpers.test.ts
```

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: `zazen-world.test.tsx` FAILS — it still renders the old component. Task 7 fixes it. Every other file passes.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/client tests/components/client
git commit -m "feat(path): generate terrain from a garden seed with reachability repair"
```

---

### Task 6: Pixel art generator

**Files:**
- Create: `scripts/zazen-art/palette.mjs`
- Create: `scripts/zazen-art/sprites.mjs`
- Create: `scripts/generate-zazen-art.mjs`
- Modify: `package.json`
- Delete: `public/images/zazen/**/*.gif`
- Test: `tests/scripts/zazen-art.test.ts`

**Interfaces:**
- Consumes: `sharp` (already a devDependency)
- Produces: `PALETTE` (17 entries keyed by single characters), `SPRITES` (name → `{ width, height, rows }`), and `pnpm run generate:art` writing PNGs to `public/images/zazen/{sol,decors,persos,fx}/`

**Sprite inventory** — every name here is referenced by `zazen-world-terrain.ts` or the renderer, so all must exist:

- `sol/`: `sand-0`, `sand-1`, `sand-moss`, `moss-mid`, `moss-deep`, `water-still` (4 frames stacked vertically, 64×256), `stone-slab`, `gravel-edge`, `bridge-plank`, `shrine-locked`, `shrine-active`
- `decors/`: `pine`, `maple`, `bamboo-a`, `bamboo-b`, `reed`, `rock-small`, `rock-mound`, `lantern-lit`, `lantern-unlit`, `torii`, `post`, `stone-marker`, `stone-marker-lit`
- `persos/`: `pilgrim` (one sheet, 4 facings × 3 frames, 24×40 cells → 72×160), `npc-2`, `npc-3`
- `fx/`: `dust-puff` (3 frames), `ripple` (3 frames)

- [ ] **Step 1: Write the failing test**

```ts
// tests/scripts/zazen-art.test.ts
import { describe, expect, it } from "vitest";
import { PALETTE } from "../../scripts/zazen-art/palette.mjs";
import { SPRITES } from "../../scripts/zazen-art/sprites.mjs";

const ALLOWED = new Set([
  "#f2ece0", "#e6dccb", "#d4c7b2",
  "#a8b295", "#8b9a78", "#6d7d5c",
  "#d8d3cf", "#bcb8bc", "#9a97a2",
  "#cdbfba", "#a8968f", "#7d6c68",
  "#c2566e", "#9b3f56", "#6e2b3e",
  "#4a4038", "#2e2721",
]);

const REQUIRED = [
  "sand-0", "sand-1", "sand-moss", "moss-mid", "moss-deep", "water-still",
  "stone-slab", "gravel-edge", "bridge-plank", "shrine-locked", "shrine-active",
  "pine", "maple", "bamboo-a", "bamboo-b", "reed", "rock-small", "rock-mound",
  "lantern-lit", "lantern-unlit", "torii", "post", "stone-marker", "stone-marker-lit",
  "pilgrim", "npc-2", "npc-3", "dust-puff", "ripple",
];

describe("palette", () => {
  it("uses only the seventeen approved colours", () => {
    for (const value of Object.values(PALETTE)) {
      if (value !== null) {
        expect(ALLOWED.has(value)).toBe(true);
      }
    }
  });

  it("reserves one key for transparency", () => {
    expect(PALETTE["."]).toBeNull();
  });
});

describe("sprites", () => {
  it("defines every sprite the game references", () => {
    for (const name of REQUIRED) {
      expect(SPRITES[name], `missing sprite: ${name}`).toBeDefined();
    }
  });

  it("has rows matching the declared height and width", () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      expect(sprite.rows, `${name} row count`).toHaveLength(sprite.height);
      for (const row of sprite.rows) {
        expect(row, `${name} row width`).toHaveLength(sprite.width);
      }
    }
  });

  it("uses only characters defined in the palette", () => {
    for (const [name, sprite] of Object.entries(SPRITES)) {
      for (const row of sprite.rows) {
        for (const char of row) {
          expect(Object.hasOwn(PALETTE, char), `${name} uses undefined char "${char}"`).toBe(true);
        }
      }
    }
  });

  it("draws ground tiles on the frozen 64x64 cell", () => {
    for (const name of ["sand-0", "sand-1", "sand-moss", "moss-mid", "moss-deep"]) {
      expect(SPRITES[name].width).toBe(64);
      expect(SPRITES[name].height).toBe(64);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/scripts/zazen-art.test.ts`
Expected: FAIL — cannot resolve `scripts/zazen-art/palette.mjs`

- [ ] **Step 3: Write the palette**

```js
// scripts/zazen-art/palette.mjs
// The seventeen approved values, and nothing else. Rose is reserved for stones, the
// shrine and sakura — it marks progress, so it must not leak into scenery.
export const PALETTE = {
  ".": null,
  a: "#f2ece0", // sand light
  b: "#e6dccb", // sand mid
  c: "#d4c7b2", // sand dark
  d: "#a8b295", // moss light
  e: "#8b9a78", // moss mid
  f: "#6d7d5c", // moss dark
  g: "#d8d3cf", // water light
  h: "#bcb8bc", // water mid
  i: "#9a97a2", // water dark
  j: "#cdbfba", // stone light
  k: "#a8968f", // stone mid
  l: "#7d6c68", // stone dark
  m: "#c2566e", // rose light
  n: "#9b3f56", // rose mid
  o: "#6e2b3e", // rose dark
  p: "#4a4038", // ink light
  q: "#2e2721", // ink dark
};
```

- [ ] **Step 4: Write the sprite maps**

Create `scripts/zazen-art/sprites.mjs` exporting `SPRITES` — a plain object of
`{ width, height, rows: string[] }`. Author every sprite listed in the inventory above.

Two rules make or break this file; the test in Step 1 enforces the mechanical ones, but
these two are on the author:

1. **The 2:1 slope.** A ground diamond's edge advances exactly 2 columns per row. Row `r`
   of the top face spans columns `32 - 2*(r+1)` through `32 + 2*(r+1)` for `r` in `0..15`,
   then mirrors for `r` in `16..31`. Any other slope reads as broken isometry immediately.
2. **One light direction.** Top-left. On every ground tile the upper-left half of the top
   face uses the *light* ramp entry and the lower-right the *mid*; the 32px skirt below the
   diamond uses the *dark* entry. Every decor sprite is lit the same way.

Build the diamond programmatically rather than by hand — hand-typing 64 rows of 64
characters is where slope errors come from:

```js
// scripts/zazen-art/sprites.mjs
import { PALETTE } from "./palette.mjs";

const CELL = 64;
const DIAMOND_HEIGHT = 32;

// Emits the 64x64 ground cell: a 64x32 diamond top face plus a 32px skirt.
const groundTile = (light, mid, dark, speckle = null, speckleRate = 0) => {
  const rows = [];
  let noise = 1;
  const next = () => {
    noise = (noise * 1103515245 + 12345) % 2147483648;
    return noise / 2147483648;
  };
  for (let y = 0; y < CELL; y++) {
    let row = "";
    for (let x = 0; x < CELL; x++) {
      const half = y < DIAMOND_HEIGHT / 2 ? (y + 1) * 2 : (DIAMOND_HEIGHT - y) * 2;
      const inTop = y < DIAMOND_HEIGHT && Math.abs(x - 32) < half;
      const skirtHalf = Math.max(0, (DIAMOND_HEIGHT - (y - DIAMOND_HEIGHT)) * 2);
      const inSkirt = y >= DIAMOND_HEIGHT && Math.abs(x - 32) < skirtHalf;
      if (inTop) {
        const lit = x - 32 < 16 - y;
        row += speckle && next() < speckleRate ? speckle : lit ? light : mid;
      } else if (inSkirt) {
        row += dark;
      } else {
        row += ".";
      }
    }
    rows.push(row);
  }
  return { height: CELL, rows, width: CELL };
};

export const SPRITES = {
  "sand-0": groundTile("a", "b", "c"),
  "sand-1": groundTile("a", "b", "c", "c", 0.06),
  "sand-moss": groundTile("a", "b", "c", "d", 0.22),
  "moss-mid": groundTile("d", "e", "f"),
  "moss-deep": groundTile("e", "f", "f", "f", 0.3),
  "gravel-edge": groundTile("b", "c", "l", "k", 0.18),
  "stone-slab": groundTile("j", "k", "l"),
  // ...remaining sprites, authored the same way
};
```

Verify the emitted diamond visually before moving on — `groundTile` is the one function in
this plan whose output cannot be judged from its source.

- [ ] **Step 5: Write the generator**

```js
// scripts/generate-zazen-art.mjs
// Pixel maps in source -> PNGs in public/. Art is reviewable in git diffs and the whole
// set can be re-emitted after a palette change.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PALETTE } from "./zazen-art/palette.mjs";
import { SPRITES } from "./zazen-art/sprites.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "public/images/zazen");

const FOLDERS = {
  decors: ["pine", "maple", "bamboo-a", "bamboo-b", "reed", "rock-small", "rock-mound",
    "lantern-lit", "lantern-unlit", "torii", "post", "stone-marker", "stone-marker-lit"],
  fx: ["dust-puff", "ripple"],
  persos: ["pilgrim", "npc-2", "npc-3"],
  sol: ["sand-0", "sand-1", "sand-moss", "moss-mid", "moss-deep", "water-still",
    "stone-slab", "gravel-edge", "bridge-plank", "shrine-locked", "shrine-active"],
};

const hexToRgba = (hex) =>
  hex === null
    ? [0, 0, 0, 0]
    : [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
        255,
      ];

const toBuffer = ({ width, height, rows }) => {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const char = rows[y][x];
      if (!Object.hasOwn(PALETTE, char)) {
        throw new Error(`Undefined palette char "${char}" at ${x},${y}`);
      }
      const [r, g, b, a] = hexToRgba(PALETTE[char]);
      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return data;
};

let written = 0;
for (const [folder, names] of Object.entries(FOLDERS)) {
  mkdirSync(join(outRoot, folder), { recursive: true });
  for (const name of names) {
    const sprite = SPRITES[name];
    if (!sprite) {
      throw new Error(`Missing sprite definition: ${name}`);
    }
    const png = await sharp(toBuffer(sprite), {
      raw: { channels: 4, height: sprite.height, width: sprite.width },
    })
      // No resampling, ever: these are authored at 1x and displayed at integer scale.
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    writeFileSync(join(outRoot, folder, `${name}.png`), png);
    written += 1;
  }
}

console.log(`generate-zazen-art: wrote ${written} sprites to ${outRoot}`);
```

- [ ] **Step 6: Register the script**

Add to `package.json` scripts, after `optimize:images:dry`:

```json
"generate:art": "node scripts/generate-zazen-art.mjs"
```

- [ ] **Step 7: Generate and verify**

```bash
pnpm run generate:art
pnpm vitest run tests/scripts/zazen-art.test.ts
```

Expected: the script reports the sprite count; tests PASS. Open two or three PNGs and confirm the diamond slope and the light direction before continuing.

- [ ] **Step 8: Delete the borrowed GIFs and commit**

```bash
git rm public/images/zazen/sol/*.gif public/images/zazen/decors/*.gif public/images/zazen/persos/*.gif
git add scripts/zazen-art scripts/generate-zazen-art.mjs package.json public/images/zazen tests/scripts/zazen-art.test.ts
git commit -m "feat(path): generate original pixel art in the site palette"
```

---

### Task 7: Rewire the game hook to the seed

**Files:**
- Modify: `src/components/client/use-zazen-game.ts`
- Test: `tests/components/client/use-zazen-game.test.tsx`

**Interfaces:**
- Consumes: `buildGarden`, `HAIKU_LINES` from `zazen-world-terrain`; `performMove`, `collectStoneAt`, `activateShrine`, `tileAt` from `zazen-world-rules`; `GardenSeed`, `FALLBACK_SEED`, `STONE_COUNT` from `src/data/garden-schema`
- Produces: `useZazenGame(options: { seed?: GardenSeed; onStoneCollected?: (i: number) => void; onShrineActivated?: () => void; onFinaleOpened?: () => void }): ZazenGameState` where `ZazenGameState` now exposes `position: Position` as explicit state (the `findPlayer` map scan is gone) plus `map`, `mapDimensions`, `stonesFound`, `shrineActivated`, `finaleOpen`, `haikuLines`, `announcement`, `move`, `dismissFinale`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/client/use-zazen-game.test.tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FALLBACK_SEED, STONE_COUNT } from "../../../src/data/garden-schema";
import { buildGarden } from "../../../src/components/client/zazen-world-terrain";
import useZazenGame from "../../../src/components/client/use-zazen-game";

describe("useZazenGame", () => {
  it("starts the pilgrim on the seed's start tile", () => {
    const { start } = buildGarden(FALLBACK_SEED);
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    expect(result.current.position).toEqual(start);
  });

  it("does not move into a blocked direction", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const before = result.current.position;
    act(() => {
      result.current.move("N");
    });
    expect(result.current.position).toEqual(before);
  });

  it("gathers a stone, records its haiku line and announces it", () => {
    const onStoneCollected = vi.fn();
    const { result } = renderHook(() =>
      useZazenGame({ onStoneCollected, seed: FALLBACK_SEED }),
    );
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      result.current.teleportForTest(stones[0]);
    });
    expect(result.current.stonesFound).toHaveLength(1);
    expect(result.current.haikuLines[0].text).toBeTruthy();
    expect(result.current.announcement).toMatch(/stone 1 of 5/i);
    expect(onStoneCollected).toHaveBeenCalledWith(0);
  });

  it("wakes the shrine once every stone is gathered", () => {
    const onShrineActivated = vi.fn();
    const { result } = renderHook(() =>
      useZazenGame({ onShrineActivated, seed: FALLBACK_SEED }),
    );
    const { stones } = buildGarden(FALLBACK_SEED);
    act(() => {
      for (const stone of stones) {
        result.current.teleportForTest(stone);
      }
    });
    expect(result.current.stonesFound).toHaveLength(STONE_COUNT);
    expect(result.current.shrineActivated).toBe(true);
    expect(onShrineActivated).toHaveBeenCalledTimes(1);
  });

  it("opens the finale on reaching the woken shrine", () => {
    const { result } = renderHook(() => useZazenGame({ seed: FALLBACK_SEED }));
    const { stones, shrine } = buildGarden(FALLBACK_SEED);
    act(() => {
      for (const stone of stones) {
        result.current.teleportForTest(stone);
      }
      result.current.teleportForTest(shrine);
    });
    expect(result.current.finaleOpen).toBe(true);
  });

  it("falls back to a playable garden with no seed", () => {
    const { result } = renderHook(() => useZazenGame({}));
    expect(result.current.map.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/use-zazen-game.test.tsx`
Expected: FAIL — `result.current.position` is undefined

- [ ] **Step 3: Rewrite the hook**

Rewrite `src/components/client/use-zazen-game.ts`:

- `useState` for `map`, `position`, `stonesFound`, `shrineActivated`, `finaleOpen`, `haikuLines`, `announcement`.
- Initialise from `buildGarden(options.seed ?? FALLBACK_SEED)` in a lazy `useMemo` so the garden is built once.
- Delete `findPlayer` entirely — position is state, not a 144-tile scan.
- `move(direction)`: call `performMove`; on success set `position` and run `arriveAt(newPosition)`.
- `arriveAt(position)`: look up the tile; if it has a `stone`, collect it, push `{ stoneIndex, text: HAIKU_LINES[stoneIndex], day: tile.day }`, announce ``Stone ${n} of ${STONE_COUNT} gathered. ${line}`` plus, when `tile.day` exists, ``${day.date}, ${day.count} commits``; when the count reaches `STONE_COUNT`, `activateShrine` and announce. If the tile is the active shrine, open the finale.
- Export `teleportForTest(position: Position)` — it calls `arriveAt` directly. It exists so the tests above do not have to path-find across a generated garden; keep it minimal and name it so its purpose is unambiguous.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/use-zazen-game.test.tsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/client/use-zazen-game.ts tests/components/client/use-zazen-game.test.tsx
git commit -m "refactor(path): drive the game hook from a garden seed"
```

---

### Task 8: Walk animation

The pilgrim leaves the tile grid. This is required, not cosmetic: you cannot tween a sprite between two DOM parents, which is why the current `perso`-on-a-tile model has no movement animation.

**Files:**
- Create: `src/components/client/use-zazen-step.ts`
- Create: `src/components/client/zazen-pilgrim.tsx`
- Test: `tests/components/client/use-zazen-step.test.tsx`

**Interfaces:**
- Consumes: `Position`, `Direction` from `zazen-world-types`
- Produces:
  - `useZazenStep(position: Position): { renderPosition: Position; facing: Direction; frame: number; moving: boolean }` — `renderPosition` is fractional during a step; `frame` cycles `0,1,2,1` while moving and rests at `0`
  - `STEP_DURATION_MS = 200`
  - `<ZazenPilgrim renderPosition facing frame offsetX offsetY />` — absolutely positioned via `toScreen`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/client/use-zazen-step.test.tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useZazenStep from "../../../src/components/client/use-zazen-step";

describe("useZazenStep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rests on the given tile before any move", () => {
    const { result } = renderHook(() => useZazenStep({ posX: 3, posY: 3 }));
    expect(result.current.renderPosition).toEqual({ posX: 3, posY: 3 });
    expect(result.current.moving).toBe(false);
  });

  it("faces the direction it moved in", () => {
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 3, posY: 3 },
    });
    rerender({ posX: 4, posY: 3 });
    expect(result.current.facing).toBe("S");
    rerender({ posX: 4, posY: 2 });
    expect(result.current.facing).toBe("E");
  });

  it("lands exactly on the target tile once the step finishes", () => {
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 3, posY: 3 },
    });
    rerender({ posX: 3, posY: 4 });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current.renderPosition).toEqual({ posX: 3, posY: 4 });
    expect(result.current.moving).toBe(false);
  });

  it("jumps straight to the target when the viewer prefers reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: query.includes("reduced-motion"),
          media: query,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    const { result, rerender } = renderHook((props) => useZazenStep(props), {
      initialProps: { posX: 1, posY: 1 },
    });
    rerender({ posX: 2, posY: 1 });
    expect(result.current.renderPosition).toEqual({ posX: 2, posY: 1 });
    expect(result.current.moving).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/use-zazen-step.test.tsx`
Expected: FAIL — cannot resolve `use-zazen-step`

- [ ] **Step 3: Implement the hook**

Key points for the implementer:

- Keep the previous `position` in a ref. When it changes, record `from`, `to`, `startedAt`, and derive `facing` via `directionFromDelta`.
- Drive with `requestAnimationFrame`, easing with `cubic-bezier`-equivalent `t * t * (3 - 2 * t)`. **Cancel the rAF on unmount and when a new step starts.**
- **`prefers-reduced-motion` is checked in JS, not only CSS.** Read `window.matchMedia("(prefers-reduced-motion: reduce)").matches`; when true, set `renderPosition` to the target and return without scheduling a frame. CSS cannot stop a rAF tween — that is the whole reason this check exists here.
- The rAF loop runs only during a step and stops at the end. Do not leave a permanent loop running; the idle bob belongs in CSS.
- `frame` is `Math.floor(progress * 4) % 4` mapped through `[0, 1, 2, 1]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/use-zazen-step.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 5: Write the pilgrim layer**

`zazen-pilgrim.tsx` renders a single absolutely-positioned `<div>` whose
`background-image` is the `pilgrim` sheet, positioned with `toScreen(renderPosition.posX,
renderPosition.posY, offsetX, offsetY)` and `background-position` derived from
`facing` (row) and `frame` (column). No React state of its own.

- [ ] **Step 6: Commit**

```bash
git add src/components/client/use-zazen-step.ts src/components/client/zazen-pilgrim.tsx tests/components/client/use-zazen-step.test.tsx
git commit -m "feat(path): add walk tween, facing and frame cycle for the pilgrim"
```

---

### Task 9: Rewire the component and fix pixel scaling

**Files:**
- Modify: `src/components/client/zazen-world.tsx`
- Modify: `tests/components/client/zazen-world.test.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 3–8
- Produces: `<ZazenWorld seed?: GardenSeed />`

**The scaling defect.** The current line is:

```ts
const nextScale = Math.min(1, available / naturalWidth);
```

A fractional scale resamples pixel art and destroys it — the whole point of Task 6 is lost if this survives. Replace with an integer scale, and let screens too narrow for scale 1 pan instead of shrinking.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/client/zazen-world.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/components/client/world.scss", () => ({}));

import ZazenWorld from "../../../src/components/client/zazen-world";
import { chooseMapScale } from "../../../src/components/client/zazen-world";

describe("chooseMapScale", () => {
  it("only ever returns an integer, so pixel art is never resampled", () => {
    for (const available of [100, 383, 640, 900, 1400, 2600]) {
      const scale = chooseMapScale(available, 768);
      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
    }
  });

  it("never shrinks below 1 — narrow screens pan instead", () => {
    expect(chooseMapScale(320, 768)).toBe(1);
  });

  it("uses the extra room on a wide viewport", () => {
    expect(chooseMapScale(1600, 768)).toBe(2);
  });
});

describe("<ZazenWorld />", () => {
  it("renders the Path of Stones heading and poetic intro", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("heading", { level: 1, name: /path of stones/i })).toBeInTheDocument();
    expect(screen.getByText(/five stones wait along the path/i)).toBeInTheDocument();
  });

  it("renders the four compass buttons", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("button", { name: /move north/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move south/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move east/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move west/i })).toBeInTheDocument();
  });

  it("keeps the application role and the instructions it describes", () => {
    render(<ZazenWorld />);
    const map = screen.getByRole("application", { name: /game world map/i });
    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute("aria-describedby", "game-instructions");
  });

  it("keeps a polite live region for announcements", () => {
    const { container } = render(<ZazenWorld />);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("renders the pilgrim as its own layer, not inside a tile", () => {
    const { container } = render(<ZazenWorld />);
    const pilgrim = container.querySelector(".zazen-world__pilgrim");
    expect(pilgrim).toBeInTheDocument();
    expect(pilgrim?.closest(".zazen-world__tile")).toBeNull();
  });

  it("responds to a keyboard move without crashing", () => {
    render(<ZazenWorld />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("application")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/client/zazen-world.test.tsx`
Expected: FAIL — `chooseMapScale` is not exported; no `.zazen-world__pilgrim`

- [ ] **Step 3: Update the component**

```ts
// exported from zazen-world.tsx so it can be tested without a DOM
const MAX_SCALE = 3;

// Integer scale only. A fractional scale resamples the sprites and destroys the pixel
// grid; below scale 1 the map pans inside its wrapper instead of shrinking.
const chooseMapScale = (available: number, naturalWidth: number): number => {
  if (naturalWidth <= 0) {
    return 1;
  }
  return Math.min(MAX_SCALE, Math.max(1, Math.floor(available / naturalWidth)));
};
```

Also in this task:
- Accept an optional `seed` prop and pass it to `useZazenGame`.
- Rename `TileRenderer`'s image sources from `.gif` to `.png` and from `img`/`decors`/`perso` to `sprite`/`decor`/`npc`.
- Remove the player `<img>` from `TileRenderer`; render `<ZazenPilgrim>` as a sibling of the tile grid inside `.zazen-world__map`.
- Feed `useZazenStep(game.position)` and pass its output to `ZazenPilgrim`.
- Keep every accessibility attribute exactly as it is today.
- Give `.zazen-world__map-wrapper` `overflow-x: auto` so scale 1 on a narrow screen pans.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/client/zazen-world.test.tsx`
Expected: PASS, 8 tests

- [ ] **Step 5: Run the whole suite and the type checker**

```bash
pnpm test
pnpm lint
pnpm exec astro check
```
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/client/zazen-world.tsx tests/components/client/zazen-world.test.tsx
git commit -m "feat(path): render the pilgrim as its own layer and scale by whole pixels"
```

---

### Task 10: Repaint the stylesheet

**Files:**
- Modify: `src/components/client/world.scss`

- [ ] **Step 1: Add the pixel-rendering and reduced-motion foundations**

```scss
.zazen-world__tile-image,
.zazen-world__decor,
.zazen-world__pilgrim {
  image-rendering: pixelated;
}

.zazen-world__map-wrapper {
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
```

- [ ] **Step 2: Add ambient life**

- Water: 4-frame vertical strip stepped with `animation: zazen-water 1.6s steps(4) infinite;` moving `background-position-y` from `0` to `-256px`.
- Decor sway: a 4s `transform: rotate()` of ±0.6deg with a per-tile `animation-delay` derived from `nth-child`, so the grove does not sway in lockstep.
- Idle bob: 2s `translateY(0 → -1px)` on `.zazen-world__pilgrim--idle`. **CSS only** — no rAF.

- [ ] **Step 3: Guard every animation**

```scss
@media (prefers-reduced-motion: reduce) {
  .zazen-world__pilgrim,
  .zazen-world__tile-image,
  .zazen-world__decor {
    animation: none !important;
    transition: none !important;
  }
}
```

This is the CSS half of the requirement. The JS half is already in `use-zazen-step` from Task 8; both are needed.

- [ ] **Step 4: Repaint to the palette**

Replace the ink-wash vignette gradients and any hard-coded colour with the sand and rose ramp values from the Global Constraints, driving from `--primary-bg-color` and `--primary-color` where a token already exists so the garden and the page stay one sheet of paper.

- [ ] **Step 5: Verify**

```bash
pnpm style:lint
pnpm dev
```
Open `http://localhost:4325/path`. Confirm: sprites are crisp at every window width, water cycles, the pilgrim walks and turns, and with "reduce motion" enabled in the OS everything is instant.

- [ ] **Step 6: Commit**

```bash
git add src/components/client/world.scss
git commit -m "style(path): repaint the garden in the paper daylight palette"
```

---

### Task 11: Visual regression for /path

Possible only because Task 1 made the garden deterministic.

**Files:**
- Create: `tests/visual/path.spec.ts`

Scope deliberately: **chromium desktop and mobile only.** Five projects × three viewports would mean fifteen PNGs for art that changes often.

- [ ] **Step 1: Write the spec**

```ts
// tests/visual/path.spec.ts
import { expect, test } from "@playwright/test";
import { waitForImagesLoad, waitForPageLoad } from "../utils/test-helpers";

// The garden is generated from a committed seed, so this snapshot is stable until the
// seed or the art changes — both of which are deliberate, reviewable commits.
test.describe("Path of Stones visual tests", () => {
  test.skip(
    ({ browserName, isMobile }) => browserName !== "chromium" || isMobile === undefined,
    "snapshots are pinned to chromium to keep the snapshot count manageable",
  );

  test("matches the garden layout", async ({ page }) => {
    await page.goto("/path");
    await waitForPageLoad(page);
    await waitForImagesLoad(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const map = page.getByRole("application", { name: /game world map/i });
    await expect(map).toHaveScreenshot("path-garden.png", { maxDiffPixelRatio: 0.01 });
  });
});
```

- [ ] **Step 2: Generate the baseline**

Run: `pnpm test:visual:update -- tests/visual/path.spec.ts --project=chromium --project="Mobile Chrome"`
Expected: two new PNGs under `tests/visual/path.spec.ts-snapshots/`

- [ ] **Step 3: Verify it passes on a rerun**

Run: `pnpm test:visual -- tests/visual/path.spec.ts --project=chromium --project="Mobile Chrome"`
Expected: PASS. If it flakes, the garden is not deterministic — fix the non-determinism rather than raising `maxDiffPixelRatio`.

- [ ] **Step 4: Commit**

```bash
git add tests/visual/path.spec.ts tests/visual/path.spec.ts-snapshots
git commit -m "test(path): add deterministic visual snapshot for the garden"
```

---

### Task 12: Phase A checkpoint

- [ ] **Step 1: Full verification**

```bash
pnpm lint
pnpm style:lint
pnpm test
pnpm build
pnpm test:visual -- tests/visual/path.spec.ts --project=chromium
```

Every command must pass. Report the actual output; do not claim success without it.

- [ ] **Step 2: Confirm nothing references deleted modules**

```bash
grep -rn "zazen-world-helpers\|\.gif\|perso\b" src/ tests/ || echo "clean"
```
Expected: `clean`, or only unrelated matches outside the game.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore(path): phase A complete — pixel garden on a static seed"
```

**Phase A is shippable here.** If Phase B stalls, `/path` is already a finished pixel game.

---

# Phase B — the garden is the work

Only the seed's *source* changes. Nothing in Phase A's rendering path is touched.

---

### Task 13: GitHub fetch script

**Files:**
- Create: `scripts/fetch-github-garden.mjs`
- Create: `src/data/github-garden.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm run fetch:github` writing a `GardenSeed`-shaped JSON to `src/data/github-garden.json`

Requirements:

- **Token-optional.** With `GITHUB_TOKEN` set, query GraphQL `user(login).contributionsCollection.contributionCalendar` for real daily counts. Without one, derive daily counts from `GET /users/<login>/events/public` (90 days, ≤300 events, PushEvents only) and languages from `GET /users/<login>/repos?sort=pushed&per_page=100`. Two requests either way.
- **Left-pad to exactly `DATA_TILES` entries**, oldest first, using `null` for days the source could not cover. The 90-day REST window therefore fills 90 of 100 tiles and the remaining 10 render as plain sand — the same as a zero-commit day. Switching a token on later lengthens the history without touching any layout code.
- **Never print raw commit messages.** Emit `date`, `count`, `language`, `repo` and nothing else. Public events already exclude private and work repos; keep a `DENY_REPOS` array at the top of the script anyway, and filter on it.
- **Never fail the build.** On any non-2xx, timeout, 403 or 429, log a warning, leave the existing `src/data/github-garden.json` untouched, and `process.exit(0)`.

- [ ] **Step 1: Write the script**

Sketch of the fallback ladder, which is the part that matters:

```js
const main = async () => {
  try {
    const seed = process.env.GITHUB_TOKEN
      ? await fetchFromGraphQL(LOGIN, process.env.GITHUB_TOKEN)
      : await fetchFromRest(LOGIN);
    writeFileSync(OUT, `${JSON.stringify(seed, null, 2)}\n`);
    console.log(`fetch-github-garden: wrote ${seed.days.filter(Boolean).length} days`);
  } catch (error) {
    // Level 2 of the ladder: keep whatever is already committed. Level 3 (FALLBACK_SEED)
    // lives in the schema module and covers a missing file entirely.
    console.warn(`fetch-github-garden: keeping the committed snapshot — ${error.message}`);
  }
  process.exit(0);
};
```

- [ ] **Step 2: Register the script**

```json
"fetch:github": "node scripts/fetch-github-garden.mjs"
```

- [ ] **Step 3: Run it and inspect the output**

```bash
pnpm run fetch:github
head -30 src/data/github-garden.json
```
Expected: 100 entries; no commit-message text anywhere in the file.

- [ ] **Step 4: Verify it degrades**

```bash
node -e "process.env.HTTPS_PROXY='http://127.0.0.1:1'" # or disconnect the network
pnpm run fetch:github
echo "exit=$?"
```
Expected: `exit=0`, a warning, and `src/data/github-garden.json` unchanged.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-github-garden.mjs src/data/github-garden.json package.json
git commit -m "feat(path): fetch github activity into a committed garden seed"
```

---

### Task 14: Wire the seed into the page

**Files:**
- Modify: `src/pages/path.astro`

`ZazenWorld` is `client:only="react"` and so never server-renders — but Astro still serialises props into the island, so the seed arrives with the page. No request, no loading state, no runtime failure mode.

- [ ] **Step 1: Update the page**

```astro
---
import Layout from "../layouts/Layout.astro";
import ZazenWorld from "../components/client/zazen-world";
import { parseGardenSeed } from "../data/garden-schema";

// Read at build time. parseGardenSeed never throws: a missing or malformed file degrades
// to FALLBACK_SEED, so the page always builds — including offline.
let raw: unknown;
try {
  raw = (await import("../data/github-garden.json")).default;
} catch {
  raw = undefined;
}
const seed = parseGardenSeed(raw);
---

<Layout title="Path of Stones" description="A quiet walk along five stones.">
  <ZazenWorld client:only="react" seed={seed} />
</Layout>
```

- [ ] **Step 2: Verify**

```bash
pnpm build
pnpm dev
```
Open `/path`. The garden should now reflect the fetched data. Compare against the shape of `src/data/github-garden.json` — a busy fortnight should be a visible mossy trail.

- [ ] **Step 3: Refresh the visual baseline**

The seed changed, so the Task 11 snapshot is legitimately stale.

```bash
pnpm test:visual:update -- tests/visual/path.spec.ts --project=chromium --project="Mobile Chrome"
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/path.astro tests/visual/path.spec.ts-snapshots
git commit -m "feat(path): build the garden from committed github activity"
```

---

### Task 15: Keep the garden fresh in CI

**Files:**
- Modify: `.github/workflows/astro-gh-pages.yml`

- [ ] **Step 1: Add the daily schedule**

```yaml
on:
  push:
    branches: [master]
  schedule:
    # Refresh the garden daily. Without this it would only change when a post ships.
    - cron: "0 5 * * *"
  workflow_dispatch:
```

- [ ] **Step 2: Add the fetch step before the build**

Insert immediately before the existing `Build` step:

```yaml
      - name: Fetch the GitHub activity the garden is grown from
        run: pnpm run fetch:github
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Do not commit the result back**

Leave the workspace ephemeral. **A push from this workflow re-triggers this workflow** — an auto-commit here is an infinite loop. The committed `src/data/github-garden.json` is the offline fallback and is refreshed by hand with `pnpm run fetch:github`. If auto-commit is ever wanted it needs a `paths-ignore` or `[skip ci]` guard; that is deliberately out of scope.

Add this as a comment in the workflow so the next reader does not "fix" it.

- [ ] **Step 4: Verify**

```bash
pnpm exec actionlint .github/workflows/astro-gh-pages.yml 2>/dev/null || echo "actionlint not installed — review by hand"
git diff .github/workflows/astro-gh-pages.yml
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/astro-gh-pages.yml
git commit -m "ci(path): refresh the garden daily from github activity"
```

Note for the operator: GitHub disables scheduled workflows on repositories with 60 days of no activity. Not a concern for an active blog, but worth knowing if the schedule ever goes quiet.

---

### Task 16: Final verification

- [ ] **Step 1: Run everything**

```bash
pnpm lint
pnpm style:lint
pnpm test
pnpm build
pnpm test:visual -- tests/visual/path.spec.ts --project=chromium --project="Mobile Chrome"
```

- [ ] **Step 2: Check the constraints by hand**

- [ ] Exactly five stones on the board, spread out
- [ ] Every stone and the shrine reachable from the start
- [ ] Sprites crisp at 360px, 768px and 1600px viewport widths
- [ ] Keyboard, compass buttons, tile clicks and swipe all move the pilgrim
- [ ] `aria-live` announces each stone with its date and count
- [ ] With "reduce motion" on, nothing animates and moves are instant
- [ ] No commit-message text anywhere in `src/data/github-garden.json` or the rendered page
- [ ] `pnpm build` succeeds with the network disconnected

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore(path): pixel garden complete"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: palette and pixel discipline → Task 6; geometry → Task 3; assets → Task 6; feel → Tasks 8–10; scaling → Task 9; motion preferences → Tasks 8 and 10; source and fallback ladder → Tasks 2 and 13; mapping and boustrophedon → Task 5; placement → Task 5; reachability → Task 5; privacy → Task 13; announcements → Task 7; CI → Task 15; testing → Tasks 1–11 and 16; phasing → Task 12.

**Known gaps, stated rather than hidden.**

- The *content* of `scripts/zazen-art/sprites.mjs` beyond the `groundTile` helper is specified by inventory, dimensions and the two craft rules, not pixel by pixel. Twenty-six hand-authored sprite maps cannot be usefully inlined in a plan; the test in Task 6 Step 1 enforces every mechanical property (dimensions, palette membership, completeness), and Step 7 requires visual inspection.
- Task 7 Step 3 and Task 10 Step 4 describe edits to existing files as directed changes rather than full file bodies, because both are substantial rewrites of files the implementer will have open. Every new symbol they introduce is named in the Interfaces block.
- The "lanterns from stars" idea in the spec is explicitly deferred and has no task, by design.

**Type consistency.** `MapTile` uses `sprite`/`walkable`/`decor`/`npc` in Tasks 3, 4, 5, 6 and 9 — the old `img`/`decors`/`perso` names appear only in the Task 12 grep that proves they are gone. `Position` is `{ posX, posY }` throughout. `buildGarden` returns `{ map, start, stones, shrine }` in Task 5 and is destructured with exactly those names in Tasks 7 and 9. `STONE_COUNT` comes from `src/data/garden-schema` everywhere.
