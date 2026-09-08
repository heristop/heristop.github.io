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
    ellipse() {
      return this;
    }
    fill() {
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
    tile(0, "lantern-lit"),
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
  const positions = () => air.children.map((c: any) => [c.x, c.y, c.alpha]);
  const still = positions();
  atmosphere.update(10000);
  expect(positions()).not.toEqual(still);
  atmosphere.update(0);
  expect(positions()).toEqual(still);
  atmosphere.destroy();
  expect(air.destroy).toHaveBeenCalledOnce();
  expect(floor.destroy).toHaveBeenCalledOnce();
});
