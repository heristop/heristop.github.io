import { Container, Graphics } from "pixi.js";
import { fountainSpray } from "./scenery-motion";

/** Water positions follow the fountain's 32×64 sprite coordinates. */
export function createFountainWater() {
  const container = new Container({ label: "fountain-water" });
  const animate: Array<(time: number) => void> = [];
  for (let index = 0; index < 3; index++) {
    const drop = new Graphics().rect(0, 0, 0.75, 1.75).fill(0xf0fff4);
    container.addChild(drop);
    animate.push((time) => {
      const phase = (time / 600 + index / 3) % 1;
      drop.position.set(12.75, 37.75 + phase * 8.5);
      drop.alpha = Math.min(1, phase * 10, (1 - phase) * 10) * 0.95;
    });
  }
  for (let index = 0; index < 2; index++) {
    const ring = new Graphics().ellipse(0, 0, 3.5, 1).stroke({ color: 0xd7f8ef, width: 0.4 });
    ring.position.set(13.5, 47.25);
    container.addChild(ring);
    animate.push((time) => {
      const phase = (time / 1000 + index / 2) % 1;
      ring.scale.set(0.25 + phase * 0.85);
      ring.alpha = (1 - phase) * 0.8;
    });
    const splash = new Graphics().rect(0, 0, 0.65, 0.85).fill(0xf0fff4);
    container.addChild(splash);
    animate.push((time) => {
      const phase = (time / 700 + index / 2) % 1;
      splash.position.set(13 + (index === 0 ? -2 : 2) * phase, 46.75 - Math.sin(phase * Math.PI) * 2);
      splash.alpha = Math.sin(phase * Math.PI) * 0.9;
    });
  }
  const spray = new Container({ label: "fountain-spray" });
  spray.position.set(13, 46.75);
  container.addChild(spray);
  const droplets = Array.from({ length: 7 }, () => {
    const drop = new Graphics().rect(0, 0, 0.8, 1.2).fill(0xf0fff4);
    spray.addChild(drop);
    return drop;
  });
  return {
    container,
    update(time: number, burstProgress: number) {
      for (const update of animate) update(time);
      droplets.forEach((drop, index) => {
        const pose = fountainSpray(index, burstProgress);
        drop.position.set(pose.x, pose.y);
        drop.alpha = pose.alpha;
      });
    },
  };
}
