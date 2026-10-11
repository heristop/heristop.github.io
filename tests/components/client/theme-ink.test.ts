import { describe, expect, it } from "vitest";
import {
  INK_INNER_RADIUS,
  inkKeyframes,
  inkMaskSize,
  inkOrigin,
  inkReach,
  inkRimRadius,
} from "../../../src/components/client/theme-ink";

describe("ink drop geometry", () => {
  it("starts from the centre of the button", () => {
    expect(inkOrigin({ left: 100, top: 20, width: 44, height: 44 })).toEqual({ x: 122, y: 42 });
  });

  it("reaches the farthest corner of the viewport", () => {
    expect(inkReach({ x: 1400, y: 40 }, 1440, 900)).toBeCloseTo(Math.hypot(1400, 860));
    expect(inkReach({ x: 720, y: 450 }, 1440, 900)).toBeCloseTo(Math.hypot(720, 450));
  });

  it("sizes the mask so its innermost rim still covers that corner", () => {
    const reach = 1650;
    expect(inkMaskSize(reach) * INK_INNER_RADIUS).toBeGreaterThanOrEqual(reach);
  });

  it("keeps the rim outside the inner radius for any phase and jitter", () => {
    for (let trial = 0; trial < 50; trial++) {
      const phases = Array.from({ length: 4 }, () => Math.random() * Math.PI * 2);
      for (let step = 0; step < 360; step++) {
        const theta = (step / 360) * Math.PI * 2;
        const radius = inkRimRadius(theta, phases, -0.002);
        expect(radius).toBeGreaterThan(INK_INNER_RADIUS);
        expect(radius).toBeLessThan(0.5);
      }
    }
  });

  it("spreads from a point to the page, and recedes along the same path", () => {
    const origin = { x: 300, y: 50 };
    const spread = inkKeyframes(origin, 1000, "spread");
    expect(spread[0]).toEqual({ maskSize: "0px 0px", maskPosition: "300px 50px" });
    expect(spread[1]).toEqual({ maskSize: "1000px 1000px", maskPosition: "-200px -450px" });
    expect(inkKeyframes(origin, 1000, "recede")).toEqual([...spread].reverse());
  });
});
