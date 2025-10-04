import { useState, useEffect, useCallback } from 'react';
import './world.css';

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

export default function ZazenWorld() {
  const [isModalOpen] = useState(true);
  
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
      case 'N': newX -= 1; break;
      case 'E': newY -= 1; break;
      case 'S': newX += 1; break;
      case 'W': newY += 1; break;
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
      {isModalOpen && (
        <div className="fixed z-10 inset-0 overflow-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-screen" style={{ height: '58vh' }}>
              <div className="bg-[#F5EEE6] px-4 pt-5 sm:p-6 relative">

                <div className="flex justify-between items-start mb-2">
                  <h1 className="title">Zazen World</h1>

                  <div className="">
                    <button 
                      type="button" 
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-[#B47B84] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B47B84] sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm" 
                      onClick={() => {
                        window.location.href = "/about";
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Inputs for movement */}
                <div className="mb-60">
                  <table style={{ width: '6.25rem', height: '5.3125rem', backgroundImage: `url(/images/zazen/compass.png)`, backgroundRepeat: 'no-repeat' }}>
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


                <div>
                  {map.map((tile, index) => (
                    <div className="absolute" key={index} style={{ top: `${50 + (tile.x + tile.y) * 16}px`, left: `${250 + (tile.x - tile.y) * 32}px` }}>
                      <div className="tile" style={{ 
                        backgroundImage: `url('/images/zazen/sol/${tile.img}.gif')`,
                      }}>
                        {tile.perso !== 0 && <img src={`/images/zazen/persos/${tile.perso}.gif`} alt={`Character ${tile.perso}`} />}
                        {tile.decors !== '' && <img src={`/images/zazen/decors/${tile.decors}.gif`} alt={tile.decors} className="decorative" />}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
