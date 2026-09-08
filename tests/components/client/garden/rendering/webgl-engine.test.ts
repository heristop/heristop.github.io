import { sceneryAngle, sceneryLift, stoneShadowScale } from "../../../../../src/components/client/garden/rendering/scenery-motion";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GardenScene } from "../../../../../src/components/client/garden/rendering/scene";

const gpu = vi.hoisted(() => ({
  apps: [] as any[],
  failInit: false,
  load: vi.fn(),
  reduced: false,
}));
vi.mock("pixi.js", () => {
  class Container {
    constructor(options = {}) {
      Object.assign(this, options);
    }
    children: any[] = [];
    x = 0;
    y = 0;
    visible = true;
    alpha = 1;
    position = {
      set: (x: number, y: number) => {
        this.x = x;
        this.y = y;
      },
    };
    scale = { set: vi.fn() };
    anchor = { set: vi.fn() };
    pivot = { set: vi.fn() };
    skew = { x: 0, y: 0 };
    destroy = vi.fn();
    addChild(...children: any[]) {
      this.children.push(...children);
      return children[0];
    }
    addChildAt(child: any, index: number) {
      this.children.splice(index, 0, child);
    }
    removeChildren() {
      return this.children.splice(0);
    }
    removeChild(child: any) {
      this.children.splice(this.children.indexOf(child), 1);
    }
  }
  class Sprite extends Container {
    constructor(public texture?: any) {
      super();
    }
  }
  class Graphics extends Container {
    rectangles: number[][] = [];
    rect(...coordinates: number[]) {
      this.rectangles.push(coordinates);
      return this;
    }
    poly() {
      return this;
    }
    ellipses: number[][] = [];
    ellipse(...coordinates: number[]) {
      this.ellipses.push(coordinates);
      return this;
    }
    fill() {
      return this;
    }
    stroke() {
      return this;
    }
  }
  class Texture {
    source: any;
    frame: any;
    destroy = vi.fn();
    constructor(options: any) {
      Object.assign(this, options);
    }
  }
  class Rectangle {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number,
    ) {}
  }
  class Application {
    canvas = document.createElement("canvas");
    stage = new Container();
    renderer: any;
    ticker = {
      deltaMS: 0,
      maxFPS: 0,
      add: (fn: () => void) => {
        this.advance = (ms: number) => {
          this.ticker.deltaMS = ms;
          fn();
        };
      },
    };
    advance = (_ms: number) => {};
    render = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    destroy = vi.fn(() => this.canvas.remove());
    constructor() {
      gpu.apps.push(this);
    }
    async init() {
      if (gpu.failInit) throw new Error("no gpu");
      this.renderer = { resize: vi.fn() };
    }
  }
  return {
    Application,
    Container,
    Text: Container,
    ColorMatrixFilter: class {
      contrast = vi.fn();
      saturate = vi.fn();
      destroy = vi.fn();
    },
    Sprite,
    Graphics,
    Texture,
    BufferImageSource: class {
      constructor(options: unknown) {
        Object.assign(this, options);
      }
    },
    Rectangle,
    Assets: { load: gpu.load },
  };
});
import {
  createAtmosphere,
  createLightTexture,
  depthTint,
  lightPixels,
} from "../../../../../src/components/client/garden/rendering/atmosphere";
import { createGardenRenderer } from "../../../../../src/components/client/garden/rendering/webgl-engine";
const tile = (posX: number, decor = "", npc = 0, sprite = "sand-0") => ({
  posX,
  posY: 0,
  decor,
  npc,
  sprite,
  walkable: true,
});
const initial = (): GardenScene => ({
  map: [
    { ...tile(0, "lantern-lit"), stone: 0 },
    tile(1, "koi", 0, "water-still"),
    tile(2, "", 2),
    tile(3, "", 3),
    tile(4, "", 1),
    tile(5, "frog"),
    { ...tile(6), shrine: "active" },
  ],
  width: 768,
  height: 480,
  offsetX: -352,
  offsetY: -32,
  pilgrim: { posX: 1, posY: 1 },
  gardener: { posX: 2, posY: 2 },
  cat: { posX: 0, posY: 1 },
  frog: { posX: 3, posY: 1 },
  catFacingLeft: false,
  catGreeting: false,
  gardenerFacingLeft: false,
  gardenerActivity: "idle",
  frogVisible: true,
  companionVisible: false,
  aquatic: false,
  transforming: false,
});
beforeEach(() => {
  gpu.apps.length = 0;
  gpu.failInit = false;
  gpu.reduced = false;
  gpu.load.mockReset().mockImplementation(async (path: string) => ({ source: { path } }));
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return gpu.reduced;
    },
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const app = () => gpu.apps.at(-1)!;
const actors = () =>
  ["pilgrim", "gardener", "cat", "frog"].map((name) =>
    app().stage.children[1].children.find((child: any) => child.label === name),
  );

it("crops and animates water, lights the empty shrine, and reuses terrain for actor updates", async () => {
  const scene = initial();
  const host = document.createElement("div");
  const renderer = await createGardenRenderer(host, scene, vi.fn());
  const ground = app().stage.children[0];
  const water = ground.children[1];
  expect(host.querySelectorAll("canvas")).toHaveLength(1);
  expect(app().render).toHaveBeenCalledOnce();
  expect(water.texture.frame).toMatchObject({ width: 64, height: 64, y: 0 });
  app().advance(450);
  expect(water.texture.frame.y).toBe(64);
  const floor = ground.children.at(-1);
  expect(floor.children.some((c: any) => c.label === "lantern-reflection")).toBe(true);
  expect(floor.children.some((c: any) => c.label === "stone-aura")).toBe(true);
  expect(
    app().stage.children[2].children.filter((c: any) => c.label === "emissive-light"),
  ).toHaveLength(2);
  const [pilgrim] = actors();
  expect(pilgrim.x).toBe(352);
  await renderer.update({ ...scene, pilgrim: { posX: 2, posY: 1 }, catGreeting: true });
  expect(ground.children[1]).toBe(water);
  expect(app().renderer.resize).not.toHaveBeenCalled();
  await renderer.update({ ...scene, width: 800, pilgrim: { posX: 2, posY: 1 } });
  expect(app().renderer.resize).toHaveBeenCalledWith(800, scene.height);
  app().advance(200);
  expect(pilgrim.x).toBe(384);
  expect(pilgrim.y).toBe(80);
  renderer.destroy();
  renderer.destroy();
  expect(app().destroy).toHaveBeenCalledTimes(1);
  expect(app().stage.filters[0].destroy).toHaveBeenCalledOnce();
  expect(host.children).toHaveLength(0);
  await renderer.update(scene);
});

it("animates all walking directions, gardener work and strike, frog hop and stationary transformations", async () => {
  let scene = initial();
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  for (const [posX, posY] of [
    [2, 1],
    [2, 2],
    [2, 1],
    [1, 1],
  ]) {
    app().advance(16);
    scene = {
      ...scene,
      pilgrim: { posX: posX!, posY: posY! },
      gardener: { posX: posX!, posY: posY! },
      cat: { posX: posX!, posY: posY! },
      frog: { posX: posX!, posY: posY! },
      catFacingLeft: true,
      gardenerFacingLeft: true,
    };
    await renderer.update(scene);
    app().advance(70);
    expect(actors()[0].children[1].texture.source.path).toContain("persos/pilgrim.png");
    expect(actors()[3].children[1].y).toBeLessThan(32);
    expect(actors()[3].children[0].y).toBe(-7);
    app().advance(500);
  }
  for (const gardenerActivity of ["rake", "attack", "idle"] as const) {
    scene = { ...scene, gardenerActivity };
    await renderer.update(scene);
    app().advance(180);
    expect(actors()[1].children[1].texture.source.path).toContain(
      gardenerActivity === "attack" ? "gardener-strike" : "gardener",
    );
  }
  const frog = actors()[3];
  const position = { x: frog.x, y: frog.y };
  for (const aquatic of [false, true]) {
    await renderer.update({
      ...scene,
      frogVisible: false,
      companionVisible: true,
      aquatic,
      transforming: true,
    });
    app().advance(100);
    expect({ x: frog.x, y: frog.y }).toEqual(position);
    expect(frog.children[0].y).toBe(0);
    expect(frog.children[1].texture.source.path).toContain(aquatic ? "mermaid-life" : "npc-2-life");
    await renderer.update({ ...scene, frogVisible: false, companionVisible: true, aquatic });
    expect(frog.children[1].alpha).toBe(1);
  }
  await renderer.update({ ...scene, frogVisible: false, companionVisible: false });
  expect(frog.visible).toBe(false);
  renderer.destroy();
});

it("honors reduced motion and pauses the ticker while the page is hidden", async () => {
  const scene = initial();
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  gpu.reduced = true;
  await renderer.update({ ...scene, frog: { posX: 4, posY: 1 } });
  expect(actors()[3].x).toBe(448);
  expect(actors()[3].children[1].y).toBe(32);
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  expect(app().stop).toHaveBeenCalled();
  renderer.destroy();
});

it("discards stale asset loads and cleans replaced scenery without destroying actors", async () => {
  const scene = initial();
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  const pilgrim = actors()[0];
  const oldGround = app().stage.children[0].children[0];
  let release!: (value: any) => void;
  gpu.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const outdated = renderer.update({ ...scene, map: [tile(0, "pine")] });
  await renderer.update({ ...scene, map: [tile(0, "maple")] });
  release({ source: { path: "pine" } });
  await outdated;
  expect(oldGround.destroy).toHaveBeenCalled();
  expect(actors()[0]).toBe(pilgrim);
  expect(app().stage.children[1].children[4].children[1].texture.source.path).toContain("maple");
  renderer.destroy();
});

it("falls back on context loss even while initial textures are pending", async () => {
  let release!: (value: any) => void;
  gpu.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const failure = vi.fn();
  const host = document.createElement("div");
  const creating = createGardenRenderer(host, initial(), failure);
  await Promise.resolve();
  await Promise.resolve();
  const lost = new Event("webglcontextlost", { cancelable: true });
  app().canvas.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBe(true);
  release({ source: {} });
  await expect(creating).rejects.toThrow("context lost");
  expect(failure).toHaveBeenCalledTimes(1);
  expect(host.children).toHaveLength(0);
  expect(app().destroy).toHaveBeenCalledTimes(1);
});

it("cleans up failed asset initialization and rejects unsupported graphics", async () => {
  gpu.load.mockRejectedValueOnce(new Error("texture missing"));
  await expect(
    createGardenRenderer(document.createElement("div"), initial(), vi.fn()),
  ).rejects.toThrow("texture missing");
  expect(app().destroy).toHaveBeenCalledTimes(1);
  gpu.failInit = true;
  await expect(
    createGardenRenderer(document.createElement("div"), initial(), vi.fn()),
  ).rejects.toThrow("no gpu");
});

it("uses a smooth bounded light falloff without modifying pixel-art sampling", () => {
  const pixels = lightPixels(8);
  const alpha = (x: number, y: number) => pixels[(y * 8 + x) * 4 + 3]!;
  expect(alpha(0, 0)).toBe(0);
  expect(alpha(3, 3)).toBeGreaterThan(alpha(2, 3));
  expect(alpha(2, 3)).toBeGreaterThan(alpha(1, 3));
  expect(alpha(3, 3)).toBe(alpha(4, 4));
  const texture = createLightTexture();
  expect(texture.source).toMatchObject({
    width: 64,
    height: 64,
    scaleMode: "linear",
    alphaMode: "no-premultiply-alpha",
  });
  expect(depthTint(-1)).toBe(depthTint(0));
  expect(depthTint(2)).toBe(depthTint(1));
  expect(depthTint(0)).not.toBe(depthTint(1));
});

it("bounds water reflections and ambient populations and gives reduced motion a stable scene", () => {
  const scene = initial();
  scene.map = Array.from({ length: 30 }, (_, i) =>
    tile(i, i === 0 ? "torii" : "", 0, "water-still"),
  );
  const atmosphere = createAtmosphere(scene, createLightTexture());
  const air = atmosphere.air as any;
  const floor = atmosphere.floor as any;
  expect(air.children.filter((c: any) => c.label === "firefly")).toHaveLength(18);
  expect(air.children.filter((c: any) => c.label === "water-mist")).toHaveLength(6);
  expect(floor.children.some((c: any) => c.label === "cast-shadow")).toBe(true);
  for (const reflection of floor.children.filter((c: any) => c.label === "water-reflection")) {
    for (const [x, y, w, h] of reflection.rectangles) {
      for (const edgeY of [y, y + h]) {
        const half = Math.min(edgeY, 32 - edgeY) * 2;
        expect(x).toBeGreaterThanOrEqual(32 - half);
        expect(x + w).toBeLessThanOrEqual(32 + half);
      }
    }
  }
  atmosphere.update(0);
  const effects = air.children.flatMap((c: any) => [c, ...c.children]);
  expect(air.children.filter((c: any) => c.label === "sun-dust")).toHaveLength(6);
  for (const time of [0, 1000, 10000, 60000]) {
    atmosphere.update(time);
    for (const effect of effects) {
      expect(effect.alpha).toBeGreaterThanOrEqual(0);
      expect(effect.alpha).toBeLessThanOrEqual(1);
      expect(Number.isFinite(effect.x)).toBe(true);
      expect(Number.isFinite(effect.y)).toBe(true);
    }
  }
  atmosphere.update(0);
  const positions = () => effects.map((c: any) => [c.x, c.y, c.alpha]);
  const still = positions();
  atmosphere.update(10000);
  expect(positions()).not.toEqual(still);
  atmosphere.update(0);
  expect(positions()).toEqual(still);
  atmosphere.destroy();
  expect(air.destroy).toHaveBeenCalledOnce();
  expect(floor.destroy).toHaveBeenCalledOnce();
});

it("reserves jewel glints and the shrine beacon for live objectives", () => {
  const scene = initial();
  const texture = createLightTexture();
  const active = createAtmosphere(scene, texture);
  const labels = (effect: ReturnType<typeof createAtmosphere>) =>
    effect.air.children.map((child) => child.label);
  expect(labels(active)).toContain("stone-glint");
  expect(labels(active)).toContain("shrine-beacon");
  expect(labels(active).filter((label) => label === "shrine-ember")).toHaveLength(8);
  active.destroy();
  scene.map = scene.map.map(({ stone: _stone, shrine: _shrine, ...tile }) => tile);
  const quiet = createAtmosphere(scene, texture);
  expect(labels(quiet)).not.toContain("stone-glint");
  expect(labels(quiet)).not.toContain("shrine-beacon");
  quiet.destroy();
});

it("anchors decor shadows to their visible feet instead of the tile front edge", async () => {
  const scene = initial();
  scene.map = [tile(0, "pagoda"), tile(1, "pine"), tile(2, "stone-marker")];
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  const figures = app().stage.children[1].children;
  for (const [decor, foot] of [["pagoda", 24], ["pine", 26], ["stone-marker", 23]] as const) {
    const figure = figures.find((item: any) =>
      item.children[1]?.texture?.source?.path?.endsWith(`/${decor}.png`),
    );
    expect(figure.children[0].ellipses[0]).toEqual([32, foot, 10, 3]);
  }
  renderer.destroy();
});


it("centers trimmed nameplate glyphs on the panel rather than their baseline", async () => {
  const renderer = await createGardenRenderer(document.createElement("div"), initial(), vi.fn());
  for (const actor of actors().slice(0, 2)) {
    const label = actor.children.at(-1);
    expect(label.style.trim).toBe(true);
    expect(label.anchor.set).toHaveBeenCalledWith(0.5, 0.5);
    expect(label.y).toBe(-11);
  }
  renderer.destroy();
});


it("keeps koi wakes bounded, reusable and still with reduced motion", async () => {
  const renderer = await createGardenRenderer(document.createElement("div"), initial(), vi.fn());
  const fish = app().stage.children[1].children.find((figure: any) =>
    figure.children.some((child: any) => child.label === "koi-wake"),
  );
  const wake = fish.children.find((child: any) => child.label === "koi-wake");
  expect(wake.mask).toBe(wake.children[0]);
  const rings = wake.children.slice(1);
  expect(rings).toHaveLength(3);
  const positions = () => rings.map((ring: any) => [ring.x, ring.y, ring.alpha]);
  const start = positions();
  app().advance(500);
  expect(positions()).not.toEqual(start);
  expect(wake.children.slice(1)).toEqual(rings);
  gpu.reduced = true;
  app().advance(500);
  expect(positions()).toEqual(start);
  app().advance(500);
  expect(positions()).toEqual(start);
  renderer.destroy();
});

it("removes a lantern's light and water reflection when it is extinguished", async () => {
  const scene = initial();
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  await renderer.update({ ...scene, map: scene.map.map((tile) =>
    tile.decor === "lantern-lit" ? { ...tile, decor: "lantern-unlit" } : tile,
  ) });
  const floor = app().stage.children[0].children.at(-1);
  expect(floor.children.some((child: any) => child.label === "lantern-reflection")).toBe(false);
  expect(app().stage.children[2].children.filter((child: any) => child.label === "emissive-light")).toHaveLength(1);
  renderer.destroy();
});


it("lifts stones for two axial turns and settles tree gusts without moving their anchors", async () => {
  expect(sceneryAngle("stone", 1)).toBeCloseTo(Math.PI * 4);
  expect(sceneryLift(0)).toBe(0);
  expect(sceneryLift(0.5)).toBe(7);
  expect(sceneryLift(1)).toBeCloseTo(0);
  expect(sceneryAngle("tree", 0)).toBe(0);
  expect(sceneryAngle("tree", 1)).toBeCloseTo(0);
  const scene = initial();
  scene.map = [{ ...tile(0, "stone-marker"), stone: 0 }, tile(1, "pine")];
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  const figures = app().stage.children[1].children;
  const stone = figures[0].children[1];
  const tree = figures[1].children[1];
  const origin = [tree.x, tree.y];
  await renderer.update({ ...scene, interaction: { id: 1, posX: 0, posY: 0, kind: "stone" } });
  app().advance(300);
  expect(stone.scale.x).toBeLessThan(1);
  expect(stone.y).toBeLessThan(13);
  await renderer.update({ ...scene, interaction: { id: 2, posX: 1, posY: 0, kind: "tree" } });
  app().advance(300);
  expect(tree.skew.x).not.toBe(0);
  expect([tree.x, tree.y]).toEqual(origin);
  app().advance(2000);
  expect(tree.skew.x).toBe(0);
  expect(stone.scale.x).toBe(1);
  expect(stone.y).toBe(13);
  gpu.reduced = true;
  await renderer.update({ ...scene, interaction: { id: 3, posX: 0, posY: 0, kind: "stone" } });
  app().advance(300);
  expect(stone.scale.x).toBe(1);
  expect(stone.y).toBe(13);
  renderer.destroy();
});

it("plays animal greetings in place and restores their resting height", async () => {
  const scene = initial();
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  const cat = actors()[2];
  const frog = actors()[3];
  const origin = [frog.x, frog.y];
  await renderer.update({ ...scene, interaction: { id: 1, ...scene.cat, kind: "cat" } });
  app().advance(250);
  expect(cat.children[1].y).toBeLessThan(35);
  await renderer.update({ ...scene, interaction: { id: 2, ...scene.frog, kind: "frog" } });
  app().advance(250);
  expect(frog.children[1].y).toBeLessThan(32);
  expect([frog.x, frog.y]).toEqual(origin);
  expect(frog.children[0].y).toBe(-7);
  app().advance(1000);
  expect(cat.children[1].y).toBe(35);
  expect(frog.children[1].y).toBe(32);
  renderer.destroy();
});


it("shrinks the stone shadow at the apex and restores it on landing without shifting its contact point", async () => {
  expect(stoneShadowScale(0)).toBe(1);
  expect(stoneShadowScale(0.5)).toBe(0.5);
  expect(stoneShadowScale(1)).toBeCloseTo(1);
  const scene = initial();
  scene.map = [{ ...tile(0, "stone-marker"), stone: 0 }];
  const renderer = await createGardenRenderer(document.createElement("div"), scene, vi.fn());
  const shadow = app().stage.children[1].children[0].children[0];
  await renderer.update({ ...scene, interaction: { id: 1, posX: 0, posY: 0, kind: "stone" } });
  app().advance(700);
  expect(shadow.scale.set).toHaveBeenLastCalledWith(0.5, 0.5);
  expect([shadow.x, shadow.y]).toEqual([32, 23]);
  app().advance(700);
  expect(shadow.scale.set).toHaveBeenLastCalledWith(1, 1);
  expect([shadow.x, shadow.y]).toEqual([32, 23]);
  renderer.destroy();
});

it("limits warm water and lantern mirrors to a two-tile Manhattan radius", () => {
  const scene = initial();
  scene.map = [
    { posX: 0, posY: 0, sprite: "moss-mid", decor: "lantern-lit", npc: 0, walkable: false },
    ...[[2, 0], [1, 1], [2, 1], [3, 0]].map(([posX, posY]) => ({
      posX, posY, sprite: "water-still", decor: "", npc: 0, walkable: false,
    })),
  ];
  const atmosphere = createAtmosphere(scene, createLightTexture(), new Map([["decors/lantern-lit", createLightTexture()]]));
  const children = (atmosphere.floor as any).children;
  expect(children.filter((child: any) => child.label === "lantern-reflection")).toHaveLength(2);
  expect(children.filter((child: any) => child.label === "water-caustic").map((child: any) => child.tint))
    .toEqual([0xffd590, 0xffd590, 0xa5e7d9, 0xa5e7d9]);
  atmosphere.destroy();
});
