import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The garden is a feature module: one directory, one door. This test is the door.
//
// A barrel file on its own is a suggestion, and a suggestion is how a page ends up
// importing a pathfinder because it happened to need one constant from the same file. The
// rule is simple enough to check by reading the source: nothing outside the module may
// name a path inside it, except the module's own index.
const MODULE = "src/components/client/garden";
const DOOR = `${MODULE}/index`;

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|astro|mjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

// Resolve a relative specifier against the importing file, as a repo-relative path.
const resolveSpec = (from: string, spec: string): string =>
  relative(process.cwd(), join(from, "..", spec)).replaceAll("\\", "/");

describe("the garden is a feature module", () => {
  const outside = [...sourceFiles("src"), ...sourceFiles("tests"), ...sourceFiles("scripts")]
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => !path.startsWith(MODULE) && !path.startsWith("tests/components/client/garden"));

  it("is only ever entered through its index", () => {
    const trespass: string[] = [];
    for (const file of outside) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/["'](\.[^"']+)["']/g)) {
        const target = resolveSpec(file, match[1]);
        if (target.startsWith(MODULE) && target !== DOOR && target !== MODULE) {
          trespass.push(`${file} reaches into ${target}`);
        }
      }
    }
    expect(trespass).toEqual([]);
  });

  // The three layers are not folders for tidiness — each one is a promise about what a
  // file in it may do, and a promise nothing checks is a comment.
  it("keeps the board pure", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(`${MODULE}/board`)) {
      const source = readFileSync(file, "utf8");
      if (/from ["']react["']/.test(source)) {
        offenders.push(`${file} imports react`);
      }
      for (const match of source.matchAll(/["'](\.[^"']+)["']/g)) {
        const target = resolveSpec(file, match[1]);
        if (target.startsWith(`${MODULE}/components`) || target.startsWith(`${MODULE}/composables`)) {
          offenders.push(`${file} depends on ${target}`);
        }
      }
    }
    // The world model has to stay runnable without a DOM: it is what the terrain
    // generator searches with when it sizes the purse, and what the tests reason about.
    expect(offenders).toEqual([]);
  });

  it("keeps components presentational", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(`${MODULE}/components`)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/["'](\.[^"']+)["']/g)) {
        const target = resolveSpec(file, match[1]);
        if (target.startsWith(`${MODULE}/composables`)) {
          offenders.push(`${file} reaches for ${target}`);
        }
      }
    }
    // A component that reaches for a hook stops taking props and starts owning the game,
    // and the next one to need it finds the state already spoken for.
    expect(offenders).toEqual([]);
  });

  it("keeps its door narrow", () => {
    // Widening this list is a decision, not an accident: everything named here is a
    // promise to the rest of the site.
    const index = readFileSync(`${MODULE}/index.ts`, "utf8");
    const exported = [...index.matchAll(/export (?:type )?\{([^}]*)\}/g)]
      .flatMap((match) => match[1].split(","))
      .map((name) => name.trim().split(/\s+as\s+/).pop())
      .filter(Boolean);
    expect(exported.sort()).toEqual([
      "FALLBACK_SEED",
      "GardenDay",
      "GardenSeed",
      "STONE_COUNT",
      "WINDOW_DAYS",
      "ZazenWorld",
      "parseGardenSeed",
    ]);
  });
});
