import type { GardenDay, GardenSeed } from "../schema";
import {
  DATA_COLS,
  DATA_ROWS,
  DATA_TILES,
  GRID_SIZE,
  STONE_COUNT,
  WINDOW_DAYS,
  dayForTile,
  tileForDay,
} from "../schema";
import type { MapTile, Position } from "../types";
import {
  LAID_STONE_SPRITE,
  STONE_DECOR,
  canPaveTile,
  isWalkableTile,
  layStoneAt,
} from "./rules";
import { cheapestCrossing, cheapestRoute } from "./routing";
import { createRng, hashString } from "./rng";
import { manhattan } from "./geometry";

const BORDER = 1;
const MIN_STONE_SEPARATION = 3;
const PLANT_CHANCE = 0.55;
const PLANT_THRESHOLD = 9;
const BORDER_DECOR_CHANCE = 0.45;
const BORDER_SPRITE_CHANCE = 0.5;
const POND_DEPTH = 2;

const SAND_MOSS_MAX = 3;
const MOSS_MID_MAX = 8;

// Firm ground is the busier half of the days you actually worked. An absolute threshold
// cannot serve both a fortnight of ones and a fortnight of twenties — set it low and a
// productive fortnight is a lawn with nothing to solve, set it high and an ordinary one
// reads as failure. Taking the top half self-normalises: every fortnight is a puzzle, and
// which half is firm still comes entirely from your own pattern.
//
// Exactly half the fortnight is firm, whatever it held. "Only the days you worked" turned
// a dead fortnight into a hundred tiles of sand crossed by laying stones in a straight
// line, which is tedium rather than difficulty — and the garden has to be worth playing on
// a bad week too. So the shape of the challenge is constant and the reading is what
// varies: a day inside the busier half with nothing on it still gives ground to stand on,
// but bare gravel rather than moss. Firm underfoot, and visibly unearned.
const FIRM_DAYS = Math.floor(WINDOW_DAYS / 2);

const firmDays = (days: readonly (GardenDay | null)[]): ReadonlySet<number> => {
  // Only the days that own a bed. A seed carrying more days than the window would
  // otherwise rank days nothing renders, and the garden would come out all sand.
  const ranked = days
    .slice(0, WINDOW_DAYS)
    .map((day, index) => ({ count: day?.count ?? 0, index }))
    // Ties go to the more recent day: between two equal days the fresher one is the one
    // still underfoot.
    .sort((a, b) => b.count - a.count || b.index - a.index);
  return new Set(ranked.slice(0, FIRM_DAYS).map((entry) => entry.index));
};

// The top vertex of the diamond, directly behind where the pilgrim starts.
const ENTRANCE: Position = { posX: 0, posY: 0 };
// Two planks reaching out from the garden's edge into the pond along the lower-left side.
const PIER: readonly Position[] = [
  { posX: 5, posY: GRID_SIZE - 1 },
  { posX: 6, posY: GRID_SIZE - 1 },
];
// The approach from the gate. It stops less than halfway down the edge on purpose: run
// all the way to the shrine's doorstep and it is a paved highway past the entire garden,
// and the walk the game is about never has to happen.
const APPROACH: readonly Position[] = Array.from({ length: 4 }, (_unused, index) => ({
  posX: 0,
  posY: index + 1,
}));
const LANTERN_SPACING = 3;
// Beside the gate. Rose is the progress colour, so exactly one tree is allowed to wear it.
const SAKURA_SPOT: Position = { posX: 1, posY: 0 };
// The garden's inhabitants and its two most recognisable stone objects. Each sits where
// its own kind belongs: the cat on the warm path, the frog and the fish at the water, the
// deer-scarer beside the pond it feeds from.
const PAGODA_SPOT: Position = { posX: GRID_SIZE - 1, posY: 4 };
const SHISHI_SPOT: Position = { posX: GRID_SIZE - 1, posY: 8 };
const FROG_SPOT: Position = { posX: 5, posY: GRID_SIZE - 1 };
const KOI_COUNT = 2;

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
const BORDER_DECOR_OPTIONS = ["pine", "rock-small", "reed", "maple"];

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

const positionForTile = (index: number): Position => {
  const { col, row } = dayIndexToCell(index);
  return cellToPosition(col, row);
};

// A day sits at the heart of its own bed, so walking "to a day" from the chart lands in
// the middle of that day's run rather than on its first tile.
const positionForDay = (day: number): Position => positionForTile(tileForDay(day));

// Inverse of the boustrophedon mapping.
const tileIndexForPosition = (position: Position): number | undefined => {
  const col = position.posX - BORDER;
  const row = position.posY - BORDER;
  if (col < 0 || col >= DATA_COLS || row < 0 || row >= DATA_ROWS) {
    return undefined;
  }
  return row * DATA_COLS + (row % 2 === 0 ? col : DATA_COLS - 1 - col);
};

const dayIndexForPosition = (position: Position): number | undefined => {
  const tile = tileIndexForPosition(position);
  return tile === undefined ? undefined : dayForTile(tile);
};

const groundForCount = (count: number): string => {
  if (count <= 0) {
    return "sand-0";
  }
  if (count <= SAND_MOSS_MAX) {
    return "sand-moss";
  }
  if (count <= MOSS_MID_MAX) {
    return "moss-mid";
  }
  return "moss-deep";
};

const isInnerCell = (posX: number, posY: number): boolean =>
  posX >= BORDER && posX < BORDER + DATA_COLS && posY >= BORDER && posY < BORDER + DATA_ROWS;

// The outer ring is authored landscape, not data: it frames the garden, holds the pond,
// and keeps the data field away from the map edge.
const buildBorderTile = (posX: number, posY: number, rng: () => number): MapTile => {
  if (posY >= GRID_SIZE - POND_DEPTH) {
    return { decor: "", npc: 0, posX, posY, sprite: "water-still", walkable: false };
  }
  const decorate = rng() < BORDER_DECOR_CHANCE;
  const decorIndex = Math.floor(rng() * BORDER_DECOR_OPTIONS.length);
  return {
    decor: decorate ? BORDER_DECOR_OPTIONS[decorIndex] : "",
    npc: 0,
    posX,
    posY,
    sprite: rng() < BORDER_SPRITE_CHANCE ? "gravel-edge" : "sand-1",
    walkable: true,
  };
};

const buildDataTile = (
  day: GardenDay | null,
  position: Position,
  rng: () => number,
  firm: boolean,
): MapTile => {
  const count = day?.count ?? 0;
  const planted = count >= PLANT_THRESHOLD && rng() < PLANT_CHANCE;
  const tile: MapTile = {
    decor: planted ? (PLANT_BY_LANGUAGE[day?.language ?? ""] ?? DEFAULT_PLANT) : "",
    npc: 0,
    posX: position.posX,
    posY: position.posY,
    // Outside the busier half the day is left raked, whatever it managed — that sand is
    // the obstacle the stones are for. Inside it, a day with nothing on it still gives
    // ground to stand on, but bare gravel rather than moss: firm underfoot, and visibly
    // unearned.
    sprite: firm ? (count > 0 ? groundForCount(count) : "gravel-edge") : "sand-0",
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
//
// The first and last days are excluded: they carry the pilgrim's start and the shrine.
// The newest day is both the shrine tile and, usually, the busiest — without this the
// shrine would overwrite a stone and the board would come up one short.
const pickStoneIndices = (
  days: readonly (GardenDay | null)[],
  firm: ReadonlySet<number>,
): number[] => {
  const FIRST = 1;
  const LAST = WINDOW_DAYS - 1;
  const chosen: number[] = [];

  const accepts = (index: number, separation: number): boolean => {
    const candidate = positionForDay(index);
    return chosen.every((other) => manhattan(candidate, positionForDay(other)) >= separation);
  };

  // Only the days that own a bed. A seed carrying more days than the window would
  // otherwise rank days nothing renders, and the garden would come out all sand.
  const ranked = days
    .slice(0, WINDOW_DAYS)
    .map((day, index) => ({ count: day?.count ?? 0, index }))
    .filter((entry) => entry.count > 0 && entry.index >= FIRST && entry.index < LAST)
    .sort((a, b) => b.count - a.count || a.index - b.index);

  // Busiest days first, but firm ones before sand at every stage. The two rankings break
  // ties in opposite directions — firmness prefers the recent day, busyness the older one
  // — so on a fortnight of equal days every stone used to land in the half that had been
  // left raked, and the budget had to stretch to reach them all.
  for (const preferFirm of [true, false]) {
    for (const entry of ranked) {
      if (chosen.length === STONE_COUNT) {
        break;
      }
      if (preferFirm && !firm.has(entry.index)) {
        continue;
      }
      if (!chosen.includes(entry.index) && accepts(entry.index, MIN_STONE_SEPARATION)) {
        chosen.push(entry.index);
      }
    }
  }

  // Not enough busy days: fill from a fixed sweep of the field, then relax the spacing.
  // Top up from firm ground before reaching for sand. A stone stranded in the middle of a
  // raked bed has to be paid for twice — once to reach it and once to leave — and because
  // the budget is set by the dearest thing the game asks you to reach, one badly placed
  // stone inflates it for the whole garden. On a lopsided fortnight that was the
  // difference between four stones spent of five and four spent of ten.
  for (const preferFirm of [true, false]) {
    for (const separation of [MIN_STONE_SEPARATION, 1]) {
      for (let index = FIRST; index < LAST && chosen.length < STONE_COUNT; index++) {
        if (preferFirm && !firm.has(index)) {
          continue;
        }
        if (!chosen.includes(index) && accepts(index, separation)) {
          chosen.push(index);
        }
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
      const nextKey = positionKey(next);
      const tile = byKey.get(nextKey);
      if (!tile || seen.has(nextKey) || !isWalkableTile(tile)) {
        continue;
      }
      seen.add(nextKey);
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
  const targetKey = positionKey(target);

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    if (positionKey(current) === targetKey) {
      break;
    }
    for (const next of neighboursOf(current)) {
      const nextKey = positionKey(next);
      if (seen.has(nextKey) || !byKey.has(nextKey)) {
        continue;
      }
      seen.add(nextKey);
      parents.set(nextKey, positionKey(current));
      queue.push(next);
    }
  }

  let cursor: string | undefined = targetKey;
  const startKey = positionKey(start);
  while (cursor !== undefined && cursor !== startKey) {
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

// The longest run of consecutive days with any activity at all.
const longestStreak = (days: readonly (GardenDay | null)[]): number => {
  let best = 0;
  let run = 0;
  for (const day of days) {
    run = (day?.count ?? 0) > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
};

// The garden's built landmarks, as opposed to its planting. A torii over the entrance so
// the way in reads as a way in, a pier out over the pond, and lanterns down the path —
// lit as far as the longest streak reaches, so consistency shows up as light in the world
// rather than as another number under the chart.
const placeLandmarks = (
  map: MapTile[],
  days: readonly (GardenDay | null)[],
  rng: () => number,
): void => {
  const byKey = new Map(map.map((tile) => [positionKey(tile), tile]));
  const at = (position: Position): MapTile | undefined => byKey.get(positionKey(position));

  const gate = at(ENTRANCE);
  if (gate) {
    gate.decor = "torii";
    gate.sprite = "gravel-edge";
    gate.walkable = false;
  }

  // A short pier over the water, with a lit lantern at its head. It is walkable, so the
  // pond stops being a wall you look at and becomes somewhere you can stand.
  PIER.forEach((position, index) => {
    const tile = at(position);
    if (!tile) {
      return;
    }
    tile.sprite = "bridge-plank";
    tile.walkable = true;
    tile.decor = index === PIER.length - 1 ? "lantern-lit" : "";
  });

  // The path of stones the page is named after. It runs down the outer ring from the
  // torii to the shrine's doorstep. The ring is authored landscape rather than data, so
  // it can be paved without overwriting a single day — and the garden badly needed it:
  // before this the board was an open plane of near-identical tiles where every direction
  // was equally arbitrary. Now there is a way through, the stones sit off it, and the
  // walk has a shape.
  APPROACH.forEach((position) => {
    const tile = at(position);
    if (!tile) {
      return;
    }
    tile.sprite = "stone-slab";
    tile.walkable = true;
    tile.decor = "";
  });

  // Lanterns line the walk rather than ringing the whole garden, and light as far along
  // it as the longest streak reached — so the path is lit exactly as far as the habit got.
  for (const [position, decor] of [
    [PAGODA_SPOT, "pagoda"],
    [SHISHI_SPOT, "shishi-odoshi"],
    [FROG_SPOT, "frog"],
  ] as const) {
    const tile = at(position);
    if (tile) {
      tile.decor = decor;
    }
  }

  // Fish move. Two of them, dropped anywhere in open water rather than parked on the same
  // two tiles every day — a pond whose fish are always in the same place is an ornament.
  const pond = map.filter((tile) => tile.sprite.startsWith("water") && tile.decor === "");
  for (let index = 0; index < KOI_COUNT && pond.length > 0; index++) {
    const [chosen] = pond.splice(Math.floor(rng() * pond.length), 1);
    if (chosen) {
      chosen.decor = "koi";
    }
  }

  const blossom = at(SAKURA_SPOT);
  if (blossom) {
    blossom.decor = "sakura";
    blossom.sprite = "gravel-edge";
  }

  const posts = APPROACH.filter((_position, index) => index % LANTERN_SPACING === 1);
  const lit = Math.min(longestStreak(days), posts.length);
  posts.forEach((position, index) => {
    const tile = at(position);
    if (tile) {
      tile.decor = index < lit ? "lantern-lit" : "lantern-unlit";
    }
  });
};

interface GardenLayout {
  map: MapTile[];
  start: Position;
  stones: readonly Position[];
  shrine: Position;
  stoneBudget: number;
  // Nobody is told about her. She is at the water's edge, she is on no route you need to
  // take, and finding her is the only reward for having gone to look.
  frog: Position;
}

// Nothing spare. The purse is now the smallest one that the BEST order of stones can
// finish on, so a spare stone on top of it is not mercy — it is the whole margin between
// "you must find the right route" and "any route will do".
const STONE_MARGIN = 0;
// If the shrine cannot be reached at any price the terrain is broken rather than merely
// mean, and the carve below has already run; hand over enough to cross a whole row.
const STONE_FALLBACK = DATA_COLS;

// What a gathered stone gives back. This is the whole shape of the game: the five stones
// are the objective AND the fuel, so the question stops being "can I afford the crossing"
// — one sum, asked once — and becomes "in what order do I take them", asked five times on
// a board whose shape is my own commit history.
//
// It is deliberately less than a long leg costs. Set it high enough to pay for the worst
// crossing and you can never be stranded, the ordering stops mattering, and the strategy
// evaporates into a formality. At two it very nearly did: five stones handed back ten,
// which is most of a second purse, and every order was affordable.
const STONE_REFUEL = 1;

// Pave everything on a route that is still sand, exactly as walking it would. Laid stones
// are permanent, so a later leg that crosses the same ground crosses it free — which is
// most of why a real tour is affordable at all, and why a budget worked out from
// independent one-way trips was far too generous.
const payFor = (map: readonly MapTile[], path: readonly Position[]): MapTile[] => {
  let paved = map as MapTile[];
  for (const step of path) {
    const tile = paved.find(
      (candidate) => candidate.posX === step.posX && candidate.posY === step.posY,
    );
    if (tile && canPaveTile(tile)) {
      paved = layStoneAt(paved, step);
    }
  }
  return paved;
};

// Can this purse finish the garden AT ALL? Every order of the five stones, depth first,
// stopping at the first one that reaches the shrine.
//
// The first version of this asked a weaker question — whether the *greedy* order finished
// — and the answer made the game easy in a way no amount of tuning would have fixed. A
// purse a thoughtless walk survives is a purse a thoughtful walk never notices, so the
// ordering had nothing riding on it. Sizing to the best order instead means the route you
// take is the difference between finishing and not, which is the entire game.
//
// Most branches die at their first or second leg once the purse is tight, so the hundred
// and twenty orders are nearly all pruned before they are walked.
const tourCompletes = (
  map: readonly MapTile[],
  start: Position,
  stones: readonly Position[],
  shrine: Position,
  purse: number,
): boolean => {
  const walk = (
    ground: readonly MapTile[],
    position: Position,
    remaining: readonly Position[],
    wallet: number,
  ): boolean => {
    if (remaining.length === 0) {
      const home = cheapestCrossing(ground, position, shrine);
      return home !== undefined && home <= wallet;
    }
    for (const [index, target] of remaining.entries()) {
      const route = cheapestRoute(ground, position, target, wallet);
      if (!route) {
        continue;
      }
      const rest = remaining.filter((_, other) => other !== index);
      if (walk(payFor(ground, route.path), target, rest, wallet - route.cost + STONE_REFUEL)) {
        return true;
      }
    }
    return false;
  };

  return walk(map, start, stones, purse);
};

const buildGarden = (seed: GardenSeed): GardenLayout => {
  const rng = createRng(hashString(`${seed.login}:${seed.generatedAt}:${seed.totalContributions}`));
  const map: MapTile[] = [];

  // Border first, in a fixed order, so the rng stream is deterministic.
  for (let posX = 0; posX < GRID_SIZE; posX++) {
    for (let posY = 0; posY < GRID_SIZE; posY++) {
      if (!isInnerCell(posX, posY)) {
        map.push(buildBorderTile(posX, posY, rng));
      }
    }
  }

  // Then one data tile per day, in day order, so the boustrophedon mapping is the only
  // thing deciding where a day lands.
  const firm = firmDays(seed.days);
  const byKey = new Map<string, MapTile>();
  for (let index = 0; index < DATA_TILES; index++) {
    const position = positionForTile(index);
    const day = dayForTile(index);
    const tile = buildDataTile(seed.days[day] ?? null, position, rng, firm.has(day));
    map.push(tile);
    byKey.set(positionKey(tile), tile);
  }

  const stones: Position[] = [];
  pickStoneIndices(seed.days, firm).forEach((dayIndex, stoneIndex) => {
    const position = positionForDay(dayIndex);
    const tile = byKey.get(positionKey(position));
    if (!tile) {
      return;
    }
    tile.decor = STONE_DECOR;
    tile.stone = stoneIndex;
    tile.walkable = true;
    stones.push(position);
  });

  // The shrine keeps the last tile rather than the last day's centre: it belongs at the
  // far end of the walk, which is where the snake finishes.
  // The shrine no longer sits on the last tile of the snake every single time. It stays
  // in the far half of the field — the walk has to be a journey — but which tile is drawn
  // from the same seeded stream as everything else, so it moves when the fortnight does
  // and never between two visitors on the same day.
  const farHalf = Array.from({ length: Math.floor(DATA_TILES / 2) }, (_u, i) => i + DATA_TILES / 2);
  const shrineTileIndex = farHalf[Math.floor(rng() * farHalf.length)] ?? DATA_TILES - 1;
  const shrine = positionForTile(shrineTileIndex);
  const shrineTile = byKey.get(positionKey(shrine));
  if (shrineTile) {
    shrineTile.decor = "";
    shrineTile.shrine = "locked";
    shrineTile.sprite = "shrine-locked";
    shrineTile.walkable = true;
  }

  const start = positionForTile(0);
  const startTile = byKey.get(positionKey(start));
  if (startTile) {
    startTile.decor = "";
    startTile.walkable = true;
  }

  placeLandmarks(map, seed.days, rng);

  // Where the pilgrim stands must be firm whatever the day did — a garden that opens with
  // its own first step impossible is not a challenge, it is a bug.
  if (startTile && startTile.sprite === "sand-0") {
    startTile.sprite = LAID_STONE_SPRITE;
  }

  const reached = reachableSet(map, start);
  for (const target of [...stones, shrine]) {
    if (!reached.has(positionKey(target))) {
      carvePathTo(map, start, target);
    }
  }

  // Painter's order. Tiles are built border-first and then in day order, which snakes
  // back and forth across the field — rendered in that order a back tile would paint
  // over a front one. Depth in this projection is posX + posY.
  map.sort((a, b) => a.posX + a.posY - (b.posX + b.posY) || a.posX - b.posX);

  // How many stones this fortnight starts you with. Run after the carve, so the answer
  // reflects the garden the player will actually stand in, and found by walking rather
  // than by arithmetic: the smallest purse that completes a whole tour, plus one spare.
  //
  // The old sum took the most expensive single destination and budgeted for that. It was
  // measuring the wrong thing twice over — it priced each trip from the start as though
  // the others had not happened, and it knew nothing of the stones refunding you along the
  // way. Searching upward from one guarantees the garden is finishable and guarantees it
  // is not comfortable, which is the only pair of properties that matters here.
  let purse = 1;
  while (purse <= STONE_FALLBACK && !tourCompletes(map, start, stones, shrine, purse)) {
    purse += 1;
  }
  const stoneBudget = Math.min(purse, STONE_FALLBACK) + STONE_MARGIN;

  return { frog: FROG_SPOT, map, shrine, start, stoneBudget, stones };
};

export type { GardenLayout };
export {
  HAIKU_LINES,
  STONE_REFUEL,
  buildGarden,
  tourCompletes,
  cellToPosition,
  dayIndexForPosition,
  dayIndexToCell,
  groundForCount,
  positionForDay,
  tileIndexForPosition,
};
