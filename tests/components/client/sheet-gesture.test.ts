import { describe, expect, it } from "vitest";
import {
  createVelocityTracker,
  handoffDuration,
  projectMomentum,
  rubberband,
  sheetOffset,
  shouldDismiss,
} from "../../../src/components/client/sheet-gesture";

const HEIGHT = 400;

describe("sheetOffset", () => {
  it("follows the finger 1:1 downward", () => {
    expect(sheetOffset(0, HEIGHT)).toBe(0);
    expect(sheetOffset(125, HEIGHT)).toBe(125);
  });

  it("resists upward travel, more the further it goes, never past the cap", () => {
    const small = -sheetOffset(-40, HEIGHT);
    const large = -sheetOffset(-400, HEIGHT);
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(40);
    expect(large / 400).toBeLessThan(small / 40);
    expect(-sheetOffset(-1e6, HEIGHT)).toBeLessThan(HEIGHT);
  });

  it("gives nothing for no overshoot", () => {
    expect(rubberband(0, HEIGHT)).toBe(0);
    expect(rubberband(-10, HEIGHT)).toBe(0);
  });
});

describe("shouldDismiss", () => {
  it("closes on a clear downward flick, even after a short pull", () => {
    expect(shouldDismiss(20, 800, HEIGHT)).toBe(true);
  });

  it("snaps back from a slow, short pull", () => {
    expect(shouldDismiss(60, 50, HEIGHT)).toBe(false);
  });

  it("closes when released past half the sheet", () => {
    expect(shouldDismiss(240, 0, HEIGHT)).toBe(true);
  });

  it("never closes while the sheet is moving back up", () => {
    expect(shouldDismiss(300, -200, HEIGHT)).toBe(false);
  });

  it("projects momentum like scroll deceleration", () => {
    expect(projectMomentum(0)).toBe(0);
    expect(projectMomentum(500)).toBeCloseTo(249.5, 1);
  });
});

describe("handoffDuration", () => {
  it("is shorter for a faster release and stays within bounds", () => {
    const fast = handoffDuration(100, 4000);
    const slow = handoffDuration(100, 2000);
    expect(fast).toBeLessThan(slow);
    expect(handoffDuration(200, 1e6)).toBe(120);
    expect(handoffDuration(200, 10)).toBe(280);
    expect(handoffDuration(0, 500)).toBe(280);
  });
});

describe("createVelocityTracker", () => {
  it("measures px/s over the recent window", () => {
    const tracker = createVelocityTracker();
    tracker.reset(0, 0);
    for (let t = 16; t <= 160; t += 16) {
      tracker.add(t, t);
    }
    expect(tracker.velocity(160)).toBeCloseTo(1000, 0);
  });

  it("reports no momentum when the finger paused before lifting", () => {
    const tracker = createVelocityTracker();
    tracker.reset(0, 0);
    tracker.add(50, 16);
    expect(tracker.velocity(400)).toBe(0);
  });

  it("reports nothing from a single sample", () => {
    const tracker = createVelocityTracker();
    tracker.reset(10, 0);
    expect(tracker.velocity(0)).toBe(0);
  });
});
