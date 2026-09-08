import { useCallback, useState, useSyncExternalStore } from "react";

export function supportsWebGL() {
  if (
    typeof window === "undefined" ||
    (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined")
  )
    return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

// Probe after React commits, once per page, rather than allocating GPU resources in render.
let capability: boolean | undefined;
const subscribe = (changed: () => void) => {
  if (capability === undefined) {
    capability = supportsWebGL();
    changed();
  }
  return () => {};
};
const snapshot = () => capability ?? false;
const serverSnapshot = () => false;

export default function useRenderer() {
  const available = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [failed, setFailed] = useState(false);
  const supported = available && !failed;
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    const override = new URLSearchParams(window.location.search).get("renderer");
    if (override === "dom") return false;
    if (override === "webgl" || override === "three") return true;
    try {
      return window.localStorage.getItem("path-stones:hd2d") !== "off";
    } catch {
      return true;
    }
  });
  const [engine, setEngine] = useState<"pixi" | "three">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("renderer") === "three" ? "three" : "pixi",
  );
  const toggleEngine = () => {
    const next = engine === "three" ? "pixi" : "three";
    setReady(false);
    setEngine(next);
    setEnabled(true);
    const url = new URL(window.location.href);
    url.searchParams.set("renderer", next === "three" ? "three" : "webgl");
    window.history.replaceState(window.history.state, "", url);
  };
  const [ready, setReady] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const onReady = useCallback((value: boolean) => {
    setReady(value);
    if (value) setHasRendered(true);
    if (!value) setFailed(true);
  }, []);
  const toggle = () => {
    const next = !enabled;
    setReady(false);
    setEnabled(next);
    try {
      window.localStorage.setItem("path-stones:hd2d", next ? "on" : "off");
    } catch {
      /* Session control works without storage. */
    }
    // A diagnostic URL must not override the player's explicit preference on reload.
    const url = new URL(window.location.href);
    url.searchParams.delete("renderer");
    window.history.replaceState(window.history.state, "", url);
  };
  return { supported, enabled, ready, hasRendered, onReady, toggle, engine, toggleEngine };
}
