import "./world.scss";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GardenSeed } from "../../data/garden-schema";
import {
  DATA_TILES,
  FALLBACK_SEED,
  GRID_SIZE,
  STONE_COUNT,
  WINDOW_DAYS,
} from "../../data/garden-schema";
import type { Direction, MapTile, Position } from "./zazen-garden-types";
import {
  DECOR_HEADROOM,
  applyDirectionOffset,
  directionFromDelta,
  manhattan,
  toScreen,
} from "./zazen-world-geometry";
import { canPaveTile, handleKeyDirection, isWalkableTile, tileAt } from "./zazen-world-rules";
import { cheapestRoute } from "./zazen-stones";
import {
  STONE_REFUEL,
  dayIndexForPosition,
  positionForDay,
  tileIndexForPosition,
} from "./zazen-world-terrain";
import ZazenCat from "./zazen-cat";
import ZazenCompanion from "./zazen-companion";
import ZazenDayCard from "./zazen-day-card";
import ZazenHeatmap from "./zazen-heatmap";
import ZazenDefeatOverlay from "./zazen-defeat-overlay";
import ZazenFinaleOverlay from "./zazen-finale-overlay";
import ZazenHaikuScroll from "./zazen-haiku-scroll";
import ZazenPilgrim, { PILGRIM_ANCHOR_X } from "./zazen-pilgrim";
import useZazenAudio from "./use-zazen-audio";
import useZazenGame from "./use-zazen-game";
import useZazenStep, { prefersReducedMotion } from "./use-zazen-step";

const ICON_SIZE = 16;
const ICON_STROKE_WIDTH = 2.5;
const BURST_SETTLE_MS = 30;
const MAX_SCALE = 3;
const AUTO_STEP_MS = 190;

// Left alone, he walks. He waits this long after you last touched anything, then takes a
// step every so often — never onto a stone or the shrine, because those are yours to find
// and a pilgrim who solved the garden while you were reading the page is not company, he
// is a spoiler.
// The cat keeps his own clock. He does not wait for you to stop touching things, because
// he does not care what you are doing — which is most of what makes a cat read as a cat.
// Where the cat may put his feet: firm ground, and not on anything that belongs to the
// player. He may use the stones you have laid — he is following you across them, which is
// the point of laying them.
const catCanStand = (map: readonly MapTile[], position: Position): boolean => {
  const tile = tileAt(map, position);
  return (
    tile !== undefined &&
    isWalkableTile(tile) &&
    tile.stone === undefined &&
    tile.shrine === undefined
  );
};

// The first step of the shortest walk to the pilgrim over ground the cat can use.
//
// He used to pick whichever neighbour happened to be nearer as the crow flies, which is
// fine on open moss and useless the moment there is sand between you: he would walk into
// the nearest pocket of firm ground, find every exit facing the wrong way, and spend the
// rest of the game there. A breadth-first search costs nothing on a board this size and
// takes the long way round when the long way round is the only way.
const catStepToward = (
  map: readonly MapTile[],
  from: Position,
  to: Position,
): Position | undefined => {
  const key = (position: Position) => `${position.posX},${position.posY}`;
  const first = new Map<string, Position>();
  const seen = new Set<string>([key(from)]);
  const queue: Position[] = [from];

  while (queue.length > 0) {
    const current = queue.shift() as Position;
    for (const direction of DIRECTIONS) {
      const next = applyDirectionOffset(direction, current.posX, current.posY);
      const nextKey = key(next);
      if (seen.has(nextKey)) {
        continue;
      }
      // The pilgrim's own tile is the destination, not a place to stand — he stops beside
      // you rather than in you.
      if (next.posX === to.posX && next.posY === to.posY) {
        return first.get(key(current)) ?? next;
      }
      if (!catCanStand(map, next)) {
        continue;
      }
      seen.add(nextKey);
      first.set(nextKey, first.get(key(current)) ?? next);
      queue.push(next);
    }
  }
  return undefined;
};

// Somewhere he can actually walk from. A fixed corner was fine while the garden was
// mostly moss and became a trap the moment half the fortnight was raked sand: he would
// spawn on a tile with four unwalkable neighbours and stand there for the whole game.
// Nearest standable tile to a preferred spot, breadth first, so wherever the sand falls he
// starts on ground with somewhere to go.
const catFooting = (map: readonly MapTile[], near: Position): Position => {
  const key = (position: Position) => `${position.posX},${position.posY}`;
  const seen = new Set<string>([key(near)]);
  const queue: Position[] = [near];
  while (queue.length > 0) {
    const current = queue.shift() as Position;
    const open = DIRECTIONS.map((direction) =>
      applyDirectionOffset(direction, current.posX, current.posY),
    );
    if (catCanStand(map, current) && open.some((next) => catCanStand(map, next))) {
      return current;
    }
    for (const next of open) {
      if (!seen.has(key(next)) && tileAt(map, next)) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return near;
};

const CAT_STEP_MS = 900;
const COMPANION_STEP_MS = 620;
const CAT_MOVE_CHANCE = 0.55;
// How often a step is taken towards the pilgrim rather than wherever he fancies.
const CAT_FOLLOW_CHANCE = 0.8;
// Beyond this he stops pretending he was going that way anyway.
const CAT_HURRY_RANGE = 4;
const CAT_START: Position = { posX: 0, posY: 3 };

const WANDER_AFTER_MS = 7000;
const WANDER_TICK_MS = 2600;
const WANDER_CHANCE = 0.55;
const DIRECTIONS: readonly Direction[] = ["N", "S", "E", "W"];

// Integer scale only. A fractional scale resamples every sprite and destroys the pixel
// grid the art is authored on; below scale 1 the map pans inside its wrapper rather
// than shrinking.
const chooseMapScale = (available: number, naturalWidth: number): number => {
  if (naturalWidth <= 0) {
    return 1;
  }
  return Math.min(MAX_SCALE, Math.max(1, Math.floor(available / naturalWidth)));
};

interface DirectionButtonProps {
  direction: Direction;
  icon: React.ReactNode;
  keyLabel: string;
  label: string;
  modifier: string;
  onMove: (dir: Direction) => void;
  tooltip: string;
  tooltipPlacement?: "top" | "bottom" | "left" | "right";
}

const DirectionButton = ({
  direction,
  onMove,
  icon,
  label,
  tooltip,
  tooltipPlacement = "top",
  keyLabel,
  modifier,
}: DirectionButtonProps) => (
  <button
    type="button"
    className={`zazen-world__compass-btn zazen-world__compass-btn--${modifier}`}
    onClick={() => {
      onMove(direction);
    }}
    aria-label={label}
    data-tooltip={tooltip}
    data-tooltip-placement={tooltipPlacement}
  >
    {icon}
    <span>{keyLabel}</span>
  </button>
);

const tileClassName = (tile: MapTile): string => {
  const classes = ["zazen-world__tile-image"];
  if (tile.laid === true) {
    classes.push("zazen-world__tile-image--laid");
  }
  if (tile.stone !== undefined) {
    classes.push("zazen-world__tile-image--stone");
  }
  if (tile.shrine === "locked") {
    classes.push("zazen-world__tile-image--shrine-locked");
  }
  if (tile.shrine === "active") {
    classes.push("zazen-world__tile-image--shrine-active");
  }
  return classes.join(" ");
};

// Grains thrown out of the broken raking, spread along the ground plane's 2:1 ratio so
// they scatter across the tile rather than out of it. Six is enough to read as a handful
// and few enough that six of them at once never becomes weather.
const GRAINS: readonly (readonly [number, number])[] = [
  [-19, -5],
  [-11, -8],
  [-4, 6],
  [5, 7],
  [12, -8],
  [19, -4],
];

// Plays exactly once, on the render where the tile first becomes `laid`, because that is
// the render on which this element first exists. No timer, no transient flag: the stone
// is laid forever, and the mount is the event.
const LaidBurst = () => (
  <span className="zazen-world__laid" aria-hidden="true">
    <span className="zazen-world__laid-ring" />
    {GRAINS.map(([x, y]) => (
      <span
        className="zazen-world__laid-grain"
        key={`${x},${y}`}
        style={{ "--grain-x": `${x}px`, "--grain-y": `${y}px` } as React.CSSProperties}
      />
    ))}
  </span>
);

// Where a stone was taken. Same mount-once trick as the landing: the tile gains `gathered`
// on exactly one render, and that is the render this element first exists on.
const GatherBurst = () => (
  <span className="zazen-world__gather" aria-hidden="true">
    <span className="zazen-world__gather-ring" />
    <span className="zazen-world__gather-ring zazen-world__gather-ring--late" />
    {GRAINS.map(([x, y]) => (
      <span
        className="zazen-world__gather-spark"
        key={`${x},${y}`}
        style={
          { "--grain-x": `${x * 0.8}px`, "--grain-y": `${y * 0.8 - 8}px` } as React.CSSProperties
        }
      />
    ))}
  </span>
);

// The transformation. Smoke first, then her — the frog is simply not there afterwards,
// and a swap with no smoke in between reads as a rendering fault rather than as magic.
// Twelve sparks rather than six, thrown round a full circle so they read as a ring
// breaking open rather than as dust off a landing.
const SPARKS = Array.from({ length: 12 }, (_unused, index) => {
  const angle = (index / 12) * Math.PI * 2;
  // Flattened to the ground plane's 2:1 ratio on the way out, then lifted — the arc is
  // what makes them rise off a floor rather than slide across a picture of one.
  return [Math.cos(angle) * 22, Math.sin(angle) * 11 - 16] as const;
});

const FrogBurst = () => (
  <span className="zazen-world__spell" aria-hidden="true">
    <span className="zazen-world__spell-flash" />
    <span className="zazen-world__spell-ring" />
    <span className="zazen-world__spell-ring zazen-world__spell-ring--late" />
    <span className="zazen-world__spell-column" />
    <span className="zazen-world__spell-smoke" />
    <span className="zazen-world__spell-smoke zazen-world__spell-smoke--wide" />
    {SPARKS.map(([x, y], index) => (
      <span
        className="zazen-world__spell-mote"
        key={`${x},${y}`}
        style={
          {
            "--grain-x": `${Math.round(x)}px`,
            "--grain-y": `${Math.round(y)}px`,
            "--spark-delay": `${index * 26}ms`,
          } as React.CSSProperties
        }
      />
    ))}
  </span>
);

const TileRenderer = React.memo(function TileRenderer({ tile }: { tile: MapTile }) {
  const stoneAttr = tile.stone !== undefined ? { "data-stone-index": tile.stone } : {};
  // Marks the tile as carrying something that stands on the ground, so the stylesheet can
  // lay a contact shadow under it. Without one, every tree and lantern floats: an
  // isometric projection only reads as depth if things are anchored to the plane.
  // A fish is not standing on anything. The contact shadow is what tells the eye a tree is
  // ON the tile rather than floating over it, and under a koi it drew a hard grey ellipse
  // on the surface of the pond — a shadow cast by something that is already underwater.
  const standing = (tile.decor !== "" && tile.decor !== "koi") || tile.npc !== 0;
  const standingAttr = standing ? { "data-standing": "" } : {};
  // Anything that is its own light source. HD-2D spends most of its budget on bloom, and
  // bloom needs to know which pixels are emitting rather than merely bright.
  const glowAttr =
    tile.decor === "lantern-lit" || tile.shrine === "active" ? { "data-glow": "" } : {};
  return (
    <div
      className={tileClassName(tile)}
      style={{ backgroundImage: `url('/images/zazen/sol/${tile.sprite}.png')` }}
      {...stoneAttr}
      {...standingAttr}
      {...glowAttr}
    >
      {tile.laid === true && <LaidBurst />}
      {tile.gathered === true && <GatherBurst />}
      {tile.transformed === true && <FrogBurst />}
      {tile.npc !== 0 && (
        <img
          src={`/images/zazen/persos/npc-${tile.npc}.png`}
          alt=""
          className={
            tile.transformed === true
              ? "zazen-world__npc zazen-world__npc--arriving"
              : "zazen-world__npc"
          }
        />
      )}
      {tile.decor !== "" && (
        <img
          src={`/images/zazen/decors/${tile.decor}.png`}
          alt=""
          className="zazen-world__decor"
        />
      )}
    </div>
  );
});

const northIcon = <ArrowUp size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const westIcon = <ArrowLeft size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const eastIcon = <ArrowRight size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const southIcon = <ArrowDown size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;

const CompassPanel = ({ onMove }: { onMove: (dir: Direction) => void }) => (
  <div className="zazen-world__compass" role="group" aria-labelledby="compass-label">
    <div className="sr-only" id="compass-label">
      Movement controls
    </div>
    <div className="zazen-world__compass-container">
      <DirectionButton
        direction="N"
        onMove={onMove}
        icon={northIcon}
        label="Walk up and left (W or up arrow)"
        tooltip="W or ↑ — up-left"
        tooltipPlacement="top"
        keyLabel="W"
        modifier="north"
      />
      <DirectionButton
        direction="W"
        onMove={onMove}
        icon={westIcon}
        label="Walk down and left (A or left arrow)"
        tooltip="A or ← — down-left"
        tooltipPlacement="left"
        keyLabel="A"
        modifier="west"
      />
      <DirectionButton
        direction="E"
        onMove={onMove}
        icon={eastIcon}
        label="Walk up and right (D or right arrow)"
        tooltip="D or → — up-right"
        tooltipPlacement="right"
        keyLabel="D"
        modifier="east"
      />
      <DirectionButton
        direction="S"
        onMove={onMove}
        icon={southIcon}
        label="Walk down and right (S or down arrow)"
        tooltip="S or ↓ — down-right"
        tooltipPlacement="bottom"
        keyLabel="S"
        modifier="south"
      />
    </div>
  </div>
);

// Without this the garden is a pretty texture. With it, it is a record you can read.
// The legend has one job now: say which ground you may walk on and which costs a stone.
// Naming four shades of commit-count told you what the colours meant and nothing about
// how to play, which is the wrong half of the story to tell first.
// The rules, as three cards rather than as a paragraph. They were prose — five lines of
// it, above the board — and prose is the wrong instrument here: nobody reads an essay to
// find out what a tile costs. Every rule is now a swatch, a price and four words, which
// is the whole game in about three seconds.
interface Rule {
  key: string;
  cost: string;
  gloss: string;
  sprites: readonly string[];
  tone: "free" | "cost" | "goal";
}

const RULES: readonly Rule[] = [
  {
    cost: "free",
    gloss: "days I committed",
    key: "firm",
    sprites: ["moss-mid", "gravel-edge"],
    tone: "free",
  },
  {
    cost: "one stone",
    gloss: "days I did not",
    key: "sand",
    sprites: ["sand-0"],
    tone: "cost",
  },
  {
    cost: `+${STONE_REFUEL} each`,
    gloss: `all ${STONE_COUNT}, then the shrine`,
    key: "stones",
    sprites: [],
    tone: "goal",
  },
];

const RULE_TITLES: Record<string, string> = {
  firm: "Moss & gravel",
  sand: "Raked sand",
  stones: "Gather the stones",
};

const Legend = () => (
  <ul className="path-stones__rules">
    {RULES.map((rule) => (
      <li className={`path-stones__rule path-stones__rule--${rule.tone}`} key={rule.key}>
        <span className="path-stones__rule-swatches" aria-hidden="true">
          {rule.tone === "goal" ? (
            <span className="path-stones__rule-swatch path-stones__rule-swatch--stone" />
          ) : (
            rule.sprites.map((sprite) => (
              <span
                className="path-stones__rule-swatch"
                key={sprite}
                style={{ backgroundImage: `url('/images/zazen/sol/${sprite}.png')` }}
              />
            ))
          )}
        </span>
        <span className="path-stones__rule-text">
          <b>{RULE_TITLES[rule.key]}</b>
          <span className="path-stones__rule-gloss">{rule.gloss}</span>
        </span>
        <span className="path-stones__rule-cost">{rule.cost}</span>
      </li>
    ))}
  </ul>
);

// The garden arrives the way it was made: the frame first, then one tile per day from the
// oldest to the newest, so the board is visibly built out of the history rather than
// merely derived from it. The day order is the boustrophedon walk, which means a streak
// comes in as one continuous run of moss rather than as scattered tiles.
// Dust in the light. Eight is enough to read as air and few enough to stay ambient.
const MOTES = [0, 1, 2, 3, 4, 5, 6, 7];

// Long enough for the stone to land, the dust to clear and the counter to settle at zero.
const DEFEAT_SETTLE_MS = 1100;

// No ceiling on what a route may cost. Used when the question is "what would this cost"
// rather than "what can I have" — the board is 144 tiles, so nothing can exceed it.
const UNCAPPED = Number.POSITIVE_INFINITY;

// Restarting a CSS animation on an element that is still on screen. The obvious move is to
// key the element so React remounts it — but a key on a static child position leaves the
// outgoing element behind, and the counter rendered as two numerals side by side: a "2"
// that should have gone and the "0" that replaced it. This flips an attribute instead, and
// the stylesheet hangs two identically-bodied keyframes off the two values, so every event
// swaps animation-name and the animation restarts from the top. No remount, nothing to
// leak. Nothing has happened yet at zero, so nothing animates on first paint.
const pulseFor = (count: number): string | undefined =>
  count > 0 ? String(count % 2) : undefined;

const GROW_FRAME_MS = 240;
const GROW_PER_DAY_MS = 11;

const growDelayFor = (dayIndex: number | undefined): number =>
  dayIndex === undefined ? 0 : GROW_FRAME_MS + dayIndex * GROW_PER_DAY_MS;

// Light falls across the garden from the far corner. Every tile was lit identically,
// which is why a hundred and forty-four of them read as a flat sheet however good the
// individual sprites were: depth needs a gradient, not just a projection. posX + posY is
// the distance along the view axis, so it doubles as the falloff.
const DEPTH_SPAN = (GRID_SIZE - 1) * 2;
const DEPTH_FAR = 1.03;
const DEPTH_NEAR = 0.88;

// A stable pseudo-random offset per tile. Without it every tree on the board leans the
// same way at the same moment, which reads as one sheet of paper moving rather than wind.
const windPhaseFor = (posX: number, posY: number): number =>
  ((posX * 7 + posY * 13) % 11) / 11;

const depthLightFor = (posX: number, posY: number): number => {
  const depth = (posX + posY) / DEPTH_SPAN;
  return DEPTH_FAR + (DEPTH_NEAR - DEPTH_FAR) * depth;
};

// When the last day has landed. The pilgrim waits for his garden to exist.
const GROW_TOTAL_MS = GROW_FRAME_MS + DATA_TILES * GROW_PER_DAY_MS;

const isStepTarget = (tile: MapTile, position: Position): boolean => {
  const dx = Math.abs(tile.posX - position.posX);
  const dy = Math.abs(tile.posY - position.posY);
  if (dx + dy !== 1) {
    return false;
  }
  return isWalkableTile(tile);
};

const dispatchSakuraBurstForStone = (stoneIndex: number) => {
  if (typeof document === "undefined") {
    return;
  }
  const el = document.querySelector<HTMLElement>(`[data-stone-index="${stoneIndex}"]`);
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  document.dispatchEvent(
    new CustomEvent("sakura:burst", {
      detail: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    }),
  );
};

const ZazenWorld = ({ seed }: { seed?: GardenSeed }) => {
  const audio = useZazenAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const lastBurstStoneRef = useRef<number>(-1);
  const hasFramedRef = useRef(false);
  const [mapScale, setMapScale] = useState(1);

  // The inspect cursor. undefined means "not inspecting" — the day card then reports
  // whichever day the pilgrim is standing on.
  const [cursorDay, setCursorDay] = useState<number | undefined>(undefined);
  // Queued route for Enter-to-walk, consumed one tile at a time.
  const [route, setRoute] = useState<readonly Position[]>([]);

  const [cat, setCat] = useState({ facingLeft: false, position: CAT_START });

  // Whether the cat ever came close enough to be greeted. He asks for nothing and is
  // therefore easy to walk straight past, which is the only reason stopping for him is
  // worth anything — so it is recorded once and never taken back.
  const [catMet, setCatMet] = useState(false);

  // She does not exist until she is freed, and then she walks. Undefined rather than a
  // parked position, so nothing has to remember whether she is real yet.
  const [companion, setCompanion] = useState<
    { facingLeft: boolean; position: Position } | undefined
  >(undefined);


  // Any deliberate input parks him. He is ambience, and ambience must never fight the
  // hand on the keyboard.
  const lastInputRef = useRef(Date.now());
  const noteInput = useCallback(() => {
    lastInputRef.current = Date.now();
  }, []);

  const handleStoneCollected = useCallback(
    (stoneIndex: number) => {
      audio.playChime();
      lastBurstStoneRef.current = stoneIndex;
    },
    [audio],
  );

  const handleFinaleOpened = useCallback(() => {
    audio.playBell();
  }, [audio]);

  // The one sound in the garden that means you spent something.
  const handleStoneLaid = useCallback(() => {
    audio.playStoneDrop();
  }, [audio]);

  const game = useZazenGame({
    onFinaleOpened: handleFinaleOpened,
    onStoneCollected: handleStoneCollected,
    onStoneLaid: handleStoneLaid,
    seed,
  });

  const step = useZazenStep(game.position);

  const [hoverDay, setHoverDay] = useState<number | undefined>(undefined);
  const [hoverPosition, setHoverPosition] = useState<Position | undefined>(undefined);

  // Click any reachable tile to walk there. Adjacency was a needless restriction: the
  // garden is 144 tiles and nudging the pilgrim one step at a time across it is busywork,
  // not play.
  // What the player was last told about a route they could not take. Cleared the moment
  // they do anything else, so it reads as a reply rather than as a status.
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  const handleTileClick = useCallback(
    (tile: MapTile) => {
      noteInput();
      // Priced, not merely walkable. The mouse used to be barred from sand entirely — you
      // could only pave by nudging into it with a key, which made the game's central move
      // unavailable to the input most people were using.
      //
      // Priced without a ceiling, too: asking for the route you can afford and getting
      // nothing back cannot tell the difference between "there is no way there" and "there
      // is, and it costs one more stone than you are holding". The second is the more
      // interesting answer and the game was swallowing it.
      const route_ = cheapestRoute(game.map, game.position, tile, UNCAPPED);
      if (!route_ || route_.path.length === 0) {
        setRefusal("No way through to there at any price.");
        return;
      }
      if (route_.cost > game.stonesLeft) {
        setRefusal(
          `That way costs ${route_.cost} ${route_.cost === 1 ? "stone" : "stones"}. ` +
            `You are carrying ${game.stonesLeft}.`,
        );
        return;
      }
      setRefusal(undefined);
      setCursorDay(undefined);
      setRoute(route_.path);
    },
    [game.map, game.position, game.stonesLeft, noteInput],
  );

  // Route preview. Showing where a click will take you before it happens is what makes
  // click-to-walk feel deliberate rather than approximate — and now that a route can cost
  // something, showing what it costs before you commit is the difference between a choice
  // and a surprise. Priced uncapped for the same reason the click is: a route you cannot
  // afford still has a price, and the price is the thing worth showing.
  const preview = useMemo(() => {
    if (!hoverPosition || route.length > 0) {
      return undefined;
    }
    return cheapestRoute(game.map, game.position, hoverPosition, UNCAPPED);
  }, [game.map, game.position, hoverPosition, route.length]);

  const previewAffordable = preview === undefined || preview.cost <= game.stonesLeft;

  // The hovered route, in words. Free crossings say nothing: most of the board is free and
  // a readout that never goes quiet stops being read.
  const routePrice =
    preview === undefined || preview.path.length === 0 || preview.cost === 0
      ? "\u00a0"
      : previewAffordable
        ? `This way: ${preview.cost} ${preview.cost === 1 ? "stone" : "stones"}`
        : `This way: ${preview.cost} ${preview.cost === 1 ? "stone" : "stones"} — you have ${game.stonesLeft}`;

  const previewKeys = useMemo(
    () => new Set((preview?.path ?? []).map((step_) => `${step_.posX},${step_.posY}`)),
    [preview],
  );

  // The tiles on that route that are still sand: each one is a stone you would spend.
  const previewPaveKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const step_ of preview?.path ?? []) {
      const tile = tileAt(game.map, step_);
      if (tile && canPaveTile(tile)) {
        keys.add(`${step_.posX},${step_.posY}`);
      }
    }
    return keys;
  }, [game.map, preview]);

  // Walk to a day picked from the heatmap. Same route machinery as a tile click, so the
  // chart is a control rather than a decoration hanging off the side of the game.
  const walkToDay = useCallback(
    (dayIndex: number) => {
      noteInput();
      const target = positionForDay(dayIndex);
      const path = cheapestRoute(game.map, game.position, target, game.stonesLeft)?.path;
      setRefusal(undefined);
      if (!path || path.length === 0) {
        return;
      }
      setCursorDay(undefined);
      setRoute(path);
    },
    [game.map, game.position],
  );

  const resolvedSeed = seed ?? FALLBACK_SEED;

  const stoneDays = useMemo(() => {
    const set = new Set<number>();
    for (const tile of game.map) {
      if (tile.stone === undefined) {
        continue;
      }
      const index = dayIndexForPosition(tile);
      if (index !== undefined) {
        set.add(index);
      }
    }
    return set;
  }, [game.map]);

  const inspectDay = hoverDay ?? cursorDay;
  const focusedPosition =
    inspectDay === undefined ? game.position : positionForDay(inspectDay);
  const focusedTile = tileAt(game.map, focusedPosition);
  const focusedDayIndex = dayIndexForPosition(focusedPosition);

  // Trailing effect: fire the sakura burst after the stone tile's decor has cleared, so
  // the petals appear from the tile the pilgrim just stepped onto.
  useEffect(() => {
    if (lastBurstStoneRef.current === -1) {
      return;
    }
    const stoneIndex = lastBurstStoneRef.current;
    lastBurstStoneRef.current = -1;
    const timer = setTimeout(() => {
      dispatchSakuraBurstForStone(stoneIndex);
    }, BURST_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [game.stonesFound]);

  // Responsive scale. Measure the container and pick the largest whole-pixel zoom.
  useEffect(() => {
    const naturalWidth = game.mapDimensions.width;
    if (naturalWidth === 0) {
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const compute = () => {
      const style = getComputedStyle(node);
      const paddingL = Number.parseFloat(style.paddingLeft) || 0;
      const paddingR = Number.parseFloat(style.paddingRight) || 0;
      const available = node.clientWidth - paddingL - paddingR;
      if (available <= 0) {
        return;
      }
      setMapScale(chooseMapScale(available, naturalWidth));
    };
    compute();
    const hasResizeObserver = typeof globalThis.ResizeObserver === "function";
    const observer = hasResizeObserver ? new globalThis.ResizeObserver(compute) : undefined;
    observer?.observe(node);
    globalThis.addEventListener("resize", compute);
    return () => {
      observer?.disconnect();
      globalThis.removeEventListener("resize", compute);
    };
  }, [game.mapDimensions.width]);

  // Keep the pilgrim on screen when the garden is wider than the viewport. The board pans
  // rather than shrinking, so on a phone it opened on an empty corner with the pilgrim
  // somewhere off to the right. This only intervenes when the pilgrim has actually left
  // the visible strip — inside it the visitor's own panning is left alone.
  useEffect(() => {
    const pan = panRef.current;
    if (!pan || pan.scrollWidth <= pan.clientWidth) {
      return;
    }
    const framed = hasFramedRef.current;
    hasFramedRef.current = true;
    const { left } = toScreen(
      step.renderPosition.posX,
      step.renderPosition.posY,
      game.mapDimensions.offsetX,
      game.mapDimensions.offsetY,
    );
    const pilgrimX = (left + PILGRIM_ANCHOR_X) * mapScale;
    const margin = Math.min(96, pan.clientWidth / 4);
    const tooFarLeft = pilgrimX < pan.scrollLeft + margin;
    const tooFarRight = pilgrimX > pan.scrollLeft + pan.clientWidth - margin;
    if (!tooFarLeft && !tooFarRight) {
      return;
    }
    // Following the pilgrim is a movement and should be seen as one; the very first
    // framing is not. Sliding the garden sideways the moment the page opens reads as the
    // board drifting of its own accord, so the opening view is simply the right one.
    pan.scrollTo({
      behavior: !framed || prefersReducedMotion() ? "auto" : "smooth",
      left: pilgrimX - pan.clientWidth / 2,
    });
  }, [step.renderPosition, game.mapDimensions, mapScale]);

  // A fresh garden — or a restart — may not have firm ground where he was standing.
  useEffect(() => {
    setCat((current) => {
      const footing = catFooting(game.map, CAT_START);
      return footing.posX === current.position.posX && footing.posY === current.position.posY
        ? current
        : { facingLeft: current.facingLeft, position: footing };
    });
  }, [game.map]);

  const catGreeting = manhattan(cat.position, game.position) <= 1;
  useEffect(() => {
    if (catGreeting) {
      setCatMet(true);
    }
  }, [catGreeting]);

  // She stands up where the frog was and walks from there. A restart takes her away again.
  useEffect(() => {
    if (!game.frogFreed) {
      setCompanion(undefined);
      return;
    }
    // Where the frog was, or the nearest tile to it she can actually stand and walk on —
    // she was sitting at the water's edge and the water is not hers to cross.
    setCompanion(
      (current) => current ?? { facingLeft: false, position: catFooting(game.map, game.frog) },
    );
  }, [game.frog, game.frogFreed, game.map]);

  // She follows, on the same rules as the cat and a beat slower — she is keeping you
  // company rather than herding you, and two things arriving at your heel in step reads
  // as an escort.
  useEffect(() => {
    if (!game.frogFreed || game.finaleOpen || prefersReducedMotion()) {
      return;
    }
    const timer = setInterval(() => {
      setCompanion((current) => {
        if (!current) {
          return current;
        }
        if (manhattan(current.position, game.position) <= 1) {
          return current;
        }
        const next = catStepToward(game.map, current.position, game.position);
        if (!next) {
          return current;
        }
        return {
          facingLeft: next.posX - next.posY < current.position.posX - current.position.posY,
          position: next,
        };
      });
    }, COMPANION_STEP_MS);
    return () => {
      clearInterval(timer);
    };
  }, [game.finaleOpen, game.frogFreed, game.map, game.position]);

  // The cat's own errand. Same walkability rules as the pilgrim, and the same refusal to
  // step on a stone or the shrine — those are the player's to find, and a cat that
  // collected them would be a thief rather than company.
  useEffect(() => {
    if (prefersReducedMotion()) {
      return;
    }
    const timer = setInterval(() => {
      // He hurries when he has fallen behind and dawdles when he has not, which is the
      // difference between a follower and an escort.
      const chance =
        manhattan(cat.position, game.position) > CAT_HURRY_RANGE ? 1 : CAT_MOVE_CHANCE;
      if (Math.random() > chance) {
        return;
      }
      setCat((current) => {
        // He has noticed the pilgrim. Cats do not walk away from someone who has just
        // arrived — they stop, turn, and wait to be acknowledged.
        if (manhattan(current.position, game.position) <= 1) {
          return {
            facingLeft:
              game.position.posX - game.position.posY <
              current.position.posX - current.position.posY,
            position: current.position,
          };
        }
        const open = DIRECTIONS.map((direction) =>
          applyDirectionOffset(direction, current.position.posX, current.position.posY),
        ).filter((next) => catCanStand(game.map, next));
        // Boxed in. The ground around him can change under his feet — the player paves,
        // and a tile he was using can be the only way out of a pocket — so rather than
        // freeze he steps to the nearest place with somewhere to go.
        if (open.length === 0) {
          const footing = catFooting(game.map, game.position);
          return footing.posX === current.position.posX &&
            footing.posY === current.position.posY
            ? current
            : { facingLeft: current.facingLeft, position: footing };
        }

        // He tags along. Not on a leash — one step in every few is still his own, or he
        // reads as a cursor with fur — but the rest follow the route, which is what turns
        // him from scenery you happen to pass into company you have picked up. When there
        // is no route at all he wanders, rather than standing there facing a wall.
        const following = Math.random() < CAT_FOLLOW_CHANCE;
        const routed = following
          ? catStepToward(game.map, current.position, game.position)
          : undefined;
        const next = routed ?? open[Math.floor(Math.random() * open.length)];
        return {
          // N and W both travel leftwards on screen; E and S both travel right.
          facingLeft:
            next.posX - next.posY < current.position.posX - current.position.posY,
          position: next,
        };
      });
    }, CAT_STEP_MS);
    return () => {
      clearInterval(timer);
    };
  }, [cat.position, game.map, game.position]);

  // His own life. A garden whose only inhabitant stands perfectly still until poked reads
  // as a diorama; one where he wanders off on his own reads as a place that exists whether
  // or not you are watching.
  useEffect(() => {
    if (game.finaleOpen || prefersReducedMotion()) {
      return;
    }
    const timer = setInterval(() => {
      if (route.length > 0 || Date.now() - lastInputRef.current < WANDER_AFTER_MS) {
        return;
      }
      // He dawdles: most ticks he simply stays where he is, which is what stops the
      // wandering reading as a machine pacing a cage.
      if (Math.random() > WANDER_CHANCE) {
        return;
      }
      const open = DIRECTIONS.filter((direction) => {
        const next = applyDirectionOffset(direction, game.position.posX, game.position.posY);
        const tile = tileAt(game.map, next);
        return (
          tile !== undefined &&
          isWalkableTile(tile) &&
          tile.stone === undefined &&
          tile.shrine === undefined
        );
      });
      if (open.length === 0) {
        return;
      }
      game.move(open[Math.floor(Math.random() * open.length)]);
    }, WANDER_TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [game, route.length]);

  // Walk a queued route one tile per step, so Enter can send the pilgrim to a tile that
  // is not adjacent. Each step goes through game.move, so stones, the shrine and the
  // walkability rules all behave exactly as they do for a keypress.
  useEffect(() => {
    if (route.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const [next, ...rest] = route;
      const dir = directionFromDelta(game.position, next);
      if (dir) {
        game.move(dir);
      }
      setRoute(rest);
    }, AUTO_STEP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [game, route]);

  useEffect(() => {
    const handleKeyPress = (ev: KeyboardEvent) => {
      // Tab steps the inspect cursor through history, oldest to newest. It is only
      // captured while the map itself has focus, and Escape hands focus back to the
      // page, so this is never a keyboard trap.
      const mapFocused =
        mapRef.current !== null &&
        typeof document !== "undefined" &&
        document.activeElement === mapRef.current;

      if (mapFocused && ev.key === "Tab") {
        ev.preventDefault();
        setCursorDay((current) => {
          const from = current ?? dayIndexForPosition(game.position) ?? 0;
          const next = ev.shiftKey ? from - 1 : from + 1;
          return Math.min(WINDOW_DAYS - 1, Math.max(0, next));
        });
        return;
      }

      if (mapFocused && ev.key === "Escape" && cursorDay !== undefined) {
        ev.preventDefault();
        setCursorDay(undefined);
        return;
      }

      if (mapFocused && ev.key === "Enter" && cursorDay !== undefined) {
        ev.preventDefault();
        const path = cheapestRoute(
          game.map,
          game.position,
          positionForDay(cursorDay),
          game.stonesLeft,
        )?.path;
        if (path && path.length > 0) {
          setRoute(path);
        }
        return;
      }

      handleKeyDirection(ev, (dir) => {
        setRoute([]);
        setCursorDay(undefined);
        game.move(dir);
      });
    };
    globalThis.addEventListener("keydown", handleKeyPress);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyPress);
    };
  }, [cursorDay, game]);

  // There is deliberately no swipe-to-move gesture. Sprites are only ever drawn at whole
  // pixel scales, so on a narrow screen the garden pans instead of shrinking — and a
  // horizontal drag cannot both pan the board and step the pilgrim. Panning wins,
  // because you have to be able to see the board; the compass and tapping a neighbouring
  // tile remain the ways to move, on every device.

  const { mapDimensions } = game;
  // A defeat that appears the instant the last stone lands reads as an accusation. Let
  // the dust settle first; the state itself is already final, this only delays the news.
  const [defeatVisible, setDefeatVisible] = useState(false);
  useEffect(() => {
    if (!game.doomed) {
      setDefeatVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setDefeatVisible(true);
    }, DEFEAT_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [game.doomed]);

  const handleReplay = useCallback(() => {
    setCatMet(false);
    setDefeatVisible(false);
    setRoute([]);
    setCursorDay(undefined);
    game.restart();
  }, [game]);

  const stonesLabel = `${game.stonesFound.length} of ${STONE_COUNT} stones gathered`;
  const supplyLabel = `${game.stonesLeft} stepping stones left to lay`;
  const supplyClasses = ["path-stones__gauge", "path-stones__gauge--supply"];
  if (game.stonesLeft === 0) {
    supplyClasses.push("path-stones__gauge--spent");
  } else if (game.stonesLeft === 1) {
    supplyClasses.push("path-stones__gauge--low");
  }

  return (
    <div className="zazen-world-container path-stones" ref={containerRef}>
      <div className="sr-only" aria-live="polite">
        {game.announcement}
      </div>
      <div className="zazen-world__header path-stones__header">
        <h1 className="sr-only">Path of Stones</h1>
        <p className="path-stones__intro">Cross the garden without disturbing the sand.</p>
        {/* One line where there were five. Everything the paragraph used to explain is
            now shown by the rule cards below, and what is left is the only thing the
            cards cannot show: whose fortnight this is and which corner it starts at. */}
        <p className="path-stones__source">
          {WINDOW_DAYS} days of my public GitHub activity — one bed each, oldest at the
          near corner.
        </p>
        <p className="sr-only" id="game-instructions">
          Click any tile to walk there. WASD and the arrow keys step one tile at a time along
          the garden's diagonals: up arrow walks up and left, right arrow up and right,
          down arrow down and right, left arrow down and left. With the garden focused, Tab and Shift+Tab move an inspect cursor
          through the days oldest to newest, Enter walks to the day under the cursor, and
          Escape stops inspecting. Moss, gravel and laid stones may be walked on freely.
          Raked sand may not: stepping onto it lays one of your stepping stones, which
          costs one from your supply and makes that tile firm for the rest of the walk.
          Every stone you gather returns {STONE_REFUEL} to your supply, so the order you
          take them in decides whether you can afford the rest. Gather all five, then walk
          to the awakened shrine to complete the path. If no stone is left within reach of
          what you are carrying, the walk is over and the garden can be raked afresh.
        </p>
        {/* Two gauges, not two sentences. What you have gathered and what you have left
            to spend are the only live numbers on the page, and they were set at caption
            size in the middle of a line of prose — a resource you have to hunt for is not
            a resource, it is a trap. */}
        <div className="path-stones__gauges">
          <p
            className="path-stones__gauge path-stones__gauge--found"
            aria-label={stonesLabel}
            data-pulse={pulseFor(game.stonesFound.length)}
          >
            <span className="path-stones__gauge-figure" aria-hidden="true">
              <b>{game.stonesFound.length}</b>
              <i>/ {STONE_COUNT}</i>
            </span>
            <span className="path-stones__gauge-label" aria-hidden="true">
              stones found
            </span>
            <span className="path-stones__pips" aria-hidden="true">
              {Array.from({ length: STONE_COUNT }, (_, index) => (
                <span
                  className={
                    index < game.stonesFound.length
                      ? "path-stones__pip path-stones__pip--held"
                      : "path-stones__pip"
                  }
                  key={index}
                />
              ))}
            </span>
          </p>

          {/* The supply is the losing number, so it is the one that has to move. Each
              stone spent takes a pip out of the row, leaves the empty socket behind and
              throws a -1 up out of the figure: the count alone ticked down too quietly
              to feel like anything was being given up. */}
          <p
            className={supplyClasses.join(" ")}
            aria-label={supplyLabel}
            data-pulse={pulseFor(game.supplyTicks)}
            data-delta={game.lastSupplyDelta > 0 ? "gain" : "loss"}
          >
            <span className="path-stones__gauge-figure" aria-hidden="true">
              <b>{game.stonesLeft}</b>
              {game.supplyTicks > 0 && (
                <span className="path-stones__gauge-delta">
                  {game.lastSupplyDelta > 0
                    ? `+${game.lastSupplyDelta}`
                    : `−${Math.abs(game.lastSupplyDelta)}`}
                </span>
              )}
            </span>
            <span className="path-stones__gauge-label" aria-hidden="true">
              stones to lay
            </span>
            {/* Every stone the walk has ever held: the ones still in hand, then the
                sockets of the ones spent. Sizing this to the starting purse stopped
                being right the moment a gathered stone could hand two back. */}
            <span className="path-stones__pips" aria-hidden="true">
              {Array.from({ length: game.stonesLeft + game.stonesLaid }, (_, index) => {
                const classes = ["path-stones__pip"];
                if (index < game.stonesLeft) {
                  classes.push("path-stones__pip--held");
                } else {
                  classes.push("path-stones__pip--spent");
                }
                // The pip at the boundary is the one that just went. It gains this class
                // the moment the count drops, which is what starts its fall.
                if (index === game.stonesLeft && game.stonesLaid > 0) {
                  classes.push("path-stones__pip--falling");
                }
                return <span className={classes.join(" ")} key={index} />;
              })}
            </span>
          </p>
        </div>

        {/* One line, and it only ever says one of two things: what the route under the
            cursor would cost, or why the last click went nowhere. A silent refusal reads
            as a broken control — the whole reason the click was ignored is the most
            interesting number on the board. */}
        <p
          className={
            refusal || !previewAffordable
              ? "path-stones__quote path-stones__quote--denied"
              : "path-stones__quote"
          }
          role="status"
        >
          {refusal ?? routePrice}
        </p>
      </div>
      <Legend />
      <CompassPanel onMove={game.move} />
      <div
        className="zazen-world__map-wrapper"
        ref={panRef}
        style={{
          height: `${Math.max(0, mapScale * mapDimensions.height)}px`,
          width: `${Math.max(0, mapScale * mapDimensions.width)}px`,
        }}
      >
        <div
          className="zazen-world__map"
          ref={mapRef}
          role="application"
          tabIndex={0}
          aria-label="Interactive game world map"
          aria-describedby="game-instructions"
          style={
            {
              "--board-top": `${DECOR_HEADROOM}px`,
              "--grow-total": `${GROW_TOTAL_MS}ms`,
              height: `${mapDimensions.height}px`,
              transform: `scale(${mapScale})`,
              transformOrigin: "top left",
              width: `${mapDimensions.width}px`,
            } as React.CSSProperties
          }
        >
          {/* The garden's own silhouette, blurred and dropped below it. A filter on the
              board itself would re-run over 144 children on every step; one diamond costs
              nothing and casts the same shadow. */}
          <div className="zazen-world__cast" aria-hidden="true" />
          <div className="sr-only" aria-live="polite" id="position-announcer">
            {`Pilgrim is at position ${game.position.posX}, ${game.position.posY}`}
          </div>
          {game.map.map((tile) => {
            const key = `${tile.posX},${tile.posY}`;
            const adjacent = isStepTarget(tile, game.position);
            const payable = canPaveTile(tile);
            const reachable = isWalkableTile(tile) || payable;
            const classes = ["zazen-world__tile"];
            if (adjacent) {
              classes.push("zazen-world__tile--step");
            }
            if (reachable) {
              classes.push("zazen-world__tile--walkable");
            }
            // Sand you may cross by paying for it. It was already clickable and already
            // worked — it simply gave no sign of it: the cursor stayed an arrow and the
            // hover mark was reserved for tiles you could step to for free, so the game's
            // central move looked like something the board refused to do.
            if (payable) {
              classes.push("zazen-world__tile--payable");
            }
            if (previewKeys.has(key)) {
              classes.push("zazen-world__tile--preview");
            }
            if (previewPaveKeys.has(key)) {
              classes.push("zazen-world__tile--preview-pave");
            }
            if (previewKeys.has(key) && !previewAffordable) {
              classes.push("zazen-world__tile--preview-denied");
            }
            if (
              focusedPosition.posX === tile.posX &&
              focusedPosition.posY === tile.posY &&
              inspectDay !== undefined
            ) {
              classes.push("zazen-world__tile--inspected");
            }
            const { left, top } = toScreen(
              tile.posX,
              tile.posY,
              mapDimensions.offsetX,
              mapDimensions.offsetY,
            );
            return (
              <div
                className={classes.join(" ")}
                key={key}
                style={
                  {
                    "--depth-light": depthLightFor(tile.posX, tile.posY),
                    "--wind-phase": windPhaseFor(tile.posX, tile.posY),
                    "--grow-delay": `${growDelayFor(tileIndexForPosition(tile))}ms`,
                    left: `${left}px`,
                    top: `${top}px`,
                  } as React.CSSProperties
                }
                // Only the neighbouring tiles are exposed as buttons. Every tile is
                // clickable, but announcing 144 of them would bury the useful ones —
                // keyboard users get the whole garden through the Tab inspect cursor,
                // which reads each day out and walks there on Enter.
                role={adjacent ? "button" : undefined}
                aria-label={adjacent ? `Walk to ${tile.posX}, ${tile.posY}` : undefined}
                onClick={
                  reachable
                    ? () => {
                        handleTileClick(tile);
                      }
                    : undefined
                }
                onMouseEnter={() => {
                  setHoverPosition({ posX: tile.posX, posY: tile.posY });
                  setHoverDay(dayIndexForPosition(tile));
                }}
                onMouseLeave={() => {
                  setHoverPosition(undefined);
                  setHoverDay(undefined);
                }}
              >
                <TileRenderer tile={tile} />
                {/* The tile itself is a 0x0 box: it is absolutely positioned and so is
                    everything in it. This span is the actual hit area, clipped to the
                    diamond so neighbouring tiles never steal each other's clicks. */}
                <span className="zazen-world__hit" aria-hidden="true" />
              </div>
            );
          })}
          <div className="zazen-world__weather" aria-hidden="true" />
          <div className="zazen-world__grade" aria-hidden="true" />
          {/* Rare on purpose. Something that crosses every few seconds is scenery;
              something that crosses every minute and a half is a thing you notice. */}
          <div className="zazen-world__sky" aria-hidden="true">
            <span className="zazen-world__bird" />
            <span className="zazen-world__bird zazen-world__bird--far" />
            <span className="zazen-world__bird zazen-world__bird--late" />
            {MOTES.map((mote) => (
              <span
                className="zazen-world__mote"
                key={mote}
                style={{ "--mote": mote } as React.CSSProperties}
              />
            ))}
          </div>
          {companion && (
            <ZazenCompanion
              position={companion.position}
              facingLeft={companion.facingLeft}
              offsetX={game.mapDimensions.offsetX}
              offsetY={game.mapDimensions.offsetY}
            />
          )}
          <ZazenCat
            position={cat.position}
            facingLeft={cat.facingLeft}
            greeting={catGreeting}
            offsetX={mapDimensions.offsetX}
            offsetY={mapDimensions.offsetY}
          />
          <ZazenPilgrim
            renderPosition={step.renderPosition}
            facing={step.facing}
            frame={step.frame}
            moving={step.moving}
            offsetX={mapDimensions.offsetX}
            offsetY={mapDimensions.offsetY}
          />
        </div>
      </div>
      {!game.finaleOpen && (
        <ZazenDayCard
          tile={focusedTile}
          dayIndex={focusedDayIndex}
          totalDays={WINDOW_DAYS}
          inspecting={inspectDay !== undefined}
        />
      )}
      {!game.finaleOpen && (
        <ZazenHeatmap
          days={resolvedSeed.days}
          pilgrimDay={dayIndexForPosition(game.position)}
          inspectDay={inspectDay}
          focusDay={focusedDayIndex}
          stoneDays={stoneDays}
          shrineDay={WINDOW_DAYS - 1}
          onHoverDay={setHoverDay}
          onSelectDay={walkToDay}
        />
      )}
      {!game.finaleOpen && <ZazenHaikuScroll lines={game.haikuLines} />}
      {game.finaleOpen && (
        <ZazenFinaleOverlay
          lines={game.haikuLines}
          steps={game.steps}
          stonesLaid={game.stonesLaid}
          stonesLeft={game.stonesLeft}
          frogFreed={game.frogFreed}
          catMet={catMet}
          onWalkAgain={handleReplay}
        />
      )}
      {/* Held back a beat. The stone that ends the walk has only just landed, and cutting
          to a dialog over the top of its dust reads as the game catching you out rather
          than as the garden running out of road. */}
      {defeatVisible && (
        <ZazenDefeatOverlay
          stonesFound={game.stonesFound.length}
          stonesLaid={game.stonesLaid}
          steps={game.steps}
          onReplay={handleReplay}
        />
      )}
    </div>
  );
};

export default ZazenWorld;
export { chooseMapScale };
