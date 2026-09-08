import useRenderer from "./composables/use-renderer";
import { groundArtwork } from "./rendering/artwork";
import WebGLBoard from "./rendering/webgl-board";
import useGardenMusic from "./composables/use-music";
import Frog from "./components/figures/frog";
import useGamepad from "./composables/use-gamepad";
import { MAX_GARDENER_TURNS } from "./board/challenge";
import { chooseRakeTargets } from "./board/gardener";
import Gardener from "./components/figures/gardener";
import TurnAnnouncement from "./components/hud/turn-announcement";
import useStride from "./composables/use-stride";
import Journey from "./components/hud/journey";
import { DiscoveryReveal } from "./components/hud/discovery-cards";
import Icon from "../icon";
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { GardenSeed } from "./schema";
import { DATA_TILES, FALLBACK_SEED, GRID_SIZE, STONE_COUNT, WINDOW_DAYS } from "./schema";
import type { Direction, MapTile, Position } from "./types";
// One import per layer, not one per file. The island is the only thing in the module that
// touches all four, so it is the one place where the layering is visible at a glance —
// and it stays visible only while these stay collapsed.
import {
  DECOR_HEADROOM,
  STONE_REFUEL,
  applyDirectionOffset,
  canPaveTile,
  cheapestRoute,
  dayIndexForPosition,
  directionFromDelta,
  handleKeyDirection,
  isWalkableTile,
  manhattan,
  positionForDay,
  tileAt,
  tileIndexForPosition,
  toScreen,
} from "./board";
import {
  PILGRIM_ANCHOR_X,
  ZazenCat,
  ZazenCompanion,
  ZazenDayCard,
  ZazenDefeatOverlay,
  ZazenFinaleOverlay,
  ZazenHaikuScroll,
  ZazenHeatmap,
  ZazenPilgrim,
} from "./components";
import { prefersReducedMotion, useZazenAudio, useZazenGame, useZazenStep } from "./composables";

const ICON_SIZE = 16;
const BURST_SETTLE_MS = 30;
const MAX_SCALE = 3;
const MAX_BOARD_WIDTH = 960;
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
const CAT_MOVE_CHANCE = 0.55;
// How often a step is taken towards the pilgrim rather than wherever he fancies.
const CAT_FOLLOW_CHANCE = 0.8;
// Beyond this he stops pretending he was going that way anyway.
const CAT_HURRY_RANGE = 4;
const CAT_START: Position = { posX: 0, posY: 3 };

const DIRECTIONS: readonly Direction[] = ["N", "S", "E", "W"];

// Integer scale only. A fractional scale resamples every sprite and destroys the pixel
// grid the art is authored on; below scale 1 the map pans inside its wrapper rather
// than shrinking. Cap the available space so wide monitors do not magnify the board.
const chooseMapScale = (available: number, naturalWidth: number): number => {
  if (naturalWidth <= 0) {
    return 1;
  }
  return Math.min(
    MAX_SCALE,
    Math.max(1, Math.floor(Math.min(available, MAX_BOARD_WIDTH) / naturalWidth)),
  );
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
  const standing =
    (tile.decor !== "" && tile.decor !== "koi" && tile.decor !== "frog") || tile.npc !== 0;
  const standingAttr = standing ? { "data-standing": "" } : {};
  // Anything that is its own light source. HD-2D spends most of its budget on bloom, and
  // bloom needs to know which pixels are emitting rather than merely bright.
  const glowAttr =
    tile.decor === "lantern-lit" || tile.shrine === "active" ? { "data-glow": "" } : {};
  return (
    <div
      className={tileClassName(tile)}
      style={{ backgroundImage: `url('/images/zazen/sol/${groundArtwork(tile)}.png')` }}
      {...stoneAttr}
      {...standingAttr}
      {...glowAttr}
    >
      {tile.decor === "lantern-lit" && (
        <span className="zazen-world__light-pool" aria-hidden="true" />
      )}
      {tile.laid === true && <LaidBurst />}
      {tile.gathered === true && (
        <>
          <GatherBurst />
          <span className="zazen-world__reward" aria-hidden="true">
            +{STONE_REFUEL} stones
          </span>
        </>
      )}
      {tile.stone !== undefined && (
        <span className="zazen-world__beacon" aria-hidden="true">
          ◆
        </span>
      )}
      {tile.npc === 2 && (
        <span className="zazen-world__npc zazen-world__npc-2-sprite" aria-hidden="true" />
      )}
      {tile.npc !== 0 && tile.npc !== 2 && (
        <img
          src={`/images/zazen/persos/npc-${tile.npc}${tile.npc === 3 ? "-life" : ""}.png`}
          alt=""
          className={
            tile.transformed === true
              ? "zazen-world__npc zazen-world__npc--arriving"
              : "zazen-world__npc"
          }
        />
      )}
      {tile.decor === "koi" && (
        <span
          className="zazen-world__koi"
          style={
            { "--swim-delay": `${-((tile.posX * 3 + tile.posY) % 9)}s` } as React.CSSProperties
          }
          aria-hidden="true"
        >
          <img src="/images/zazen/decors/koi-life.png" alt="" className="zazen-world__decor" />
          <span className="zazen-world__koi-surface" />
        </span>
      )}
      {tile.decor !== "" && tile.decor !== "frog" && tile.decor !== "koi" && (
        <img
          src={`/images/zazen/decors/${tile.decor}.png`}
          alt=""
          className="zazen-world__decor"
          style={
            { "--life-delay": `${-((tile.posX * 3 + tile.posY) % 7)}s` } as React.CSSProperties
          }
          data-foreground={
            (tile.posX + tile.posY > 8 && ["pine", "maple", "sakura"].includes(tile.decor)) ||
            undefined
          }
        />
      )}
    </div>
  );
});

const northIcon = <Icon name="arrow-up" size={ICON_SIZE} />;
const westIcon = <Icon name="arrow-left" size={ICON_SIZE} />;
const eastIcon = <Icon name="arrow-right" size={ICON_SIZE} />;
const southIcon = <Icon name="arrow-down" size={ICON_SIZE} />;

const CompassPanel = ({
  onMove,
  disabled,
  stonesLeft,
}: {
  onMove: (dir: Direction) => void;
  disabled: boolean;
  stonesLeft: number;
}) => (
  <div className="zazen-world__compass" role="group" aria-labelledby="compass-label">
    <div className="sr-only" id="compass-label">
      Movement controls
    </div>
    <div className="path-stones__touch-status">
      <span>{disabled ? "Garden at work" : "Your move"}</span>
      <strong>
        {stonesLeft} <small>stones to lay</small>
      </strong>
      <p>
        Tap a tile to travel.
        <br />
        Drag the garden to explore.
      </p>
    </div>
    <fieldset className="zazen-world__compass-container" disabled={disabled}>
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
    </fieldset>
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
    gloss: "walk without spending",
    key: "firm",
    sprites: ["moss-mid", "gravel-edge"],
    tone: "free",
  },
  {
    cost: "one stone",
    gloss: "lay a stepping stone",
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
const pulseFor = (count: number): string | undefined => (count > 0 ? String(count % 2) : undefined);

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
const windPhaseFor = (posX: number, posY: number): number => ((posX * 7 + posY * 13) % 11) / 11;

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

// Frame updates belong to the moving actor, not the board and its HUD.
const MovingPilgrim = React.memo(function MovingPilgrim({
  position,
  offsetX,
  offsetY,
}: {
  position: Position;
  offsetX: number;
  offsetY: number;
}) {
  const step = useZazenStep(position);
  return <ZazenPilgrim {...step} offsetX={offsetX} offsetY={offsetY} />;
});

const ZazenWorld = ({ seed }: { seed?: GardenSeed }) => {
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem("path-stones:sound") !== "off";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem("path-stones:sound", soundOn ? "on" : "off");
    } catch {
      /* Sound controls still work when browser storage is unavailable. */
    }
  }, [soundOn]);
  const audio = useZazenAudio(soundOn);
  const { musicOn, toggleMusic } = useGardenMusic();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<HTMLDivElement>(null);
  const lastBurstStoneRef = useRef<number>(-1);
  const hasFramedRef = useRef(false);
  const [mapScale, setMapScale] = useState(1);
  const renderer = useRenderer();
  const webglRequested = renderer.supported && renderer.enabled;
  const webglReady = webglRequested && renderer.ready;

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
  const [runId, setRunId] = useState(0);

  const [companionRevealed, setCompanionRevealed] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [mermaidAwakened, setMermaidAwakened] = useState(false);
  const catWalking = useStride(cat.position);
  const handleDiscoveryComplete = useCallback((kind: "cat" | "frog" | "mermaid") => {
    if (kind === "frog") {
      setCompanionRevealed(true);
      setTransforming(true);
    }
  }, []);

  const handleStoneCollected = useCallback(
    (stoneIndex: number) => {
      if (soundOn) audio.playChime();
      lastBurstStoneRef.current = stoneIndex;
    },
    [audio, soundOn],
  );

  const handleFinaleOpened = useCallback(() => {
    if (soundOn) audio.playVictory();
  }, [audio, soundOn]);

  // The one sound in the garden that means you spent something.
  const handleStoneLaid = useCallback(() => {
    if (soundOn) audio.playStoneDrop();
  }, [audio, soundOn]);

  const game = useZazenGame({
    onFinaleOpened: handleFinaleOpened,
    onStoneCollected: handleStoneCollected,
    onStoneLaid: handleStoneLaid,
    seed,
  });

  const move = game.move;
  const frogHopping = useStride(game.frog);
  const [attack, setAttack] = useState({
    ticks: 0,
    position: undefined as Position | undefined,
    visible: false,
  });
  if (attack.ticks !== game.attackTicks) {
    setAttack({ ticks: game.attackTicks, position: game.position, visible: game.attackTicks > 0 });
  }
  const attackVisible = attack.visible;
  const attackPosition = attack.position;
  const playAttack = useEffectEvent(() => audio.playAttack());
  useEffect(() => {
    if (!game.attackTicks) return;
    playAttack();
    const timer = setTimeout(() => setAttack((current) => ({ ...current, visible: false })), 800);
    return () => clearTimeout(timer);
  }, [game.attackTicks]);

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
      if (game.phase !== "player" || game.finaleOpen) return;
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
      setRefusal(undefined);
      setCursorDay(undefined);
      setRoute(route_.path);
    },
    [game.map, game.position, game.phase, game.finaleOpen],
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
        : `This way: ${preview.cost} stones · walk until the gardener’s turn`;

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
      if (game.phase !== "player") return;
      const target = positionForDay(dayIndex);
      const path = cheapestRoute(game.map, game.position, target, UNCAPPED)?.path;
      setRefusal(undefined);
      if (!path || path.length === 0) {
        return;
      }
      setCursorDay(undefined);
      setRoute(path);
    },
    [game.map, game.position, game.phase],
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
  const focusedPosition = inspectDay === undefined ? game.position : positionForDay(inspectDay);
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
  const frameActor = useEffectEvent(() => {
    const pan = panRef.current;
    if (!pan) return;
    if (pan.scrollWidth <= pan.clientWidth && pan.scrollHeight <= pan.clientHeight) return;
    const framed = hasFramedRef.current;
    hasFramedRef.current = true;
    const focus =
      game.phase === "gardener" && !prefersReducedMotion() ? game.gardenerPosition : game.position;
    const { left, top } = toScreen(
      focus.posX,
      focus.posY,
      game.mapDimensions.offsetX,
      game.mapDimensions.offsetY,
    );
    const pilgrimX = (left + PILGRIM_ANCHOR_X) * mapScale;
    const pilgrimY = (top + 16) * mapScale;
    const marginY = Math.min(80, pan.clientHeight / 4);
    const margin = Math.min(96, pan.clientWidth / 4);
    if (
      pilgrimX >= pan.scrollLeft + margin &&
      pilgrimX <= pan.scrollLeft + pan.clientWidth - margin &&
      pilgrimY >= pan.scrollTop + marginY &&
      pilgrimY <= pan.scrollTop + pan.clientHeight - marginY
    )
      return;
    pan.scrollTo({
      behavior: !framed || prefersReducedMotion() ? "auto" : "smooth",
      left: pilgrimX - pan.clientWidth / 2,
      top: pilgrimY - pan.clientHeight / 2,
    });
  });
  useEffect(() => {
    frameActor();
  }, [game.position, game.mapDimensions, game.phase, game.gardenerPosition, mapScale]);
  useEffect(() => {
    const pan = panRef.current;
    if (!pan) return;
    const onResize = () => frameActor();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : undefined;
    observer?.observe(pan);
    window.addEventListener("resize", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Reconcile changed terrain before committing a frame, without an effect cascade.
  const [catMap, setCatMap] = useState(game.map);
  if (catMap !== game.map) {
    setCatMap(game.map);
    const footing = catFooting(game.map, cat.position);
    if (footing.posX !== cat.position.posX || footing.posY !== cat.position.posY) {
      setCat({ facingLeft: cat.facingLeft, position: footing });
    }
  }
  const catGreeting = manhattan(cat.position, game.position) <= 1;
  if (catGreeting && !catMet) setCatMet(true);

  const aquaticTransformation =
    game.frogFreed && !!tileAt(game.map, game.frog)?.sprite.startsWith("water");

  // Reset the discovery lifetime before committing a new run.
  const [previousFrogFreed, setPreviousFrogFreed] = useState(game.frogFreed);
  if (previousFrogFreed !== game.frogFreed) {
    setPreviousFrogFreed(game.frogFreed);
    if (!game.frogFreed) {
      setCompanionRevealed(false);
      setTransforming(false);
      setMermaidAwakened(false);
    }
  }
  useEffect(() => {
    if (!companionRevealed) return;
    const timer = setTimeout(() => {
      setTransforming(false);
      if (aquaticTransformation) setMermaidAwakened(true);
    }, 1600);
    return () => clearTimeout(timer);
  }, [companionRevealed, aquaticTransformation]);

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
      const chance = manhattan(cat.position, game.position) > CAT_HURRY_RANGE ? 1 : CAT_MOVE_CHANCE;
      if (Math.random() > chance) {
        return;
      }
      const following = Math.random() < CAT_FOLLOW_CHANCE;
      const directionRoll = Math.random();
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
          return footing.posX === current.position.posX && footing.posY === current.position.posY
            ? current
            : { facingLeft: current.facingLeft, position: footing };
        }

        // He tags along. Not on a leash — one step in every few is still his own, or he
        // reads as a cursor with fur — but the rest follow the route, which is what turns
        // him from scenery you happen to pass into company you have picked up. When there
        // is no route at all he wanders, rather than standing there facing a wall.
        const routed = following
          ? catStepToward(game.map, current.position, game.position)
          : undefined;
        const next = routed ?? open[Math.floor(directionRoll * open.length)];
        return {
          // N and W both travel leftwards on screen; E and S both travel right.
          facingLeft: next.posX - next.posY < current.position.posX - current.position.posY,
          position: next,
        };
      });
    }, CAT_STEP_MS);
    return () => {
      clearInterval(timer);
    };
  }, [cat.position, game.map, game.position]);

  // Walk a queued route one tile per step, so Enter can send the pilgrim to a tile that
  // is not adjacent. Each step goes through game.move, so stones, the shrine and the
  // walkability rules all behave exactly as they do for a keypress.
  if (game.phase !== "player" || game.finaleOpen) {
    if (route.length > 0) setRoute([]);
    if (refusal !== undefined) setRefusal(undefined);
  }
  useEffect(() => {
    if (game.phase !== "player" || game.finaleOpen) return;
    if (route.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      const [next, ...rest] = route;
      const dir = directionFromDelta(game.position, next);
      if (dir) move(dir);
      setRoute(rest);
    }, AUTO_STEP_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [game.phase, game.finaleOpen, game.position, move, route]);

  const onKeyPress = useEffectEvent((ev: KeyboardEvent) => {
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
  });
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => onKeyPress(event);
    globalThis.addEventListener("keydown", handleKeyPress);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  // There is deliberately no swipe-to-move gesture. Sprites are only ever drawn at whole
  // pixel scales, so on a narrow screen the garden pans instead of shrinking — and a
  // horizontal drag cannot both pan the board and step the pilgrim. Panning wins,
  // because you have to be able to see the board; the compass and tapping a neighbouring
  // tile remain the ways to move, on every device.

  const { mapDimensions } = game;
  const webglScene = useMemo(
    () => ({
      map: game.map,
      ...mapDimensions,
      pilgrim: game.position,
      cat: cat.position,
      catFacingLeft: cat.facingLeft,
      catGreeting,
      gardener: game.gardenerPosition,
      gardenerFacingLeft: game.gardenerFacingLeft,
      gardenerActivity: attackVisible ? ("attack" as const) : game.gardenerActivity,
      frog: game.frog,
      frogVisible: !game.frogFreed || !companionRevealed,
      companionVisible: game.frogFreed && companionRevealed,
      aquatic: aquaticTransformation,
      transforming,
    }),
    [
      game.map,
      mapDimensions,
      game.position,
      cat.position,
      cat.facingLeft,
      catGreeting,
      game.gardenerPosition,
      game.gardenerFacingLeft,
      game.gardenerActivity,
      attackVisible,
      game.frog,
      game.frogFreed,
      companionRevealed,
      aquaticTransformation,
      transforming,
    ],
  );
  const handleReplay = useCallback(() => {
    audio.stopEffects();
    setRunId((current) => current + 1);
    setCatMet(false);
    setRefusal(undefined);
    setHoverDay(undefined);
    setHoverPosition(undefined);
    hasFramedRef.current = false;
    setRoute([]);
    setCursorDay(undefined);
    game.restart();
  }, [game, audio]);

  const focusPilgrim = useCallback(() => {
    const pan = panRef.current;
    if (!pan) return;
    const { left, top } = toScreen(
      game.position.posX,
      game.position.posY,
      game.mapDimensions.offsetX,
      game.mapDimensions.offsetY,
    );
    hasFramedRef.current = true;
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    pan.scrollTo({
      left: (left + PILGRIM_ANCHOR_X) * mapScale - pan.clientWidth / 2,
      top: (top + 16) * mapScale - pan.clientHeight / 2,
      behavior,
    });
    pan.scrollIntoView({ block: "center", behavior });
    mapRef.current?.focus({ preventScroll: true });
  }, [game.position, game.mapDimensions, mapScale]);

  const gamepad = useGamepad({
    canMove: () =>
      game.phase === "player" &&
      !game.finaleOpen &&
      !document.querySelector(".stone-game-help[open]") &&
      !document.activeElement?.matches("input, textarea, select, [contenteditable=true]"),
    move: (direction) => {
      setRoute([]);
      setCursorDay(undefined);
      game.move(direction);
    },
    confirm: () => {
      const help = document.querySelector<HTMLDetailsElement>(".stone-game-help");
      if (help?.open) {
        help.open = false;
        return;
      }
      if (game.phase === "lost" || game.finaleOpen) {
        handleReplay();
        return;
      }
      focusPilgrim();
    },
    cancel: () => {
      setRoute([]);
      setCursorDay(undefined);
      const help = document.querySelector<HTMLDetailsElement>(".stone-game-help");
      if (help) help.open = false;
    },
    sound: () => setSoundOn((current) => !current),
    help: () => {
      if (game.phase === "lost" || game.finaleOpen) return;
      const help = document.querySelector<HTMLDetailsElement>(".stone-game-help");
      if (help) {
        help.open = !help.open;
        if (help.open) {
          setRoute([]);
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }
    },
  });

  const threatenedPaths = useMemo(
    () =>
      game.phase === "player" && game.stonesLeft === 1 && game.gardenerTurns < MAX_GARDENER_TURNS
        ? chooseRakeTargets(game.map, game.laidTrail, game.position, game.gardenerTurns + 1, {
            budget: 2 * (MAX_GARDENER_TURNS - game.gardenerTurns),
            from: game.gardenerPosition,
          })
        : [],
    [
      game.phase,
      game.stonesLeft,
      game.gardenerTurns,
      game.map,
      game.laidTrail,
      game.position,
      game.gardenerPosition,
    ],
  );
  const { posX: focusedX, posY: focusedY } = focusedPosition;
  // Actor animation frames do not change terrain, tile controls or route markers.
  const tiles = useMemo(
    () =>
      game.map.map((tile) => {
        const key = `${tile.posX},${tile.posY}`;
        const rakeIndex = game.rakeTargets.findIndex((target) => manhattan(tile, target) === 0);
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
        if (focusedX === tile.posX && focusedY === tile.posY && inspectDay !== undefined) {
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
            data-rake={rakeIndex >= 0 ? "marked" : undefined}
            data-working={
              (game.gardenerActivity === "rake" && manhattan(tile, game.gardenerPosition) === 0) ||
              undefined
            }
            data-threatened={
              threatenedPaths.some((target) => manhattan(tile, target) === 0) || undefined
            }
            role={adjacent ? "button" : undefined}
            aria-disabled={adjacent && game.phase === "gardener" ? true : undefined}
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
            {!webglReady ? (
              <TileRenderer tile={tile} />
            ) : (
              <div
                className="zazen-world__tile-image garden-webgl__markers"
                data-stone-index={tile.stone}
              >
                {tile.stone !== undefined && (
                  <span className="zazen-world__beacon" aria-hidden="true">
                    ◆
                  </span>
                )}
                {tile.laid && <LaidBurst />}
                {tile.gathered && (
                  <>
                    <GatherBurst />
                    <span className="zazen-world__reward" aria-hidden="true">
                      +{STONE_REFUEL} stones
                    </span>
                  </>
                )}
              </div>
            )}
            {game.gardenerActivity === "rake" && manhattan(tile, game.gardenerPosition) === 0 && (
              <span className="zazen-world__rake-dust" aria-hidden="true" />
            )}
            {game.phase === "gardener" &&
              game.gardenerActions.some(
                (action) => action.kind === "walk" && manhattan(tile, action.position) === 0,
              ) && <span className="zazen-world__gardener-footstep" aria-hidden="true" />}

            {/* The tile itself is a 0x0 box: it is absolutely positioned and so is
      everything in it. This span is the actual hit area, clipped to the
      diamond so neighbouring tiles never steal each other's clicks. */}
            <span className="zazen-world__hit" aria-hidden="true" />
          </div>
        );
      }),
    [
      webglReady,
      game.map,
      game.rakeTargets,
      game.position,
      game.phase,
      game.gardenerActivity,
      game.gardenerPosition,
      game.gardenerActions,
      previewKeys,
      previewPaveKeys,
      previewAffordable,
      focusedX,
      focusedY,
      inspectDay,
      mapDimensions,
      threatenedPaths,
      handleTileClick,
    ],
  );
  const refillsLeft = Math.max(0, MAX_GARDENER_TURNS - game.gardenerTurns);

  const stonesLabel = `${game.stonesFound.length} of ${STONE_COUNT} stones gathered`;
  const supplyLabel = `${game.stonesLeft} stepping stones left to lay`;
  const supplyClasses = ["path-stones__gauge", "path-stones__gauge--supply"];
  if (game.stonesLeft === 0) {
    supplyClasses.push("path-stones__gauge--spent");
  } else if (game.stonesLeft === 1) {
    supplyClasses.push("path-stones__gauge--low");
  }

  return (
    <div
      className="zazen-world-container path-stones"
      ref={containerRef}
      data-awakened={game.shrineActivated || undefined}
    >
      <DiscoveryReveal
        key={runId}
        mermaidAwakened={mermaidAwakened}
        catMet={catMet}
        frogFreed={game.frogFreed}
        paused={game.phase !== "player"}
        onReveal={audio.playReveal}
        onComplete={handleDiscoveryComplete}
      />
      {!game.finaleOpen && (
        <TurnAnnouncement
          phase={game.phase}
          opening={game.openingTurn}
          round={Math.max(1, game.gardenerTurns + (game.phase === "player" ? 1 : 0))}
        />
      )}
      <div className="path-stones__ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="sr-only" aria-live="polite">
        {game.announcement}
      </div>
      <div className="zazen-world__header path-stones__header">
        <span className="path-stones__chapter">
          <span aria-hidden="true">✦</span> A garden chronicle <span aria-hidden="true">✦</span>
        </span>
        <span className="path-stones__eyebrow path-stones__attribution">
          A garden shaped by{" "}
          <a href={`https://github.com/${resolvedSeed.login}`} target="_blank" rel="noreferrer">
            @{resolvedSeed.login}’s GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
        <h1 className="path-stones__title">
          Path of <em>Stones</em>
        </h1>
        <p className="path-stones__intro">Five ancient stones. One path home.</p>
        {/* One line where there were five. Everything the paragraph used to explain is
            now shown by the rule cards below, and what is left is the only thing the
            cards cannot show: whose fortnight this is and which corner it starts at. */}
        <p className="sr-only" id="game-instructions">
          Click any tile to walk there. WASD and the arrow keys step one tile at a time along the
          garden's diagonals: up arrow walks up and left, right arrow up and right, down arrow down
          and right, left arrow down and left. With the garden focused, Tab and Shift+Tab move an
          inspect cursor through the days oldest to newest, Enter walks to the day under the cursor,
          and Escape stops inspecting. Moss, gravel and laid stones may be walked on freely. Raked
          sand may not: stepping onto it lays one of your stepping stones, which costs one from your
          supply and makes that tile firm until the gardener rakes it. Every stone you gather
          returns {STONE_REFUEL} to your supply, so the order you take them in decides whether you
          can afford the rest. Gather all five, then walk to the awakened shrine to complete the
          path. You have four rounds and three gardener refills. The gardener moves first to rake an
          approach to a stone. When you run out, he rakes up to two useful approaches on his first
          return and three on later visits, then gives you two stones. Your tile, its neighbours and
          discoveries stay safe. Keep one tile between you and the gardener: he can knock away one
          stone per round when you step beside him. In the final round, collect reachable stones or
          rescue the frog to keep going. If no reward is reachable with an empty supply, the run
          ends.
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
            {/* Show this turn's reserve, so repeated refills never grow an endless row. */}
            <span className="path-stones__pips" aria-hidden="true">
              {Array.from(
                { length: Math.max(game.stonesLeft, game.stoneBudget, 2) },
                (_, index) => {
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
                },
              )}
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
          <span className="path-stones__quote-reserve" aria-hidden="true">
            This way: 999 stones · walk until the gardener’s turn
          </span>
          <span>{refusal ?? routePrice}</span>
        </p>
      </div>
      <div className="path-stones__battle">
        <div className="path-stones__mission" role="group" aria-label="Play controls">
          <span className="path-stones__eyebrow">Play controls</span>
          <span className="path-stones__movement-hint">
            <span className="path-stones__hint-pointer">
              Click a tile to travel · WASD / arrow keys to walk
            </span>
            <span className="path-stones__hint-touch">
              Tap a tile to travel · drag the garden to explore
            </span>
          </span>
          <div className="path-stones__input-hint" data-controller={gamepad}>
            <span className="path-stones__controller-status" role="status">
              <Icon name="gamepad" size={16} aria-hidden="true" />
              {gamepad === "connected"
                ? "Controller connected"
                : gamepad === "unsupported"
                  ? "Use keyboard or touch · controller unavailable"
                  : "Press a gamepad button to connect"}
            </span>
            {gamepad === "connected" && (
              <span className="path-stones__pad-keys">
                <span>
                  <kbd>
                    <Icon name="move" size={13} />
                  </kbd>{" "}
                  Stick / D-pad
                </span>
                <span>
                  <kbd>A / ✕</kbd> Focus game
                </span>
                <span>
                  <kbd>B / ○</kbd> Cancel
                </span>
                <span>
                  <kbd>X / □</kbd> Sound
                </span>
                <span>
                  <kbd>Start</kbd> Help
                </span>
              </span>
            )}
          </div>
          <div className="path-stones__tools">
            <button
              type="button"
              aria-pressed={soundOn}
              onClick={() => setSoundOn((current) => !current)}
            >
              {soundOn ? (
                <Icon name="volume-2" size={15} aria-hidden="true" />
              ) : (
                <Icon name="volume-x" size={15} aria-hidden="true" />
              )}
              Sound {soundOn ? "on" : "off"}
            </button>
            {renderer.supported && (
              <button
                type="button"
                aria-pressed={renderer.enabled}
                onClick={renderer.toggle}
                title="Soft lighting, water reflections and atmospheric effects"
              >
                <Icon name="sunrise" size={15} aria-hidden="true" />
                HD-2D {renderer.enabled ? "on" : "off"}
              </button>
            )}
            <button type="button" aria-pressed={musicOn} onClick={toggleMusic}>
              <Icon name="music" size={15} aria-hidden="true" />
              Music {musicOn ? "on" : "off"}
            </button>
            <button type="button" onClick={handleReplay}>
              <Icon name="rotate-ccw" size={15} aria-hidden="true" /> Restart run
            </button>
          </div>
        </div>
        <div
          className="path-stones__turn"
          data-final-round={refillsLeft === 0 || undefined}
          data-phase={game.phase}
          role="status"
          aria-live="polite"
        >
          <span className="path-stones__gardener-portrait" key={game.phase} aria-hidden="true" />
          <div>
            <span className="path-stones__eyebrow">
              Round{" "}
              {Math.max(1, Math.min(4, game.gardenerTurns + (game.phase === "gardener" ? 0 : 1)))} /
              4 · {game.phase === "player" ? "Your turn" : "Gardener’s turn"}
            </span>
            <strong>
              {game.phase === "gardener"
                ? game.rakeTargets.length
                  ? game.gardenerActivity === "walk"
                    ? "Walking to the next path…"
                    : game.gardenerActivity === "rake"
                      ? "Raking this path…"
                      : "The gardener is choosing his route…"
                  : "Your nearby paths are safe…"
                : refillsLeft === 0
                  ? "Final round. Every stone counts."
                  : "Lay a path. Stay one step ahead."}
            </strong>
            <small>
              {game.phase === "gardener"
                ? game.openingTurn
                  ? "Opening move · your starting reserve is protected."
                  : "Your turn resumes with 2 stones."
                : refillsLeft === 0
                  ? "No more refills. Collect a stone to keep going."
                  : `Next visit: up to ${game.gardenerTurns === 0 ? 2 : 3} paths raked. Amber paths are at risk.`}
            </small>
          </div>
          <span className="path-stones__turn-reward">
            {game.phase === "gardener" ? (game.openingTurn ? "I" : "+2") : `${refillsLeft}`}
            <small>{game.phase === "gardener" ? "NEXT TURN" : "REFILLS LEFT"}</small>
          </span>
        </div>
        <Legend />
        <div className="path-stones__stage">
          <div className="path-stones__scene-heading" role="group" aria-label="Current objective">
            <Icon
              name={game.shrineActivated ? "sunrise" : "compass"}
              size={18}
              aria-hidden="true"
            />
            <strong>
              {game.shrineActivated ? "Reach the awakened shrine" : "Gather the five stones"}
            </strong>
            <span>
              {game.stonesFound.length} / {STONE_COUNT}
            </span>
          </div>
          <div className="path-stones__scene-mist" aria-hidden="true" />
          <button
            className="path-stones__recenter"
            type="button"
            onClick={focusPilgrim}
            aria-label="Find pilgrim — center the garden on your character"
          >
            <Icon name="locate" size={16} /> Find pilgrim
          </button>
          <CompassPanel
            disabled={game.phase !== "player" || game.finaleOpen}
            stonesLeft={game.stonesLeft}
            onMove={(direction) => {
              setRoute([]);
              setCursorDay(undefined);
              game.move(direction);
            }}
          />
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
              data-renderer={webglReady ? "webgl" : "dom"}
              data-renderer-switched={renderer.hasRendered || undefined}
              role="application"
              tabIndex={0}
              aria-label="Interactive game world map"
              aria-busy={game.phase === "gardener"}
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
              {webglRequested && <WebGLBoard scene={webglScene} onReady={renderer.onReady} />}
              {tiles}
              <div className="zazen-world__weather" aria-hidden="true" />
              <div className="zazen-world__grade" aria-hidden="true" />
              <div className="zazen-world__cloud-shadows" aria-hidden="true">
                <span />
              </div>
              {/* Rare on purpose. Something that crosses every few seconds is scenery;
              something that crosses every minute and a half is a thing you notice. */}
              <div className="zazen-world__sky" aria-hidden="true">
                <span className="zazen-world__cloud zazen-world__cloud--one" />
                <span className="zazen-world__cloud zazen-world__cloud--two" />
                <span className="zazen-world__bird">
                  <span className="zazen-world__bird-body" />
                </span>
                <span className="zazen-world__bird zazen-world__bird--far">
                  <span className="zazen-world__bird-body" />
                </span>
                <span className="zazen-world__bird zazen-world__bird--late">
                  <span className="zazen-world__bird-body" />
                </span>
                {MOTES.map((mote) => (
                  <span
                    className="zazen-world__mote"
                    key={mote}
                    style={{ "--mote": mote } as React.CSSProperties}
                  />
                ))}
              </div>
              {!webglReady && (
                <Gardener
                  position={game.gardenerPosition}
                  activity={attackVisible ? "attack" : game.gardenerActivity}
                  facingLeft={game.gardenerFacingLeft}
                  offsetX={mapDimensions.offsetX}
                  offsetY={mapDimensions.offsetY}
                />
              )}
              {!webglReady && (!game.frogFreed || !companionRevealed) && (
                <Frog
                  position={game.frog}
                  hopping={frogHopping}
                  offsetX={mapDimensions.offsetX}
                  offsetY={mapDimensions.offsetY}
                />
              )}
              {!webglReady && game.frogFreed && companionRevealed && (
                <ZazenCompanion
                  aquatic={aquaticTransformation}
                  transforming={transforming}
                  walking={false}
                  position={game.frog}
                  facingLeft={false}
                  offsetX={game.mapDimensions.offsetX}
                  offsetY={game.mapDimensions.offsetY}
                />
              )}
              {transforming && (
                <div
                  className="zazen-world__tile"
                  style={toScreen(
                    game.frog.posX,
                    game.frog.posY,
                    mapDimensions.offsetX,
                    mapDimensions.offsetY,
                  )}
                >
                  <FrogBurst />
                </div>
              )}
              {!webglReady && (
                <ZazenCat
                  walking={catWalking}
                  position={cat.position}
                  facingLeft={cat.facingLeft}
                  greeting={catGreeting}
                  offsetX={mapDimensions.offsetX}
                  offsetY={mapDimensions.offsetY}
                />
              )}
              {attackVisible && (
                <span
                  key={game.attackTicks}
                  className="zazen-world__attack-loss"
                  role="status"
                  style={toScreen(
                    (attackPosition ?? game.position).posX,
                    (attackPosition ?? game.position).posY,
                    mapDimensions.offsetX,
                    mapDimensions.offsetY,
                  )}
                >
                  −1 stone
                </span>
              )}
              {!webglReady && (
                <MovingPilgrim
                  position={game.position}
                  offsetX={mapDimensions.offsetX}
                  offsetY={mapDimensions.offsetY}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {!game.finaleOpen && (
        <Journey
          mermaidAwakened={mermaidAwakened}
          recordKey={`path-stones:best:v4:${JSON.stringify(resolvedSeed)}`}
          complete={false}
          steps={game.steps}
          stonesLaid={game.stonesLaid}
          stonesLeft={game.stonesLeft}
          gardenerTurns={game.gardenerTurns}
          catMet={catMet}
          frogFreed={game.frogFreed}
        />
      )}
      {!game.finaleOpen && (
        <div className="path-stones__almanac">
          <ZazenDayCard
            tile={focusedTile}
            dayIndex={focusedDayIndex}
            totalDays={WINDOW_DAYS}
            inspecting={inspectDay !== undefined}
          />
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
        </div>
      )}
      <aside className="path-stones__source" aria-labelledby="garden-source-title">
        <div>
          <span className="path-stones__eyebrow">Behind the garden</span>
          <h2 id="garden-source-title">A fortnight of @{resolvedSeed.login}’s GitHub</h2>
          <p>
            Each bed reflects one of {WINDOW_DAYS} days of @{resolvedSeed.login}’s public GitHub
            activity. Moss, planting and the day cards tell that history. Paths and supplies are
            balanced for play, even on quiet weeks.
          </p>
        </div>
        <div className="path-stones__source-meta">
          <span>Activity snapshot</span>
          <time dateTime={resolvedSeed.generatedAt}>{resolvedSeed.generatedAt.slice(0, 10)}</time>
          <a href={`https://github.com/${resolvedSeed.login}`} target="_blank" rel="noreferrer">
            View @{resolvedSeed.login} on GitHub <Icon name="arrow-up-right" size={13} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </aside>
      {!game.finaleOpen && <ZazenHaikuScroll lines={game.haikuLines} />}
      {game.phase === "lost" && (
        <ZazenDefeatOverlay
          stonesFound={game.stonesFound.length}
          stonesLaid={game.stonesLaid}
          steps={game.steps}
          onReplay={handleReplay}
        />
      )}
      {game.finaleOpen && (
        <ZazenFinaleOverlay
          recordKey={`path-stones:best:v4:${JSON.stringify(resolvedSeed)}`}
          lines={game.haikuLines}
          steps={game.steps}
          stonesLaid={game.stonesLaid}
          stonesLeft={game.stonesLeft}
          gardenerTurns={game.gardenerTurns}
          frogFreed={game.frogFreed}
          catMet={catMet}
          onWalkAgain={handleReplay}
        />
      )}
    </div>
  );
};

export default ZazenWorld;
export { chooseMapScale };
