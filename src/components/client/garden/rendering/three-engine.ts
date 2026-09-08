import * as THREE from "three";
import { groundArtwork } from "./artwork";
import { CELL, fitCamera, tilePoint } from "./three-projection";
import { sceneryAngle, sceneryDuration, sceneryLift } from "./scenery-motion";
import type { GardenRenderer, GardenScene } from "./scene";
import type { Position } from "../types";

const SHEETS = [
  "pilgrim",
  "pilgrim-idle",
  "gardener",
  "gardener-strike",
  "cat-walk",
  "npc-2-life",
  "mermaid-life",
];
const FEET: Record<string, number> = {
  pine: 26,
  maple: 26,
  sakura: 26,
  "bamboo-a": 31,
  "bamboo-b": 31,
  reed: 28,
  "rock-small": 28,
  "rock-mound": 28,
  "lantern-lit": 25,
  "lantern-unlit": 25,
  torii: 25,
  "stone-marker": 23,
  "stone-marker-lit": 23,
};
type Figure = {
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
};
type Actor = Figure & {
  from: THREE.Vector3;
  to: THREE.Vector3;
  started: number;
  duration: number;
  row: number;
};

export async function createGardenRenderer(
  host: HTMLDivElement,
  initial: GardenScene,
  onFailure: () => void,
): Promise<GardenRenderer> {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const world = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 1, 4000);
  fitCamera(camera, initial);
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const terrain = new THREE.Group();
  const actors = new Map<string, Actor>();
  const textures = new Map<string, THREE.Texture>();
  const frames = new Map<string, THREE.Texture>();
  const loading = new Map<string, Promise<THREE.Texture>>();
  const loadedMaps = new WeakSet<GardenScene["map"]>();
  const loader = new THREE.TextureLoader();
  const reactions = new Map<string, number>();
  const animations: Array<(time: number) => void> = [];
  let scene = initial;
  let renderedMap: GardenScene["map"] | undefined;
  let disposed = false;
  let revision = 0;
  let elapsed = 0;
  let lastFrame: number | undefined;
  let interactionId = initial.interaction?.id;
  let attackStarted = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  world.add(terrain, new THREE.HemisphereLight(0xd7eee0, 0x33433a, 1.35));
  const sun = new THREE.DirectionalLight(0xffe0a6, 2.0);
  sun.position.set(-150, 480, 400);
  sun.target.position.set(240, 0, 240);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -480,
    right: 480,
    top: 480,
    bottom: -480,
    near: 1,
    far: 1200,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  world.add(sun, sun.target);

  const disposeObject = (object: THREE.Object3D) => {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material])
          material.dispose();
      }
      if (child instanceof THREE.Light && "shadow" in child)
        (child as THREE.DirectionalLight).shadow?.dispose();
    });
    object.removeFromParent();
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    revision++;
    renderer.setAnimationLoop(null);
    document.removeEventListener("visibilitychange", visibility);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    disposeObject(world);
    for (const texture of frames.values()) texture.dispose();
    for (const texture of textures.values()) texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    destroy();
    onFailure();
  };
  const load = (path: string) => {
    let promise = loading.get(path);
    if (!promise) {
      promise = loader.loadAsync(`/images/zazen/${path}.png`).then((texture) => {
        if (disposed) {
          texture.dispose();
          throw new Error("Three garden disposed while loading");
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        textures.set(path, texture);
        return texture;
      });
      loading.set(path, promise);
    }
    return promise;
  };
  const frame = (path: string, width: number, height: number, column = 0, row = 0) => {
    const key = `${path}:${width}:${height}:${column}:${row}`;
    let texture = frames.get(key);
    if (!texture) {
      const source = textures.get(path)!;
      const image = source.image;
      if (!(image instanceof HTMLImageElement)) throw new Error("Expected a loaded sprite image");
      texture = source.clone();
      texture.repeat.set(width / image.width, height / image.height);
      texture.offset.set(column * texture.repeat.x, 1 - (row + 1) * texture.repeat.y);
      texture.needsUpdate = true;
      frames.set(key, texture);
    }
    return texture;
  };
  const figure = (width: number, height: number): Figure => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({
        alphaTest: 0.45,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    mesh.quaternion.copy(camera.quaternion);
    mesh.castShadow = true;
    group.add(mesh);
    return { group, mesh };
  };
  const placeFigure = (
    item: Figure,
    x: number,
    y: number,
    foot: number,
    centerAboveFoot: number,
  ) => {
    item.group.position.copy(tilePoint(x, y, foot));
    item.mesh.position.copy(cameraUp).multiplyScalar(centerAboveFoot);
  };
  const move = (name: string, position: Position, duration: number) => {
    let actor = actors.get(name);
    const next = tilePoint(position.posX, position.posY, name === "frog" ? 24 : 31);
    if (!actor) {
      actor = {
        ...figure(1, 1),
        from: next.clone(),
        to: next.clone(),
        started: elapsed,
        duration,
        row: 0,
      };
      actor.group.position.copy(next);
      if (name === "pilgrim" || name === "gardener") {
        const width = name === "pilgrim" ? 30 : 64;
        const canvas = document.createElement("canvas");
        canvas.width = width * 4;
        canvas.height = 56;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#172c32";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#f4df9f";
        context.font = "600 36px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(name === "pilgrim" ? "YOU" : "GARDENER", canvas.width / 2, 29);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.set(`label-${name}`, texture);
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(width, 14),
          new THREE.MeshBasicMaterial({ map: texture }),
        );
        label.quaternion.copy(camera.quaternion);
        label.position.copy(cameraUp).multiplyScalar(42);
        actor.group.add(label);
      }
      actors.set(name, actor);
      world.add(actor.group);
    }
    if (!actor.to.equals(next)) {
      const dx = next.x - actor.to.x;
      const dz = next.z - actor.to.z;
      actor.row = dx + dz > 0 ? (dx > dz ? 0 : 1) : dx > dz ? 2 : 3;
      actor.from.copy(actor.group.position);
      actor.to.copy(next);
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
    actor.mesh.material.map = frame(path, w, h, column, row);
    actor.mesh.scale.set(w * scale * (flip ? -1 : 1), h * scale, 1);
    actor.mesh.position.copy(cameraUp).multiplyScalar((h / 2 - 4) * scale);
    actor.mesh.material.opacity = 1;
  };
  const tick = () => {
    const time = reduced.matches ? 0 : elapsed;
    for (const animate of animations) animate(time);
    for (const [name, actor] of actors) {
      const progress = reduced.matches
        ? 1
        : Math.min(1, (elapsed - actor.started) / actor.duration);
      const walking = progress < 1 && !actor.from.equals(actor.to);
      actor.group.position.lerpVectors(actor.from, actor.to, progress);
      const idle = Math.floor(time / 300) % 4;
      if (name === "pilgrim")
        dress(
          actor,
          walking ? "persos/pilgrim" : "persos/pilgrim-idle",
          24,
          40,
          walking ? [0, 1, 2, 1][Math.floor(time / 80) % 4] : idle,
          actor.row,
        );
      else if (name === "gardener") {
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
      } else if (name === "cat")
        dress(
          actor,
          "persos/cat-walk",
          24,
          24,
          idle,
          walking ? 0 : scene.catGreeting ? 2 : 1,
          scene.catFacingLeft,
        );
      else {
        actor.group.visible = scene.frogVisible || scene.companionVisible;
        if (scene.companionVisible) {
          dress(actor, scene.aquatic ? "persos/mermaid-life" : "persos/npc-2-life", 24, 40, idle);
          actor.mesh.castShadow = !scene.aquatic;
          actor.mesh.material.emissive.set(scene.transforming ? 0x44552a : 0x000000);
        } else {
          dress(actor, "decors/frog-life", 32, 64, walking ? 2 : idle);
          actor.mesh.position
            .copy(cameraUp)
            .multiplyScalar(24 + (walking ? Math.sin(progress * Math.PI) * 12 : 0));
          actor.mesh.castShadow = true;
          actor.mesh.material.emissive.set(0);
        }
      }
      const started = reactions.get(name);
      const kind = name === "cat" ? "cat" : "frog";
      const reaction = started === undefined ? 1 : (elapsed - started) / sceneryDuration(kind);
      if (
        (name === "cat" || (name === "frog" && !scene.companionVisible)) &&
        !walking &&
        !reduced.matches &&
        reaction < 1
      ) {
        if (name === "cat")
          dress(
            actor,
            "persos/cat-walk",
            24,
            24,
            Math.min(3, Math.floor(reaction * 4)),
            2,
            scene.catFacingLeft,
          );
        actor.mesh.position.addScaledVector(cameraUp, sceneryLift(reaction));
      }
    }
  };
  const render = (now: number) => {
    if (disposed) return;
    if (lastFrame !== undefined && now - lastFrame < 1000 / 60) return;
    elapsed += lastFrame === undefined ? 0 : Math.min(50, now - lastFrame);
    lastFrame = now;
    try {
      tick();
      renderer.render(world, camera);
    } catch {
      destroy();
      onFailure();
    }
  };
  const visibility = () => {
    lastFrame = undefined;
    renderer.setAnimationLoop(document.hidden ? null : render);
  };
  const update = async (next: GardenScene) => {
    if (disposed) return;
    const version = ++revision;
    if (!loadedMaps.has(next.map)) {
      const paths = new Set(SHEETS.map((name) => `persos/${name}`));
      paths.add("decors/frog-life");
      for (const tile of next.map) {
        paths.add(`sol/${groundArtwork(tile)}`);
        if (tile.decor && tile.decor !== "frog")
          paths.add(`decors/${tile.decor === "koi" ? "koi-life" : tile.decor}`);
        if (tile.npc)
          paths.add(`persos/npc-${tile.npc}${tile.npc === 2 || tile.npc === 3 ? "-life" : ""}`);
      }
      await Promise.all([...paths].map(load));
      loadedMaps.add(next.map);
    }
    if (disposed || version !== revision) return;
    if (next.gardenerActivity === "attack" && scene.gardenerActivity !== "attack")
      attackStarted = elapsed;
    if (next.interaction && next.interaction.id !== interactionId) {
      interactionId = next.interaction.id;
      const kind = next.interaction.kind;
      reactions.set(
        kind === "cat" || kind === "frog"
          ? kind
          : `${next.interaction.posX},${next.interaction.posY}`,
        elapsed,
      );
    }
    scene = next;
    fitCamera(camera, scene);
    if (renderer.domElement.width !== scene.width || renderer.domElement.height !== scene.height)
      renderer.setSize(scene.width, scene.height);
    if (renderedMap !== scene.map) {
      while (terrain.children.length) disposeObject(terrain.children[0]);
      animations.length = 0;
      const minX = Math.min(...scene.map.map((tile) => tile.posX));
      const minY = Math.min(...scene.map.map((tile) => tile.posY));
      const maxX = Math.max(...scene.map.map((tile) => tile.posX)) + 1;
      const maxY = Math.max(...scene.map.map((tile) => tile.posY)) + 1;
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry((maxX - minX) * CELL, 18, (maxY - minY) * CELL),
        new THREE.MeshStandardMaterial({ color: 0x625a3e, roughness: 0.95 }),
      );
      plinth.position.set(((maxX + minX) * CELL) / 2, -9.1, ((maxY + minY) * CELL) / 2);
      plinth.receiveShadow = true;
      terrain.add(plinth);
      for (const tile of scene.map) {
        const water = tile.sprite === "water-still";
        // Reproject the authored diamond onto a genuine horizontal square.
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, 0, 0, CELL, 0, 0, CELL, 0, CELL, 0, 0, CELL], 3),
        );
        geometry.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute([0.5, 1, 1, 0.75, 0.5, 0.5, 0, 0.75], 2),
        );
        geometry.setIndex([0, 2, 1, 0, 3, 2]);
        geometry.computeVertexNormals();
        const path = `sol/${groundArtwork(tile)}`;
        const material = new THREE.MeshStandardMaterial({
          map: water ? frame(path, 64, 64) : textures.get(path),
          roughness: water ? 0.28 : 1,
          metalness: water ? 0.2 : 0,
          color: water ? 0x8fc9c6 : 0xffffff,
        });
        const base = new THREE.Mesh(geometry, material);
        base.position.set(tile.posX * CELL, 0, tile.posY * CELL);
        base.receiveShadow = true;
        terrain.add(base);
        if (water) {
          animations.push((time) => {
            material.map = frame(path, 64, 64, 0, Math.floor(time / 400) % 8);
          });
          const ripple = new THREE.Mesh(
            new THREE.PlaneGeometry(CELL, CELL),
            new THREE.ShaderMaterial({
              transparent: true,
              depthWrite: false,
              uniforms: { time: { value: 0 }, phase: { value: tile.posX + tile.posY * 0.7 } },
              vertexShader:
                "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
              fragmentShader:
                "varying vec2 vUv; uniform float time; uniform float phase; void main(){float wave=sin(vUv.x*35.0+sin(vUv.y*18.0+time)*1.5+time+phase);float line=pow(max(0.0,wave),20.0);float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(0.0,0.15,1.0-vUv.x);gl_FragColor=vec4(0.8,0.94,0.81,line*edge*0.15);}",
            }),
          );
          ripple.rotation.x = -Math.PI / 2;
          ripple.position.copy(tilePoint(tile.posX, tile.posY));
          ripple.position.y = 0.12;
          terrain.add(ripple);
          animations.push((time) => {
            ripple.material.uniforms.time.value = time / 2200;
          });
        }
        const decor = tile.decor;
        if ((decor && decor !== "frog") || tile.npc) {
          const fish = decor === "koi";
          const width = tile.npc ? 24 : 32;
          const height = tile.npc ? 40 : 64;
          const path = tile.npc
            ? `persos/npc-${tile.npc}${tile.npc === 2 || tile.npc === 3 ? "-life" : ""}`
            : `decors/${fish ? "koi-life" : decor}`;
          const item = figure(width, height);
          const animated = fish || tile.npc === 2 || tile.npc === 3;
          item.mesh.material.map = animated ? frame(path, width, height) : textures.get(path)!;
          const foot = tile.npc ? 29 : (FEET[decor] ?? 24);
          placeFigure(item, tile.posX, tile.posY, foot, foot - 32 + height / 2);
          terrain.add(item.group);
          if (animated)
            animations.push((time) => {
              item.mesh.material.map = frame(
                path,
                width,
                height,
                Math.floor(time / (fish ? 280 : 300)) % 4,
              );
            });
          if (fish) {
            item.mesh.castShadow = false;
            item.mesh.material.transparent = true;
            item.mesh.material.opacity = 0.7;
            item.mesh.material.color.set(0x83b6b6);
            animations.push((time) => {
              item.mesh.position.copy(cameraUp).multiplyScalar(foot);
              item.mesh.position.x += Math.sin(time / 1200 + tile.posX) * 2;
            });
          }
          if (["pine", "maple", "sakura", "bamboo-a", "bamboo-b", "reed"].includes(decor)) {
            const rest = item.mesh.quaternion.clone();
            const rotation = new THREE.Quaternion();
            const axis = new THREE.Vector3(0, 0, 1);
            animations.push((time) => {
              const start = reactions.get(`${tile.posX},${tile.posY}`);
              const progress =
                start === undefined ? 1 : (elapsed - start) / sceneryDuration("tree");
              const gust = reduced.matches || progress >= 1 ? 0 : sceneryAngle("tree", progress);
              item.mesh.quaternion
                .copy(rest)
                .multiply(
                  rotation.setFromAxisAngle(axis, Math.sin(time / 2400 + tile.posX) * 0.01 + gust),
                );
            });
          }
          if (decor === "lantern-lit" || tile.shrine === "active") {
            item.mesh.material.emissive.set(0x826128);
            item.mesh.material.emissiveIntensity = 0.45;
            const lamp = new THREE.PointLight(0xffc46b, 1800, 125, 2);
            lamp.position.copy(tilePoint(tile.posX, tile.posY));
            lamp.position.y = 22;
            terrain.add(lamp);
            animations.push((time) => {
              lamp.intensity = 1700 + Math.sin(time / 730 + tile.posX) * 120;
            });
          }
        }
      }
      const mist = new THREE.Mesh(
        new THREE.PlaneGeometry((maxX - minX) * CELL, (maxY - minY) * CELL),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: { time: { value: 0 } },
          vertexShader:
            "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader:
            "varying vec2 vUv; uniform float time; void main(){float waves=sin(vUv.x*17.0+time)*sin(vUv.y*13.0-time*0.4);float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(0.0,0.15,1.0-vUv.x)*smoothstep(0.0,0.15,vUv.y)*smoothstep(0.0,0.15,1.0-vUv.y);gl_FragColor=vec4(0.71,0.82,0.74,max(0.0,waves)*edge*0.085);}",
        }),
      );
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(((maxX + minX) * CELL) / 2, 5, ((maxY + minY) * CELL) / 2);
      terrain.add(mist);
      animations.push((time) => {
        mist.material.uniforms.time.value = time / 13000;
      });
      // Sparse illuminated motes occupy real space above the floor.
      const positions = new Float32Array(24 * 3);
      for (let i = 0; i < 24; i++) {
        positions[i * 3] = ((i * 137.5) % ((maxX - minX) * CELL)) + minX * CELL;
        positions[i * 3 + 1] = 10 + (i % 7) * 5;
        positions[i * 3 + 2] = ((i * 83.7) % ((maxY - minY) * CELL)) + minY * CELL;
      }
      const dustGeometry = new THREE.BufferGeometry();
      dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dust = new THREE.Points(
        dustGeometry,
        new THREE.PointsMaterial({
          color: 0xffdfa0,
          size: 1.7,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        }),
      );
      terrain.add(dust);
      animations.push((time) => {
        dust.position.y = Math.sin(time / 4200) * 4;
        dust.material.opacity = 0.35 + Math.sin(time / 3000) * 0.15;
      });
      renderedMap = scene.map;
    }
    move("pilgrim", scene.pilgrim, 200);
    move("gardener", scene.gardener, 240);
    move("cat", scene.cat, 460);
    move("frog", scene.frog, 460);
    tick();
  };
  try {
    renderer.domElement.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    await update(initial);
    if (disposed) throw new Error("Three garden context lost during initialization");
    renderer.render(world, camera);
    host.appendChild(renderer.domElement);
    visibility();
  } catch (error) {
    destroy();
    throw error;
  }
  return { update, destroy };
}
