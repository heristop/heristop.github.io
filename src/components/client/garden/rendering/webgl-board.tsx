import { useEffect, useEffectEvent, useRef } from "react";
import type { GardenRenderer, GardenScene } from "./scene";

export default function WebGLBoard({
  scene,
  onReady,
}: {
  scene: GardenScene;
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
    void import("./webgl-engine")
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
  }, []);
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
