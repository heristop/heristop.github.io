import { useState, useEffect, useCallback } from 'react';
import './zazen.css';

type MapTile = {
  x: number;
  y: number;
  img: string;
  perso: number;
  decors: string;
};

const initialMap: MapTile[] = [
  { x: 1, y: 1, img: 'terre', perso: 0, decors: 'pierre' },
  { x: 2, y: 1, img: 'terre', perso: 0, decors: '' },
  { x: 3, y: 1, img: 'terre', perso: 0, decors: '' },
  { x: 4, y: 1, img: 'terre', perso: 0, decors: '' },
  { x: 5, y: 1, img: 'terre-2', perso: 0, decors: '' },
  { x: 6, y: 1, img: 'terre', perso: 0, decors: '' },

  { x: 1, y: 2, img: 'terre', perso: 0, decors: 'pierre' },
  { x: 2, y: 2, img: 'terre', perso: 1, decors: '' },
  { x: 3, y: 2, img: 'terre', perso: 0, decors: '' },
  { x: 4, y: 2, img: 'terre', perso: 0, decors: '' },
  { x: 5, y: 2, img: 'terre', perso: 0, decors: '' },
  { x: 6, y: 2, img: 'terre-2', perso: 0, decors: '' },

  { x: 1, y: 3, img: 'terre', perso: 0, decors: '' },
  { x: 2, y: 3, img: 'terre', perso: 0, decors: '' },
  { x: 3, y: 3, img: 'terre', perso: 0, decors: /*'bulletin'*/'' },
  { x: 4, y: 3, img: 'terre', perso: 0, decors: '' },
  { x: 5, y: 3, img: 'terre', perso: 3, decors: '' },
  { x: 6, y: 3, img: 'terre', perso: 0, decors: 'arbre' },

  { x: 1, y: 4, img: 'terre', perso: 0, decors: 'arbre' },
  { x: 2, y: 4, img: 'terre', perso: 0, decors: '' },
  { x: 3, y: 4, img: 'terre', perso: 0, decors: '' },
  { x: 4, y: 4, img: 'terre', perso: 0, decors: '' },
  { x: 5, y: 4, img: 'terre', perso: 2, decors: '' },
  { x: 6, y: 4, img: 'terre', perso: 0, decors: '' },

  { x: 1, y: 5, img: 'eau-2', perso: 0, decors: '' },
  { x: 2, y: 5, img: 'eau-2', perso: 0, decors: '' },
  { x: 3, y: 5, img: 'eau-2', perso: 0, decors: '' },
  { x: 4, y: 5, img: 'eau-2', perso: 0, decors: '' },
  { x: 5, y: 5, img: 'eau-2', perso: 0, decors: '' },
  { x: 6, y: 5, img: 'eau-2', perso: 0, decors: '' },

  { x: 1, y: 6, img: 'eau-1', perso: 0, decors: '' },
  { x: 2, y: 6, img: 'eau-1', perso: 0, decors: '' },
  { x: 3, y: 6, img: 'eau-1', perso: 0, decors: 'barque' },
  { x: 4, y: 6, img: 'eau-1', perso: 0, decors: '' },
  { x: 5, y: 6, img: 'eau-1', perso: 0, decors: '' },
  { x: 6, y: 6, img: 'eau-1', perso: 0, decors: '' },
];

export default function Zazen() {
  const [map, setMap] = useState<MapTile[]>(initialMap);
  const [characterPosition, setCharacterPosition] = useState<{ x: number; y: number }>();

  // Lazy initialization for character position
  useEffect(() => {
    const initialPosition = map.find(tile => tile.perso === 1);
    if (initialPosition) {
      setCharacterPosition({ x: initialPosition.x, y: initialPosition.y });
    }
  }, [map]);

  const move = useCallback((direction: 'N' | 'E' | 'S' | 'W') => {
    if (!characterPosition) return;

    let newX = characterPosition.x;
    let newY = characterPosition.y;

    switch (direction) {
      case 'N': newY -= 1; break;
      case 'E': newX += 1; break;
      case 'S': newY += 1; break;
      case 'W': newX -= 1; break;
    }

    const targetTileIndex = map.findIndex(tile => tile.x === newX && tile.y === newY && tile.perso === 0  && tile.decors === '' && !tile.img.match(/eau/));
    
    if (targetTileIndex !== -1) {
      // Create a new map only if necessary
      const newMap = [...map];
      const currentIndex = map.findIndex(tile => tile.x === characterPosition.x && tile.y === characterPosition.y);
      if (currentIndex !== -1) {
        newMap[targetTileIndex] = { ...newMap[targetTileIndex], perso: 1 };  // Set the new position
        newMap[currentIndex] = { ...newMap[currentIndex], perso: 0 };  // Clear the old position
        setMap(newMap);  // Update the map state
        setCharacterPosition({ x: newX, y: newY });  // Update the character position state
      }
    }
  }, [characterPosition, map]);

  return (
    <div>
      {map.map((tile, index) => (
        <div key={index} style={{ position: 'absolute', top: `${50 + (tile.x + tile.y) * 16}px`, left: `${250 + (tile.x - tile.y) * 32}px` }}>
          <div className="tile" style={{ 
            backgroundImage: `url('/images/zazen/sol/${tile.img}.gif')`,
          }}>
            {tile.perso !== 0 && <img src={`/images/zazen/persos/${tile.perso}.gif`} alt={`Character ${tile.perso}`} />}
            {tile.decors !== '' && <img src={`/images/zazen/decors/${tile.decors}.gif`} alt={tile.decors} className="decorative" />}
          </div>
        </div>
      ))}

      {/* Inputs for movement */}
      <div className="mx-9">
        <table style={{ width: '100px', height: '85px', backgroundImage: `url(/images/zazen/compass.png)`, backgroundRepeat: 'no-repeat' }}>
          <tbody>
            <tr>
              <td></td>
              <td><input type="radio" name="direction" onClick={() => move('N')} /></td>
              <td></td>
            </tr>
            <tr>
              <td><input type="radio" name="direction" onClick={() => move('W')} /></td>
              <td></td>
              <td><input type="radio" name="direction" onClick={() => move('E')} /></td>
            </tr>
            <tr>
              <td></td>
              <td><input type="radio" name="direction" onClick={() => move('S')} /></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
