// Pixel maps in source -> PNGs in public/. Art is reviewable in git diffs and the whole
// set can be re-emitted after a palette change.
//
// Nothing here resamples: sprites are authored at 1x and displayed at integer scale only.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PALETTE } from "./zazen-art/palette.mjs";
import { SPRITES, GROUND_VARIANTS } from "./zazen-art/sprites.mjs";

const HEX_RED = [1, 3];
const HEX_GREEN = [3, 5];
const HEX_BLUE = [5, 7];
const RGBA_CHANNELS = 4;
const OPAQUE = 255;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "public/images/zazen");

const FOLDERS = {
  decors: [
    "pine",
    "maple",
    "frog",
    "koi",
    "pagoda",
    "shishi-odoshi",
    "sakura",
    "bamboo-a",
    "bamboo-b",
    "reed",
    "rock-small",
    "rock-mound",
    "lantern-lit",
    "lantern-unlit",
    "torii",
    "post",
    "stone-marker",
    "stone-marker-lit",
  ],
  fx: ["dust-puff", "ripple"],
  persos: ["pilgrim", "cat-walk", "npc-2", "npc-2-life", "npc-3", "gardener"],
  sol: [
    ...GROUND_VARIANTS.flatMap((name) => [1, 2, 3].map((variant) => `${name}-v${variant}`)),
    "sand-0",
    "sand-1",
    "sand-moss",
    "moss-mid",
    "moss-deep",
    "water-still",
    "stone-slab",
    "gravel-edge",
    "bridge-plank",
    "shrine-locked",
    "shrine-active",
  ],
};

const hexToRgba = (hex) =>
  hex === null
    ? [0, 0, 0, 0]
    : [
        Number.parseInt(hex.slice(...HEX_RED), 16),
        Number.parseInt(hex.slice(...HEX_GREEN), 16),
        Number.parseInt(hex.slice(...HEX_BLUE), 16),
        OPAQUE,
      ];

const toBuffer = ({ width, height, rows }) => {
  const data = Buffer.alloc(width * height * RGBA_CHANNELS);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const char = rows[y][x];
      if (!Object.hasOwn(PALETTE, char)) {
        throw new Error(`Undefined palette char "${char}" at ${x},${y}`);
      }
      const [r, g, b, a] = hexToRgba(PALETTE[char]);
      const offset = (y * width + x) * RGBA_CHANNELS;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = a;
    }
  }
  return data;
};

let written = 0;
for (const [folder, names] of Object.entries(FOLDERS)) {
  mkdirSync(join(outRoot, folder), { recursive: true });
  for (const name of names) {
    const entry = SPRITES[name];
    if (!entry) {
      throw new Error(`Missing sprite definition: ${name}`);
    }
    const png = await sharp(toBuffer(entry), {
      raw: { channels: RGBA_CHANNELS, height: entry.height, width: entry.width },
    })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    writeFileSync(join(outRoot, folder, `${name}.png`), png);
    written += 1;
  }
}

console.log(`generate-zazen-art: wrote ${written} sprites to ${outRoot}`);
