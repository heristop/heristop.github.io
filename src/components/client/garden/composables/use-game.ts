import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { GardenSeed } from "../schema";
import { FALLBACK_SEED, STONE_COUNT } from "../schema";
import type { Direction, HaikuEntry, MapTile, Position } from "../types";
import { MAX_GARDENER_TURNS, canReachNextReward } from "../board/challenge";
import type { GardenerAction } from "../board/gardener";
import type { GardenLayout } from "../board/terrain";
import { HAIKU_LINES, STONE_REFUEL, buildGarden, randomizeFrog } from "../board/terrain";
import {
  activateShrine,
  canPaveTile,
  collectStoneAt,
  layStoneAt,
  performMove,
  tileAt,
} from "../board/rules";
import { applyDirectionOffset, manhattan } from "../board/geometry";
import { calculateMapDimensions } from "../board/geometry";
import {
  chooseRakeTargets,
  rakePaths,
  GARDENER_REFILL,
  GARDENER_STEP_MS,
  GARDENER_RAKE_MS,
  planGardenerTurn,
} from "../board/gardener";

interface UseZazenGameOptions {
  seed?: GardenSeed;
  onStoneCollected?: (stoneIndex: number) => void;
  onStoneLaid?: (position: Position) => void;
  onShrineActivated?: () => void;
  onFinaleOpened?: () => void;
}

interface GameState {
  announcement: string;
  phase: "player" | "gardener" | "lost";
  gardenerTurns: number;
  openingTurn: boolean;
  rakeTargets: Position[];
  gardenerPosition: Position;
  gardenerFacingLeft: boolean;
  gardenerActivity: "idle" | "ready" | "walk" | "rake";
  gardenerActions: GardenerAction[];
  laidTrail: Position[];
  finaleOpen: boolean;
  haikuLines: readonly HaikuEntry[];
  map: MapTile[];
  position: Position;
  shrineActivated: boolean;
  stonesFound: readonly number[];
  stonesLeft: number;
  stonesLaid: number;
  steps: number;
  // Where the last stone went, so the board can play the landing on the right tile and
  // the header can flinch on the same beat. The map remembers a laid stone forever; this
  // remembers only the most recent one.
  lastLaid: Position | undefined;
  // The supply moves in both directions now, so the header needs to know that it moved
  // and which way. A count rather than a flag: the animation restarts off the count, and
  // two changes to the same value in a row still read as two events.
  supplyTicks: number;
  lastSupplyDelta: number;
  frogFreed: boolean;
  frog: Position;
}

interface ZazenGameState extends GameState {
  dismissFinale: () => void;
  mapDimensions: { height: number; offsetX: number; offsetY: number; width: number };
  move: (dir: Direction) => void;
  restart: () => void;
  shrine: Position;
  stoneBudget: number;
  teleportForTest: (position: Position) => void;
}

type Action =
  | { type: "arrive"; position: Position }
  | { type: "lay"; position: Position }
  | { type: "restart"; frogRoll: number }
  | { type: "dismissFinale" }
  | { type: "advanceGardener" }
  | { type: "hopFrog"; roll: number };

const describeDay = (tile: MapTile): string => {
  const day = tile.day;
  if (!day || day.count === 0) {
    return "";
  }
  const where = day.repo === "" ? "" : ` in ${day.repo}`;
  const plural = day.count === 1 ? "" : "s";
  return ` From ${day.date}, ${day.count} commit${plural}${where}.`;
};

// A reducer rather than a fistful of setState calls: arriving on a tile has to update
// the map, the tally, the poem and the announcement together, and each transition must
// compose with the last even when several arrive in one batch.
// What a courtesy is worth. She is off every route the game asks you to take, so this has
// to be enough to be glad of and never enough to be the plan.
const FROG_BONUS = 2;

// The oldest story in the genre, told the other way round. Standing beside her is the
// whole interaction — no prompt, no button, nothing said in the rules — and she is a
// woman before you have worked out what you did.
// The tile loses the frog and keeps only the fact that something happened on it, which is
// what plays the burst. She herself is not left standing here — a figure drawn into a tile
// belongs to that tile and can never walk out of it, so she joins the walking layer above
// the grid instead.
const freeTheFrog = (map: readonly MapTile[], frog: Position): MapTile[] =>
  map.map((tile) =>
    tile.posX === frog.posX && tile.posY === frog.posY
      ? { ...tile, decor: "", transformed: true }
      : tile,
  );

const arrive = (
  previous: GameState,
  position: Position,
  shrine: Position,
  frog: Position,
): GameState => {
  // Every arrival is a step, counted before anything else can return early, because the
  // score reads brevity off this number and a walk that skipped the tally on its way
  // through would come out looking shorter than it was.
  let state: GameState = { ...previous, steps: previous.steps + 1 };

  // Checked before anything else can return, because she sits beside the water and the
  // tile you are standing on when you meet her is nobody's business but yours.
  if (!state.frogFreed && manhattan(position, frog) <= 1) {
    state = {
      ...state,
      announcement:
        "The frog by the water stands up, and is not a frog. " +
        `She leaves you ${FROG_BONUS} stones for the courtesy.`,
      frogFreed: true,
      lastSupplyDelta: FROG_BONUS,
      map: freeTheFrog(state.map, frog),
      stonesLeft: state.stonesLeft + FROG_BONUS,
      supplyTicks: state.supplyTicks + 1,
    };
  }

  const landed = tileAt(state.map, position);
  if (!landed) {
    return { ...state, position };
  }

  if (landed.stone !== undefined) {
    const stoneIndex = landed.stone;
    if (state.stonesFound.includes(stoneIndex)) {
      return { ...state, position };
    }
    const stonesFound = [...state.stonesFound, stoneIndex];
    const complete = stonesFound.length === STONE_COUNT;
    let map = collectStoneAt(state.map, stoneIndex);
    if (complete) {
      map = activateShrine(map, shrine);
    }

    // The line is chosen by how many stones you have gathered, not by which stone this
    // is. Stones sit on the busiest days, which bears no relation to the order you walk
    // past them — indexing by stoneIndex assembled the poem scrambled, and it opened on
    // its own last line. The poem is the payoff of the page; it reads in order.
    const line = HAIKU_LINES[stonesFound.length - 1];

    // A gathered stone goes back into the purse. This is what makes the order you take
    // them in a decision rather than a formality — the stones are the objective and the
    // fuel at once, and a cheap one taken early buys the expensive one later.
    return {
      ...state,
      announcement: complete
        ? "The shrine awakens. Walk to it to finish the path."
        : `Stone ${stonesFound.length} of ${STONE_COUNT} gathered, ` +
          `${STONE_REFUEL} stones back. ${line}${describeDay(landed)}`,
      finaleOpen: state.finaleOpen,
      haikuLines: [...state.haikuLines, { day: landed.day, stoneIndex, text: line }],
      lastSupplyDelta: STONE_REFUEL,
      map,
      position,
      shrineActivated: complete || state.shrineActivated,
      stonesFound,
      stonesLeft: state.stonesLeft + STONE_REFUEL,
      supplyTicks: state.supplyTicks + 1,
    };
  }

  if (landed.shrine === "active") {
    return {
      ...state,
      announcement: "You have reached the shrine.",
      finaleOpen: true,
      position,
    };
  }

  return { ...state, announcement: "", position };
};

const handToGardener = (state: GameState): GameState => {
  if (state.stonesLeft > 0 || state.finaleOpen) return state;
  if (state.gardenerTurns >= MAX_GARDENER_TURNS) {
    return canReachNextReward(
      state.map,
      state.position,
      state.stonesLeft,
      state.frogFreed ? undefined : state.frog,
    )
      ? state
      : {
          ...state,
          phase: "lost",
          announcement: "No refills remain, and no reward is within reach. Try a tighter route.",
        };
  }
  const rakeTargets = chooseRakeTargets(
    state.map,
    state.laidTrail,
    state.position,
    state.gardenerTurns + 1,
    {
      budget: GARDENER_REFILL * (MAX_GARDENER_TURNS - state.gardenerTurns),
      from: state.gardenerPosition,
    },
  );
  const gardenerActions = planGardenerTurn(
    state.map,
    state.gardenerPosition,
    rakeTargets,
    state.position,
  );
  return {
    ...state,
    phase: "gardener",
    gardenerActivity: "ready",
    gardenerActions,
    rakeTargets: gardenerActions
      .filter((action) => action.kind === "rake")
      .map((action) => action.position),
    gardenerTurns: state.gardenerTurns + 1,
    announcement: `Gardener's turn. ${rakeTargets.length} approaches to the remaining stones marked for raking. Two stepping stones are coming.`,
  };
};

const makeReducer =
  (layout: GardenLayout) =>
  (state: GameState, action: Action): GameState => {
    const shrine = layout.shrine;
    switch (action.type) {
      case "hopFrog": {
        if (
          state.phase !== "player" ||
          state.frogFreed ||
          state.finaleOpen ||
          manhattan(state.frog, state.position) <= 2
        )
          return state;
        const banks = state.map.filter(
          (tile) =>
            manhattan(tile, state.frog) === 1 &&
            tile.decor === "" &&
            tile.npc === 0 &&
            tile.stone === undefined &&
            !tile.shrine &&
            (tile.walkable || tile.sprite.startsWith("water")) &&
            state.map.some(
              (near) => manhattan(near, tile) <= 1 && near.sprite.startsWith("water"),
            ) &&
            state.map.some((near) => manhattan(near, tile) === 1 && near.walkable) &&
            manhattan(tile, state.position) > 2,
        );
        if (!banks.length) return state;
        const target = banks[Math.min(banks.length - 1, Math.floor(action.roll * banks.length))];
        return {
          ...state,
          frog: { posX: target.posX, posY: target.posY },
          map: state.map.map((tile) =>
            tile === target
              ? { ...tile, decor: "frog" }
              : manhattan(tile, state.frog) === 0
                ? { ...tile, decor: "" }
                : tile,
          ),
        };
      }
      case "arrive": {
        if (state.phase !== "player" || state.finaleOpen) return state;
        return handToGardener(arrive(state, action.position, shrine, state.frog));
      }
      // Pave, then arrive. Two steps in one action so the tile is already firm by the
      // time `arrive` reads the map — otherwise the pilgrim lands on sand he has just
      // paid for and the garden still calls it sand.
      case "lay": {
        if (state.stonesLeft <= 0 || state.phase !== "player" || state.finaleOpen) {
          return state;
        }
        const paved: GameState = {
          ...state,
          lastLaid: action.position,
          lastSupplyDelta: -1,
          map: layStoneAt(state.map, action.position),
          stonesLaid: state.stonesLaid + 1,
          laidTrail: [...state.laidTrail, action.position],
          stonesLeft: state.stonesLeft - 1,
          supplyTicks: state.supplyTicks + 1,
        };
        return handToGardener(arrive(paved, action.position, shrine, state.frog));
      }
      // A raked garden is raked again. Nothing carries over — not the stones you found,
      // not the ones you spent, not the lines of the poem you had earned.
      case "advanceGardener": {
        if (state.phase !== "gardener") return state;
        const completed = state.gardenerActivity === "rake" ? [state.gardenerPosition] : [];
        const map = rakePaths(state.map, layout.map, completed);
        const laidTrail = state.laidTrail.filter(
          (position) => !completed.some((target) => manhattan(position, target) === 0),
        );
        const rakeTargets = state.rakeTargets.filter(
          (position) => !completed.some((target) => manhattan(position, target) === 0),
        );
        const [next, ...gardenerActions] = state.gardenerActions;
        if (next) {
          return {
            ...state,
            map,
            laidTrail,
            rakeTargets,
            gardenerActions,
            gardenerPosition: next.position,
            gardenerActivity: next.kind,
            gardenerFacingLeft:
              next.kind === "walk"
                ? next.position.posX - next.position.posY <
                  state.gardenerPosition.posX - state.gardenerPosition.posY
                : state.gardenerFacingLeft,
          };
        }
        return {
          ...state,
          map,
          laidTrail,
          phase: "player",
          gardenerActivity: "idle",
          gardenerActions: [],
          rakeTargets: [],
          stonesLeft: state.openingTurn ? state.stonesLeft : GARDENER_REFILL,
          openingTurn: false,
          lastSupplyDelta: state.openingTurn ? 0 : GARDENER_REFILL,
          supplyTicks: state.openingTurn ? state.supplyTicks : state.supplyTicks + 1,
          lastLaid: undefined,
          announcement: state.openingTurn
            ? "Your turn. The gardener has made his opening move. Plan your route to the stones."
            : "Your turn. Two fresh stepping stones. Find your next crossing.",
        };
      }
      case "restart": {
        return initialState(randomizeFrog(layout, action.frogRoll, state.frog));
      }
      case "dismissFinale": {
        return { ...state, finaleOpen: false };
      }
    }
  };

const initialState = (layout: GardenLayout): GameState => {
  const gardenerPosition = { posX: 0, posY: 3 };
  const targets = chooseRakeTargets(layout.map, [], layout.start, 1, {
    budget: layout.stoneBudget + MAX_GARDENER_TURNS * GARDENER_REFILL,
    limit: 1,
    from: gardenerPosition,
  });
  const gardenerActions = planGardenerTurn(layout.map, gardenerPosition, targets, layout.start);
  return {
    announcement: "The gardener moves first. Watch him rake an approach to the stones.",
    phase: "gardener",
    openingTurn: true,
    gardenerTurns: 0,
    rakeTargets: gardenerActions
      .filter((action) => action.kind === "rake")
      .map((action) => action.position),
    gardenerPosition: { posX: 0, posY: 3 },
    gardenerFacingLeft: false,
    gardenerActivity: "ready",
    gardenerActions,
    laidTrail: [],
    finaleOpen: false,
    frogFreed: false,
    frog: layout.frog,
    haikuLines: [],
    lastLaid: undefined,
    lastSupplyDelta: 0,
    map: layout.map,
    supplyTicks: 0,
    position: layout.start,
    shrineActivated: false,
    stonesFound: [],
    steps: 0,
    stonesLaid: 0,
    stonesLeft: layout.stoneBudget,
  };
};

const useZazenGame = (options: UseZazenGameOptions = {}): ZazenGameState => {
  const seed = options.seed ?? FALLBACK_SEED;
  const layout = useMemo(() => buildGarden(seed), [seed]);
  const reducer = useMemo(() => makeReducer(layout), [layout]);
  const [state, dispatch] = useReducer(reducer, layout, (initialLayout) =>
    initialState(randomizeFrog(initialLayout, Math.random())),
  );

  useEffect(() => {
    if (state.phase !== "gardener") return;
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const delay =
      state.gardenerActivity === "rake"
        ? GARDENER_RAKE_MS
        : state.gardenerActivity === "walk"
          ? GARDENER_STEP_MS
          : 1100;
    const timer = setTimeout(() => dispatch({ type: "advanceGardener" }), reduced ? 20 : delay);
    return () => clearTimeout(timer);
  }, [state.phase, state.gardenerActivity, state.gardenerActions]);

  useEffect(() => {
    if (state.frogFreed || state.phase !== "player" || state.finaleOpen) return;
    const timer = setInterval(() => dispatch({ type: "hopFrog", roll: Math.random() }), 2400);
    return () => clearInterval(timer);
  }, [state.frogFreed, state.phase, state.finaleOpen]);

  const mapDimensions = useMemo(() => calculateMapDimensions(state.map), [state.map]);

  // Side effects live outside the reducer, which has to stay pure. Watching the state
  // it produced is also what keeps audio and petals in step with the announcement.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const lastStoneCount = useRef(0);

  useEffect(() => {
    // A restart hands back an empty tally, and the ref has to follow it down or the first
    // stone of the second walk arrives silently.
    if (state.stonesFound.length === 0) {
      lastStoneCount.current = 0;
      return;
    }
    if (state.stonesFound.length > lastStoneCount.current) {
      lastStoneCount.current = state.stonesFound.length;
      const latest = state.stonesFound.at(-1);
      if (latest !== undefined) {
        optionsRef.current.onStoneCollected?.(latest);
      }
    }
  }, [state.stonesFound]);

  useEffect(() => {
    if (state.shrineActivated) {
      optionsRef.current.onShrineActivated?.();
    }
  }, [state.shrineActivated]);

  useEffect(() => {
    if (state.finaleOpen) {
      optionsRef.current.onFinaleOpened?.();
    }
  }, [state.finaleOpen]);

  const lastLaidCount = useRef(0);

  useEffect(() => {
    if (state.stonesLaid === 0) {
      lastLaidCount.current = 0;
      return;
    }
    if (state.stonesLaid > lastLaidCount.current) {
      lastLaidCount.current = state.stonesLaid;
      if (state.lastLaid) {
        optionsRef.current.onStoneLaid?.(state.lastLaid);
      }
    }
  }, [state.lastLaid, state.stonesLaid]);

  const teleportForTest = useCallback((position: Position) => {
    dispatch({ position, type: "arrive" });
  }, []);

  const restart = useCallback(() => {
    dispatch({ type: "restart", frogRoll: Math.random() });
  }, []);

  // One verb with two prices. Stepping onto firm ground is free; stepping onto raked sand
  // spends a stone and pays for the crossing permanently. The player performs the same
  // gesture either way — the garden decides what it costs.
  const move = useCallback(
    (direction: Direction) => {
      if (state.finaleOpen || state.phase !== "player") {
        return;
      }
      const result = performMove(direction, state.position, state.map);
      if (result) {
        dispatch({ position: result.newPosition, type: "arrive" });
        return;
      }
      if (state.stonesLeft <= 0) {
        return;
      }
      const target = applyDirectionOffset(direction, state.position.posX, state.position.posY);
      const tile = tileAt(state.map, target);
      if (!tile || !canPaveTile(tile)) {
        return;
      }
      dispatch({ position: target, type: "lay" });
    },
    [state.finaleOpen, state.phase, state.map, state.position, state.stonesLeft],
  );

  const dismissFinale = useCallback(() => {
    dispatch({ type: "dismissFinale" });
  }, []);

  return {
    ...state,
    dismissFinale,
    mapDimensions,
    move,
    restart,
    shrine: layout.shrine,
    stoneBudget: layout.stoneBudget,
    teleportForTest,
  };
};

export default useZazenGame;
export type { UseZazenGameOptions, ZazenGameState };
