import { expect, it } from "vitest";
import { OrthographicCamera, Vector3 } from "three";
import { CELL, fitCamera, tilePoint } from "../../../../../src/components/client/garden/rendering/three-projection";
import { toScreen } from "../../../../../src/components/client/garden/board/geometry";

it("aligns 3D ground and character feet with the React hit plane at every tile", () => {
  for (const width of [768, 900]) {
    const dimensions = { width, height: 540, offsetX: -352, offsetY: -32 };
    const camera = new OrthographicCamera(0, 1, 1, 0, 1, 4000);
    fitCamera(camera, dimensions);
    for (let x = 0; x < 12; x++) {
      for (let y = 0; y < 12; y++) {
        const screen = toScreen(x, y, dimensions.offsetX, dimensions.offsetY);
        for (const foot of [0, 16, 24, 31]) {
          const projected = tilePoint(x, y, foot).project(camera);
          expect((projected.x + 1) * width / 2).toBeCloseTo(screen.left + 32);
          expect((1 - projected.y) * dimensions.height / 2).toBeCloseTo(screen.top + foot);
        }
        const edge = new Vector3((x + 1) * CELL, 0, y * CELL).project(camera);
        expect((edge.x + 1) * width / 2).toBeCloseTo(screen.left + 64);
        expect((1 - edge.y) * dimensions.height / 2).toBeCloseTo(screen.top + 16);
      }
    }
  }
});
