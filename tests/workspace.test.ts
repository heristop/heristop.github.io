import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { expect, it } from "vitest";

const root = `${process.cwd()}/`;

it("runs the packaged game model in Node without the browser renderer", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "@zazencode/path-of-stones/register",
      "--input-type=module",
      "--eval",
      'const { FALLBACK_SEED, buildGarden, initialState } = await import("@zazencode/path-of-stones/headless"); const state = initialState(buildGarden(FALLBACK_SEED)); console.log(JSON.stringify({ phase: state.phase, tiles: state.map.length }));',
    ],
    { cwd: root, encoding: "utf8" },
  );
  expect(result.stderr, result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ phase: "gardener", tiles: 144 });
});

it("keeps the source sprites and audio in the game package", () => {
  for (const asset of [
    "images/hd/characters/pilgrim.png",
    "images/hd/scenery/frog.png",
    "images/ground/water-still.png",
    "sounds/zen-garden.mp3",
  ]) {
    expect(existsSync(`${root}packages/path-of-stones/assets/${asset}`), asset).toBe(true);
  }
});

it("tracks only a pinned private repository reference in the public site", () => {
  const result = spawnSync("git", ["ls-files", "--stage", "--", "packages/path-of-stones"], {
    cwd: root,
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.trim()).toMatch(/^160000 [a-f0-9]{40} 0\tpackages\/path-of-stones$/);
});
