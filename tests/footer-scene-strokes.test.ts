import { describe, expect, it } from "vitest";
import { paintStrokes } from "../scripts/footer-scene/generate.mjs";
import strokes from "../src/components/footer-scene-strokes.json";

describe("footer scene strokes", () => {
  it("matches the generator, so brushwork is retuned in the script rather than by hand", () => {
    expect(paintStrokes()).toEqual(strokes);
  });
});
