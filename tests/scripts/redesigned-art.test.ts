import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";
import { generateRedesignedArt } from "../../scripts/zazen-art/redesigned.mjs";

const root = join(process.cwd(), "public/images/zazen");
const dimensions: Record<string, [number, number, number, number]> = {
  "pilgrim": [24, 40, 3, 4], "pilgrim-idle": [24, 40, 4, 4],
  "gardener": [32, 40, 4, 3], "gardener-strike": [64, 40, 6, 1],
  "cat-walk": [24, 24, 4, 3], "npc-2": [24, 40, 1, 1],
  "npc-2-life": [24, 40, 4, 2], "npc-3": [24, 40, 1, 1],
  "npc-3-life": [24, 40, 4, 1], "mermaid-life": [24, 40, 4, 1],
  "bird-flight": [24, 16, 8, 1],
};

async function occupied(path: string) {
  const { data, info } = await sharp(await readFile(join(root, path))).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  let left = info.width, right = 0, top = info.height, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 127) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return { width: right - left + 1, height: bottom - top + 1, bottom };
}

it("ships transparent 4x artwork with a populated frame for every animation state", async () => {
  for (const [name, [w, h, cols, rows]] of Object.entries(dimensions)) {
    const folder = name === "bird-flight" ? "fx" : "persos";
    const image = await readFile(join(root, `hd/${folder}/${name}.png`));
    const meta = await sharp(image).metadata();
    expect([meta.width, meta.height, meta.hasAlpha], name).toEqual([w * cols * 4, h * rows * 4, true]);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const { data } = await sharp(image).extract({ left: x * w * 4, top: y * h * 4, width: w * 4, height: h * 4 })
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = data.filter((_, index) => index % 4 === 3);
      expect(alpha.includes(0), `${name} frame ${x},${y} backdrop`).toBe(true);
      expect(alpha.includes(255), `${name} frame ${x},${y} subject`).toBe(true);
      expect(alpha[0], `${name} frame ${x},${y} corner`).toBe(0);
    }
    const native = await sharp(await readFile(join(root, `${folder}/${name}.png`))).metadata();
    expect([native.width, native.height]).toEqual([w * cols, h * rows]);
  }
});

it("keeps lantern and rock proportions when source artwork crosses a nominal atlas row", async () => {
  const lit = await occupied("hd/decors/lantern-lit.png");
  const unlit = await occupied("hd/decors/lantern-unlit.png");
  expect(Math.abs(lit.height - unlit.height)).toBeLessThanOrEqual(4);
  expect(lit.height).toBeGreaterThanOrEqual(39 * 4);
  const rock = await occupied("hd/decors/rock-mound.png");
  expect(rock.width).toBeGreaterThanOrEqual(20 * 4);
  expect(rock.height).toBeLessThanOrEqual(20 * 4);
  expect(rock.bottom).toBe(61 * 4 - 1);
});

it("regenerates the delivered native and HD sprites without restoring the old artwork", async () => {
  const destination = await mkdtemp(join(tmpdir(), "zazen-art-"));
  try {
    expect(await generateRedesignedArt(destination)).toBe(32);
    for (const folder of ["persos", "decors", "fx", "hd/persos", "hd/decors", "hd/fx"]) {
      for (const name of await readdir(join(destination, folder))) {
        expect(await readFile(join(destination, folder, name)), `${folder}/${name}`)
          .toEqual(await readFile(join(root, folder, name)));
      }
    }
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
}, 20000);
