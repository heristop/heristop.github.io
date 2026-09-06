import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { GardenSeed } from "../../../../data/garden-schema";
import { FALLBACK_SEED, STONE_COUNT } from "../../../../data/garden-schema";
import type { Direction, HaikuEntry, MapTile, Position } from "../types";
import type { GardenLayout } from "../board/terrain";
import { HAIKU_LINES, STONE_REFUEL, buildGarden } from "../board/terrain";
import {
  activateShrine,
  canPaveTile,
  collectStoneAt,
  isWalkableTile,
  layStoneAt,
  performMove,
  tileAt,
} from "../board/rules";
import { applyDirectionOffset, manhattan } from "../board/geometry";
import { calculateMapDimensions } from "../board/geometry";
import { cheapestCrossing } from "../board/routing";

interface UseZazenGameOptions {
  seed?: GardenSeed;
  onStoneCollected?: (stoneIndex: number) => void;
  onStoneLaid?: (position: Position) => void;
  onShrineActivated?: () => void;
  onFinaleOpened?: () => void;
}

interface GameState {
  announcement: string;
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
}

interface ZazenGameState extends GameState {
  dismissFinale: () => void;
  doomed: boolean;
  mapDimensions: { height: number; offsetX: number; offsetY: number; width: number };
  move: (dir: Direction) => void;
  frog: Position;
  restart: () => void;
  shrine: Position;
  stoneBudget: number;
  stranded: boolean;
  teleportForTest: (position: Position) => void;
}

type Action =
  | { type: "arrive"; position: Position }
  | { type: "lay"; position: Position }
  | { type: "restart" }
  | { type: "dismissFinale" };

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

const makeReducer =
  (layout: GardenLayout) =>
  (state: GameState, action: Action): GameState => {
    const shrine = layout.shrine;
    switch (action.type) {
      case "arrive": {
        return arrive(state, action.position, shrine, layout.frog);
      }
      // Pave, then arrive. Two steps in one action so the tile is already firm by the
      // time `arrive` reads the map — otherwise the pilgrim lands on sand he has just
      // paid for and the garden still calls it sand.
      case "lay": {
        if (state.stonesLeft <= 0) {
          return state;
        }
        const paved: GameState = {
          ...state,
          lastLaid: action.position,
          lastSupplyDelta: -1,
          map: layStoneAt(state.map, action.position),
          stonesLaid: state.stonesLaid + 1,
          stonesLeft: state.stonesLeft - 1,
          supplyTicks: state.supplyTicks + 1,
        };
        return arrive(paved, action.position, shrine, layout.frog);
      }
      // A raked garden is raked again. Nothing carries over — not the stones you found,
      // not the ones you spent, not the lines of the poem you had earned.
      case "restart": {
        return initialState(layout);
      }
      case "dismissFinale": {
        return { ...state, finaleOpen: false };
      }
    }
  };

const initialState = (layout: GardenLayout): GameState => ({
  announcement: "",
  finaleOpen: false,
  frogFreed: false,
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
});

const useZazenGame = (options: UseZazenGameOptions = {}): ZazenGameState => {
  const seed = options.seed ?? FALLBACK_SEED;
  const layout = useMemo(() => buildGarden(seed), [seed]);
  const reducer = useMemo(() => makeReducer(layout), [layout]);
  const [state, dispatch] = useReducer(reducer, layout, initialState);

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
    dispatch({ type: "restart" });
  }, []);

  // One verb with two prices. Stepping onto firm ground is free; stepping onto raked sand
  // spends a stone and pays for the crossing permanently. The player performs the same
  // gesture either way — the garden decides what it costs.
  const move = useCallback(
    (direction: Direction) => {
      if (state.finaleOpen) {
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
    [state.finaleOpen, state.map, state.position, state.stonesLeft],
  );

  // Nowhere left to step and nothing left to spend. Not a failure the game inflicts —
  // just the end of this walk, and the garden can be raked.
  const stranded = useMemo(() => {
    if (state.finaleOpen || state.stonesLeft > 0) {
      return false;
    }
    return (["N", "E", "S", "W"] as const).every((direction) => {
      const next = applyDirectionOffset(direction, state.position.posX, state.position.posY);
      const tile = tileAt(state.map, next);
      return !tile || !isWalkableTile(tile);
    });
  }, [state.finaleOpen, state.map, state.position, state.stonesLeft]);

  // The walk is lost, and provably so: there is no stone you can still afford to reach.
  // Not "some stone is out of reach" — every one of them is. Reaching any stone at all
  // refuels you, so one affordable stone is enough to keep the walk alive, and declaring
  // defeat while an affordable one remains would be the game calling a loss the player
  // could still have played out of. It is checked again after every move, so this fires
  // at the last honest moment rather than the first pessimistic one.
  const doomed = useMemo(() => {
    if (state.finaleOpen) {
      return false;
    }
    const ungathered = layout.stones.filter((_, index) => !state.stonesFound.includes(index));
    // While a stone is still out there the shrine is locked and reaching it proves
    // nothing, so the shrine only becomes an objective once the last stone is in hand.
    const objectives = ungathered.length > 0 ? ungathered : [layout.shrine];
    return objectives.every((target) => {
      const cost = cheapestCrossing(state.map, state.position, target);
      return cost === undefined || cost > state.stonesLeft;
    });
  }, [
    layout.shrine,
    layout.stones,
    state.finaleOpen,
    state.map,
    state.position,
    state.stonesFound,
    state.stonesLeft,
  ]);

  const dismissFinale = useCallback(() => {
    dispatch({ type: "dismissFinale" });
  }, []);

  return {
    ...state,
    dismissFinale,
    doomed,
    frog: layout.frog,
    mapDimensions,
    move,
    restart,
    shrine: layout.shrine,
    stoneBudget: layout.stoneBudget,
    stranded,
    teleportForTest,
  };
};

export default useZazenGame;
export type { UseZazenGameOptions, ZazenGameState };
