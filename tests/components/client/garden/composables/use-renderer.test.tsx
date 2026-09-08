import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useRenderer, {
  supportsWebGL,
} from "../../../../../src/components/client/garden/composables/use-renderer";

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => stored.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      stored.set(key, value);
    }),
  });
  window.history.replaceState(null, "", "/path-of-stones/");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const available = () => {
  vi.stubGlobal("WebGLRenderingContext", class {});
  const loseContext = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    getExtension: () => ({ loseContext }),
  } as unknown as ReturnType<HTMLCanvasElement["getContext"]>);
  return loseContext;
};
it("detects capability and releases its probe context, including WebGL1 fallback", () => {
  expect(supportsWebGL()).toBe(false);
  const lose = available();
  expect(supportsWebGL()).toBe(true);
  expect(lose).toHaveBeenCalledOnce();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null);
  expect(supportsWebGL()).toBe(true);
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  expect(supportsWebGL()).toBe(false);
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(supportsWebGL()).toBe(false);
});
it("defaults to HD-2D and remembers switches without leaving the override URL behind", () => {
  available();
  window.history.replaceState(
    { marker: true },
    "",
    "/path-of-stones/?renderer=webgl&other=1#garden",
  );
  const { result } = renderHook(useRenderer);
  expect(result.current.enabled).toBe(true);
  act(() => result.current.onReady(true));
  expect(result.current.ready).toBe(true);
  act(() => result.current.toggle());
  expect(result.current.ready).toBe(false);
  expect(result.current.enabled).toBe(false);
  expect(window.localStorage.getItem("path-stones:hd2d")).toBe("off");
  expect(window.location.search).toBe("?other=1");
  expect(window.location.hash).toBe("#garden");
  expect(window.history.state).toEqual({ marker: true });
  const reloaded = renderHook(useRenderer);
  expect(reloaded.result.current.enabled).toBe(false);
  act(() => result.current.toggle());
  expect(window.localStorage.getItem("path-stones:hd2d")).toBe("on");
  act(() => result.current.onReady(false));
  expect(result.current.supported).toBe(false);
});
it("respects diagnostic classic mode and tolerates unavailable storage", () => {
  available();
  window.history.replaceState(null, "", "/path-of-stones/?renderer=dom");
  expect(renderHook(useRenderer).result.current.enabled).toBe(false);
  window.history.replaceState(null, "", "/path-of-stones/");
  expect(renderHook(useRenderer).result.current.enabled).toBe(true);
  vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const { result } = renderHook(useRenderer);
  expect(result.current.enabled).toBe(true);
  act(() => result.current.toggle());
  expect(result.current.enabled).toBe(false);
});
