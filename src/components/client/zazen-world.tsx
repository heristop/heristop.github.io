import "./world.scss";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { Direction, MapTile } from "./zazen-world-types";
import {
  ICON_SIZE,
  ICON_STROKE_WIDTH,
  STONES,
  TILE_HALF_HEIGHT,
  TILE_HALF_WIDTH,
  directionFromDelta,
  handleKeyDirection,
  isWalkableTile,
} from "./zazen-world-helpers";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ZazenFinaleOverlay from "./zazen-finale-overlay";
import ZazenHaikuScroll from "./zazen-haiku-scroll";
import useZazenAudio from "./use-zazen-audio";
import useZazenGame from "./use-zazen-game";

const SWIPE_THRESHOLD = 60;
const SWIPE_VERTICAL_LIMIT = 40;
const SWIPE_TIMEOUT_MS = 500;
const BURST_SETTLE_MS = 30;

interface DirectionButtonProps {
  direction: Direction;
  icon: React.ReactNode;
  keyLabel: string;
  label: string;
  modifier: string;
  onMove: (dir: Direction) => void;
  title: string;
}

interface TileRendererProps {
  tile: MapTile;
}

interface CompassPanelProps {
  onMove: (dir: Direction) => void;
}

interface GameMapProps {
  characterPosition: { posX: number; posY: number } | undefined;
  map: MapTile[];
  mapDimensions: { height: number; offsetX: number; offsetY: number; width: number };
  mapScale: number;
  onTileClick: (tile: MapTile) => void;
}

const DirectionButton = ({
  direction,
  onMove,
  icon,
  label,
  title,
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
    title={title}
  >
    {icon}
    <span>{keyLabel}</span>
  </button>
);

const tileClassName = (tile: MapTile): string => {
  const classes = ["zazen-world__tile-image"];
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

const TileRenderer = React.memo(function TileRenderer({ tile }: TileRendererProps) {
  const stoneAttr = tile.stone !== undefined ? { "data-stone-index": tile.stone } : {};
  return (
    <div
      className={tileClassName(tile)}
      style={{ backgroundImage: `url('/images/zazen/sol/${tile.img}.gif')` }}
      {...stoneAttr}
    >
      {tile.perso !== 0 && (
        <img src={`/images/zazen/persos/${tile.perso}.gif`} alt={`Character ${tile.perso}`} />
      )}
      {tile.decors !== "" && (
        <img
          src={`/images/zazen/decors/${tile.decors}.gif`}
          alt={tile.decors}
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

const CompassPanel = ({ onMove }: CompassPanelProps) => (
  <div className="zazen-world__compass" role="group" aria-labelledby="compass-label">
    <div className="sr-only" id="compass-label">
      Movement controls
    </div>
    <div className="zazen-world__compass-container">
      <DirectionButton
        direction="N"
        onMove={onMove}
        icon={northIcon}
        label="Move North (W/up arrow)"
        title="Press W or up arrow"
        keyLabel="W"
        modifier="north"
      />
      <DirectionButton
        direction="W"
        onMove={onMove}
        icon={westIcon}
        label="Move West (A/left arrow)"
        title="Press A or left arrow"
        keyLabel="A"
        modifier="west"
      />
      <DirectionButton
        direction="E"
        onMove={onMove}
        icon={eastIcon}
        label="Move East (D/right arrow)"
        title="Press D or right arrow"
        keyLabel="D"
        modifier="east"
      />
      <DirectionButton
        direction="S"
        onMove={onMove}
        icon={southIcon}
        label="Move South (S/down arrow)"
        title="Press S or down arrow"
        keyLabel="S"
        modifier="south"
      />
    </div>
  </div>
);

const isStepTarget = (
  tile: MapTile,
  characterPosition: { posX: number; posY: number } | undefined,
): boolean => {
  if (!characterPosition) {
    return false;
  }
  const dx = Math.abs(tile.posX - characterPosition.posX);
  const dy = Math.abs(tile.posY - characterPosition.posY);
  if (dx + dy !== 1) {
    return false;
  }
  return isWalkableTile(tile);
};

const GameMap = ({
  map,
  mapDimensions,
  characterPosition,
  mapScale,
  onTileClick,
}: GameMapProps) => {
  const wrapperStyle: React.CSSProperties = {
    width: `${Math.max(0, mapScale * mapDimensions.width)}px`,
    height: `${Math.max(0, mapScale * mapDimensions.height)}px`,
  };
  const mapStyle: React.CSSProperties = {
    width: `${mapDimensions.width}px`,
    height: `${mapDimensions.height}px`,
    transform: `scale(${mapScale})`,
    transformOrigin: "top left",
  };
  return (
    <div className="zazen-world__map-wrapper" style={wrapperStyle}>
      <div
        className="zazen-world__map"
        role="application"
        aria-label="Interactive game world map"
        aria-describedby="game-instructions"
        style={mapStyle}
      >
        <div className="sr-only" aria-live="polite" id="position-announcer">
          {characterPosition && `Character is at position ${characterPosition.posX}, ${characterPosition.posY}`}
        </div>
        {map.map((tile, index) => {
          const walkable = isStepTarget(tile, characterPosition);
          const className = walkable ? "zazen-world__tile zazen-world__tile--step" : "zazen-world__tile";
          return (
            <div
              className={className}
              key={index}
              style={{
                left: `${(tile.posX - tile.posY) * TILE_HALF_WIDTH - mapDimensions.offsetX}px`,
                top: `${(tile.posX + tile.posY) * TILE_HALF_HEIGHT - mapDimensions.offsetY}px`,
              }}
              role={walkable ? "button" : undefined}
              aria-label={walkable ? `Walk to ${tile.posX}, ${tile.posY}` : undefined}
              onClick={walkable ? () => { onTileClick(tile); } : undefined}
            >
              <TileRenderer tile={tile} />
            </div>
          );
        })}
      </div>
    </div>
  );
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
  const detail = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  document.dispatchEvent(new CustomEvent("sakura:burst", { detail }));
};

const ZazenWorld = () => {
  const audio = useZazenAudio();
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBurstStoneRef = useRef<number>(-1);
  const [mapScale, setMapScale] = useState(1);

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

  const game = useZazenGame({
    onFinaleOpened: handleFinaleOpened,
    onStoneCollected: handleStoneCollected,
  });

  const handleTileClick = useCallback(
    (tile: MapTile) => {
      if (!game.characterPosition) {
        return;
      }
      const dir = directionFromDelta(game.characterPosition, tile);
      if (dir) {
        game.move(dir);
      }
    },
    [game],
  );

  // Trailing effect: fire sakura burst after the stone tile's decor has been cleared,
  // so the petals appear from the tile position the player just walked onto.
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

  // Responsive map scale. Measure container width and shrink the map to fit.
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
      const nextScale = Math.min(1, available / naturalWidth);
      setMapScale((prev) => (Math.abs(prev - nextScale) < 0.005 ? prev : nextScale));
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

  // Keyboard navigation (WASD/arrows). N=posX--, S=posX++, E=posY--, W=posY++.
  useEffect(() => {
    const handleKeyPress = (ev: KeyboardEvent) => {
      handleKeyDirection(ev, game.move);
    };
    globalThis.addEventListener("keydown", handleKeyPress);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyPress);
    };
  }, [game.move]);

  // Touch swipe navigation. Horizontal = E/W (posY), vertical = N/S (posX).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const onTouchStart = (ev: TouchEvent) => {
      const touch = ev.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const onTouchEnd = (ev: TouchEvent) => {
      if (startTime === 0) {
        return;
      }
      const touch = ev.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const elapsed = Date.now() - startTime;
      startTime = 0;

      if (elapsed > SWIPE_TIMEOUT_MS) {
        return;
      }
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > SWIPE_THRESHOLD && absY < SWIPE_VERTICAL_LIMIT) {
        game.move(dx > 0 ? "W" : "E");
        return;
      }
      if (absY > SWIPE_THRESHOLD && absX < SWIPE_VERTICAL_LIMIT) {
        game.move(dy > 0 ? "S" : "N");
      }
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchend", onTouchEnd);
    };
  }, [game]);

  const stonesLabel = `${game.stonesFound.length} of ${STONES.length} stones gathered`;

  return (
    <div className="zazen-world-container path-stones" ref={containerRef}>
      <div className="sr-only" aria-live="polite">
        {game.announcement}
      </div>
      <div className="zazen-world__header path-stones__header">
        <h1 className="sr-only">Path of Stones</h1>
        <p className="path-stones__intro">Five stones wait along the path.</p>
        <p className="sr-only" id="game-instructions">
          Use WASD or arrow keys to walk the pilgrim across the garden. Swipe on touch devices.
          Find all five stones, then walk to the awakened shrine to complete the path.
        </p>
        <p className="path-stones__progress" aria-label={stonesLabel}>
          {game.stonesFound.length} / {STONES.length}
        </p>
      </div>
      <CompassPanel onMove={game.move} />
      <GameMap
        map={game.map}
        mapDimensions={game.mapDimensions}
        characterPosition={game.characterPosition}
        mapScale={mapScale}
        onTileClick={handleTileClick}
      />
      {!game.finaleOpen && <ZazenHaikuScroll lines={game.haikuLines} />}
      {game.finaleOpen && <ZazenFinaleOverlay lines={game.haikuLines} />}
    </div>
  );
};

export default ZazenWorld;
