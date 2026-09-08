import { useEffect, useEffectEvent, useRef } from "react";
import type { GardenRenderer, GardenScene } from "./scene";

export default function WebGLBoard({
  scene,
  onReady,
  engine = "pixi",
}: {
  scene: GardenScene;
  engine?: "pixi" | "three";
  onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<GardenRenderer | undefined>(undefined);
  const ready = useEffectEvent(onReady);
  const latestScene = useEffectEvent(() => scene);
  useEffect(() => {
    let cancelled = false;
    const node = host.current!;
    const failed = () => {
      if (cancelled) return;
      renderer.current?.destroy();
      renderer.current = undefined;
      node.dataset.status = "fallback";
      ready(false);
    };
    node.dataset.status = "loading";
    const three = engine === "three";
    node.dataset.engine = three ? "three" : "pixi";
    const module = three ? import("./three-engine") : import("./webgl-engine");
    void module
      .then(async ({ createGardenRenderer }) => {
        const next = await createGardenRenderer(node, latestScene(), failed);
        if (cancelled) {
          next.destroy();
          return;
        }
        renderer.current = next;
        await next.update(latestScene());
        if (!cancelled && renderer.current === next) {
          node.dataset.status = "ready";
          ready(true);
        }
      })
      .catch(failed);
    return () => {
      cancelled = true;
      renderer.current?.destroy();
      renderer.current = undefined;
    };
  }, [engine]);
  useEffect(() => {
    const current = renderer.current;
    if (current)
      void current.update(scene).catch(() => {
        current.destroy();
        if (renderer.current === current) {
          renderer.current = undefined;
          if (host.current) host.current.dataset.status = "fallback";
          ready(false);
        }
      });
  }, [scene]);
  return <div className="garden-webgl" ref={host} aria-hidden="true" data-status="loading" />;
}
