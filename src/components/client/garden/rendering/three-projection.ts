import { OrthographicCamera, Vector3 } from "three";
import type { GardenScene } from "./scene";

export const CELL = 32 * Math.SQRT2;

// Thirty-degree elevation reproduces the existing 64 × 32 diamond exactly.
// Keeping this projection fixed preserves the React hit plane and touch controls.
export function fitCamera(
  camera: OrthographicCamera,
  scene: Pick<GardenScene, "width" | "height" | "offsetX" | "offsetY">,
) {
  camera.left = scene.offsetX - 32;
  camera.right = camera.left + scene.width;
  camera.top = -scene.offsetY;
  camera.bottom = camera.top - scene.height;
  camera.position.set(1000, 1000 * Math.sqrt(2 / 3), 1000);
  camera.lookAt(new Vector3());
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function tilePoint(x: number, y: number, foot = 16) {
  return new Vector3((x + foot / 32) * CELL, 0, (y + foot / 32) * CELL);
}
