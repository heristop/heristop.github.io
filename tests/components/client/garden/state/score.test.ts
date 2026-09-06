import { describe, expect, it } from "vitest";
import { scoreWalk } from "../../../../../src/components/client/garden/state/score";

describe("scoreWalk", () => {
  // The whole point of the scoring: restraint outranks speed. A walk that never breaks
  // the sand must beat a fast one that paved its way across, or the garden is rewarding
  // exactly the thing it asks you not to do.
  it("values leaving the sand alone above crossing quickly", () => {
    const untouched = scoreWalk({ steps: 60, stonesLaid: 0, stonesLeft: 4 });
    const hurried = scoreWalk({ steps: 12, stonesLaid: 4, stonesLeft: 0 });
    expect(untouched.total).toBeGreaterThan(hurried.total);
  });

  it("names a walk that laid no stones after the sand it left alone", () => {
    expect(scoreWalk({ steps: 40, stonesLaid: 0, stonesLeft: 5 }).rank).toBe(
      "The sand undisturbed",
    );
  });

  it("ranks by how much of the supply was spent, not how much was carried", () => {
    expect(scoreWalk({ steps: 20, stonesLaid: 1, stonesLeft: 9 }).rank).toBe("Light of foot");
    expect(scoreWalk({ steps: 20, stonesLaid: 5, stonesLeft: 5 }).rank).toBe("Measured");
    expect(scoreWalk({ steps: 20, stonesLaid: 9, stonesLeft: 1 }).rank).toBe("Determined");
  });

  // Nothing subtracts. A slow visitor is someone enjoying the garden, and the tally must
  // never hand them a negative line for it.
  it("never scores a line below zero, however long the walk took", () => {
    const dawdled = scoreWalk({ steps: 5000, stonesLaid: 3, stonesLeft: 0 });
    expect(dawdled.lines.every((line) => line.points >= 0)).toBe(true);
    expect(dawdled.total).toBeGreaterThan(0);
  });

  it("adds its own lines up", () => {
    const score = scoreWalk({ steps: 30, stonesLaid: 2, stonesLeft: 3 });
    expect(score.total).toBe(score.lines.reduce((sum, line) => sum + line.points, 0));
  });
});

// Both companions are off every route the game asks for, so finding either is worth
// something and finding both is worth more than the two of them added up.
describe("company", () => {
  const walk = { steps: 30, stonesLaid: 2, stonesLeft: 2 };

  it("pays nothing for company nobody kept", () => {
    const plain = scoreWalk(walk);
    expect(plain.lines.some((line) => line.label === "Company")).toBe(false);
    expect(plain.lines.some((line) => line.label === "A courtesy")).toBe(false);
  });

  it("pays for each, and pays a bonus for both", () => {
    const plain = scoreWalk(walk).total;
    const withCat = scoreWalk({ ...walk, catMet: true }).total;
    const withFrog = scoreWalk({ ...walk, frogFreed: true }).total;
    const withBoth = scoreWalk({ ...walk, catMet: true, frogFreed: true }).total;

    expect(withCat).toBeGreaterThan(plain);
    expect(withFrog).toBeGreaterThan(plain);
    expect(withBoth).toBeGreaterThan(withCat - plain + (withFrog - plain) + plain);
    expect(scoreWalk({ ...walk, catMet: true, frogFreed: true }).rank).toMatch(
      /good company/i,
    );
  });
});
