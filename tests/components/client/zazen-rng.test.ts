import { describe, expect, it } from "vitest";
import { createRng, hashString } from "../../../src/components/client/zazen-rng";

describe("createRng", () => {
  it("returns the same sequence for the same seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("returns a different sequence for a different seed", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("is stable for the same input", () => {
    expect(hashString("2026-09-05")).toBe(hashString("2026-09-05"));
  });

  it("differs for different inputs", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
  });

  it("returns a non-negative 32-bit integer", () => {
    const hash = hashString("heristop");
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
