import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countdownParts,
  nextGardenAt,
  startGardenCountdown,
} from "../../../src/components/client/garden-countdown";

describe("garden countdown", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("targets today's 14:00 UTC before it and tomorrow's from it onward", () => {
    expect(nextGardenAt(new Date("2026-11-13T13:59:59Z")).toISOString()).toBe(
      "2026-11-13T14:00:00.000Z",
    );
    expect(nextGardenAt(new Date("2026-11-13T14:00:00Z")).toISOString()).toBe(
      "2026-11-14T14:00:00.000Z",
    );
    expect(nextGardenAt(new Date("2026-12-31T23:00:00Z")).toISOString()).toBe(
      "2027-01-01T14:00:00.000Z",
    );
  });

  it("reads as a duration, drops empty units and never goes negative", () => {
    expect(countdownParts(3_723_000)).toEqual({
      main: "1h 02m",
      seconds: "\u200903s",
      label: "A new garden in 1 h 2 min",
    });
    expect(countdownParts(125_000)).toMatchObject({ main: "2m", seconds: "\u200905s" });
    expect(countdownParts(999)).toEqual({
      main: "",
      seconds: "1s",
      label: "A new garden in less than a minute",
    });
    expect(countdownParts(-5)).toMatchObject({ main: "", seconds: "0s" });
  });

  it("ticks every second and stops when asked", () => {
    vi.setSystemTime(new Date("2026-11-13T13:59:58Z"));
    document.body.innerHTML = '<a href="/path-of-stones/"><span data-garden-countdown></span></a>';
    const badge = document.querySelector<HTMLElement>("[data-garden-countdown]")!;
    const stop = startGardenCountdown();
    expect(badge.textContent).toBe("2s");
    expect(badge.querySelector(".header__timer-seconds")?.textContent).toBe("2s");
    expect(document.querySelector("a")!.title).toBe("A new garden in less than a minute");
    vi.advanceTimersByTime(1000);
    expect(badge.textContent).toBe("1s");
    vi.advanceTimersByTime(1000);
    expect(badge.textContent).toBe("24h 00m\u200900s");
    expect(document.querySelector("a")!.title).toBe("A new garden in 24 h 0 min");
    stop();
    vi.advanceTimersByTime(5000);
    expect(badge.textContent).toBe("24h 00m\u200900s");
  });
});
