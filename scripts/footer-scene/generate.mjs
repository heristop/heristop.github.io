#!/usr/bin/env node

/**
 * Footer painting strokes
 * Paints the brushwork of src/components/FooterScene.astro: texture strokes that follow
 * each silhouette, water touches, rocks, reeds, pine needles and bark, grass.
 *
 * Usage: node scripts/footer-scene/generate.mjs
 *        pnpm generate:footer
 *
 * Writes src/components/footer-scene-strokes.json, which the component reads at build
 * time. Coordinates are in the painting's 1200x420 viewBox. Output is deterministic:
 * each layer has its own seed, so retuning one layer never changes another's grain.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { along, brush, createRng, lens, point, quad, round, sample } from "./brush.mjs";

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), "../../src/components/footer-scene-strokes.json");

// Mountains and cliff: cun (texture strokes) laid along each silhouette.
const paintRanges = () => {
  const rand = createRng(7);
  const stroke = (line, width, options) => brush(rand, line, width, options);

  // A stroke that leaves the crest along the slope and droops toward the fall line.
  const fall = (silhouette, x, inset, len, side, droop = 0.9) => {
    const [s] = along(silhouette, x, x + side * 0.5, inset);
    const t = along(silhouette, x, x + side * 6, inset).at(-1);
    let tx = t[0] - s[0];
    let ty = t[1] - s[1];
    const n = Math.hypot(tx, ty);
    tx /= n;
    ty /= n;
    const c = [s[0] + tx * len * 0.5, s[1] + ty * len * 0.5];
    const ex = tx * (1 - droop * 0.35);
    const ey = ty + droop * 0.6;
    const m = Math.hypot(ex, ey);
    return quad(s, c, [s[0] + (ex / m) * len, s[1] + (ey / m) * len]);
  };
  const dot = (silhouette, x, inset, rx, ry, rotate) => {
    const [cx, cy] = along(silhouette, x, x + 1, inset)[0];
    return { cx: round(cx), cy: round(cy), rx, ry, rotate };
  };

  // The main mountain is lit from the sun on its right, so the left flank carries the texture.
  const mountain = sample(
    "M-20 336 Q50 300 110 270 Q160 246 196 212 Q222 188 244 190 Q268 194 292 224 Q312 246 338 250 Q362 252 384 268 Q450 300 560 330",
  );
  const mountainCrest = [
    stroke(along(mountain, 241, 120, 1.2), 3.2, { press: 0.08 }),
    stroke(along(mountain, 250, 300, 1.2), 2.4, { press: 0.1 }),
    stroke(along(mountain, 326, 420, 1.4), 1.8, { press: 0.15 }),
  ];
  const mountainCun = [
    stroke(fall(mountain, 236, 4, 58, -1, 0.7), 2.2),
    stroke(fall(mountain, 222, 5, 50, -1, 0.75), 2),
    stroke(fall(mountain, 205, 6, 46, -1, 0.8), 1.8),
    stroke(fall(mountain, 186, 6, 36, -1, 0.85), 1.6),
    stroke(fall(mountain, 164, 7, 28, -1, 0.9), 1.4),
    stroke(fall(mountain, 258, 4, 30, 1, 0.55), 1.4),
    stroke(fall(mountain, 300, 6, 24, -1, 1.1), 1.4),
  ];
  // Moss dots sit on the crest.
  const mountainDots = [
    dot(mountain, 228, -0.5, 1.6, 1, -20),
    dot(mountain, 212, -0.4, 1.3, 0.9, -28),
    dot(mountain, 180, -0.2, 1.5, 1, -32),
    dot(mountain, 172, 0.6, 1, 0.7, -32),
    dot(mountain, 276, -0.3, 1.2, 0.8, 34),
  ];

  const hill = sample("M420 336 Q470 312 520 300 Q560 290 590 296 Q640 306 700 330");
  const hillCrest = [stroke(along(hill, 470, 640, 1), 1.6, { press: 0.3 })];

  // Cliff: a tapered headland edge, then axe-cut facets (fu pi cun) in small parallel clusters.
  const cliff = sample(
    "M774 360 Q782 332 806 306 Q830 280 862 264 Q900 246 944 240 L1040 234 Q1092 228 1130 214 Q1170 202 1220 204",
  );
  const cliffEdges = [
    stroke(along(cliff, 946, 784, 3), 3.4, { press: 0.1 }),
    stroke(along(cliff, 1050, 1150, 4), 2.2, { press: 0.3 }),
  ];
  const axe = (x, inset, len, width, lean = 0.95) => {
    const [s] = along(cliff, x, x + 1, inset);
    const line = quad(s, [s[0] - len * lean * 0.3, s[1] + len * 0.5], [s[0] - len * lean, s[1] + len]);
    return stroke(line, width, { press: 0.12, grain: 0.35 });
  };
  const cliffFacets = [
    axe(842, 10, 34, 7), axe(856, 14, 28, 5), axe(870, 18, 20, 4),
    axe(924, 12, 40, 8), axe(940, 18, 30, 6), axe(956, 24, 20, 4),
    axe(1092, 12, 30, 6, 0.8), axe(1106, 16, 22, 4.5, 0.8),
  ];

  return {
    mountain: { crest: mountainCrest, cun: mountainCun, dots: mountainDots },
    hill: { crest: hillCrest },
    cliff: { edges: cliffEdges, facets: cliffFacets },
  };
};

// Water, rocks and reeds. Open water stays mostly empty.
const paintWater = () => {
  const rand = createRng(19);
  const stroke = (line, width, options) => brush(rand, line, width, { grain: 0.15, ...options });
  const curve = (s, c, e) => quad(s, c, e, 20);
  const root = { press: 0.05, tail: 0.05 };

  const horizon = [lens(0, 341, 250, 0.9, 0), lens(290, 341.5, 360, 0.7, 0), lens(690, 341, 90, 0.5, 0)].join(" ");
  const touches = [
    lens(30, 357, 74, 1.6), lens(150, 362, 34, 1.1),
    lens(270, 352, 96, 1.3), lens(236, 372, 46, 1.1),
    lens(520, 365, 70, 1.4), lens(612, 384, 38, 1),
    lens(380, 392, 112, 1.7), lens(110, 398, 56, 1.2),
    lens(660, 404, 48, 1.1),
  ];
  // Two broken touches per 300-unit wavelength, so sliding a swell by one wavelength loops seamlessly.
  const swell = (y, a, b) => {
    const d = [];
    for (let x = -300; x < 1500; x += 300) {
      d.push(lens(x + a[0], y, a[1], a[2], -1.4), lens(x + b[0], y + 1, b[1], b[2], -1));
    }
    return d.join(" ");
  };
  const swells = [
    swell(364, [24, 120, 1.1], [190, 54, 0.8]),
    swell(384, [70, 150, 1.4], [250, 40, 0.9]),
    swell(406, [10, 90, 1.7], [140, 120, 1.3]),
  ];

  // Rocks: a dark crest where the brush lands, folds, ink pooled at the waterline.
  const rockInk = [
    stroke(curve([40, 340], [58, 320], [92, 320]), 3.2, { press: 0.1 }),
    stroke(curve([96, 320.5], [118, 324], [130, 340]), 2.2, { press: 0.2 }),
    stroke(curve([88, 323], [80, 334], [66, 347]), 2.6, { press: 0.15, grain: 0.3 }),
    stroke(curve([104, 326], [100, 336], [92, 346]), 2, { press: 0.15, grain: 0.3 }),
    stroke(curve([122, 345], [128, 338], [142, 338]), 1.8, { press: 0.2 }),
    stroke(curve([26, 351], [90, 353.5], [174, 352]), 2.4, { press: 0.3, tail: 0.2 }),
  ].join(" ");
  const rockReflection = [lens(36, 357, 92, 2.2, 0.8), lens(118, 357, 50, 1.4, 0.6)].join(" ");

  // Reeds: pressed at the root, lifted to a fine tip.
  const reeds = [
    stroke(curve([142, 345], [133, 328], [137, 309]), 2.4, root),
    stroke(curve([150, 341], [147, 316], [157, 295]), 2.6, root),
    stroke(curve([160, 343], [165, 322], [177, 309]), 2.2, root),
    stroke(curve([146, 343], [140, 334], [128, 330]), 1.6, root),
  ];

  // Drawn for the mirrored sampan, so the wake trails off to negative x.
  const wake = [
    stroke(curve([-36, 353], [-54, 353.6], [-82, 358]), 1.8, root),
    stroke(curve([-30, 356], [-44, 359.5], [-62, 365]), 1.3, root),
  ].join(" ");
  const glints = [[474, 352, 24, 1.1], [466, 360, 38, 1.3], [478, 369, 18, 0.9], [470, 379, 30, 1.1], [481, 390, 12, 0.8]]
    .map(([x, y, len, w]) => lens(x, y, len, w, 0));

  return {
    water: { horizon, touches, swells, wake, glints },
    rocks: { ink: rockInk, reflection: rockReflection, reeds },
  };
};

// Pine: needle pads painted as fans of fine strokes over a domed mass; fish-scale bark.
const paintPine = () => {
  const rand = createRng(31);

  // One needle: a sliver from the fan's heart to a fine tip.
  const needle = (c, angle, len, w) => {
    const tip = [c[0] + Math.cos(angle) * len, c[1] + Math.sin(angle) * len];
    const px = -Math.sin(angle) * w;
    const py = Math.cos(angle) * w;
    return `M${point([c[0] + px, c[1] + py])} L${point(tip)} L${point([c[0] - px, c[1] - py])} Z`;
  };
  const fan = (c, radius, count) => {
    const d = [];
    for (let k = 0; k < count; k++) {
      const angle = -Math.PI * (0.9 - (0.8 * k) / (count - 1)) + (rand() - 0.5) * 0.12;
      d.push(needle(c, angle, radius * (0.75 + rand() * 0.35), 0.55));
    }
    return d.join(" ");
  };

  // A pad: flat underside, domed top, crowned by two rows of overlapping needle fans.
  // Body and needles stay separate paths: overlapping outlines of opposite winding in a
  // single path would cancel and leave holes.
  const pad = (x0, x1, yb) => {
    const width = x1 - x0;
    const h = width * 0.11;
    const mid = (x0 + x1) / 2;
    const top = (x) => yb - h * (1 - ((x - mid) / (width / 2)) ** 2) - 1.5;
    const body = `M${round(x0)} ${round(yb)} Q${round(mid)} ${round(yb - h * 2 - 3)} ${round(x1)} ${round(yb)} Q${round(mid)} ${round(yb + 4.5)} ${round(x0)} ${round(yb)} Z`;
    const fans = [];
    const n = Math.max(3, Math.round(width / 9));
    for (let i = 0; i < n; i++) {
      const x = x0 + 3 + ((width - 6) * i) / (n - 1) + (rand() - 0.5) * 3;
      fans.push(fan([x, top(x) + 1.5], 5 + rand() * 2.5 + (1 - Math.abs(x - mid) / (width / 2)) * 2, 9));
    }
    for (let i = 0; i < n - 1; i++) {
      const x = x0 + 7 + ((width - 14) * i) / Math.max(1, n - 2) + (rand() - 0.5) * 3;
      fans.push(fan([x, top(x) + 4], 4 + rand() * 2, 7));
    }
    return { body, needles: fans.join(" ") };
  };

  // Keyed by the pad's --w gust offset. Painted in this order: the order sets each pad's grain.
  const pads = {};
  for (const [gust, x0, x1, yb] of [[1, 747, 833, 176], [0, 737, 795, 200], [4, 834, 898, 168], [2, 793, 843, 154], [3, 836, 874, 198]]) {
    pads[gust] = pad(x0, x1, yb);
  }

  // Bark: small paper-coloured scales along the trunk, angled across the grain.
  const cubic = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return [0, 1].map((i) => u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i]);
  };
  const limbs = [
    [[876, 256], [866, 234], [852, 216], [826, 202], 13],
    [[812, 196], [800, 190], [790, 182], [781, 172], 5],
  ];
  const scales = [];
  for (const [p0, p1, p2, p3, count] of limbs) {
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count + (rand() - 0.5) * 0.03;
      const a = cubic(p0, p1, p2, p3, t);
      const b = cubic(p0, p1, p2, p3, Math.min(1, t + 0.02));
      const grain = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const side = k % 2 ? 1 : -1;
      const c = [a[0] - Math.sin(grain) * side * 0.9, a[1] + Math.cos(grain) * side * 0.9];
      const angle = grain + Math.PI / 2 + side * 0.35;
      const len = 2.6 + rand() * 1.2;
      const w = 0.55;
      const e = [c[0] + Math.cos(angle) * len, c[1] + Math.sin(angle) * len];
      const m = [(c[0] + e[0]) / 2 + Math.cos(grain) * w * 1.6, (c[1] + e[1]) / 2 + Math.sin(grain) * w * 1.6];
      scales.push(`M${point(c)} Q${point(m)} ${point(e)} Q${point([(c[0] + e[0]) / 2, (c[1] + e[1]) / 2])} ${point(c)} Z`);
    }
  }

  return { pine: { pads, bark: scales.join(" ") } };
};

// Grass on the cliff: each tuft is a few blades tapering from root to tip.
const paintGrass = () => {
  const blade = (x, y, a, b, c, d) => {
    const left = [];
    const right = [];
    const n = 10;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      const px = u * u * x + 2 * u * t * (x + a) + t * t * (x + c);
      const py = u * u * y + 2 * u * t * (y + b) + t * t * (y + d);
      const tx = 2 * u * a + 2 * t * (c - a);
      const ty = 2 * u * b + 2 * t * (d - b);
      const m = Math.hypot(tx, ty) || 1;
      const w = 0.75 * (1 - t) + 0.08;
      left.push(`${round(px - (ty / m) * w)} ${round(py + (tx / m) * w)}`);
      right.unshift(`${round(px + (ty / m) * w)} ${round(py - (tx / m) * w)}`);
    }
    return "M" + [...left, ...right].join(" L") + " Z";
  };
  // Each blade: root x, y, then a relative quadratic (control, tip).
  const tufts = [
    [[903, 247, -2, -6, -6, -9], [905, 247, 0, -8, 1, -12], [907, 247, 3, -5, 7, -7]],
    [[1058, 233, -3, -5, -7, -7], [1060, 233, 1, -8, 0, -11], [1062, 233, 3, -6, 6, -8]],
    [[1146, 213, -2, -6, -5, -9], [1148, 213, 1, -7, 3, -10]],
  ];
  return { grass: tufts.map((tuft) => tuft.map((args) => blade(...args)).join(" ")) };
};

export const paintStrokes = () => ({ ...paintRanges(), ...paintWater(), ...paintPine(), ...paintGrass() });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUTPUT, `${JSON.stringify(paintStrokes(), null, 2)}\n`);
  console.log(`footer-scene: wrote ${OUTPUT}`);
}
