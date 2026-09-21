import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/FooterScene.astro"), "utf8");
const script = /<script is:inline>([\s\S]*?)<\/script>/.exec(source)?.[1];
if (!script) {
  throw new Error("FooterScene.astro has no inline script");
}

type Entry = { isIntersecting: boolean };
type Callback = (entries: Entry[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  callback: Callback;

  constructor(callback: Callback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
}

const mountScene = () => {
  document.body.innerHTML = '<div class="footer-scene" aria-hidden="true" data-footer-scene></div>';
  const scene = document.querySelector<HTMLElement>("[data-footer-scene]");
  if (!scene) {
    throw new Error("scene not mounted");
  }
  return scene;
};

// The script declares `const initFooterScene` at top level; wrapping it in a
// Function gives each run its own scope, as a fresh classic script would have.
const runScript = () => new Function(script)();

describe("FooterScene inline script", () => {
  beforeEach(() => {
    sessionStorage.clear();
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("creates one observer even though astro:page-load also fires on the first load", () => {
    const scene = mountScene();
    runScript();
    document.dispatchEvent(new Event("astro:page-load"));

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(FakeIntersectionObserver.instances[0].observe).toHaveBeenCalledWith(scene);
  });

  it("wakes the scene while it intersects and sleeps it when it leaves", () => {
    const scene = mountScene();
    runScript();
    const [observer] = FakeIntersectionObserver.instances;

    observer.callback([{ isIntersecting: true }]);
    expect(scene.classList.contains("is-awake")).toBe(true);

    observer.callback([{ isIntersecting: false }]);
    expect(scene.classList.contains("is-awake")).toBe(false);
  });

  it("disconnects on astro:before-swap and observes the swapped-in scene", () => {
    mountScene();
    runScript();
    document.dispatchEvent(new Event("astro:before-swap"));
    expect(FakeIntersectionObserver.instances[0].disconnect).toHaveBeenCalledOnce();

    const nextScene = mountScene();
    document.dispatchEvent(new Event("astro:page-load"));
    expect(FakeIntersectionObserver.instances).toHaveLength(2);
    expect(FakeIntersectionObserver.instances[1].observe).toHaveBeenCalledWith(nextScene);
  });

  it("wakes the scene immediately when IntersectionObserver is unavailable", () => {
    vi.unstubAllGlobals(); // jsdom has no IntersectionObserver of its own
    const scene = mountScene();
    runScript();
    expect(scene.classList.contains("is-awake")).toBe(true);
  });

  it("inks the painting in on the first visit once it scrolls into view", async () => {
    const scene = mountScene();
    runScript();
    expect(scene.classList.contains("is-inking")).toBe(true);
    expect(scene.classList.contains("is-painted")).toBe(false);

    FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true }]);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(scene.classList.contains("is-painted")).toBe(true);
    expect(sessionStorage.getItem("footer-scene-painted")).toBe("true");
  });

  it("shows the finished painting on later pages of the same visit", () => {
    sessionStorage.setItem("footer-scene-painted", "true");
    const scene = mountScene();
    runScript();
    expect(scene.classList.contains("is-inking")).toBe(false);
  });

  it("skips the brush reveal under reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const scene = mountScene();
    runScript();
    expect(scene.classList.contains("is-inking")).toBe(false);
  });
});
