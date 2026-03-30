import "./world.scss";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { Direction, MapTile, MoveResult } from "./zazen-world-types";
import {
  ICON_SIZE, ICON_STROKE_WIDTH, TILE_HALF_HEIGHT, TILE_HALF_WIDTH,
  buildInitialMap, calculateMapDimensions, handleKeyDirection, performMove,
} from "./zazen-world-helpers";
import { useCallback, useEffect, useState } from "react";

interface DirectionButtonProps {
  direction: Direction;
  onMove: (dir: Direction) => void;
  icon: React.ReactNode;
  label: string;
  title: string;
  keyLabel: string;
  modifier: string;
}

interface TileRendererProps {
  tile: MapTile;
}

interface CompassPanelProps {
  onMove: (dir: Direction) => void;
}

interface GameMapProps {
  map: MapTile[];
  mapDimensions: { height: number; width: number };
  characterPosition: { posX: number; posY: number } | undefined;
}

const DirectionButton = function DirectionButton({ direction, onMove, icon, label, title, keyLabel, modifier }: DirectionButtonProps) {
  return (
    <button
      className={`zazen-world__compass-btn zazen-world__compass-btn--${modifier}`}
      onClick={() => { onMove(direction); }}
      aria-label={label}
      title={title}
    >
      {icon}
      <span>{keyLabel}</span>
    </button>
  );
};

const TileRenderer = function TileRenderer({ tile }: TileRendererProps) {
  return (
    <div
      className="zazen-world__tile-image"
      style={{ backgroundImage: `url('/images/zazen/sol/${tile.img}.gif')` }}
    >
      {tile.perso !== 0 && (
        <img src={`/images/zazen/persos/${tile.perso}.gif`} alt={`Character ${tile.perso}`} />
      )}
      {tile.decors !== "" && (
        <img src={`/images/zazen/decors/${tile.decors}.gif`} alt={tile.decors} className="zazen-world__decor" />
      )}
    </div>
  );
};

const northIcon = <ArrowUp size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const westIcon = <ArrowLeft size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const eastIcon = <ArrowRight size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;
const southIcon = <ArrowDown size={ICON_SIZE} strokeWidth={ICON_STROKE_WIDTH} />;

const CompassPanel = function CompassPanel({ onMove }: CompassPanelProps) {
  return (
    <div className="zazen-world__compass" role="group" aria-labelledby="compass-label">
      <div className="sr-only" id="compass-label">Movement controls</div>
      <div className="zazen-world__compass-container">
        <DirectionButton direction="N" onMove={onMove} icon={northIcon} label="Move North (W/up arrow)" title="Press W or up arrow" keyLabel="W" modifier="north" />
        <DirectionButton direction="W" onMove={onMove} icon={westIcon} label="Move West (A/left arrow)" title="Press A or left arrow" keyLabel="A" modifier="west" />
        <DirectionButton direction="E" onMove={onMove} icon={eastIcon} label="Move East (D/right arrow)" title="Press D or right arrow" keyLabel="D" modifier="east" />
        <DirectionButton direction="S" onMove={onMove} icon={southIcon} label="Move South (S/down arrow)" title="Press S or down arrow" keyLabel="S" modifier="south" />
      </div>
    </div>
  );
};

const GameMap = function GameMap({ map, mapDimensions, characterPosition }: GameMapProps) {
  return (
    <div
      className="zazen-world__map"
      role="application"
      aria-label="Interactive game world map"
      aria-describedby="game-instructions"
      style={{ height: `${mapDimensions.height}px`, width: `${mapDimensions.width}px` }}
    >
      <div className="sr-only" aria-live="polite" id="position-announcer">
        {characterPosition && `Character is at position ${characterPosition.posX}, ${characterPosition.posY}`}
      </div>
      {map.map((tile, index) => (
        <div
          className="zazen-world__tile"
          key={index}
          style={{
            left: `${(tile.posX - tile.posY) * TILE_HALF_WIDTH}px`,
            top: `${(tile.posX + tile.posY) * TILE_HALF_HEIGHT}px`,
          }}
        >
          <TileRenderer tile={tile} />
        </div>
      ))}
    </div>
  );
};

const initialMap = buildInitialMap();

export default function ZazenWorld() {
  const [map, setMap] = useState<MapTile[]>(initialMap);
  const [characterPosition, setCharacterPosition] = useState<{ posX: number; posY: number }>();
  const [mapDimensions, setMapDimensions] = useState({ height: 0, width: 0 });

  useEffect(() => { setMapDimensions(calculateMapDimensions(map)); }, [map]);

  useEffect(() => {
    const pos = map.find((tile) => tile.perso === 1);
    if (pos) { setCharacterPosition({ posX: pos.posX, posY: pos.posY }); }
  }, [map]);

  const move = useCallback(
    (direction: Direction) => {
      if (!characterPosition) { return; }
      const result: MoveResult | undefined = performMove(direction, characterPosition, map);
      if (result) {
        setMap(result.newMap);
        setCharacterPosition(result.newPosition);
      }
    },
    [characterPosition, map],
  );

  useEffect(() => {
    const handleKeyPress = function handleKeyPress(ev: KeyboardEvent) { handleKeyDirection(ev, move); };
    globalThis.addEventListener("keydown", handleKeyPress);
    return () => { globalThis.removeEventListener("keydown", handleKeyPress); };
  }, [move]);

  return (
    <div className="zazen-world-container">
      <div className="zazen-world__header">
        <h1 className="zazen-world__title">Zazen World</h1>
        <p className="zazen-world__instructions" id="game-instructions">
          Use WASD keys or arrow keys to move your character around the world.
          Click the compass buttons or use keyboard navigation to explore.
        </p>
      </div>
      <CompassPanel onMove={move} />
      <GameMap map={map} mapDimensions={mapDimensions} characterPosition={characterPosition} />
    </div>
  );
}
