// Import the approved generated artwork into the game's existing frame contracts.
// Keep the source atlases: regenerate PNGs without another image-model call.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "../../output/imagegen/zazen/");
const RESOLUTION = 4;
const blank = (width, height) => sharp({
  create: { width: width * RESOLUTION, height: height * RESOLUTION, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
});

// The generated sources have a slightly textured teal backdrop. This narrow chroma
// range excludes the warm outlines, jade foliage and lighter turquoise fish tails.
const isBackdrop = (r, g, b) =>
  r < 72 && g < 98 && b < 106 && g - r >= 15 && b - r >= 18 && Math.abs(g - b) < 15;

async function atlas(name) {
  const { data, info } = await sharp(join(sourceRoot, name)).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (isBackdrop(data[i], data[i + 1], data[i + 2])) data.fill(0, i, i + 4);
  }
  return { data, width: info.width, height: info.height };
}

function bounds(source, left, top, right, bottom) {
  let x0 = right, y0 = bottom, x1 = left - 1, y1 = top - 1;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    if (source.data[(y * source.width + x) * 4 + 3]) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  if (x1 < x0) throw new Error(`Empty source frame at ${left},${top}`);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// Model output has approximate grids. Find the empty gutter near each nominal
// column boundary so a wide torii or branch is not clipped by an equal-width crop.
function columns(source, count, top, bottom) {
  const cuts = [0];
  for (let column = 1; column < count; column++) {
    const nominal = Math.round(source.width * column / count);
    let best = nominal, score = Infinity;
    const radius = Math.floor(source.width / count / 8);
    for (let x = nominal - radius; x <= nominal + radius; x++) {
      let occupied = 0;
      for (let y = top; y < bottom; y++) occupied += source.data[(y * source.width + x) * 4 + 3] ? 1 : 0;
      const next = occupied * source.width + Math.abs(x - nominal);
      if (next < score) { score = next; best = x; }
    }
    cuts.push(best);
  }
  return [...cuts, source.width];
}

async function row(source, rowIndex, rowCount, columnCount) {
  const boundary = (index) => {
    if (index === 0) return 0;
    if (index === rowCount) return source.height;
    const nominal = Math.round(source.height * index / rowCount);
    const radius = Math.floor(source.height / rowCount / 8);
    let best = nominal, score = Infinity;
    for (let y = nominal - radius; y <= nominal + radius; y++) {
      let occupied = 0;
      for (let x = 0; x < source.width; x++) occupied += source.data[(y * source.width + x) * 4 + 3] ? 1 : 0;
      const next = occupied * source.height + Math.abs(y - nominal);
      if (next < score) { score = next; best = y; }
    }
    return best;
  };
  const top = boundary(rowIndex);
  const bottom = boundary(rowIndex + 1);
  const cuts = columns(source, columnCount, top, bottom);
  return Promise.all(Array.from({ length: columnCount }, async (_, column) => {
    const box = bounds(source, cuts[column], top, cuts[column + 1], bottom);
    const image = await sharp(source.data, { raw: { width: source.width, height: source.height, channels: 4 } })
      .extract(box).png().toBuffer();
    return { image, ...box };
  }));
}

async function fit(frame, width, height, maxWidth, maxHeight, baseline, scale) {
  const ratio = scale ?? Math.min(maxWidth / frame.width, maxHeight / frame.height);
  const w = Math.max(1, Math.min(maxWidth, Math.round(frame.width * ratio)));
  const h = Math.max(1, Math.min(maxHeight, Math.round(frame.height * ratio)));
  const { data } = await sharp(frame.image).resize(w * RESOLUTION, h * RESOLUTION).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  // Restore hard pixel edges after reduction; never bake the teal matte into PNGs.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) data.fill(0, i, i + 4);
    else data[i + 3] = 255;
  }
  return blank(width, height).composite([{
    input: data, raw: { width: w * RESOLUTION, height: h * RESOLUTION, channels: 4 },
    left: Math.floor((width - w) * RESOLUTION / 2), top: (baseline + 1 - h) * RESOLUTION,
  }]).png().toBuffer();
}

async function fitRow(frames, width, height, maxWidth, maxHeight, baseline) {
  // One scale for the whole cycle prevents breathing from changing head size.
  const scale = Math.min(...frames.flatMap(frame => [maxWidth / frame.width, maxHeight / frame.height]));
  return Promise.all(frames.map(frame => fit(frame, width, height, maxWidth, maxHeight, baseline, scale)));
}

async function sheet(rows, width, height) {
  return blank(rows[0].length * width, rows.length * height).composite(rows.flatMap((frames, y) =>
    frames.map((input, x) => ({ input, left: x * width * RESOLUTION, top: y * height * RESOLUTION })))).png().toBuffer();
}

async function birdFlight() {
  const source = await atlas("bird-flight-v2.png");
  const frames = (await Promise.all([row(source, 0, 2, 4), row(source, 1, 2, 4)])).flat();
  // Eye centers measured in the source atlas. Wings must move around the body,
  // rather than dragging it up and down as each silhouette changes height.
  const eyes = [[324, 278], [759.5, 278.5], [1191, 278.5], [1635.5, 278],
    [322.5, 639], [763.5, 640], [1198, 640], [1637.5, 641]];
  const offsets = frames.map((frame, index) => ({
    x: eyes[index][0] - frame.left, y: eyes[index][1] - frame.top,
  }));
  const scale = Math.min(...frames.flatMap((frame, index) => {
    const { x, y } = offsets[index];
    return [15 / x, 7 / (frame.width - x), 7 / y, 7 / (frame.height - y)];
  }));
  const poses = await Promise.all(frames.map(async (frame, index) => {
    const width = Math.round(frame.width * scale * RESOLUTION);
    const height = Math.round(frame.height * scale * RESOLUTION);
    const { data } = await sharp(frame.image).resize(width, height).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) data.fill(0, i, i + 4);
      else data[i + 3] = 255;
    }
    return blank(24, 16).composite([{
      input: data, raw: { width, height, channels: 4 },
      left: Math.round((16 - offsets[index].x * scale) * RESOLUTION),
      top: Math.round((8 - offsets[index].y * scale) * RESOLUTION),
    }]).png().toBuffer();
  }));
  return sheet([poses], 24, 16);
}

// Derive quiet breathing from the new neutral pose while retaining its planted feet.
async function breathe(frame, width, height, footRow, offset) {
  if (!offset) return frame;
  const upper = await sharp(frame).extract({ left: 0, top: 0, width: width * RESOLUTION, height: footRow * RESOLUTION })
    .resize(width * RESOLUTION, (footRow - offset) * RESOLUTION, { kernel: "nearest" }).png().toBuffer();
  const feet = await sharp(frame).extract({ left: 0, top: footRow * RESOLUTION, width: width * RESOLUTION, height: (height - footRow) * RESOLUTION })
    .png().toBuffer();
  return blank(width, height).composite([
    { input: upper, left: 0, top: offset * RESOLUTION }, { input: feet, left: 0, top: footRow * RESOLUTION },
  ]).png().toBuffer();
}

// Reuse the illustrated legs for alternate steps; the upper body stays registered.
async function stride(frame, width, height, footRow, phase) {
  width *= RESOLUTION;
  height *= RESOLUTION;
  footRow *= RESOLUTION;
  phase *= RESOLUTION;
  const { data } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const moved = Buffer.from(data);
  for (let y = footRow; y < height; y++) moved.fill(0, y * width * 4, (y + 1) * width * 4);
  for (let y = footRow; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = x < width / 2 ? phase : -phase;
    const tx = x + offset;
    if (tx >= 0 && tx < width && data[(y * width + x) * 4 + 3]) {
      data.copy(moved, (y * width + tx) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
  }
  return sharp(moved, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function generateRedesignedArt(outRoot) {
  const [decorAtlas, pilgrimAtlas, castAtlas] = await Promise.all([
    atlas("decors-v2.png"), atlas("pilgrim-walk-v2.png"), atlas("characters-v2.png"),
  ]);
  const outputs = new Map();
  outputs.set("fx/bird-flight", await birdFlight());
  const decorNames = [
    "pine", "maple", "sakura", "bamboo-a", "bamboo-b", "reed", "rock-small", "rock-mound",
    "lantern-unlit", "lantern-lit", "torii", "pagoda", "stone-marker", "stone-marker-lit", "post", "shishi-odoshi",
  ];
  // Width, height and last occupied row of each original prop, matching its shadow.
  const decorBoxes = [
    [28, 48, 58], [32, 52, 58], [32, 52, 58], [27, 47, 63],
    [22, 39, 63], [16, 31, 60], [16, 12, 60], [24, 20, 60],
    [20, 41, 57], [20, 41, 57], [31, 51, 57], [20, 35, 56],
    [16, 25, 55], [16, 25, 55], [11, 32, 56], [20, 28, 56],
  ];
  for (let y = 0; y < 4; y++) {
    const frames = await row(decorAtlas, y, 4, 4);
    for (let x = 0; x < 4; x++) {
      const index = y * 4 + x;
      outputs.set(`decors/${decorNames[index]}`, await fit(frames[x], 32, 64, ...decorBoxes[index]));
    }
  }

  const walking = [], resting = [];
  for (let y = 0; y < 4; y++) {
    const frames = await fitRow(await row(pilgrimAtlas, y, 4, 3), 24, 40, 22, 33, 35);
    walking.push(frames);
    resting.push(await Promise.all([0, 1, 0, 2].map(offset => breathe(frames[0], 24, 40, 32, offset))));
  }
  outputs.set("persos/pilgrim", await sheet(walking, 24, 40));
  outputs.set("persos/pilgrim-idle", await sheet(resting, 24, 40));

  const cast = await Promise.all(Array.from({ length: 8 }, (_, y) => row(castAtlas, y, 8, 4)));
  // Share the gardener's scale across idle and raking poses.
  const gardenerFrames = await fitRow(cast[0].concat(cast[1]), 32, 40, 31, 33, 36);
  const idle = gardenerFrames.slice(0, 4), rake = gardenerFrames.slice(4);
  const gardenerWalk = await Promise.all(idle.map((frame, i) => stride(frame, 32, 40, 31, [0, 1, 0, -1][i])));
  outputs.set("persos/gardener", await sheet([idle, gardenerWalk, rake], 32, 40));
  const strike = await Promise.all([0, 1, 2, 3, 2, 0].map(async (index, phase) => {
    const input = phase === 0 || phase === 5 ? idle[0] : rake[index];
    return blank(64, 40).composite([{ input, left: [0, 0, 3, 5, 3, 0][phase] * RESOLUTION, top: 0 }]).png().toBuffer();
  }));
  outputs.set("persos/gardener-strike", await sheet([strike], 64, 40));

  const cat = await fitRow(cast[2], 24, 24, 22, 19, 21);
  const catRest = await Promise.all([0, 1, 0, 1].map(offset => breathe(cat[0], 24, 24, 19, offset)));
  const catGreeting = await Promise.all(cat.map((frame, i) => breathe(frame, 24, 24, 19, [0, 1, 2, 1][i])));
  outputs.set("persos/cat-walk", await sheet([cat, catRest, catGreeting], 24, 24));
  outputs.set("decors/cat", await fit(cast[2][0], 32, 64, 22, 19, 56));

  const woman = await fitRow(cast[3], 24, 40, 17, 28, 31);
  const womanWalk = await Promise.all(woman.map((frame, i) => stride(frame, 24, 40, 29, [0, 1, 0, -1][i])));
  outputs.set("persos/npc-2", woman[0]);
  outputs.set("persos/npc-2-life", await sheet([woman, womanWalk], 24, 40));
  const monk = await fitRow(cast[4], 24, 40, 20, 27, 34);
  outputs.set("persos/npc-3", monk[0]);
  outputs.set("persos/npc-3-life", await sheet([monk], 24, 40));
  const mermaid = await fitRow(cast[5], 24, 40, 22, 31, 34);
  outputs.set("persos/mermaid-life", await sheet([mermaid], 24, 40));
  for (const [name, y, w, h, baseline] of [["frog", 6, 18, 15, 56], ["koi", 7, 20, 11, 57]]) {
    const frames = await fitRow(cast[y], 32, 64, w, h, baseline);
    outputs.set(`decors/${name}`, frames[0]);
    outputs.set(`decors/${name}-life`, await sheet([frames], 32, 64));
  }
  for (const [name, input] of outputs) {
    const target = join(outRoot, `${name}.png`);
    const hdTarget = join(outRoot, "hd", `${name}.png`);
    await mkdir(dirname(target), { recursive: true });
    await mkdir(dirname(hdTarget), { recursive: true });
    await writeFile(hdTarget, await sharp(input).png({ compressionLevel: 9, palette: true, colours: 256 }).toBuffer());
    const { width, height } = await sharp(input).metadata();
    await writeFile(target, await sharp(input).resize(width / RESOLUTION, height / RESOLUTION)
      .png({ compressionLevel: 9, palette: true, colours: 128 }).toBuffer());
  }
  return outputs.size;
}
