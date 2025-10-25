import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import "./world.scss";

interface MapTile {
  x: number;
  y: number;
  img: string;
  perso: number;
  decors: string;
}

// Helper function to generate terrain procedurally
const generateTerrain = (x: number, y: number): { img: string; decors: string; perso: number } => {
  // Original map content (centered at 4-9 range in 12x12 map)
  const originalContent: Record<string, { img: string; decors: string; perso: number }> = {
    "4-4": { img: "terre", decors: "pierre", perso: 0 }, "4-5": { img: "terre", decors: "pierre", perso: 0 }, "4-6": { img: "terre", decors: "", perso: 0 }, "4-7": { img: "terre", decors: "arbre", perso: 0 }, "4-8": { img: "eau-2", decors: "", perso: 0 }, "4-9": { img: "eau-1", decors: "", perso: 0 }, "5-4": { img: "terre", decors: "", perso: 0 }, "5-5": { img: "terre", decors: "", perso: 1 }, "5-6": { img: "terre", decors: "", perso: 0 }, "5-7": { img: "terre", decors: "", perso: 0 }, "5-8": { img: "eau-2", decors: "", perso: 0 }, "5-9": { img: "eau-1", decors: "", perso: 0 }, "6-4": { img: "terre", decors: "", perso: 0 }, "6-5": { img: "terre", decors: "", perso: 0 }, "6-6": { img: "terre", decors: "", perso: 0 }, "6-7": { img: "terre", decors: "", perso: 0 }, "6-8": { img: "eau-2", decors: "", perso: 0 }, "6-9": { img: "eau-1", decors: "barque", perso: 0 }, "7-4": { img: "terre", decors: "", perso: 0 }, "7-5": { img: "terre", decors: "", perso: 0 }, "7-6": { img: "terre", decors: "", perso: 0 }, "7-7": { img: "terre", decors: "", perso: 0 }, "7-8": { img: "eau-2", decors: "", perso: 0 }, "7-9": { img: "eau-1", decors: "", perso: 0 }, "8-4": { img: "terre-2", decors: "", perso: 0 }, "8-5": { img: "terre", decors: "", perso: 0 }, "8-6": { img: "terre", decors: "", perso: 3 }, "8-7": { img: "terre", decors: "", perso: 2 }, "8-8": { img: "eau-2", decors: "", perso: 0 }, "8-9": { img: "eau-1", decors: "", perso: 0 }, "9-4": { img: "terre", decors: "", perso: 0 }, "9-5": { img: "terre-2", decors: "", perso: 0 }, "9-6": { img: "terre", decors: "arbre", perso: 0 }, "9-7": { img: "terre", decors: "", perso: 0 }, "9-8": { img: "eau-2", decors: "", perso: 0 }, "9-9": { img: "eau-1", decors: "", perso: 0 },
  };

  const key = `${x}-${y}`;
  if (originalContent[key]) {
    return originalContent[key];
  }

  // Procedural generation for new areas
  const centerX = 6.5;
  const centerY = 6.5;
  const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

  // Create varied terrain based on distance and position
  let img = "terre";
  let decors = "";
  let perso = 0;

  // Water areas - river crossing the entire map horizontally
  if (y >= 8 && y <= 9) {
    img = y === 9 ? "eau-1" : "eau-2";
  }
  // Mountain/rocky areas at edges
  else if (distanceFromCenter > 7 || (x <= 2 || x >= 11 || y <= 2 || y >= 11)) {
    img = Math.random() > 0.6 ? "terre-2" : "terre";
  }
  // Regular terrain with variation
  else {
    img = Math.random() > 0.7 ? "terre-2" : "terre";
  }

  // Add decorations (more sparse)
  if (img.includes("terre") && Math.random() > 0.8) {
    const decorOptions = ["arbre", "pierre"];
    decors = decorOptions[Math.floor(Math.random() * decorOptions.length)];
  }

  // No additional boats - only the one in original content

  return { decors, img, perso };
};

// Generate the 12x12 map
const initialMap: MapTile[] = [];
for (let x = 1; x <= 12; x++) {
  for (let y = 1; y <= 12; y++) {
    const { img, decors, perso } = generateTerrain(x, y);
    initialMap.push({ decors, img, perso, x, y });
  }
}

export default function ZazenWorld() {

  const [map, setMap] = useState<MapTile[]>(initialMap);
  const [characterPosition, setCharacterPosition] = useState<{
    x: number;
    y: number;
  }>();

  const [mapDimensions, setMapDimensions] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const calculateMapDimensions = () => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

      map.forEach(tile => {
        const top = (tile.x + tile.y) * 16;
        const left = (tile.x - tile.y) * 32;

        if (top < minY) {minY = top;}
        if (top > maxY) {maxY = top;}
        if (left < minX) {minX = left;}
        if (left > maxX) {maxX = left;}
      });

      // Add tile dimensions to the max values
      const width = maxX - minX + 64; // 64 is the tile width
      const height = maxY - minY + 90; // 90 is the tile height

      setMapDimensions({ height, width });
    };

    calculateMapDimensions();
  }, [map]);

  const move = useCallback(
    (direction: "N" | "E" | "S" | "W") => {
      if (!characterPosition) {return;}

      let newX = characterPosition.x;
      let newY = characterPosition.y;

      // Fixed directions for isometric view
      switch (direction) {
        case "N": { // Move up-left visually
          newX -= 1;
          break;
        }
        case "E": { // Move up-right visually
          newY -= 1;
          break;
        }
        case "S": { // Move down-right visually
          newX += 1;
          break;
        }
        case "W": { // Move down-left visually
          newY += 1;
          break;
        }
      }

      const targetTileIndex = map.findIndex(
        (tile) =>
          tile.x === newX &&
          tile.y === newY &&
          tile.perso === 0 &&
          tile.decors === "" &&
          !/eau/.test(tile.img),
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

  // Lazy initialization for character position
  useEffect(() => {
    const initialPosition = map.find((tile) => tile.perso === 1);
    if (initialPosition) {
      setCharacterPosition({ x: initialPosition.x, y: initialPosition.y });
    }
  }, [map]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w': {
          e.preventDefault();
          move('N');
          break;
        }
        case 'arrowdown':
        case 's': {
          e.preventDefault();
          move('S');
          break;
        }
        case 'arrowleft':
        case 'a': {
          e.preventDefault();
          move('W');
          break;
        }
        case 'arrowright':
        case 'd': {
          e.preventDefault();
          move('E');
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
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

      {/* Inputs for movement */}
      <div className="zazen-world__compass" role="group" aria-labelledby="compass-label">
        <div className="sr-only" id="compass-label">Movement controls</div>
        <div
          className="zazen-world__compass-container"
        >
          <button
            className="zazen-world__compass-btn zazen-world__compass-btn--north"
            onClick={() => move("N")}
            aria-label="Move North (W/↑)"
            title="Press W or ↑ arrow"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
            <span>W</span>
          </button>
          <button
            className="zazen-world__compass-btn zazen-world__compass-btn--west"
            onClick={() => move("W")}
            aria-label="Move West (A/←)"
            title="Press A or ← arrow"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>A</span>
          </button>
          <button
            className="zazen-world__compass-btn zazen-world__compass-btn--east"
            onClick={() => move("E")}
            aria-label="Move East (D/→)"
            title="Press D or → arrow"
          >
            <ArrowRight size={16} strokeWidth={2.5} />
            <span>D</span>
          </button>
          <button
            className="zazen-world__compass-btn zazen-world__compass-btn--south"
            onClick={() => move("S")}
            aria-label="Move South (S/↓)"
            title="Press S or ↓ arrow"
          >
            <ArrowDown size={16} strokeWidth={2.5} />
            <span>S</span>
          </button>
        </div>
      </div>

      <div
        className="zazen-world__map"
        role="application"
        aria-label="Interactive game world map"
        aria-describedby="game-instructions"
        style={{
          height: `${mapDimensions.height}px`, width: `${mapDimensions.width}px`,
        }}
      >
        <div className="sr-only" aria-live="polite" id="position-announcer">
          {characterPosition && `Character is at position ${characterPosition.x}, ${characterPosition.y}`}
        </div>
        {map.map((tile, index) => (
          <div
            className="zazen-world__tile"
            key={index}
            style={{
              left: `${(tile.x - tile.y) * 32}px`, top: `${(tile.x + tile.y) * 16}px`,
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
