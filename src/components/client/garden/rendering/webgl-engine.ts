import { sceneryAngle, sceneryDuration, sceneryLift, stoneShadowScale } from "./scenery-motion";
import {
  Application,
  Assets,
  Container,
  ColorMatrixFilter,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  Text,
} from "pixi.js";
import { createAtmosphere, createLightTexture, depthTint } from "./atmosphere";
import { groundArtwork } from "./artwork";
import { createFountainWater } from "./fountain-water";
import type { GardenRenderer, GardenScene } from "./scene";
import type { Position } from "../types";

const root = "/images/zazen/";
const actorSheets = [
  "pilgrim",
  "pilgrim-idle",
  "gardener",
  "gardener-strike",
  "cat-walk",
  "npc-2-life",
  "mermaid-life",
];
const point = (p: Position, scene: GardenScene) => ({
  x: (p.posX - p.posY) * 32 - scene.offsetX,
  y: (p.posX + p.posY) * 16 - scene.offsetY,
});

// Visible foot rows in the 32×64 artwork, after its -32px vertical placement.
const decorContactY: Readonly<Record<string, number>> = {
  pine: 26, maple: 26, sakura: 26,
  "bamboo-a": 31, "bamboo-b": 31, reed: 28,
  "rock-small": 28, "rock-mound": 28,
  "lantern-lit": 25, "lantern-unlit": 25, torii: 25,
  "stone-marker": 23, "stone-marker-lit": 23,
};

type Actor = {
  container: Container;
  sprite: Sprite;
  shadow: Graphics;
  from: { x: number; y: number };
  to: { x: number; y: number };
  started: number;
  duration: number;
  row: number;
};

/** The renderer consumes game snapshots; it never owns rules, turns or input. */
export async function createGardenRenderer(
  host: HTMLElement,
  initial: GardenScene,
  onFailure: () => void,
): Promise<GardenRenderer> {
  const app = new Application();
  const frames = new Map<string, Texture>();
  const textures = new Map<string, Texture>();
  let destroyed = false;
  let revision = 0;
  let elapsed = 0;
  const sceneryStarts = new Map<string, number>();
  const animalStarts = new Map<string, number>();
  let interactionId = initial.interaction?.id;
  let scene = initial;
  let grade: ColorMatrixFilter | undefined;
  let lightTexture: Texture | undefined;
  let atmosphere: ReturnType<typeof createAtmosphere> | undefined;
  const loadedMaps = new WeakSet<GardenScene["map"]>();
  let renderedMap: GardenScene["map"] | undefined;
  const ground = new Container();
  const figures = new Container({ sortableChildren: true });
  const animations: Array<(time: number) => void> = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const actors = new Map<string, Actor>();
  const contextLost = (event: Event) => {
    event.preventDefault();
    destroy();
    onFailure();
  };
  const visibility = () => {
    if (document.hidden) app.stop();
    else app.start();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    revision++;
    document.removeEventListener("visibilitychange", visibility);
    app.canvas.removeEventListener("webglcontextlost", contextLost);
    app.destroy(true, { children: true });
    for (const texture of frames.values()) texture.destroy(false);
    lightTexture?.destroy(true);
    grade?.destroy();
  };
  const frame = (path: string, width: number, height: number, column = 0, row = 0) => {
    const key = `${path}:${width}:${height}:${column}:${row}`;
    let texture = frames.get(key);
    if (!texture) {
      texture = new Texture({
        source: textures.get(path)!.source,
        frame: new Rectangle(column * width, row * height, width, height),
      });
      frames.set(key, texture);
    }
    return texture;
  };
  const load = async (paths: Set<string>) => {
    await Promise.all(
      [...paths].map(async (path) => {
        if (textures.has(path)) return;
        const detailed = path.startsWith("persos/") || path.startsWith("decors/");
        const texture = await Assets.load<Texture>({
          src: root + (detailed ? "hd/" : "") + path + ".png",
          data: { resolution: detailed ? 4 : 1 },
        });
        texture.source.scaleMode = "nearest";
        textures.set(path, texture);
      }),
    );
  };
  const makeActor = (name: string, position: Position, duration: number) => {
    const container = new Container();
    container.label = name;
    const shadow = new Graphics().ellipse(32, 31, 9, 3).fill({ color: 0x142c2a, alpha: 0.25 });
    const sprite = new Sprite();
    container.addChild(shadow, sprite);
    if (name === "pilgrim" || name === "gardener") {
      const labelLift = name === "pilgrim" ? 17 : 12;
      const plateWidth = name === "pilgrim" ? 30 : 64;
      const left = 32 - plateWidth / 2;
      const right = 32 + plateWidth / 2;
      const plate = new Graphics()
        .poly([left + 1, -18, right - 1, -18, right, -17, right, -5,
          right - 1, -4, left + 1, -4, left, -5, left, -17])
        .fill({ color: 0x172c32, alpha: 0.9 });
      plate.label = "nameplate";
      plate.y = -labelLift;
      const label = new Text({
        text: name === "pilgrim" ? "YOU" : "GARDENER",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 9,
          trim: true,
          letterSpacing: 0.8,
          fontWeight: "600",
          fill: name === "pilgrim" ? 0xffe6a9 : 0xe3e8d6,
        },
        resolution: 2,
      });
      // Trim font line-box padding before centering the visible glyphs in the plate.
      label.anchor.set(0.5, 0.5);
      label.position.set(32, -11 - labelLift);
      container.addChild(plate, label);
    }
    figures.addChild(container);
    const p = point(position, scene);
    const actor: Actor = {
      container,
      sprite,
      shadow,
      from: p,
      to: p,
      started: 0,
      duration,
      row: 0,
    };
    actors.set(name, actor);
    return actor;
  };
  const move = (name: string, position: Position, duration: number) => {
    const actor = actors.get(name) ?? makeActor(name, position, duration);
    const next = point(position, scene);
    if (next.x !== actor.to.x || next.y !== actor.to.y) {
      actor.from = { x: actor.container.x, y: actor.container.y };
      const dx = next.x - actor.to.x;
      const dy = next.y - actor.to.y;
      actor.row = dy > 0 ? (dx > 0 ? 0 : 1) : dx > 0 ? 2 : 3;
      actor.to = next;
      actor.started = elapsed;
    }
  };
  const dress = (
    actor: Actor,
    path: string,
    w: number,
    h: number,
    column: number,
    row = 0,
    flip = false,
    scale = 1.35,
  ) => {
    actor.sprite.texture = frame(path, w, h, column, row);
    actor.sprite.anchor.set(0.5, 1);
    const footRow = path === "persos/npc-2-life" ? 31
      : path === "persos/mermaid-life" ? 34
      : path === "persos/cat-walk" ? 21
      : path.startsWith("persos/gardener") ? 36
      : path.startsWith("persos/pilgrim") ? 35 : 56;
    const originalScale = actor.container.label === "gardener" ? 0.85 : 1;
    actor.sprite.position.set(32, 35 + (h - footRow) * (scale - originalScale));
    actor.sprite.scale.set(flip ? -scale : scale, scale);
  };
  const tick = () => {
    const time = reducedMotion.matches ? 0 : elapsed;
    for (const animate of animations) animate(time);
    atmosphere?.update(time);
    for (const [name, actor] of actors) {
      const progress = reducedMotion.matches
        ? 1
        : Math.min(1, (elapsed - actor.started) / actor.duration);
      const walking = progress < 1 && (actor.from.x !== actor.to.x || actor.from.y !== actor.to.y);
      actor.container.position.set(
        actor.from.x + (actor.to.x - actor.from.x) * progress,
        actor.from.y + (actor.to.y - actor.from.y) * progress,
      );
      actor.container.zIndex = actor.container.y + 32;
      actor.sprite.tint = 0xffffff;
      const idle = Math.floor(time / 300) % 4;
      if (name === "pilgrim") {
        dress(
          actor,
          walking ? "persos/pilgrim" : "persos/pilgrim-idle",
          24,
          40,
          walking ? [0, 1, 2, 1][Math.floor(time / 80) % 4]! : idle,
          actor.row,
          false,
          1.5,
        );
      } else if (name === "gardener") {
        if (scene.gardenerActivity === "attack")
          dress(
            actor,
            "persos/gardener-strike",
            64,
            40,
            Math.min(5, Math.floor((elapsed - attackStarted) / 133)),
            0,
            scene.gardenerFacingLeft,
            1.35,
          );
        else
          dress(
            actor,
            "persos/gardener",
            32,
            40,
            idle,
            scene.gardenerActivity === "rake" ? 2 : walking ? 1 : 0,
            scene.gardenerFacingLeft,
            1.35,
          );
      } else if (name === "cat") {
        dress(
          actor,
          "persos/cat-walk",
          24,
          24,
          idle,
          walking ? 0 : scene.catGreeting ? 2 : 1,
          scene.catFacingLeft,
        );
      } else {
        actor.container.visible = scene.frogVisible || scene.companionVisible;
        if (scene.companionVisible) {
          dress(actor, scene.aquatic ? "persos/mermaid-life" : "persos/npc-2-life", 24, 40, idle);
          actor.sprite.alpha = scene.transforming ? 0.65 + Math.sin(time / 80) * 0.25 : 1;
          // The woman's feet end at row 31: sprite top -5 + 31 = ground y26.
          actor.shadow.y = -5;
          actor.shadow.alpha = scene.aquatic ? 0 : 1;
        } else {
          dress(actor, "decors/frog-life", 32, 64, walking ? 2 : idle);
          actor.sprite.y = 32 + 8 * 0.35 - (walking ? Math.sin(progress * Math.PI) * 12 : 0);
          actor.sprite.alpha = 1;
          // Frog artwork ends at row 56, eight pixels above the frame bottom.
          // Only the sprite hops; the contact shadow follows the ground trajectory.
          actor.shadow.y = -7;
          actor.shadow.alpha = walking ? 0.65 : 1;
        }
      }
      if (name === "cat" || (name === "frog" && !scene.companionVisible)) {
        const started = animalStarts.get(name);
        const reaction = started === undefined ? 1 : (elapsed - started) / sceneryDuration(name);
        if (name === "cat") actor.shadow.alpha = 1;
        if (!reducedMotion.matches && !walking && reaction < 1) {
          if (name === "cat") dress(actor, "persos/cat-walk", 24, 24, Math.min(3, Math.floor(reaction * 4)), 2, scene.catFacingLeft);
          actor.sprite.y -= sceneryLift(reaction) * (name === "frog" ? 1.4 : 0.6);
          actor.shadow.alpha = 0.65;
        }
      }
    }
  };
  let attackStarted = 0;
  const update = async (next: GardenScene) => {
    if (destroyed) return;
    const version = ++revision;
    if (!loadedMaps.has(next.map)) {
      const paths = new Set(actorSheets.map((name) => `persos/${name}`));
      paths.add("decors/frog-life");
      for (const tile of next.map) {
        paths.add(`sol/${groundArtwork(tile)}`);
        if (tile.decor && tile.decor !== "frog")
          paths.add(`decors/${tile.decor === "koi" ? "koi-life" : tile.decor}`);
        if (tile.npc)
          paths.add(`persos/npc-${tile.npc}${tile.npc === 2 || tile.npc === 3 ? "-life" : ""}`);
      }
      await load(paths);
      loadedMaps.add(next.map);
    }
    if (destroyed || version !== revision) return;
    if (next.gardenerActivity === "attack" && scene.gardenerActivity !== "attack")
      attackStarted = elapsed;
    if (scene.width !== next.width || scene.height !== next.height)
      app.renderer.resize(next.width, next.height);
    if (next.interaction && next.interaction.id !== interactionId) {
      interactionId = next.interaction.id;
      if (next.interaction.kind === "cat" || next.interaction.kind === "frog")
        animalStarts.set(next.interaction.kind, elapsed);
      else sceneryStarts.set(`${next.interaction.posX},${next.interaction.posY}`, elapsed);
    }
    scene = next;
    if (renderedMap !== scene.map) {
      if (atmosphere) {
        ground.removeChild(atmosphere.floor);
        app.stage.removeChild(atmosphere.air);
        atmosphere.destroy();
      }
      for (const child of ground.removeChildren()) child.destroy({ children: true });
      const actorContainers = new Set([...actors.values()].map((actor) => actor.container));
      for (const child of figures.children.slice())
        if (!actorContainers.has(child)) {
          figures.removeChild(child);
          child.destroy({ children: true });
        }
      animations.length = 0;
      for (const tile of scene.map) {
        const p = point(tile, scene);
        const groundPath = `sol/${groundArtwork(tile)}`;
        const water = tile.sprite === "water-still";
        const base = new Sprite(water ? frame(groundPath, 64, 64) : textures.get(groundPath));
        if (water)
          animations.push((time) => {
            base.texture = frame(groundPath, 64, 64, 0, Math.floor(time / 400) % 8);
          });
        base.position.set(p.x, p.y);
        base.tint = water ? 0x9cdad5 : depthTint((tile.posX + tile.posY) / 22);
        base.width = 64;
        base.height = 64;
        ground.addChild(base);
        const decor = tile.decor;
        if ((decor && decor !== "frog") || tile.npc) {
          const container = new Container();
          container.position.set(p.x, p.y);
          container.zIndex = p.y + 32;
          figures.addChild(container);
          const fish = decor === "koi";
          if (!fish)
            container.addChild(
              new Graphics().ellipse(32, tile.npc ? (tile.npc === 2 ? 23 : 29) : (decorContactY[decor] ?? 24), 10, 3).fill({ color: 0x142c2a, alpha: 0.2 }),
            );
          const path = tile.npc
            ? `persos/npc-${tile.npc}${tile.npc === 2 || tile.npc === 3 ? "-life" : ""}`
            : `decors/${fish ? "koi-life" : decor}`;
          const sprite = new Sprite();
          const animated = fish || tile.npc === 2 || tile.npc === 3;
          const w = tile.npc ? 24 : 32;
          const h = tile.npc ? 40 : 64;
          const scale = tile.npc ? 1.35 : fish ? 1.35 : tile.stone !== undefined ? 1 : 1.15;
          const contactY = tile.npc ? (tile.npc === 2 ? 31 : 34) : (decorContactY[decor] ?? 24) + 32;
          sprite.texture = animated ? frame(path, w, h) : textures.get(path)!;
          sprite.position.set(32 - w * scale / 2, 32 - h - contactY * (scale - 1));
          sprite.tint = tile.npc ? 0xffffff : depthTint((tile.posX + tile.posY) / 60);
          sprite.width = w * scale;
          sprite.height = h * scale;
          container.addChild(sprite);
          if (decor === "shishi-odoshi") {
            const water = createFountainWater();
            water.container.position.set(sprite.x, sprite.y);
            water.container.scale.set(scale);
            container.addChild(water.container);
            animations.push((time) => {
              water.container.visible = !reducedMotion.matches;
              const start = sceneryStarts.get(`${tile.posX},${tile.posY}`);
              water.update(time, start === undefined ? 1 : (elapsed - start) / sceneryDuration("fountain"));
            });
          }
          const tree = ["pine", "maple", "sakura", "bamboo-a", "bamboo-b", "reed"].includes(decor);
          if (tree || tile.stone !== undefined) {
            const kind = tree ? "tree" : "stone";
            const pivotY = tree ? (decorContactY[decor] ?? 26) + 32 : 45;
            sprite.pivot.set(16, pivotY);
            sprite.position.set(32, pivotY - 32);
            const shadow = container.children[0] as Graphics;
            if (!tree) {
              const footY = decorContactY[decor] ?? 24;
              shadow.pivot.set(32, footY);
              shadow.position.set(32, footY);
            }
            animations.push(() => {
              const start = sceneryStarts.get(`${tile.posX},${tile.posY}`);
              const progress = start === undefined ? 1 : (elapsed - start) / sceneryDuration(kind);
              const angle = reducedMotion.matches || progress >= 1 ? 0 : sceneryAngle(kind, progress);
              if (tree) sprite.skew.x = angle;
              else {
                // A billboard turning around its vertical axis, with its shadow left on the ground.
                const shadowScale = reducedMotion.matches || progress >= 1 ? 1 : stoneShadowScale(progress);
                shadow.scale.set(shadowScale, shadowScale);
                sprite.scale.x = Math.cos(angle);
                sprite.y = pivotY - 32 - (reducedMotion.matches || progress >= 1 ? 0 : sceneryLift(progress));
              }
            });
          }
          if (fish) {
            const wake = new Container({ label: "koi-wake" });
            const mask = new Graphics().poly([32, 0, 64, 16, 32, 32, 0, 16]).fill(0xffffff);
            wake.addChild(mask);
            wake.mask = mask;
            container.addChild(wake);
            // Three reusable rings trail the fish; no particles are allocated per frame.
            for (let index = 0; index < 3; index++) {
              const ring = new Graphics()
                .ellipse(0, 0, 8, 2)
                .stroke({ color: 0xc9ece0, width: 0.7, alpha: 1 });
              ring.label = "koi-ripple";
              ring.blendMode = "add";
              wake.addChild(ring);
              animations.push((time) => {
                const phase = (time / 2400 + index / 3 + tile.posX * 0.17) % 1;
                const drift = Math.sin((time - phase * 900) / 1200 + tile.posX) * 3;
                ring.position.set(34 + drift + phase * 3, 22);
                ring.scale.set(0.5 + phase, 0.6 + phase * 0.8);
                ring.alpha = Math.sin(phase * Math.PI) * (1 - phase) * 0.32;
              });
            }
          }
          if (animated)
            animations.push((time) => {
              sprite.texture = frame(path, w, h, Math.floor(time / 260 + tile.posX) % 4);
              if (fish) {
                sprite.x = 32 - w * scale / 2 + Math.sin(time / 1200 + tile.posX) * 3;
                sprite.y = -32 - contactY * (scale - 1) + Math.sin(time / 2100 + tile.posX) * 0.6;
                sprite.tint = 0xb9dcd2;
                sprite.alpha = 0.76 + Math.sin(time / 2600 + tile.posX) * 0.07;
              }
            });
        }
      }
      atmosphere = createAtmosphere(scene, lightTexture!, textures);
      ground.addChild(atmosphere.floor);
      app.stage.addChild(atmosphere.air);
      renderedMap = scene.map;
    }
    move("pilgrim", scene.pilgrim, 200);
    move("gardener", scene.gardener, 240);
    move("cat", scene.cat, 460);
    move("frog", scene.frog, 460);
    tick();
  };
  try {
    await app.init({
      width: initial.width,
      height: initial.height,
      preference: ["webgl"],
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
      autoDensity: true,
      roundPixels: true,
      autoStart: false,
    });
    grade = new ColorMatrixFilter();
    // Pixi filters default to resolution 1, which would downsample the HD scene.
    grade.resolution = "inherit";
    grade.contrast(0.12, false);
    grade.saturate(0.16, true);
    app.stage.filters = [grade];
    lightTexture = createLightTexture();
    app.stage.addChild(ground, figures);
    app.ticker.maxFPS = 60;
    app.ticker.add(() => {
      elapsed += app.ticker.deltaMS;
      tick();
    });
    app.canvas.addEventListener("webglcontextlost", contextLost);
    document.addEventListener("visibilitychange", visibility);
    await update(initial);
    if (destroyed) throw new Error("WebGL context lost during initialization");
    app.render();
    host.appendChild(app.canvas);
    visibility();
  } catch (error) {
    // Initialization can fail before Pixi creates its renderer (unsupported GPU).
    if (app.renderer) destroy();
    throw error;
  }
  return { update, destroy };
}
