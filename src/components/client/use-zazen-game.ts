import { useCallback, useMemo, useState } from "react";
import type { Direction, HaikuEntry, MapTile } from "./zazen-world-types";
import {
  SHRINE_POSITION,
  STONES,
  activateShrine,
  buildInitialMap,
  calculateMapDimensions,
  collectStoneAt,
  performMove,
} from "./zazen-world-helpers";

interface UseZazenGameOptions {
  onStoneCollected?: (stoneIndex: number) => void;
  onShrineActivated?: () => void;
  onFinaleOpened?: () => void;
}

interface ZazenGameState {
  announcement: string;
  characterPosition: { posX: number; posY: number } | undefined;
  dismissFinale: () => void;
  finaleOpen: boolean;
  haikuLines: readonly HaikuEntry[];
  map: MapTile[];
  mapDimensions: { height: number; offsetX: number; offsetY: number; width: number };
  move: (dir: Direction) => void;
  shrineActivated: boolean;
  stonesFound: readonly number[];
}

const findPlayer = (map: MapTile[]): { posX: number; posY: number } | undefined => {
  const player = map.find((tile) => tile.perso === 1);
  if (!player) {
    return undefined;
  }
  return { posX: player.posX, posY: player.posY };
};

const useZazenGame = (options: UseZazenGameOptions = {}): ZazenGameState => {
  const [map, setMap] = useState<MapTile[]>(() => buildInitialMap());
  const [stonesFound, setStonesFound] = useState<readonly number[]>([]);
  const [shrineActivated, setShrineActivated] = useState(false);
  const [finaleOpen, setFinaleOpen] = useState(false);
  const [haikuLines, setHaikuLines] = useState<readonly HaikuEntry[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const characterPosition = useMemo(() => findPlayer(map), [map]);
  const mapDimensions = useMemo(() => calculateMapDimensions(map), [map]);

  const move = useCallback(
    (direction: Direction) => {
      if (!characterPosition || finaleOpen) {
        return;
      }
      const result = performMove(direction, characterPosition, map);
      if (!result) {
        return;
      }

      const landedTile = result.newMap.find(
        (tile) =>
          tile.posX === result.newPosition.posX && tile.posY === result.newPosition.posY,
      );
      if (!landedTile) {
        setMap(result.newMap);
        return;
      }

      let nextMap = result.newMap;

      if (landedTile.stone !== undefined) {
        const stoneIndex = landedTile.stone;
        const stone = STONES[stoneIndex];
        nextMap = collectStoneAt(nextMap, stoneIndex);
        const nextStones = [...stonesFound, stoneIndex];
        setStonesFound(nextStones);
        setHaikuLines((prev) => [...prev, { stoneIndex, text: stone.line }]);
        setAnnouncement(
          `Stone ${nextStones.length} of ${STONES.length} gathered. ${stone.line}`,
        );
        options.onStoneCollected?.(stoneIndex);

        if (nextStones.length === STONES.length) {
          nextMap = activateShrine(nextMap);
          setShrineActivated(true);
          setAnnouncement("The shrine awakens. Walk to it to finish the path.");
          options.onShrineActivated?.();
        }
      } else if (
        landedTile.shrine === "active" &&
        landedTile.posX === SHRINE_POSITION.posX &&
        landedTile.posY === SHRINE_POSITION.posY
      ) {
        setFinaleOpen(true);
        setAnnouncement("You have reached the shrine.");
        options.onFinaleOpened?.();
      } else {
        setAnnouncement("");
      }

      setMap(nextMap);
    },
    [characterPosition, finaleOpen, map, options, stonesFound],
  );

  const dismissFinale = useCallback(() => {
    setFinaleOpen(false);
  }, []);

  return {
    announcement,
    characterPosition,
    dismissFinale,
    finaleOpen,
    haikuLines,
    map,
    mapDimensions,
    move,
    shrineActivated,
    stonesFound,
  };
};

export default useZazenGame;
export type { UseZazenGameOptions, ZazenGameState };
