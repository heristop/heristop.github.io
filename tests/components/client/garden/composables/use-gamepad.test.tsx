import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useGamepad, {
  gamepadDirection,
} from "../../../../../src/components/client/garden/composables/use-gamepad";

const pad = (): Gamepad =>
  ({
    id: "Test controller",
    index: 0,
    connected: true,
    mapping: "standard",
    timestamp: 0,
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  }) as unknown as Gamepad;
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("controller input", () => {
  it("maps the D-pad and dominant stick axis, ignoring stick drift", () => {
    const controller = pad();
    expect(gamepadDirection({ ...controller, axes: [0.2, -0.2] })).toBeUndefined();
    expect(gamepadDirection({ ...controller, axes: [-0.9, 0.4] })).toBe("W");
    expect(gamepadDirection({ ...controller, axes: [0.4, -0.9] })).toBe("N");
    for (const [index, direction] of [
      [12, "N"],
      [13, "S"],
      [14, "W"],
      [15, "E"],
    ] as const) {
      const buttons = controller.buttons.map((button, i) => ({ ...button, pressed: i === index }));
      expect(gamepadDirection({ ...controller, buttons })).toBe(direction);
    }
  });

  const setup = () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    let callback: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
      callback = fn;
      return 1;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    let controllers: (Gamepad | null)[] = [pad()];
    vi.stubGlobal("navigator", { getGamepads: () => controllers });
    const controls = {
      canMove: vi.fn(() => true),
      move: vi.fn(),
      confirm: vi.fn(),
      cancel: vi.fn(),
      sound: vi.fn(),
      help: vi.fn(),
    };
    const hook = renderHook(() => useGamepad(controls));
    const tick = (time: number) => act(() => callback(time));
    const set = (value: (Gamepad | null)[]) => {
      controllers = value;
    };
    tick(0);
    tick(16);
    return { hook, controls, tick, set, cancelFrame };
  };

  it("steps once immediately, delays repeating, and stops on release", () => {
    const { controls, tick, set, hook } = setup();
    set([{ ...pad(), axes: [1, 0] }]);
    tick(32);
    tick(100);
    expect(controls.move).toHaveBeenCalledTimes(1);
    tick(352);
    tick(532);
    expect(controls.move).toHaveBeenCalledTimes(3);
    set([pad()]);
    tick(720);
    expect(controls.move).toHaveBeenCalledTimes(3);
    hook.unmount();
  });

  it("requires a neutral stick after the gardener or an open menu", () => {
    const { controls, tick, set, hook } = setup();
    controls.canMove.mockReturnValue(false);
    set([{ ...pad(), axes: [1, 0] }]);
    tick(32);
    controls.canMove.mockReturnValue(true);
    tick(500);
    expect(controls.move).not.toHaveBeenCalled();
    set([pad()]);
    tick(520);
    set([{ ...pad(), axes: [1, 0] }]);
    tick(540);
    expect(controls.move).toHaveBeenCalledWith("E");
    hook.unmount();
  });

  it("fires menu buttons only on a fresh press", () => {
    const { controls, tick, set, hook } = setup();
    const buttons = pad().buttons.map((button, i) => ({
      ...button,
      pressed: [0, 1, 2, 9].includes(i),
    }));
    set([{ ...pad(), buttons }]);
    tick(32);
    tick(500);
    for (const action of ["confirm", "cancel", "sound", "help"] as const)
      expect(controls[action]).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it("handles disconnects, unrecognised mappings and cleanup", () => {
    const { tick, set, hook, cancelFrame } = setup();
    expect(hook.result.current).toBe("connected");
    set([]);
    tick(32);
    expect(hook.result.current).toBe("waiting");
    set([{ ...pad(), mapping: "" }]);
    tick(64);
    expect(hook.result.current).toBe("unsupported");
    hook.unmount();
    expect(cancelFrame).toHaveBeenCalled();
  });

  it("does not apply a held button when first discovering a controller", () => {
    const { controls, tick, set, hook } = setup();
    set([]);
    tick(32);
    const buttons = pad().buttons.map((button, i) => ({ ...button, pressed: i === 0 }));
    set([{ ...pad(), buttons }]);
    tick(64);
    tick(80);
    expect(controls.confirm).not.toHaveBeenCalled();
    hook.unmount();
  });
  it("ignores background input and requires release after focus returns", () => {
    const { controls, tick, set, hook } = setup();
    vi.mocked(document.hasFocus).mockReturnValue(false);
    set([{ ...pad(), axes: [1, 0] }]);
    tick(32);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    tick(64);
    expect(controls.move).not.toHaveBeenCalled();
    set([pad()]);
    tick(80);
    set([{ ...pad(), axes: [1, 0] }]);
    tick(100);
    expect(controls.move).toHaveBeenCalledTimes(1);
    hook.unmount();
  });
});
