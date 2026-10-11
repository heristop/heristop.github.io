import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_HIDE_DELAY_MS,
  AutoHide,
  clampTime,
  formatSpeed,
  formatTime,
  formatValueText,
  keyToAction,
  nextSpeed,
  sliderKeyTarget,
  timeAtPosition,
} from "../../../src/components/client/zen-video-controls";

describe("formatTime", () => {
  it("reads minutes and padded seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(7.9)).toBe("0:07");
    expect(formatTime(62)).toBe("1:02");
    expect(formatTime(599)).toBe("9:59");
  });

  it("adds hours only when there are some", () => {
    expect(formatTime(3723)).toBe("1:02:03");
  });

  it("never prints NaN for an unknown or live duration", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatTime(-4)).toBe("0:00");
  });
});

describe("formatValueText", () => {
  it("says where the playhead is out of the whole", () => {
    expect(formatValueText(12.4, 22)).toBe("0:12 of 0:22");
  });

  it("falls back to the position alone before the duration is known", () => {
    expect(formatValueText(3, Number.NaN)).toBe("0:03");
  });
});

describe("speeds", () => {
  it("cycles 0.75 → 1 → 1.25 → 1.5 → 2 → 0.75", () => {
    const seen = [0.75];
    for (let step = 0; step < 5; step += 1) {
      seen.push(nextSpeed(seen.at(-1) ?? 1));
    }
    expect(seen).toEqual([0.75, 1, 1.25, 1.5, 2, 0.75]);
  });

  it("brings an off-list rate back to normal", () => {
    expect(nextSpeed(3)).toBe(1);
  });

  it("formats with a multiplication sign", () => {
    expect(formatSpeed(1.25)).toBe("1.25×");
  });
});

describe("seeking", () => {
  it("clamps to the clip", () => {
    expect(clampTime(-2, 22)).toBe(0);
    expect(clampTime(30, 22)).toBe(22);
    expect(clampTime(Number.NaN, 22)).toBe(0);
    expect(clampTime(5, Number.NaN)).toBe(0);
  });

  it("maps a pointer on the track to a time", () => {
    expect(timeAtPosition(150, 100, 200, 20)).toBe(5);
    expect(timeAtPosition(50, 100, 200, 20)).toBe(0);
    expect(timeAtPosition(400, 100, 200, 20)).toBe(20);
    expect(timeAtPosition(150, 100, 0, 20)).toBe(0);
  });

  it("moves the scrubber by 5s on arrows, 10s on page keys, to the ends on Home/End", () => {
    expect(sliderKeyTarget("ArrowRight", 10, 22)).toBe(15);
    expect(sliderKeyTarget("ArrowUp", 10, 22)).toBe(15);
    expect(sliderKeyTarget("ArrowLeft", 10, 22)).toBe(5);
    expect(sliderKeyTarget("ArrowDown", 3, 22)).toBe(0);
    expect(sliderKeyTarget("ArrowRight", 20, 22)).toBe(22);
    expect(sliderKeyTarget("PageUp", 0, 22)).toBe(10);
    expect(sliderKeyTarget("PageDown", 15, 22)).toBe(5);
    expect(sliderKeyTarget("Home", 15, 22)).toBe(0);
    expect(sliderKeyTarget("End", 0, 22)).toBe(22);
    expect(sliderKeyTarget("Enter", 0, 22)).toBeNull();
  });
});

describe("keyToAction", () => {
  const plain = { onButton: false, ownsArrows: false };
  const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers,
  });

  it("maps Space/K, ←/→, M and F", () => {
    expect(keyToAction(press(" "), plain)).toBe("toggle-play");
    expect(keyToAction(press("k"), plain)).toBe("toggle-play");
    expect(keyToAction(press("K"), plain)).toBe("toggle-play");
    expect(keyToAction(press("ArrowLeft"), plain)).toBe("seek-back");
    expect(keyToAction(press("ArrowRight"), plain)).toBe("seek-forward");
    expect(keyToAction(press("m"), plain)).toBe("toggle-mute");
    expect(keyToAction(press("f"), plain)).toBe("fullscreen");
    expect(keyToAction(press("x"), plain)).toBeNull();
  });

  it("lets Space press a focused button instead of playing", () => {
    expect(keyToAction(press(" "), { onButton: true, ownsArrows: false })).toBeNull();
    expect(keyToAction(press("k"), { onButton: true, ownsArrows: false })).toBe("toggle-play");
  });

  it("leaves the arrows to a control that uses them (the volume range)", () => {
    expect(keyToAction(press("ArrowLeft"), { onButton: false, ownsArrows: true })).toBeNull();
    expect(keyToAction(press("ArrowRight"), { onButton: false, ownsArrows: true })).toBeNull();
  });

  it("ignores modified keys (browser and screen reader shortcuts)", () => {
    expect(keyToAction(press("f", { metaKey: true }), plain)).toBeNull();
    expect(keyToAction(press("ArrowLeft", { altKey: true }), plain)).toBeNull();
    expect(keyToAction(press("k", { ctrlKey: true }), plain)).toBeNull();
  });
});

describe("AutoHide", () => {
  let changes: boolean[];
  let hide: AutoHide;

  beforeEach(() => {
    vi.useFakeTimers();
    changes = [];
    hide = new AutoHide((visible) => changes.push(visible));
  });

  afterEach(() => {
    hide.dispose();
    vi.useRealTimers();
  });

  it("starts visible and stays so while paused", () => {
    expect(hide.visible).toBe(true);
    hide.poke();
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);
    expect(hide.visible).toBe(true);
    expect(changes).toEqual([]);
  });

  it("hides after 2.5s of playback without a pointer", () => {
    hide.setPlaying(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 1);
    expect(hide.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(hide.visible).toBe(false);
    expect(changes).toEqual([false]);
  });

  it("comes back on a poke and restarts the quiet spell", () => {
    hide.setPlaying(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
    hide.poke();
    expect(hide.visible).toBe(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 100);
    hide.poke();
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 100);
    expect(hide.visible).toBe(true);
    vi.advanceTimersByTime(100);
    expect(hide.visible).toBe(false);
    expect(changes).toEqual([false, true, false]);
  });

  it("shows at once on pause", () => {
    hide.setPlaying(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
    hide.setPlaying(false);
    expect(hide.visible).toBe(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);
    expect(hide.visible).toBe(true);
  });

  it("holds while pinned (focus, hover, scrubbing) and resumes the timer after", () => {
    hide.setPlaying(true);
    hide.pin("focus", true);
    hide.pin("scrub", true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);
    expect(hide.visible).toBe(true);
    hide.pin("scrub", false);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);
    expect(hide.visible).toBe(true);
    hide.pin("focus", false);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
    expect(hide.visible).toBe(false);
  });

  it("hides immediately on request while playing, never while paused or pinned", () => {
    hide.hideNow();
    expect(hide.visible).toBe(true);
    hide.setPlaying(true);
    hide.pin("focus", true);
    hide.hideNow();
    expect(hide.visible).toBe(true);
    hide.pin("focus", false);
    hide.hideNow();
    expect(hide.visible).toBe(false);
  });

  it("ignores unpinning a reason that was never pinned", () => {
    hide.setPlaying(true);
    vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 1);
    hide.pin("hover", false);
    vi.advanceTimersByTime(1);
    expect(hide.visible).toBe(false);
  });
});
