import { useEffect, useRef, useState } from "react";
import type { Direction } from "../types";

interface Controls {
  canMove: () => boolean;
  move: (direction: Direction) => void;
  confirm: () => void;
  cancel: () => void;
  sound: () => void;
  help: () => void;
}

export const gamepadDirection = (pad: Pick<Gamepad, "buttons" | "axes">): Direction | undefined => {
  const down = (index: number) => pad.buttons[index]?.pressed;
  const x = (down(15) ? 1 : 0) - (down(14) ? 1 : 0);
  const y = (down(13) ? 1 : 0) - (down(12) ? 1 : 0);
  if (x || y) return y ? (y < 0 ? "N" : "S") : x < 0 ? "W" : "E";
  const [ax = 0, ay = 0] = pad.axes;
  if (Math.max(Math.abs(ax), Math.abs(ay)) < 0.35) return undefined;
  return Math.abs(ax) > Math.abs(ay) ? (ax < 0 ? "W" : "E") : ay < 0 ? "N" : "S";
};

export default function useGamepad(controls: Controls) {
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });
  const [status, setStatus] = useState<"waiting" | "connected" | "unsupported">("waiting");

  useEffect(() => {
    if (typeof navigator.getGamepads !== "function") {
      setStatus("unsupported");
      return;
    }
    let frame = 0;
    let identity = "";
    let previous: boolean[] = [];
    let held: Direction | undefined;
    let nextStep = 0;
    let armed = false;
    let lastStatus = "";
    const report = (next: typeof status) => {
      if (next !== lastStatus) {
        lastStatus = next;
        setStatus(next);
      }
    };
    const poll = (now: number) => {
      frame = requestAnimationFrame(poll);
      let pads: (Gamepad | null)[];
      try {
        pads = Array.from(navigator.getGamepads());
      } catch {
        report("unsupported");
        cancelAnimationFrame(frame);
        return;
      }
      const pad = pads.find((p) => p?.connected && p.mapping === "standard");
      if (!pad) {
        report(pads.some((p) => p?.connected) ? "unsupported" : "waiting");
        identity = "";
        previous = [];
        held = undefined;
        armed = false;
        return;
      }
      report("connected");
      const buttons = pad.buttons.map((button) => button.pressed);
      const key = `${pad.index}:${pad.id}`;
      if (key !== identity || document.hidden || !document.hasFocus()) {
        identity = key;
        previous = buttons;
        armed = false;
        held = undefined;
        return;
      }
      const actions = [
        [0, "confirm"],
        [1, "cancel"],
        [2, "sound"],
        [9, "help"],
      ] as const;
      for (const [index, action] of actions) {
        if (buttons[index] && !previous[index]) latest.current[action]();
      }
      previous = buttons;
      const direction = gamepadDirection(pad);
      if (!latest.current.canMove()) {
        armed = false;
        held = undefined;
        return;
      }
      if (!direction) {
        armed = true;
        held = undefined;
        return;
      }
      if (!armed) return;
      if (direction !== held || now >= nextStep) {
        latest.current.move(direction);
        nextStep = now + (direction !== held ? 320 : 180);
        held = direction;
      }
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);
  return status;
}
