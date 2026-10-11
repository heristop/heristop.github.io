import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mayNavigateWithArrows } from "../../../src/components/client/arrow-nav-guard";
import { initZenVideos } from "../../../src/components/client/zen-video";

let controller: AbortController;
let video: HTMLVideoElement;

const query = <T extends Element>(selector: string): T => {
  const found = document.querySelector<T>(selector);
  if (found === null) {
    throw new Error(selector);
  }
  return found;
};

const key = (target: Element, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

beforeEach(() => {
  let paused = true;
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(22);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  document.body.innerHTML = `
    <div class="post-page">
      <figure class="img-figure">
        <video controls loop playsinline aria-label="Deck demo" style="width: 100%; border-radius: 0.5rem;">
          <source src="/demo.mp4" type="video/mp4" />
        </video>
        <figcaption>Caption</figcaption>
      </figure>
    </div>`;
  video = query<HTMLVideoElement>("video");
  controller = new AbortController();
  initZenVideos(controller.signal);
});

afterEach(() => {
  controller.abort();
  vi.restoreAllMocks();
});

describe("initZenVideos", () => {
  it("wraps the clip in a labelled player and drops the native controls", () => {
    const root = query<HTMLElement>(".zen-video");
    expect(root.getAttribute("role")).toBe("group");
    expect(root.getAttribute("aria-label")).toBe("Deck demo, video player");
    expect(root.dataset.state).toBe("idle");
    expect(root.style.width).toBe("100%");
    expect(root.style.getPropertyValue("--zen-video-radius")).toBe("0.5rem");
    expect(video.parentElement).toBe(root);
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.getAttribute("aria-label")).toBe("Deck demo");
  });

  it("exposes a seek slider with spoken time", () => {
    video.dispatchEvent(new Event("durationchange"));
    const slider = query<HTMLElement>("[role='slider']");
    expect(slider.getAttribute("aria-valuemax")).toBe("22");
    expect(slider.getAttribute("aria-valuetext")).toBe("0:00 of 0:22");
  });

  it("offers captions only when a track exists", () => {
    expect(document.querySelector(".zen-video__captions")).toBeNull();
  });

  it("plays and pauses from the disc, keeping its name in step", () => {
    const disc = query<HTMLButtonElement>(".zen-video__disc");
    expect(disc.getAttribute("aria-label")).toBe("Play");
    disc.click();
    expect(query<HTMLElement>(".zen-video").dataset.state).toBe("playing");
    expect(disc.getAttribute("aria-label")).toBe("Pause");
    disc.click();
    expect(query<HTMLElement>(".zen-video").dataset.state).toBe("paused");
  });

  it("toggles mute with M and reports it as pressed", () => {
    const slider = query<HTMLElement>("[role='slider']");
    key(slider, { key: "m" });
    video.dispatchEvent(new Event("volumechange"));
    expect(video.muted).toBe(true);
    expect(query(".zen-video__mute").getAttribute("aria-pressed")).toBe("true");
  });

  it("seeks 5s with the arrows and keeps them from the article navigation", () => {
    const slider = query<HTMLElement>("[role='slider']");
    slider.focus();
    const event = key(slider, { key: "ArrowRight" });
    expect(event.defaultPrevented).toBe(true);
    expect(video.currentTime).toBe(5);
    expect(mayNavigateWithArrows(event, slider)).toBe(false);

    const mute = query<HTMLButtonElement>(".zen-video__mute");
    const fresh = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    expect(mayNavigateWithArrows(fresh, mute)).toBe(false);
  });

  it("cycles the speed and announces it", () => {
    vi.useFakeTimers();
    const speed = query<HTMLButtonElement>(".zen-video__speed");
    speed.click();
    video.dispatchEvent(new Event("ratechange"));
    expect(video.playbackRate).toBe(1.25);
    expect(speed.getAttribute("aria-label")).toBe("Playback speed: 1.25×");
    vi.advanceTimersByTime(100);
    expect(query("[aria-live='polite']").textContent).toBe("Speed 1.25×");
    vi.useRealTimers();
  });

  it("hands the markup back on teardown", () => {
    controller.abort();
    expect(document.querySelector(".zen-video")).toBeNull();
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.getAttribute("style")).toContain("border-radius");
  });

  it("does not wrap a clip twice", () => {
    initZenVideos(controller.signal);
    expect(document.querySelectorAll(".zen-video")).toHaveLength(1);
  });
});
