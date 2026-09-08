import { BufferImageSource, Container, Graphics, Sprite, Texture } from "pixi.js";
import { toScreen } from "../board/geometry";
import type { GardenScene } from "./scene";

/** One small, reusable light texture. Soft light never resamples the pixel-art textures. */
export function lightPixels(size = 64) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(((x + 0.5) / size) * 2 - 1, ((y + 0.5) / size) * 2 - 1);
      const alpha = Math.round(Math.max(0, 1 - radius * radius) ** 3 * 255);
      const index = (y * size + x) * 4;
      pixels[index] = 255;
      pixels[index + 1] = 255;
      pixels[index + 2] = 255;
      pixels[index + 3] = alpha;
    }
  }
  return pixels;
}

export function createLightTexture() {
  return new Texture({
    source: new BufferImageSource({
      resource: lightPixels(),
      width: 64,
      height: 64,
      format: "rgba8unorm",
      scaleMode: "linear",
      alphaMode: "no-premultiply-alpha",
    }),
  });
}

/** Warm back edge, cooler foreground; the actual terrain remains perfectly flat. */
export function depthTint(depth: number) {
  const amount = Math.max(0, Math.min(1, depth));
  return (
    (Math.round(255 - amount * 53) << 16) |
    (Math.round(246 - amount * 35) << 8) |
    Math.round(223 - amount * 4)
  );
}

export function createAtmosphere(
  scene: GardenScene,
  texture: Texture,
  sceneryTextures: ReadonlyMap<string, Texture> = new Map(),
) {
  const floor = new Container({ label: "atmosphere-floor" });
  const air = new Container({ label: "atmosphere-air" });
  const animations: Array<(time: number) => void> = [];
  const place = (posX: number, posY: number) => toScreen(posX, posY, scene.offsetX, scene.offsetY);
  const glow = (
    parent: Container,
    x: number,
    y: number,
    width: number,
    height: number,
    color: number,
    alpha: number,
    additive = true,
  ) => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.width = width;
    sprite.height = height;
    sprite.tint = color;
    sprite.alpha = alpha;
    if (additive) sprite.blendMode = "add";
    parent.addChild(sprite);
    return sprite;
  };
  const lights = scene.map.filter(
    (tile) => tile.decor === "lantern-lit" || tile.shrine === "active",
  );
  const water = scene.map.filter((tile) => tile.sprite === "water-still");
  const sun = glow(
    floor,
    scene.width * 0.43,
    scene.height * 0.36,
    scene.width * 0.75,
    scene.height * 0.55,
    0xffd99b,
    0.12,
  );
  sun.label = "sunlight";
  animations.push((time) => {
    sun.alpha = 0.115 + Math.sin(time / 11000) * 0.015;
  });
  for (let index = 0; index < 3; index++) {
    const shaft = glow(
      air,
      scene.width * (0.37 + index * 0.09),
      scene.height * 0.37,
      38 - index * 9,
      scene.height * 0.62,
      0xffe3a5,
      0.12,
    );
    shaft.rotation = -0.72;
    shaft.label = "sun-shaft";
    animations.push((time) => {
      shaft.alpha = 0.09 + (Math.sin(time / 8700 + index * 1.8) + 1) * 0.025;
      shaft.x = scene.width * (0.37 + index * 0.09) + Math.sin(time / 14000) * 7;
    });
    // Sparse dust catches the sun; the population stays fixed across scene updates.
    for (let speck = 0; speck < 2; speck++) {
      const dust = glow(air, 0, 0, 3, 3, 0xffe4ac, 0);
      dust.label = "sun-dust";
      animations.push((time) => {
        const phase = (time / 14000 + index * 0.31 + speck * 0.47) % 1;
        const distance = (phase - 0.5) * scene.height * 0.45;
        dust.x = shaft.x + Math.sin(0.72) * distance + Math.sin(phase * Math.PI * 4) * 4;
        dust.y = scene.height * 0.37 + Math.cos(0.72) * distance;
        dust.alpha = Math.sin(phase * Math.PI) ** 2 * 0.36;
      });
    }
  }
  for (const tile of scene.map) {
    if (!["pine", "maple", "sakura", "torii"].includes(tile.decor)) continue;
    const p = place(tile.posX, tile.posY);
    const shadow = glow(
      floor,
      p.left + 43,
      p.top + 32,
      tile.decor === "torii" ? 54 : 38,
      13,
      0x102e31,
      0.38,
      false,
    );
    shadow.rotation = 0.35;
    shadow.label = "cast-shadow";
  }
  for (const tile of scene.map) {
    if (tile.stone === undefined) continue;
    const p = place(tile.posX, tile.posY);
    const aura = glow(floor, p.left + 32, p.top + 22, 48, 22, 0xffc985, 0.25);
    aura.label = "stone-aura";
    const spark = glow(air, p.left + 32, p.top - 8, 9, 9, 0xffdfa0, 0.5);
    spark.label = "stone-spark";
    const glint = new Container({ label: "stone-glint" });
    air.addChild(glint);
    glow(glint, 0, 0, 22, 3, 0xffe9b9, 0.8);
    glow(glint, 0, 0, 3, 26, 0xffe9b9, 0.8);
    animations.push((time) => {
      const pulse = Math.sin(time / 1000 + tile.stone!);
      aura.alpha = 0.2 + pulse * 0.06;
      spark.y = p.top - 8 + Math.sin(time / 800 + tile.stone!) * 3;
      spark.alpha = 0.45 + pulse * 0.16;
      glint.position.set(spark.x, spark.y);
      // A brief jewel glint, staggered so the objectives never flash together.
      glint.alpha = Math.max(0, Math.sin(time / 1800 + tile.stone! * 2.3)) ** 12 * 0.7;
    });
  }
  for (const tile of lights) {
    const p = place(tile.posX, tile.posY);
    const shrine = tile.shrine === "active";
    const pool = glow(
      floor,
      p.left + 32,
      p.top + 20,
      shrine ? 144 : 104,
      shrine ? 66 : 48,
      0xffc675,
      0.56,
    );
    const halo = glow(
      air,
      p.left + 32,
      p.top + (shrine ? 12 : -1),
      shrine ? 100 : 68,
      shrine ? 80 : 70,
      0xffcd79,
      0.38,
    );
    halo.label = "emissive-light";
    const core = glow(
      air,
      p.left + 32,
      p.top + (shrine ? 12 : -1),
      shrine ? 20 : 12,
      shrine ? 12 : 16,
      0xffe8af,
      0.8,
    );
    core.label = "light-core";
    if (shrine) {
      const beacon = glow(air, p.left + 32, p.top - 30, 38, 130, 0xffdf9f, 0.3);
      beacon.label = "shrine-beacon";
      animations.push((time) => {
        beacon.alpha = 0.24 + Math.sin(time / 1900) * 0.06;
      });
      for (let index = 0; index < 8; index++) {
        const ember = glow(air, 0, 0, 4, 4, 0xffe4ac, 0);
        ember.label = "shrine-ember";
        animations.push((time) => {
          const phase = (time / 5200 + index / 8) % 1;
          ember.x = p.left + 32 + Math.sin(phase * Math.PI * 2 + index) * 16;
          ember.y = p.top + 16 - phase * 95;
          ember.alpha = Math.sin(phase * Math.PI) ** 2 * 0.65;
        });
      }
    }
    animations.push((time) => {
      const flicker = Math.sin(time / 830 + tile.posX) * 0.025 + Math.sin(time / 1270) * 0.01;
      pool.alpha = 0.56 + flicker;
      halo.alpha = 0.34 + flicker;
      core.alpha = 0.77 + flicker * 1.8;
    });
  }
  for (const [index, tile] of water.entries()) {
    const p = place(tile.posX, tile.posY);
    const warm = lights.some(
      (light) => Math.abs(light.posX - tile.posX) + Math.abs(light.posY - tile.posY) <= 2,
    );
    const lampTexture = sceneryTextures.get("decors/lantern-lit");
    const nearLamp = lights.some(
      (light) =>
        light.decor === "lantern-lit" &&
        Math.abs(light.posX - tile.posX) + Math.abs(light.posY - tile.posY) <= 2,
    );
    if (nearLamp && lampTexture) {
      const mirror = new Container({ label: "lantern-reflection" });
      mirror.position.set(p.left, p.top);
      const mask = new Graphics().poly([32, 0, 64, 16, 32, 32, 0, 16]).fill(0xffffff);
      const reflected = new Sprite(lampTexture);
      reflected.anchor.set(0.5, 0);
      reflected.position.set(32, 24);
      reflected.scale.set(0.62, -0.48);
      reflected.tint = 0xd6d7b3;
      mirror.addChild(reflected, mask);
      mirror.mask = mask;
      floor.addChild(mirror);
      animations.push((time) => {
        reflected.x = 32 + Math.sin(time / 1200 + index) * 1.3;
        mirror.alpha = 0.19 + Math.sin(time / 1700 + index) * 0.04;
      });
    }
    const caustic = glow(floor, p.left + 32, p.top + 16, 30, 12, warm ? 0xffd590 : 0xa5e7d9, 0.14);
    caustic.label = "water-caustic";
    animations.push((time) => {
      caustic.alpha = 0.08 + (Math.sin(time / 1900 + index * 1.7) + 1) * 0.045;
    });
    const reflection = new Graphics();
    reflection.label = "water-reflection";
    reflection.position.set(p.left, p.top);
    // Every fragment stays inside the 64×32 diamond, including its full rectangle height.
    for (let row = 0; row < 5; row++) {
      const y = 6 + row * 4;
      const half = Math.min(y, 31 - y) * 2 - 4;
      const length = Math.min(half * 1.2, 7 + ((index + row * 3) % 12));
      reflection.rect(32 - length / 2 + Math.sin(index + row) * 3, y, length, 1);
    }
    reflection.fill({ color: warm ? 0xffdf9b : 0xc6e9de, alpha: 1 });
    reflection.blendMode = "add";
    floor.addChild(reflection);
    if (index % 3 === 0) {
      const glimmer = new Graphics();
      glimmer.label = "water-glimmer";
      glimmer.poly([0, -3, 1, -1, 5, 0, 1, 1, 0, 3, -1, 1, -5, 0, -1, -1]).fill(0xe5f5dc);
      glimmer.blendMode = "add";
      floor.addChild(glimmer);
      animations.push((time) => {
        glimmer.position.set(p.left + 32 + Math.sin(time / 2100 + index) * 6, p.top + 16);
        glimmer.alpha = Math.max(0, Math.sin(time / 1600 + index * 1.9)) ** 8 * 0.6;
      });
    }
    animations.push((time) => {
      reflection.alpha = 0.12 + (Math.sin(time / 1150 + index * 0.8) + 1) * 0.065;
    });
    if (index % 3 === 0 && index < 18) {
      const mist = new Container({ label: "water-mist" });
      air.addChild(mist);
      // Overlapping thin wisps avoid a single opaque ellipse over the water and actors.
      for (let layer = 0; layer < 3; layer++) {
        const wisp = glow(mist, 0, 0, 100 + layer * 22, 12 + layer * 5, 0xb6d4ce, 0.06, false);
        animations.push((time) => {
          const phase = time / (7600 + layer * 1900) + index * 1.7 + layer * 2.1;
          wisp.x = p.left + 32 + Math.sin(phase) * (16 + layer * 4);
          wisp.y = p.top + 5 - layer * 5 + Math.cos(phase * 0.83) * 3;
          wisp.alpha = 0.035 + (Math.sin(phase * 0.7) + 1) * 0.018;
        });
      }
    }
  }
  // Fixed population and deterministic phases: rebuilding a changed tile never restarts the sky.
  const count = Math.min(18, scene.map.length);
  for (let index = 0; index < count; index++) {
    const tile = scene.map[(index * 17) % scene.map.length]!;
    const p = place(tile.posX, tile.posY);
    const mote = glow(air, p.left + 32, p.top, 5, 5, index % 3 === 0 ? 0xffd27e : 0xd9e9b4, 0.4);
    mote.label = "firefly";
    animations.push((time) => {
      const phase = time / 3300 + index * 2.4;
      mote.x = p.left + 32 + Math.sin(phase * 0.7) * 14;
      mote.y = p.top - 8 + Math.cos(phase * 0.43) * 9;
      mote.alpha = Math.max(0, Math.sin(phase)) * 0.48;
    });
  }
  return {
    floor,
    air,
    update: (time: number) => {
      for (const animate of animations) animate(time);
    },
    destroy: () => {
      floor.destroy({ children: true });
      air.destroy({ children: true });
    },
  };
}
