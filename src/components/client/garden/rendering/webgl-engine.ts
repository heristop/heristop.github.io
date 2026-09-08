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
  let scene = initial;
  let grade: ColorMatrixFilter | undefined;
  let lightTexture: Texture | undefined;
  let atmosphere: ReturnType<typeof createAtmosphere> | undefined;
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
        const texture = await Assets.load<Texture>(root + path + ".png");
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
      const label = new Text({
        text: name === "pilgrim" ? "YOU" : "GARDENER",
        style: {
          fontFamily: "Georgia",
          fontSize: 7,
          fontWeight: "bold",
          fill: 0xffe6a9,
          stroke: { color: 0x233a35, width: 1 },
        },
        resolution: 2,
      });
      label.anchor.set(0.5, 1);
      label.position.set(32, -6);
      container.addChild(label);
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
    scale = 1,
  ) => {
    actor.sprite.texture = frame(path, w, h, column, row);
    actor.sprite.anchor.set(0.5, 1);
    actor.sprite.position.set(32, 35);
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
      actor.sprite.tint = depthTint((actor.container.y + scene.offsetY) / 640);
      const idle = Math.floor(time / 300) % 4;
      if (name === "pilgrim") {
        dress(
          actor,
          walking ? "persos/pilgrim" : "persos/pilgrim-idle",
          24,
          40,
          walking ? [0, 1, 2, 1][Math.floor(time / 80) % 4]! : idle,
          actor.row,
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
            0.85,
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
            0.85,
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
          actor.shadow.alpha = scene.aquatic ? 0 : 1;
        } else {
          dress(actor, "decors/frog-life", 32, 64, walking ? 2 : idle);
          actor.sprite.y = 32 - (walking ? Math.sin(progress * Math.PI) * 12 : 0);
          actor.sprite.alpha = 1;
          actor.shadow.alpha = walking ? 0.65 : 1;
        }
      }
    }
  };
  let attackStarted = 0;
  const update = async (next: GardenScene) => {
    if (destroyed) return;
    const version = ++revision;
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
    if (destroyed || version !== revision) return;
    if (next.gardenerActivity === "attack" && scene.gardenerActivity !== "attack")
      attackStarted = elapsed;
    if (scene.width !== next.width || scene.height !== next.height)
      app.renderer.resize(next.width, next.height);
    scene = next;
    if (renderedMap !== scene.map) {
      if (atmosphere) {
        ground.removeChild(atmosphere.floor);
        app.stage.removeChild(atmosphere.air);
        atmosphere.destroy();
      }
      for (const child of ground.removeChildren()) child.destroy({ children: true });
      for (const child of figures.children.slice())
        if (![...actors.values()].some((actor) => actor.container === child)) {
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
              new Graphics().ellipse(32, 29, 10, 3).fill({ color: 0x142c2a, alpha: 0.2 }),
            );
          const path = tile.npc
            ? `persos/npc-${tile.npc}${tile.npc === 2 || tile.npc === 3 ? "-life" : ""}`
            : `decors/${fish ? "koi-life" : decor}`;
          const sprite = new Sprite();
          const animated = fish || tile.npc === 2 || tile.npc === 3;
          const w = tile.npc ? 24 : 32;
          const h = tile.npc ? 40 : 64;
          sprite.texture = animated ? frame(path, w, h) : textures.get(path)!;
          sprite.position.set(tile.npc ? 20 : 16, 32 - h);
          sprite.tint = depthTint((tile.posX + tile.posY) / 30);
          sprite.width = w;
          sprite.height = h;
          container.addChild(sprite);
          if (animated)
            animations.push((time) => {
              sprite.texture = frame(path, w, h, Math.floor(time / 260 + tile.posX) % 4);
              if (fish) {
                sprite.x = 16 + Math.sin(time / 1200 + tile.posX) * 3;
                sprite.alpha = 0.7;
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
      resolution: 1,
      roundPixels: true,
      autoStart: false,
    });
    grade = new ColorMatrixFilter();
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
