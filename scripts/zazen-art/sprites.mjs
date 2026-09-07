// Pixel maps for every sprite the garden renders.
//
// Two rules govern everything in this file, and both are load-bearing:
//
//   1. THE 2:1 SLOPE. A ground diamond's edge advances exactly 2 columns per row.
//      Any other slope reads as broken isometry instantly. `diamondHalfWidth` is the
//      single place that rule lives — do not inline a different one.
//   2. ONE LIGHT DIRECTION, top-left. Every tile's top face is the light ramp entry,
//      its left wall the mid entry, its right wall the dark entry. Every decor sprite
//      is lit to match.
//
// Sprites are composed with the tiny raster helpers below rather than hand-typed as
// rows of characters: 64 rows of 64 characters is where slope errors come from.

const CELL = 64;
const DIAMOND_HEIGHT = 32;
const SKIRT_DEPTH = 16;
const DECOR_WIDTH = 32;
const DECOR_HEIGHT = 64;
const MONK_CELL_W = 24;
const MONK_CELL_H = 40;

// --- raster helpers ---------------------------------------------------------

const grid = (width, height) =>
  Array.from({ length: height }, () => Array.from({ length: width }, () => "."));

const put = (g, x, y, char) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) {
    g[y][x] = char;
  }
};

const rect = (g, x, y, width, height, char) => {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      put(g, x + dx, y + dy, char);
    }
  }
};

const blit = (target, source, offsetX, offsetY) => {
  for (let y = 0; y < source.length; y++) {
    for (let x = 0; x < source[y].length; x++) {
      if (source[y][x] !== ".") {
        put(target, offsetX + x, offsetY + y, source[y][x]);
      }
    }
  }
};

const toRows = (g) => g.map((row) => row.join(""));

/**
 * @typedef {{ width: number, height: number, rows: string[] }} Sprite
 * @param {string[][]} g
 * @returns {Sprite}
 */
const sprite = (g) => ({ height: g.length, rows: toRows(g), width: g[0].length });

// Stack frames vertically into one strip, as CSS steps() animation expects.
const stack = (frames) => {
  const width = frames[0][0].length;
  const out = grid(width, frames.length * frames[0].length);
  frames.forEach((frame, index) => {
    blit(out, frame, 0, index * frame.length);
  });
  return out;
};

// A deterministic speckle source. Never Math.random: the emitted PNGs are committed,
// so regenerating must produce byte-identical files.
const speckler = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) >>> 0;
    return state / 4294967296;
  };
};

// An ordered 4x4 dither. Pixel art gets its gradients from patterned thresholds, not from
// intermediate colours — there are seventeen of those and no more — so a tile's face is
// shaded by mixing two of them in a stable pattern rather than by blending.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const dither = (x, y) => BAYER[y & 3][x & 3] / 16;

// --- ground -----------------------------------------------------------------

// The one definition of the 2:1 slope. Row y of the diamond spans
// [32 - halfWidth, 32 + halfWidth); halfWidth grows by 2 per row.
const diamondHalfWidth = (y) =>
  y < DIAMOND_HEIGHT / 2 ? (y + 1) * 2 : (DIAMOND_HEIGHT - y) * 2;

// The lowest diamond row occupied by a column, used to find where its wall starts.
const bottomRowForColumn = (dx) => {
  for (let y = DIAMOND_HEIGHT - 1; y >= 0; y--) {
    if (dx < diamondHalfWidth(y)) {
      return y;
    }
  }
  return -1;
};

const groundTile = (light, mid, dark, speckle = null, speckleRate = 0, seed = 7) => {
  const g = grid(CELL, CELL);
  const noise = speckler(seed);

  // The top face was one flat colour, which is why a hundred of these read as a sheet of
  // paper rather than as ground: an isometric tile with no internal shading has nothing
  // for the eye to catch. Light falls off towards the near vertex, dithered; and the two
  // near edges take a darker pixel, which is what separates one tile from the next.
  for (let y = 0; y < DIAMOND_HEIGHT; y++) {
    const half = diamondHalfWidth(y);
    // Only the near quarter of the face is dithered. Spread across the whole tile the
    // pattern stops reading as shading and starts reading as static — a hundred tiles of
    // half-dither is just noise with a grid in it.
    const falloff = Math.max(0, (y / (DIAMOND_HEIGHT - 1) - 0.74) * 1.9);
    for (let x = CELL / 2 - half; x < CELL / 2 + half; x++) {
      const nearEdge =
        y >= DIAMOND_HEIGHT / 2 && (x === CELL / 2 - half || x === CELL / 2 + half - 1);
      let char = light;
      if (nearEdge) {
        char = mid;
      } else if (dither(x, y) < falloff) {
        char = mid;
      } else if (speckle && noise() < speckleRate) {
        char = speckle;
      }
      put(g, x, y, char);
    }
  }

  for (let x = 0; x < CELL; x++) {
    const dx = Math.abs(x - CELL / 2 + (x < CELL / 2 ? 0 : 1));
    const bottom = bottomRowForColumn(Math.abs(x - CELL / 2));
    if (bottom < 0) {
      continue;
    }
    const wall = x < CELL / 2 ? mid : dark;
    for (let d = 1; d <= SKIRT_DEPTH; d++) {
      const seam = (d === 6 || d === 12) && (x + d) % 9 < 7;
      const fissure = (x + (d > 6 ? 7 : 0)) % 17 === 0;
      put(g, x, bottom + d, seam || fissure ? "l" : wall);
    }
    void dx;
  }

  return g;
};

// Raked sand: faint parallel furrows following the isometric grain.
const rakedSand = () => {
  const g = groundTile("a", "b", "c");
  for (let y = 2; y < DIAMOND_HEIGHT; y += 5) {
    const half = diamondHalfWidth(y);
    for (let x = CELL / 2 - half; x < CELL / 2 + half; x++) {
      put(g, x, y, "b");
    }
  }
  return g;
};

const bridgePlank = () => {
  const g = groundTile("k", "l", "l");
  for (let y = 3; y < DIAMOND_HEIGHT; y += 6) {
    const half = diamondHalfWidth(y);
    for (let x = CELL / 2 - half; x < CELL / 2 + half; x++) {
      put(g, x, y, "l");
    }
  }
  return g;
};

// The highlight travels one row per frame, and the loop is exactly as long as the pattern
// repeats — eight rows, eight frames. A four-frame loop over an eight-row pattern jumps
// backwards halfway through, and that snap is what reads as the pond blinking rather than
// flowing.
const WATER_FRAMES = 8;
const WATER_PERIOD = 8;

const waterFrames = () =>
  stack(
    Array.from({ length: WATER_FRAMES }, (_unused, frame) => {
      const g = groundTile("g", "h", "i");
      for (let y = frame; y < DIAMOND_HEIGHT; y += WATER_PERIOD) {
        const half = diamondHalfWidth(y) - 6;
        if (half <= 0) {
          continue;
        }
        // Dithered, not solid. A full-width band of the darker water tone is a hard line
        // sliding down the tile; at 50% it is a shimmer, which is the same gentle read the
        // clay pond gets from its seven-percent albedo ripple.
        for (let x = CELL / 2 - half; x < CELL / 2 + half; x++) {
          if (dither(x, y) < 0.5) {
            put(g, x, y, "h");
          }
        }
      }
      return g;
    }),
  );

// One diamond inset inside another, sharing the tile's 2:1 slope so the step reads as a
// step rather than as a shape floating on the ground.
const inlaidDiamond = (g, inset, face, edge) => {
  for (let y = inset; y < DIAMOND_HEIGHT - inset; y++) {
    const half = diamondHalfWidth(y) - inset * 2;
    if (half <= 0) {
      continue;
    }
    for (let x = CELL / 2 - half; x < CELL / 2 + half; x++) {
      // Two pixels of edge, not one. On a 2:1 slope each row advances the boundary by two
      // columns, so a single-pixel edge lands with a gap under it every row and the ring
      // comes out as a row of dashes rather than as a line.
      const onEdge = x < CELL / 2 - half + 2 || x >= CELL / 2 + half - 2;
      put(g, x, y, onEdge ? edge : face);
    }
  }
};

// The shrine's dais. This was one cream diamond ringed in rose on a stone tile — at four
// tiles' distance a pale lozenge with a dotted edge, which is to say a hole in the garden
// rather than the place the whole walk is aimed at. It is now three stepped tiers, lit
// from the top-left like everything else, so it stands up off the ground; the locked
// variant is the same stone with the warmth and the rose taken out of it.
const shrineTile = (active) => {
  const g = groundTile("k", "k", "l");
  inlaidDiamond(g, 3, "j", "l");
  inlaidDiamond(g, 7, active ? "a" : "j", "k");
  inlaidDiamond(g, 11, active ? "b" : "k", active ? "m" : "l");

  // Four rose marks at the top tier's vertices, and only when it is awake. They are the
  // one place scenery is allowed the progress colour, and they are what the eye finds
  // from across the board.
  if (active) {
    // A small lit diamond at the centre. The top tier was a blank cream plate and the eye
    // had nothing to land on — this is the thing you are walking towards.
    const middle = Math.floor(DIAMOND_HEIGHT / 2);
    for (let row = -2; row <= 2; row++) {
      const width = 4 - Math.abs(row) * 2;
      if (width > 0) {
        rect(g, CELL / 2 - width, middle + row, width * 2, 1, row < 0 ? "m" : "n");
      }
    }
  }
  return g;
};

// --- decor ------------------------------------------------------------------

// A one-pixel skin around the silhouette. Against sand this pale, an unoutlined sprite has
// no edge to hold it — the canopy's lightest greens sit only a shade off the ground and
// the whole tree dissolves into it. The outline is what makes a sprite an object.
const outline = (g, char) => {
  const source = g.map((row) => row.slice());
  const height = source.length;
  const width = source[0].length;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (source[y][x] !== ".") {
        continue;
      }
      const touching =
        (source[y - 1]?.[x] ?? ".") !== "." ||
        (source[y + 1]?.[x] ?? ".") !== "." ||
        (source[y][x - 1] ?? ".") !== "." ||
        (source[y][x + 1] ?? ".") !== ".";
      if (touching) {
        g[y][x] = char;
      }
    }
  }
  return g;
};

const decor = (draw, outlineChar = null) => {
  const g = grid(DECOR_WIDTH, DECOR_HEIGHT);
  draw(g);
  return outlineChar ? outline(g, outlineChar) : g;
};

// Three fat rounded tiers rather than four thin cones. Each tier is lit along its top
// edge and shadowed along its last row, so the canopy has a near and a far side instead
// of reading as a flat green triangle.
const PINE_TIERS = [
  { halves: [2, 4, 5, 6, 7, 7], top: 14 },
  { halves: [3, 5, 7, 8, 9, 9], top: 26 },
  { halves: [4, 6, 8, 10, 11, 11], top: 36 },
];

// Each authored row covers two pixel rows. A canopy needs roughly thirty rows to reach
// from the crown down to the trunk, and thirty hand-tuned half-widths is a table nobody
// can read — so the shape is authored at half height and drawn at full.
const ROW_SCALE = 2;

const canopyTier = (g, top, halves) => {
  halves.forEach((half, index) => {
    const last = index === halves.length - 1;
    const fill = index === 0 ? "d" : last ? "f" : "e";
    for (let step = 0; step < ROW_SCALE; step++) {
      const y = top + index * ROW_SCALE + step;
      rect(g, 16 - half, y, half * 2, 1, fill);
      if (!last && index > 0) {
        put(g, 16 - half, y, "d");
      }
    }
  });
};

const pine = () =>
  decor((g) => {
    rect(g, 15, 47, 3, 10, "p");
    put(g, 15, 47, "q");
    PINE_TIERS.forEach(({ top, halves }) => {
      canopyTier(g, top, halves);
    });
  }, "f");

// Overlapping leaf clusters give the crown an irregular silhouette and lit ledges.
const leafyTree = (light, mid, dark) =>
  decor((g) => {
    rect(g, 15, 36, 4, 22, "p");
    rect(g, 15, 40, 1, 17, "k");
    rect(g, 10, 43, 7, 2, "p");
    rect(g, 18, 38, 7, 2, "p");
    const clusters = [[19, 33, 10, 9], [9, 30, 8, 9], [24, 26, 7, 8],
      [15, 22, 10, 10], [8, 21, 6, 6], [19, 15, 7, 7]];
    for (const [cx, cy, rx, ry] of clusters) {
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const edge = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (edge > 1 || (edge > 0.85 && (x + y) % 3 === 0)) continue;
          const shade = y > ry * 0.45 || x > rx * 0.65 ? dark : mid;
          const highlight = y < -ry * 0.15 && x < rx * 0.25;
          put(g, cx + x, cy + y, highlight ? light : shade);
          if (highlight && (x + y * 3) % 7 === 0) put(g, cx + x, cy + y, mid);
        }
      }
    }
  }, dark);

const maple = () => leafyTree("d", "e", "f");

// Rose is reserved for the stones, the shrine — and sakura. It is the one warm note the
// palette allows in the planting, so it is spent on exactly one tree.
const sakura = () => leafyTree("m", "n", "o");

const bamboo = (stalks, height) =>
  decor((g) => {
    stalks.forEach((offset, index) => {
      const top = DECOR_HEIGHT - height + index * 3;
      rect(g, 16 + offset, top, 3, height - index * 3, index % 2 === 0 ? "e" : "d");
      for (let y = top + 5; y < DECOR_HEIGHT; y += 7) {
        rect(g, 16 + offset, y, 3, 1, "f");
      }
      rect(g, 16 + offset - 4, top + 6, 4, 1, "d");
      rect(g, 16 + offset + 3, top + 12, 4, 1, "d");
    });
  }, "f");

const reed = () =>
  decor((g) => {
    [-6, -1, 4].forEach((offset, index) => {
      const top = 34 + index * 4;
      rect(g, 16 + offset, top, 2, DECOR_HEIGHT - top - 4, index === 1 ? "e" : "d");
      rect(g, 16 + offset, top - 3, 2, 3, "f");
    });
  }, "f");

const rock = (width, height, light, mid, dark) =>
  decor((g) => {
    const baseY = DECOR_HEIGHT - height - 4;
    for (let y = 0; y < height; y++) {
      const half = Math.round((width / 2) * Math.sin(((y + 1) / (height + 1)) * Math.PI) + 2);
      for (let x = 16 - half; x < 16 + half; x++) {
        put(g, x, baseY + y, y < height / 3 ? light : x < 16 ? mid : dark);
      }
    }
  }, "l");

const lantern = (lit) =>
  decor((g) => {
    rect(g, 13, 50, 7, 6, "l");
    rect(g, 14, 40, 5, 10, "k");
    rect(g, 11, 36, 11, 4, "j");
    rect(g, 13, 26, 7, 10, lit ? "a" : "j");
    if (lit) {
      rect(g, 15, 29, 3, 5, "m");
    }
    rect(g, 10, 22, 13, 4, "k");
    rect(g, 15, 18, 3, 4, "l");
  }, "l");

const torii = () =>
  decor((g) => {
    rect(g, 4, 12, 25, 4, "n");
    rect(g, 6, 20, 21, 3, "n");
    rect(g, 7, 16, 5, 40, "o");
    rect(g, 21, 16, 5, 40, "o");
    rect(g, 8, 16, 2, 40, "n");
    rect(g, 22, 16, 2, 40, "n");
  }, "o");

const post = () =>
  decor((g) => {
    rect(g, 14, 30, 5, 26, "l");
    rect(g, 15, 30, 2, 26, "k");
    rect(g, 12, 26, 9, 4, "k");
  }, "l");

// The five stones. Rose, because rose is the progress signal.
const stoneMarker = (lit) =>
  decor((g) => {
    const body = lit ? "m" : "n";
    for (let y = 0; y < 22; y++) {
      const half = Math.round(7 * Math.sin(((y + 2) / 25) * Math.PI) + 1);
      for (let x = 16 - half; x < 16 + half; x++) {
        put(g, x, 32 + y, y < 6 ? (lit ? "a" : "m") : x < 16 ? body : "o");
      }
    }
    if (lit) {
      rect(g, 14, 36, 4, 2, "a");
    }
  }, "o");

// --- the garden's inhabitants -----------------------------------------------
//
// Kawaii is a proportion rule before it is a style: an oversized head, eyes set low and
// wide, and a body that tapers to almost nothing. Every one of these is built to that,
// and each is a shape somebody recognises before they have read a word of the page.

// The cat walks the garden on his own, so unlike everything else in this file he is a
// character sheet rather than a prop. Walk, idle, and greeting each get four frames.
// His 24px cell keeps him smaller than the pilgrim.
const CAT_CELL = 24;

const catCell = (frame, mode = 0) => {
  const g = grid(CAT_CELL, CAT_CELL);
  const step = mode === 0 ? [0, 1, 0, -1][frame] : 0;
  const tail = mode === 2 ? [0, 1, 2, 1][frame] : [0, 1, -1, 0][frame];

  // On four legs, side on. A cat drawn upright reads as a person in a cat suit; the whole
  // charm of one crossing a garden is the low horizontal body and the tail held up.
  rect(g, 4, 8 - step, 2, 5, "k");
  rect(g, 3 + tail, 5 - step, 2, 4, "k");

  // Body: a low bar, thicker at the shoulder than the hip.
  for (let y = 0; y < 6; y++) {
    const inset = y === 0 || y === 5 ? 1 : 0;
    rect(g, 5 + inset, 10 + y, 12 - inset * 2, 1, y > 3 ? "k" : "j");
  }

  // Four legs, front and back pairs swinging opposite each other.
  rect(g, 6 + step, 16, 2, 5, "k");
  rect(g, 9 - step, 16, 2, 5, "j");
  rect(g, 13 + step, 16, 2, 5, "j");
  rect(g, 16 - step, 16, 2, 5, "k");

  // Head at the leading end.
  for (let y = 0; y < 8; y++) {
    const half = y === 0 || y === 7 ? 3 : 4;
    rect(g, 17 - half, 6 + y, half * 2, 1, "j");
  }
  rect(g, 14, 3, 3, 3, "j");
  rect(g, 18, 3, 3, 3, "j");
  put(g, 15, 4, "k");
  put(g, 19, 4, "k");

  // Two marks and a nose is the whole face at this size.
  rect(g, 15, 9, 2, 2, "q");
  rect(g, 19, 9, 2, 2, "q");
  put(g, 15, 9, "a");
  put(g, 19, 9, "a");
  put(g, 21, 12, "m");

  if (mode === 1 && frame === 2) {
    rect(g, 15, 9, 2, 2, "j");
    rect(g, 19, 9, 2, 2, "j");
    rect(g, 15, 10, 2, 1, "p");
    rect(g, 19, 10, 2, 1, "p");
  }
  if (frame === 3) {
    rect(g, 18, 3, 3, 1, ".");
    put(g, 21, 4, "j");
  }
  if (mode === 2 && frame > 0) {
    // Lift the chin toward the pilgrim while the tail curls in greeting.
    const head = g.slice(2, 14).map(row => row.slice(13));
    rect(g, 13, 2, 11, 12, ".");
    blit(g, head, 13, frame === 2 ? 0 : 1);
  }
  return outline(g, "l");
};

const catSheet = () => {
  const g = grid(CAT_CELL * 4, CAT_CELL * 3);
  for (let mode = 0; mode < 3; mode++) {
    for (let frame = 0; frame < 4; frame++) {
      blit(g, catCell(frame, mode), frame * CAT_CELL, mode * CAT_CELL);
    }
  }
  return g;
};

// A frog on his haunches. Two eye-bumps above the line of the head is the entire read.
const frog = () =>
  decor((g) => {
    for (let y = 0; y < 8; y++) {
      const half = 4 + Math.round(y / 2);
      rect(g, 16 - half, 48 + y, half * 2, 1, y > 5 ? "f" : "e");
    }
    rect(g, 11, 45, 4, 4, "e");
    rect(g, 17, 45, 4, 4, "e");
    rect(g, 12, 46, 2, 2, "a");
    rect(g, 18, 46, 2, 2, "a");
    put(g, 12, 47, "q");
    put(g, 18, 47, "q");
    rect(g, 13, 53, 6, 1, "f");
  }, "f");

// Koi, lying flat rather than standing: the only sprite drawn along the ground plane,
// because a fish standing upright in a pond is a dead fish.
const koi = () =>
  decor((g) => {
    // Body, tapering to the tail so the direction he is facing is unambiguous.
    const BODY = [3, 5, 6, 6, 5, 3];
    BODY.forEach((half, index) => {
      rect(g, 13 - half, 50 + index, half * 2, 1, "a");
    });
    // Tail: a clear fork, which is the one shape that says "fish" at six pixels.
    rect(g, 19, 51, 3, 4, "a");
    rect(g, 22, 49, 2, 3, "a");
    rect(g, 22, 54, 2, 3, "a");
    // Two patches and an eye.
    rect(g, 9, 51, 3, 2, "n");
    rect(g, 14, 53, 3, 2, "n");
    put(g, 8, 52, "q");
  }, "i");

// A shishi-odoshi — the bamboo deer-scarer that tips, empties and knocks. Nothing else in
// a garden has this silhouette.
const shishiOdoshi = () =>
  decor((g) => {
    rect(g, 13, 46, 7, 4, "j");
    rect(g, 12, 50, 9, 6, "k");
    rect(g, 15, 30, 3, 17, "e");
    rect(g, 15, 36, 3, 1, "f");
    rect(g, 15, 42, 3, 1, "f");
    // the spout, tipped down towards the basin
    rect(g, 8, 34, 8, 2, "d");
    rect(g, 8, 36, 3, 2, "e");
  }, "l");

// A gorintō, the five-ringed stone pagoda: cube, sphere, pyramid, stacked.
const pagoda = () =>
  decor((g) => {
    rect(g, 8, 50, 16, 6, "k");
    rect(g, 10, 46, 12, 4, "j");
    rect(g, 7, 41, 18, 3, "j");
    rect(g, 11, 44, 10, 2, "k");
    rect(g, 11, 36, 10, 5, "j");
    rect(g, 8, 32, 16, 3, "j");
    rect(g, 12, 35, 8, 1, "k");
    rect(g, 13, 27, 6, 5, "j");
    rect(g, 14, 23, 4, 4, "k");
  }, "l");

// --- characters -------------------------------------------------------------

// A pilgrim in ink robes. Deliberately not rose: rose belongs to the stones.
//
// Chibi proportions — the head is a third of him. At 24x40 on a board this size a
// realistic 1:6 figure has a five-pixel head, which cannot hold a face, and what you get
// is a dark upright rectangle: a chess piece, not a character. The head is what makes him
// read as someone rather than something, so it gets the room.
const CX = 12;

// Authored as explicit half-widths per row, the way pixel art actually gets drawn. A
// formula gives you a cone or a box; a silhouette this small has to be shaped by hand or
// it reads as neither a hat nor a head.
const HAT_HALVES = [2, 3, 4, 5, 6, 7, 9, 9];
const HEAD_HALVES = [3, 4, 5, 5, 5, 5, 5, 4, 3];
const ROBE_HALVES = [4, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 7];

const rowRun = (g, halves, top, fill, edge) => {
  halves.forEach((half, y) => {
    rect(g, CX - half, top + y, half * 2, 1, fill);
    if (edge) {
      put(g, CX - half, top + y, edge);
      put(g, CX + half - 1, top + y, edge);
    }
  });
};

const monkCell = (facing, frame) => {
  const g = grid(MONK_CELL_W, MONK_CELL_H);
  const bob = frame === 1 ? 1 : 0;
  const stride = frame === 0 ? 0 : frame === 1 ? 2 : -2;
  const top = 4 + bob;

  // Kasa. The wide conical brim is the silhouette that says "pilgrim" from across the
  // board, and it has to droop at the edges — a straight bar reads as a plank on a post.
  rowRun(g, HAT_HALVES, top, "c", "k");
  rect(g, CX - 4, top, 8, 2, "b");
  put(g, CX - 9, top + 7, "k");
  put(g, CX + 8, top + 7, "k");

  // Head. The pale face is nearly the colour of the sand, so it carries its own warm
  // outline: without one he dissolves into the board from two tiles away.
  const headTop = top + 8;
  rowRun(g, HEAD_HALVES, headTop, "a", "k");
  rect(g, CX - 5, headTop, 10, 1, "k");

  // Eyes with a lit pixel. Two wide and three tall is the smallest eye that still holds
  // an expression; one pixel is a full stop.
  const eye = (x) => {
    rect(g, x, headTop + 3, 2, 3, "q");
    put(g, x, headTop + 3, "p");
  };
  if (facing === "S") {
    eye(CX - 4);
    eye(CX + 2);
    rect(g, CX - 1, headTop + 7, 2, 1, "k");
  } else if (facing === "E") {
    // Three-quarter, not profile. One eye on a head still drawn face-on does not read as
    // someone seen from the side — it reads as someone who has lost an eye. Both eyes
    // stay, crowded towards the way he is walking.
    eye(CX - 1);
    eye(CX + 3);
    put(g, CX + 2, headTop + 7, "k");
  } else if (facing === "W") {
    eye(CX - 5);
    eye(CX - 1);
    put(g, CX - 2, headTop + 7, "k");
  }

  // Robe, flaring to the hem and pulled back in at the very bottom so it sits rather
  // than splays.
  const bodyTop = headTop + 9;
  rowRun(g, ROBE_HALVES, bodyTop, "p", "q");
  rect(g, CX - 5, bodyTop + 4, 10, 1, "q");

  rect(g, CX - 4 + stride, bodyTop + 12, 3, 2, "q");
  rect(g, CX + 1 - stride, bodyTop + 12, 3, 2, "q");
  return g;
};

// 3 frames across, 4 facings down.
// Four frames each: breathing/blink, planted walking feet, and a full rake stroke.
const gardenerSheet = () => {
  const sheet = grid(128, 120);
  for (let mode = 0; mode < 3; mode++) {
    for (let frame = 0; frame < 4; frame++) {
      const g = grid(32, 40);
      const bob = mode === 1 ? frame % 2 : mode === 2 && frame > 1 ? 2 : 0;
      const stride = mode === 1 ? [0, 2, 0, -2][frame] : 0;
      // Boots, cuffed trousers, forest apron and rolled linen sleeves.
      rect(g, 7 + stride, 33, 5, 4, "q");
      rect(g, 16 - stride, 33, 5, 4, "q");
      rect(g, 8 + stride, 30, 3, 4, "l");
      rect(g, 16 - stride, 30, 3, 4, "p");
      rect(g, 5, 19 + bob, 18, 10, "f");
      rect(g, 8, 19 + bob, 12, 14, "e");
      rect(g, 9, 20 + bob, 2, 10, "d");
      rect(g, 8, 25 + bob, 12, 2, "p");
      rect(g, 13, 27 + bob, 5, 3, "f");
      rect(g, 4, 20 + bob, 4, 7, "a");
      rect(g, 20, 20 + bob, 4, 6, "b");
      rect(g, 5, 27 + bob, 3, 3, "c");
      // Friendly weathered face, white sideburns and a tiny beard.
      rect(g, 8, 10 + bob, 13, 10, "p");
      rect(g, 9, 11 + bob, 11, 8, "b");
      rect(g, 9, 11 + bob, 4, 5, "a");
      rect(g, 8, 13 + bob, 2, 5, "j");
      rect(g, 19, 13 + bob, 2, 5, "j");
      const blink = mode === 0 && frame === 3;
      rect(g, 12, 13 + bob, 2, blink ? 1 : 2, "q");
      rect(g, 17, 13 + bob, 2, blink ? 1 : 2, "q");
      rect(g, 13, 17 + bob, 6, 3, "j");
      put(g, 15, 17 + bob, "p");
      // Wide straw hat, dark ribbon, sunlit crown.
      rect(g, 7, 5 + bob, 15, 5, "c");
      rect(g, 9, 4 + bob, 10, 4, "b");
      rect(g, 9, 4 + bob, 7, 2, "a");
      rect(g, 7, 8 + bob, 15, 2, "f");
      rect(g, 3, 10 + bob, 23, 2, "c");
      rect(g, 4, 9 + bob, 21, 1, "a");
      // The rake moves with his hands, not as a detached floating prop.
      const rakeX = mode === 2 ? [26, 28, 25, 23][frame] : 26;
      const rakeY = mode === 2 ? [8, 9, 12, 11][frame] : 5;
      rect(g, rakeX, rakeY, 2, 24, "c");
      rect(g, rakeX, rakeY, 1, 23, "b");
      rect(g, 21, 24 + bob, Math.max(2, rakeX - 20), 2, "b");
      rect(g, rakeX - 4, rakeY + 24, 9, 2, "l");
      for (let tooth = -4; tooth <= 4; tooth += 2) rect(g, rakeX + tooth, rakeY + 25, 1, 3, "j");
      // A slight hand shift makes the idle frames feel alive without bobbing the feet.
      if (mode === 0) rect(g, 24, 21 + (frame % 2), 3, 2, "b");
      blit(sheet, g, frame * 32, mode * 40);
    }
  }
  return sheet;
};

const pilgrimSheet = () => {
  const facings = ["S", "W", "E", "N"];
  const g = grid(MONK_CELL_W * 3, MONK_CELL_H * facings.length);
  facings.forEach((facing, row) => {
    [0, 1, 2].forEach((frame) => {
      blit(g, monkCell(facing, frame), frame * MONK_CELL_W, row * MONK_CELL_H);
    });
  });
  return g;
};

// Two seated figures already on the board, kept as scenery.
const npc = (robe, accent) => {
  const g = grid(MONK_CELL_W, MONK_CELL_H);
  rect(g, 8, 14, 8, 5, "c");
  rect(g, 6, 12, 12, 2, accent);
  for (let y = 0; y < 12; y++) {
    const half = 5 + Math.round(y / 2);
    rect(g, 12 - half, 19 + y, half * 2, 1, robe);
  }
  rect(g, 5, 31, 14, 2, "l");
  return g;
};

// The kimono, narrow at the shoulder and opening to the hem. It flares less than the
// monk's robe and pulls in at the very bottom: a kimono is a straight garment tied at the
// waist, and the cone shape of the seated figures was the whole reason the woman read as a
// lamp with a hat on.
const KIMONO_HALVES = [4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 6];
const WOMAN_HEAD_HALVES = [3, 4, 5, 5, 5, 5, 4, 3];

// The frog, once she is not a frog. She stands at the water and is the only figure on the
// board that is neither the player nor scenery, so she is the one place the rose is spent
// on a person: her obi and the pin in her hair. That is exactly what the colour means
// here — this is progress you were not told to look for.
const woman = () => {
  const g = grid(MONK_CELL_W, MONK_CELL_H);
  const top = 5;

  // Shimada, in ink LIGHT rather than ink dark. The near-black version was the first half
  // of the skull: a pale plate framed in something almost the value of the outline, and at
  // this size the eye stops reading hair and face and starts reading bone and shadow.
  // Ink light against sand mid is still unmistakably black hair and drops the jump by half.
  // It has to sit ON the skull, not over it. Two pixels of overhang each side turned the
  // loop into a brim and she came out wearing a hat — the head under it then reads as a
  // face in shadow, which is halfway back to the skull again. The widest row of hair is now
  // one pixel outside the widest row of face, which is what hair does.
  rect(g, CX - 4, top - 1, 8, 1, "p");
  rect(g, CX - 5, top, 10, 4, "p");
  rect(g, CX - 3, top, 6, 1, "l");
  rect(g, CX - 5, top + 3, 10, 1, "q");
  // Corners off, so the crown is rounded rather than cut square.
  put(g, CX - 4, top - 1, ".");
  put(g, CX + 3, top - 1, ".");
  put(g, CX - 5, top, ".");
  put(g, CX + 4, top, ".");
  // The underside of the loop is where the dark belongs — one row of it, in shadow.
  rect(g, CX - 6, top + 3, 12, 1, "q");
  // The bun, off to the back of the head, and the kanzashi through it.
  rect(g, CX + 3, top + 1, 4, 3, "p");
  put(g, CX + 4, top + 2, "l");
  rect(g, CX + 5, top, 3, 1, "n");
  put(g, CX + 7, top - 1, "m");

  // Face, in two values. A single flat tone is a plate, and a plate with holes in it is a
  // skull however carefully the holes are placed — what stops it being one is that the
  // light falls across it: warmer on the upper left, a step down into the jaw. That is the
  // whole fix, and it is the fix at any sprite size.
  const headTop = top + 4;
  rowRun(g, WOMAN_HEAD_HALVES, headTop, "b", "k");
  for (let y = 4; y < WOMAN_HEAD_HALVES.length; y++) {
    const half = WOMAN_HEAD_HALVES[y];
    rect(g, CX - half + 1, headTop + y, half * 2 - 2, 1, "c");
  }

  // A fringe, one row deep, and side locks that stop at the cheekbone. They used to run
  // the full height of the face and close it in like a hood.
  rect(g, CX - 4, headTop, 8, 1, "p");
  rect(g, CX - 5, headTop + 1, 1, 2, "p");
  rect(g, CX + 4, headTop + 1, 1, 2, "p");

  // Closed, upturned eyes. Two pixels each — an outer end and an inner end a row above it
  // — so each eye is a stroke with a direction rather than a mark. Three-pixel arcs were
  // the obvious thing and they failed for a reason worth keeping: at this size the face's
  // own outline puts a dark pixel at each end of that row, so a symmetrical arc joins the
  // outline in a line of six evenly spaced dots and the whole row reads as beads, not
  // eyes. Two pixels, held one clear of the outline, is what makes them read as a pair.
  // Closed eyes, arced. Three pixels each with the middle raised, which is the ⌒ every
  // happy face in the genre is drawn with and the only shape at this size that says happy
  // on its own. Two attempts failed before this one and both failed for reasons worth
  // keeping: a flat two-pixel bar is closed but expressionless, and tilting the pair so the
  // inner end rose meant worry — inner-high is the pleading brow in every drawing
  // convention there is. The arcs also have to sit fully inside the face: the first
  // three-pixel version ran into the outline at each end, and the row came out as six
  // evenly spaced beads rather than as a pair of eyes. The face is eight pixels wide
  // between its outlines, which is exactly two arcs and the two-pixel gap between them.
  const closedEye = (x) => {
    put(g, x, headTop + 3, "p");
    put(g, x + 1, headTop + 2, "p");
    put(g, x + 2, headTop + 3, "p");
  };
  closedEye(CX - 4);
  closedEye(CX + 1);

  // Blush, low and a full pixel clear of the outline. This is the one place the rose
  // belongs on her — but only here: the first attempt put it on the outer edge of a white
  // face beside black sockets, where it was rouge on a corpse, and even at the edge of a
  // shaded face it read as two pink blocks stuck to her silhouette.
  put(g, CX - 3, headTop + 5, "m");
  put(g, CX + 2, headTop + 5, "m");

  // The mouth stays small now that the eyes carry the expression. The four-pixel curve it
  // replaced was competing with them and read as an open O.
  put(g, CX - 1, headTop + 6, "l");
  put(g, CX, headTop + 6, "l");

  // A neck. The head sat straight on the collar, which is another thing skulls do.
  rect(g, CX - 2, headTop + WOMAN_HEAD_HALVES.length, 4, 1, "c");

  // Kimono in moss. Stone put her in the same values as the sand she stands on, so the
  // figure dissolved and only the face was left floating — which is the other half of why
  // she read as a ghost. Moss is the one family on the board neither the pilgrim (ink) nor
  // the ground beneath her (sand) is using.
  const bodyTop = headTop + 8;
  rowRun(g, KIMONO_HALVES, bodyTop, "e", "f");

  // The collar, crossed left over right, and the pale line of the under-robe.
  put(g, CX - 2, bodyTop, "a");
  put(g, CX - 1, bodyTop + 1, "a");
  put(g, CX, bodyTop + 2, "a");
  put(g, CX + 1, bodyTop + 1, "a");
  put(g, CX + 2, bodyTop, "a");
  rect(g, CX - 1, bodyTop + 3, 2, 4, "d");

  // Furisode: the long hanging sleeves that say this is a young woman and not a matron.
  // Two pixels wide and held clear of the body by its own outline — drawn any thicker
  // they merged into the torso and she came out a slab with a head on it.
  rect(g, CX - 6, bodyTop + 2, 2, 6, "e");
  rect(g, CX + 4, bodyTop + 2, 2, 6, "e");
  put(g, CX - 6, bodyTop + 7, "f");
  put(g, CX + 5, bodyTop + 7, "f");

  // Obi. The one wide band across the middle, and the only rose on her.
  rect(g, CX - 5, bodyTop + 5, 10, 2, "n");
  rect(g, CX - 5, bodyTop + 5, 10, 1, "m");

  // Hem, and the two white tabi below it.
  rect(g, CX - 6, bodyTop + 13, 12, 1, "f");
  rect(g, CX - 3, bodyTop + 14, 2, 1, "a");
  rect(g, CX + 1, bodyTop + 14, 2, 1, "a");
  return g;
};

// Row 0: rest, nod, raised sleeve, wave. Row 1: alternating walking strides.
const womanSheet = () => {
  const sheet = grid(MONK_CELL_W * 4, MONK_CELL_H * 2);
  for (let mode = 0; mode < 2; mode++) {
    for (let frame = 0; frame < 4; frame++) {
      const base = woman();
      const g = grid(MONK_CELL_W, MONK_CELL_H);
      const lift = mode === 1 && frame % 2 === 1 ? -1 : 0;
      blit(g, base, 0, lift);
      if (mode === 0 && frame === 1) {
        rect(g, 0, 0, MONK_CELL_W, 17, ".");
        blit(g, base.slice(0, 17), 0, 1);
      }
      if (mode === 0 && frame >= 2) {
        rect(g, CX + 4, 19, 2, 6, ".");
        const wave = frame === 3 ? 1 : 0;
        rect(g, CX + 4 + wave, 15, 2, 6, "e");
        rect(g, CX + 4 + wave, 13, 2, 2, "b");
        put(g, CX + 5 + wave, 20, "f");
      }
      if (mode === 1 && frame > 0) {
        rect(g, CX - 5, 30 + lift, 10, 3, ".");
        rect(g, CX - 6, 30 + lift, 12, 1, "f");
        const stride = [0, 1, 0, -1][frame];
        rect(g, CX - 3 + stride, 31, 2, 1, "a");
        rect(g, CX + 1 - stride, 31, 2, 1, "a");
        rect(g, CX - 6, 22 + (frame === 3 ? -1 : 1), 2, 2, "d");
      }
      blit(sheet, g, frame * MONK_CELL_W, mode * MONK_CELL_H);
    }
  }
  return sheet;
};

// --- effects ----------------------------------------------------------------

const dustPuff = () =>
  stack(
    [0, 1, 2].map((frame) => {
      const g = grid(32, 16);
      const spread = 3 + frame * 4;
      const shade = frame === 0 ? "b" : frame === 1 ? "c" : "c";
      for (let x = 16 - spread; x < 16 + spread; x++) {
        const lift = Math.round(2 * Math.sin(((x - 16 + spread) / (spread * 2)) * Math.PI));
        put(g, x, 11 - lift - frame, shade);
        if (frame < 2) {
          put(g, x, 12 - lift - frame, shade);
        }
      }
      return g;
    }),
  );

const ripple = () =>
  stack(
    [0, 1, 2].map((frame) => {
      const g = grid(64, 32);
      const radius = 6 + frame * 8;
      for (let angle = 0; angle < 360; angle += 3) {
        const rad = (angle * Math.PI) / 180;
        const x = Math.round(32 + Math.cos(rad) * radius);
        const y = Math.round(16 + (Math.sin(rad) * radius) / 2);
        put(g, x, y, frame === 0 ? "a" : frame === 1 ? "b" : "c");
      }
      return g;
    }),
  );

// --- inventory --------------------------------------------------------------

export const SPRITES = {
  "bamboo-a": sprite(bamboo([-6, 0, 6], 46)),
  "bamboo-b": sprite(bamboo([-4, 3], 38)),
  "bridge-plank": sprite(bridgePlank()),
  "dust-puff": sprite(dustPuff()),
  "gravel-edge": sprite(groundTile("b", "c", "l", "j", 0.18, 31)),
  "lantern-lit": sprite(lantern(true)),
  "lantern-unlit": sprite(lantern(false)),
  "moss-deep": sprite(groundTile("e", "f", "f", "f", 0.3, 17)),
  "moss-mid": sprite(groundTile("d", "e", "f")),
  "npc-2": sprite(woman()),
  "npc-2-life": sprite(womanSheet()),
  "npc-3": sprite(npc("k", "l")),
  gardener: sprite(gardenerSheet()),
  "rock-mound": sprite(rock(22, 18, "j", "k", "l")),
  "rock-small": sprite(rock(13, 10, "j", "k", "l")),
  "sand-0": sprite(rakedSand()),
  "sand-1": sprite(groundTile("a", "b", "c", "c", 0.06, 11)),
  "sand-moss": sprite(groundTile("a", "b", "c", "d", 0.22, 13)),
  "shrine-active": sprite(shrineTile(true)),
  "shrine-locked": sprite(shrineTile(false)),
  "stone-marker": sprite(stoneMarker(false)),
  "stone-marker-lit": sprite(stoneMarker(true)),
  "stone-slab": sprite(groundTile("j", "k", "l")),
  "water-still": sprite(waterFrames()),
  maple: sprite(maple()),
  pilgrim: sprite(pilgrimSheet()),
  pine: sprite(pine()),
  post: sprite(post()),
  "cat-walk": sprite(catSheet()),
  frog: sprite(frog()),
  koi: sprite(koi()),
  pagoda: sprite(pagoda()),
  reed: sprite(reed()),
  "shishi-odoshi": sprite(shishiOdoshi()),
  sakura: sprite(sakura()),
  ripple: sprite(ripple()),
  torii: sprite(torii()),
};
