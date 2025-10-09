import { useState, useEffect, useCallback } from "react";
import "./world.scss";

type MapTile = {
  x: number;
  y: number;
  img: string;
  perso: number;
  decors: string;
};

const initialMap: MapTile[] = [
  { x: 1, y: 1, img: "terre", perso: 0, decors: "pierre" },
  { x: 2, y: 1, img: "terre", perso: 0, decors: "" },
  { x: 3, y: 1, img: "terre", perso: 0, decors: "" },
  { x: 4, y: 1, img: "terre", perso: 0, decors: "" },
  { x: 5, y: 1, img: "terre-2", perso: 0, decors: "" },
  { x: 6, y: 1, img: "terre", perso: 0, decors: "" },

  { x: 1, y: 2, img: "terre", perso: 0, decors: "pierre" },
  { x: 2, y: 2, img: "terre", perso: 1, decors: "" },
  { x: 3, y: 2, img: "terre", perso: 0, decors: "" },
  { x: 4, y: 2, img: "terre", perso: 0, decors: "" },
  { x: 5, y: 2, img: "terre", perso: 0, decors: "" },
  { x: 6, y: 2, img: "terre-2", perso: 0, decors: "" },

  { x: 1, y: 3, img: "terre", perso: 0, decors: "" },
  { x: 2, y: 3, img: "terre", perso: 0, decors: "" },
  { x: 3, y: 3, img: "terre", perso: 0, decors: /*'bulletin'*/ "" },
  { x: 4, y: 3, img: "terre", perso: 0, decors: "" },
  { x: 5, y: 3, img: "terre", perso: 3, decors: "" },
  { x: 6, y: 3, img: "terre", perso: 0, decors: "arbre" },

  { x: 1, y: 4, img: "terre", perso: 0, decors: "arbre" },
  { x: 2, y: 4, img: "terre", perso: 0, decors: "" },
  { x: 3, y: 4, img: "terre", perso: 0, decors: "" },
  { x: 4, y: 4, img: "terre", perso: 0, decors: "" },
  { x: 5, y: 4, img: "terre", perso: 2, decors: "" },
  { x: 6, y: 4, img: "terre", perso: 0, decors: "" },

  { x: 1, y: 5, img: "eau-2", perso: 0, decors: "" },
  { x: 2, y: 5, img: "eau-2", perso: 0, decors: "" },
  { x: 3, y: 5, img: "eau-2", perso: 0, decors: "" },
  { x: 4, y: 5, img: "eau-2", perso: 0, decors: "" },
  { x: 5, y: 5, img: "eau-2", perso: 0, decors: "" },
  { x: 6, y: 5, img: "eau-2", perso: 0, decors: "" },

  { x: 1, y: 6, img: "eau-1", perso: 0, decors: "" },
  { x: 2, y: 6, img: "eau-1", perso: 0, decors: "" },
  { x: 3, y: 6, img: "eau-1", perso: 0, decors: "barque" },
  { x: 4, y: 6, img: "eau-1", perso: 0, decors: "" },
  { x: 5, y: 6, img: "eau-1", perso: 0, decors: "" },
  { x: 6, y: 6, img: "eau-1", perso: 0, decors: "" },
];

export default function ZazenWorld() {
  const [isModalOpen] = useState(true);

  const [map, setMap] = useState<MapTile[]>(initialMap);
  const [characterPosition, setCharacterPosition] = useState<{
    x: number;
    y: number;
  }>();

  const [mapDimensions, setMapDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const calculateMapDimensions = () => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      map.forEach(tile => {
        const top = (tile.x + tile.y) * 16;
        const left = (tile.x - tile.y) * 32;

        if (top < minY) minY = top;
        if (top > maxY) maxY = top;
        if (left < minX) minX = left;
        if (left > maxX) maxX = left;
      });

      // Add tile dimensions to the max values
      const width = maxX - minX + 64; // 64 is the tile width
      const height = maxY - minY + 90; // 90 is the tile height

      setMapDimensions({ width, height });
    };

    calculateMapDimensions();
  }, [map]);

  // Lazy initialization for character position
  useEffect(() => {
    const initialPosition = map.find((tile) => tile.perso === 1);
    if (initialPosition) {
      setCharacterPosition({ x: initialPosition.x, y: initialPosition.y });
    }
  }, [map]);

  const move = useCallback(
    (direction: "N" | "E" | "S" | "W") => {
      if (!characterPosition) return;

      let newX = characterPosition.x;
      let newY = characterPosition.y;

      switch (direction) {
        case "N":
          newX -= 1;
          break;
        case "E":
          newY -= 1;
          break;
        case "S":
          newX += 1;
          break;
        case "W":
          newY += 1;
          break;
      }

      const targetTileIndex = map.findIndex(
        (tile) =>
          tile.x === newX &&
          tile.y === newY &&
          tile.perso === 0 &&
          tile.decors === "" &&
          !tile.img.match(/eau/),
      );

      if (targetTileIndex !== -1) {
        // Create a new map only if necessary
        const newMap = [...map];
        const currentIndex = map.findIndex(
          (tile) =>
            tile.x === characterPosition.x && tile.y === characterPosition.y,
        );
        if (currentIndex !== -1) {
          newMap[targetTileIndex] = { ...newMap[targetTileIndex], perso: 1 }; // Set the new position
          newMap[currentIndex] = { ...newMap[currentIndex], perso: 0 }; // Clear the old position
          setMap(newMap); // Update the map state
          setCharacterPosition({ x: newX, y: newY }); // Update the character position state
        }
      }
    },
    [characterPosition, map],
  );

  return (
    <div className="zazen-world-container">
      <div className="zazen-world__header">
        <h1 className="zazen-world__title">Zazen World</h1>
        <div className="">
          <button
            type="button"
            className="zazen-world__close"
            onClick={() => {
              window.location.href = "/about";
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Inputs for movement */}
      <div className="zazen-world__compass">
        <table
          style={{
            width: "6.25rem",
            height: "5.3125rem",
            backgroundImage: `url(/images/zazen/compass.png)`,
            backgroundRepeat: "no-repeat",
          }}
        >
          <tbody>
            <tr>
              <td></td>
              <td>
                <input
                  type="radio"
                  name="direction"
                  onClick={() => move("N")}
                />
              </td>
              <td></td>
            </tr>
            <tr>
              <td>
                <input
                  type="radio"
                  name="direction"
                  onClick={() => move("W")}
                />
              </td>
              <td></td>
              <td>
                <input
                  type="radio"
                  name="direction"
                  onClick={() => move("E")}
                />
              </td>
            </tr>
            <tr>
              <td></td>
              <td>
                <input
                  type="radio"
                  name="direction"
                  onClick={() => move("S")}
                />
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        className="zazen-world__map"
        style={{
          width: `${mapDimensions.width}px`,
          height: `${mapDimensions.height}px`,
        }}
      >
        {map.map((tile, index) => (
          <div
            className="zazen-world__tile"
            key={index}
            style={{
              top: `${(tile.x + tile.y) * 16}px`,
              left: `${(tile.x - tile.y) * 32}px`,
            }}
          >
            <div
              className="zazen-world__tile-image"
              style={{
                backgroundImage: `url('/images/zazen/sol/${tile.img}.gif')`,
              }}
            >
              {tile.perso !== 0 && (
                <img
                  src={`/images/zazen/persos/${tile.perso}.gif`}
                  alt={`Character ${tile.perso}`}
                />
              )}
              {tile.decors !== "" && (
                <img
                  src={`/images/zazen/decors/${tile.decors}.gif`}
                  alt={tile.decors}
                  className="zazen-world__decor"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
