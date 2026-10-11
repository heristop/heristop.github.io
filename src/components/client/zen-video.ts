/* Article video player. Progressive enhancement over the <video> tags written in markdown: with
   no script they keep their native controls; with it, each one is wrapped in a calm overlay
   player (styles in _video-player.scss). Autoplay and loop stay exactly as authored: the play-on-
   view clips are still driven by [...slug].astro, this only follows what the element does. */

import {
  AutoHide,
  clampTime,
  formatSpeed,
  formatTime,
  formatValueText,
  keyToAction,
  nextSpeed,
  SEEK_STEP,
  sliderKeyTarget,
  timeAtPosition,
} from "./zen-video-controls";

const SELECTOR = ".post-page video";

// A stall shorter than this resolves before a spinner could mean anything
const BUFFERING_DELAY_MS = 250;

// A play that follows a reader's gesture this closely was theirs; anything later started itself
const GESTURE_WINDOW_MS = 1000;

type IconName =
  | "play"
  | "pause"
  | "volume-2"
  | "volume-x"
  | "maximize"
  | "minimize"
  | "picture-in-picture"
  | "captions"
  | "captions-off"
  | "rotate-ccw"
  | "triangle-alert";

interface WebkitVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
}

interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
}

const icon = (name: IconName): Element => {
  const template = document.querySelector<HTMLTemplateElement>("#zen-video-icons");
  const glyph = template?.content.querySelector(`[data-icon="${name}"] svg`);
  if (glyph) {
    return glyph.cloneNode(true) as Element;
  }
  // The template ships with every article; an empty span keeps the button usable by its name
  const fallback = document.createElement("span");
  fallback.setAttribute("aria-hidden", "true");
  return fallback;
};

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
};

const button = (className: string, label: string, glyph?: IconName): HTMLButtonElement => {
  // The disc is its own shape; every other control shares the bar's button
  const classes = className === "zen-video__disc" ? className : `zen-video__button ${className}`;
  const node = element("button", classes, { type: "button", "aria-label": label });
  if (glyph) {
    node.append(icon(glyph));
  }
  return node;
};

const setIcon = (target: HTMLElement, glyph: IconName): void => {
  target.replaceChildren(icon(glyph));
};

const fullscreenSupported = (video: WebkitVideo): boolean =>
  Boolean(document.fullscreenEnabled || (document as WebkitDocument).webkitFullscreenEnabled) ||
  typeof video.webkitEnterFullscreen === "function";

const pictureInPictureSupported = (video: HTMLVideoElement): boolean =>
  "pictureInPictureEnabled" in document &&
  document.pictureInPictureEnabled &&
  !video.disablePictureInPicture &&
  typeof video.requestPictureInPicture === "function";

const captionTracks = (video: HTMLVideoElement): TextTrack[] =>
  [...video.textTracks].filter(({ kind }) => kind === "captions" || kind === "subtitles");

const enhance = (video: WebkitVideo, signal: AbortSignal): void => {
  const label = video.getAttribute("aria-label")?.trim() || "Video";
  const authoredStyle = video.getAttribute("style");
  const hadControls = video.hasAttribute("controls");

  /* ── Structure ── */
  const root = element("div", "zen-video", {
    role: "group",
    "aria-label": `${label}, video player`,
    "data-state": "idle",
    "data-controls": "visible",
  });
  // The wrapper takes the clip's place in the layout: its sizing classes, width and radius
  for (const name of video.classList) {
    if (name !== "post-video") {
      root.classList.add(name);
    }
  }
  if (video.style.width) {
    root.style.width = video.style.width;
  }
  if (video.style.maxWidth) {
    root.style.maxWidth = video.style.maxWidth;
  }
  if (video.style.borderRadius) {
    root.style.setProperty("--zen-video-radius", video.style.borderRadius);
  }

  const veil = element("div", "zen-video__veil", { "aria-hidden": "true" });
  const disc = button("zen-video__disc", "Play", "play");
  const chip = element("span", "zen-video__chip", { "aria-hidden": "true" });
  const spinner = element("span", "zen-video__spinner", { "aria-hidden": "true" });

  const error = element("div", "zen-video__error");
  error.hidden = true;
  const errorText = element("p", "zen-video__error-text");
  errorText.textContent = "This clip couldn’t be loaded.";
  const retry = button("zen-video__retry", "Try again", "rotate-ccw");
  retry.append(document.createTextNode("Try again"));
  retry.removeAttribute("aria-label");
  error.append(icon("triangle-alert"), errorText, retry);

  const bar = element("div", "zen-video__bar");
  const scrubber = element("div", "zen-video__scrubber", {
    role: "slider",
    tabindex: "0",
    "aria-label": "Seek",
    "aria-valuemin": "0",
    "aria-valuemax": "0",
    "aria-valuenow": "0",
    "aria-valuetext": "0:00",
  });
  const track = element("span", "zen-video__track", { "aria-hidden": "true" });
  const buffered = element("span", "zen-video__buffered");
  const played = element("span", "zen-video__played");
  // The head rides a rail as wide as the track, so it moves by transform alone
  const rail = element("span", "zen-video__rail", { "aria-hidden": "true" });
  rail.append(element("span", "zen-video__playhead"));
  track.append(buffered, played);
  scrubber.append(track, rail);

  const row = element("div", "zen-video__row");
  const mute = button("zen-video__mute", "Mute", "volume-2");
  const volume = element("input", "zen-video__volume", {
    type: "range",
    min: "0",
    max: "1",
    step: "0.05",
    "aria-label": "Volume",
  });
  const time = element("span", "zen-video__time", { "aria-hidden": "true" });
  const current = element("span", "zen-video__current");
  const totalLabel = element("span", "zen-video__total");
  current.textContent = "0:00";
  totalLabel.textContent = "0:00";
  time.append(current, document.createTextNode(" / "), totalLabel);
  const spacer = element("span", "zen-video__spacer");
  const speed = button("zen-video__speed", "Playback speed: 1×");
  speed.textContent = formatSpeed(1);
  speed.setAttribute("aria-label", "Playback speed: 1×");

  row.append(mute, volume, time, spacer, speed);

  const tracks = video.querySelector("track") ? captionTracks(video) : [];
  const captions =
    tracks.length > 0 ? button("zen-video__captions", "Captions", "captions-off") : undefined;
  if (captions) {
    row.append(captions);
  }
  const pip = pictureInPictureSupported(video)
    ? button("zen-video__pip", "Picture in picture", "picture-in-picture")
    : undefined;
  if (pip) {
    row.append(pip);
  }
  const fullscreen = fullscreenSupported(video)
    ? button("zen-video__fullscreen", "Full screen", "maximize")
    : undefined;
  if (fullscreen) {
    row.append(fullscreen);
  }
  bar.append(scrubber, row);

  const live = element("span", "sr-only", { "aria-live": "polite", "aria-atomic": "true" });

  video.before(root);
  root.append(video, veil, chip, spinner, disc, error, bar, live);
  video.removeAttribute("controls");
  video.removeAttribute("style");

  /* ── State ── */
  let lastGesture = 0;
  let lastPointer = "mouse";
  let frame = 0;
  let bufferingTimer: ReturnType<typeof setTimeout> | undefined;
  let scrubbing = false;
  let announceTimer: ReturnType<typeof setTimeout> | undefined;

  const autoHide = new AutoHide((visible) => {
    root.dataset.controls = visible ? "visible" : "hidden";
  });

  const announce = (message: string): void => {
    // Cleared first so the same words twice ("Muted", "Muted") are still read
    live.textContent = "";
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      live.textContent = message;
    }, 60);
  };

  const gesture = (): void => {
    lastGesture = performance.now();
    autoHide.poke();
  };

  const duration = (): number => (Number.isFinite(video.duration) ? video.duration : 0);

  const paintProgress = (at = video.currentTime): void => {
    const total = duration();
    const fraction = total > 0 ? clampTime(at, total) / total : 0;
    // Set on the scrubber, not the root: a custom property restyles its whole subtree every frame
    scrubber.style.setProperty("--zen-video-progress", String(fraction));
  };

  const paintBuffered = (): void => {
    const total = duration();
    let end = 0;
    for (let index = 0; index < video.buffered.length; index += 1) {
      if (video.buffered.start(index) <= video.currentTime + 0.5) {
        end = Math.max(end, video.buffered.end(index));
      }
    }
    scrubber.style.setProperty(
      "--zen-video-buffered",
      String(total > 0 ? Math.min(end / total, 1) : 0),
    );
  };

  const paintTime = (): void => {
    const now = video.currentTime;
    current.textContent = formatTime(now);
    scrubber.setAttribute("aria-valuenow", String(Math.floor(now)));
    scrubber.setAttribute("aria-valuetext", formatValueText(now, duration()));
  };

  const paintDuration = (): void => {
    const total = duration();
    chip.hidden = total === 0;
    chip.textContent = formatTime(total);
    totalLabel.textContent = formatTime(total);
    scrubber.setAttribute("aria-valuemax", String(Math.floor(total)));
    paintTime();
    paintProgress();
  };

  // The playhead glides on the display clock while playing; timeupdate alone ticks ~4×/s
  const tick = (): void => {
    if (!scrubbing) {
      paintProgress();
    }
    frame = video.paused ? 0 : requestAnimationFrame(tick);
  };

  const paintPlayState = (): void => {
    const playing = !video.paused && !video.ended;
    setIcon(disc, playing ? "pause" : "play");
    disc.setAttribute("aria-label", playing ? "Pause" : "Play");
  };

  const paintMute = (): void => {
    const silent = video.muted || video.volume === 0;
    setIcon(mute, silent ? "volume-x" : "volume-2");
    mute.setAttribute("aria-pressed", String(video.muted));
    volume.value = String(video.muted ? 0 : video.volume);
    volume.setAttribute("aria-valuetext", `${Math.round(Number(volume.value) * 100)}%`);
  };

  const paintSpeed = (): void => {
    const text = formatSpeed(video.playbackRate);
    speed.textContent = text;
    speed.setAttribute("aria-label", `Playback speed: ${text}`);
  };

  const paintCaptions = (): void => {
    if (!captions) {
      return;
    }
    const on = tracks.some(({ mode }) => mode === "showing");
    setIcon(captions, on ? "captions" : "captions-off");
    captions.setAttribute("aria-pressed", String(on));
  };

  const setBuffering = (on: boolean): void => {
    clearTimeout(bufferingTimer);
    if (on) {
      bufferingTimer = setTimeout(() => {
        root.dataset.buffering = "";
      }, BUFFERING_DELAY_MS);
    } else {
      delete root.dataset.buffering;
    }
  };

  const showError = (): void => {
    setBuffering(false);
    root.dataset.state = "error";
    error.hidden = false;
    announce("This clip couldn’t be loaded.");
  };

  /* ── Actions ── */
  const togglePlay = (): void => {
    if (video.paused || video.ended) {
      void video.play().catch(() => {
        // A refused play (autoplay policy, a source that failed) leaves the paused state as is
        paintPlayState();
      });
    } else {
      video.pause();
    }
  };

  const seekTo = (target: number): void => {
    const at = clampTime(target, duration());
    video.currentTime = at;
    paintProgress(at);
    paintTime();
  };

  const toggleMute = (): void => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) {
        video.volume = 0.5;
      }
      announce("Sound on");
    } else {
      video.muted = true;
      announce("Muted");
    }
  };

  const toggleFullscreen = (): void => {
    if (!fullscreen) {
      return;
    }
    if (document.fullscreenElement === root) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    const nativeFallback = (): void => {
      if (typeof video.webkitEnterFullscreen === "function") {
        video.webkitEnterFullscreen();
      } else {
        announce("Full screen isn’t available here");
      }
    };
    if (typeof root.requestFullscreen === "function" && document.fullscreenEnabled) {
      root.requestFullscreen().catch(nativeFallback);
    } else {
      nativeFallback();
    }
  };

  const togglePictureInPicture = (): void => {
    if (document.pictureInPictureElement === video) {
      void document.exitPictureInPicture().catch(() => {});
      return;
    }
    video.requestPictureInPicture().catch(() => {
      announce("Picture in picture isn’t available right now");
    });
  };

  const toggleCaptions = (): void => {
    const on = !tracks.some(({ mode }) => mode === "showing");
    tracks.forEach((track, index) => {
      track.mode = on && index === 0 ? "showing" : "hidden";
    });
    paintCaptions();
    announce(on ? "Captions on" : "Captions off");
  };

  /* ── Video events ── */
  const on = <K extends keyof HTMLVideoElementEventMap>(
    type: K,
    listener: (event: HTMLVideoElementEventMap[K]) => void,
  ): void => {
    video.addEventListener(type, listener, { signal });
  };

  on("play", () => {
    root.dataset.state = "playing";
    error.hidden = true;
    paintPlayState();
    autoHide.setPlaying(true);
    // A clip that started itself (play-on-view) keeps its picture clear
    if (performance.now() - lastGesture > GESTURE_WINDOW_MS) {
      autoHide.hideNow();
    }
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  });
  on("pause", () => {
    if (root.dataset.state !== "error") {
      root.dataset.state = video.ended ? "ended" : "paused";
    }
    paintPlayState();
    setBuffering(false);
    autoHide.setPlaying(false);
    paintProgress();
  });
  on("ended", () => {
    root.dataset.state = "ended";
    paintPlayState();
    autoHide.setPlaying(false);
  });
  on("timeupdate", () => {
    paintTime();
    if (video.paused) {
      paintProgress();
    }
  });
  on("seeked", () => {
    paintTime();
    paintProgress();
  });
  on("durationchange", paintDuration);
  on("loadedmetadata", paintDuration);
  on("progress", paintBuffered);
  on("waiting", () => {
    setBuffering(true);
  });
  for (const type of ["playing", "canplay", "seeked"] as const) {
    on(type, () => {
      setBuffering(false);
    });
  }
  on("volumechange", paintMute);
  on("ratechange", paintSpeed);
  on("error", showError);
  // A <source> that fails reports on itself; the last one failing means nothing will play
  const sources = video.querySelectorAll("source");
  sources[sources.length - 1]?.addEventListener("error", showError, { signal });
  on("enterpictureinpicture", () => {
    pip?.setAttribute("aria-label", "Exit picture in picture");
    root.dataset.pip = "";
  });
  on("leavepictureinpicture", () => {
    pip?.setAttribute("aria-label", "Picture in picture");
    delete root.dataset.pip;
  });

  document.addEventListener(
    "fullscreenchange",
    () => {
      if (!fullscreen) {
        return;
      }
      const active = document.fullscreenElement === root;
      root.toggleAttribute("data-fullscreen", active);
      setIcon(fullscreen, active ? "minimize" : "maximize");
      fullscreen.setAttribute("aria-label", active ? "Exit full screen" : "Full screen");
    },
    { signal },
  );

  /* ── Pointer ── */
  root.addEventListener(
    "pointerdown",
    (event) => {
      lastPointer = event.pointerType;
    },
    { signal, capture: true },
  );
  root.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType === "mouse") {
        autoHide.poke();
      }
    },
    { signal },
  );
  root.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType === "mouse") {
        autoHide.hideNow();
      }
    },
    { signal },
  );
  bar.addEventListener(
    "pointerenter",
    (event) => {
      if (event.pointerType === "mouse") {
        autoHide.pin("hover", true);
      }
    },
    { signal },
  );
  bar.addEventListener(
    "pointerleave",
    () => {
      autoHide.pin("hover", false);
    },
    { signal },
  );

  /* The picture itself is the big button. On touch, the first tap on a playing clip only brings
     the controls back (the finger cannot hover); the next one plays or pauses. */
  const surfaceClick = (): void => {
    if (root.dataset.state === "error") {
      return;
    }
    if (lastPointer === "touch" && !autoHide.visible) {
      gesture();
      return;
    }
    gesture();
    togglePlay();
  };
  video.addEventListener("click", surfaceClick, { signal });
  veil.addEventListener("click", surfaceClick, { signal });

  disc.addEventListener(
    "click",
    () => {
      gesture();
      togglePlay();
    },
    { signal },
  );
  mute.addEventListener(
    "click",
    () => {
      gesture();
      toggleMute();
    },
    { signal },
  );
  volume.addEventListener(
    "input",
    () => {
      const level = Number(volume.value);
      video.volume = level;
      video.muted = level === 0;
      autoHide.poke();
    },
    { signal },
  );
  speed.addEventListener(
    "click",
    () => {
      gesture();
      video.playbackRate = nextSpeed(video.playbackRate);
      announce(`Speed ${formatSpeed(video.playbackRate)}`);
    },
    { signal },
  );
  captions?.addEventListener(
    "click",
    () => {
      gesture();
      toggleCaptions();
    },
    { signal },
  );
  pip?.addEventListener(
    "click",
    () => {
      gesture();
      togglePictureInPicture();
    },
    { signal },
  );
  fullscreen?.addEventListener(
    "click",
    () => {
      gesture();
      toggleFullscreen();
    },
    { signal },
  );
  retry.addEventListener(
    "click",
    () => {
      error.hidden = true;
      root.dataset.state = "idle";
      video.load();
      disc.focus();
    },
    { signal },
  );

  /* Scrubbing: 1:1 under the finger from the first touch, captured so it survives leaving the
     track; seeks are coalesced to one per frame */
  let pendingSeek: number | undefined;
  let seekFrame = 0;
  const scrubTo = (clientX: number): void => {
    const rect = track.getBoundingClientRect();
    const at = timeAtPosition(clientX, rect.left, rect.width, duration());
    paintProgress(at);
    current.textContent = formatTime(at);
    pendingSeek = at;
    if (seekFrame === 0) {
      seekFrame = requestAnimationFrame(() => {
        seekFrame = 0;
        if (pendingSeek !== undefined) {
          video.currentTime = pendingSeek;
          pendingSeek = undefined;
        }
      });
    }
  };
  scrubber.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || duration() === 0) {
        return;
      }
      scrubbing = true;
      scrubber.setPointerCapture(event.pointerId);
      root.dataset.scrubbing = "";
      autoHide.pin("scrub", true);
      scrubTo(event.clientX);
    },
    { signal },
  );
  scrubber.addEventListener(
    "pointermove",
    (event) => {
      if (scrubbing) {
        scrubTo(event.clientX);
      }
    },
    { signal },
  );
  const endScrub = (): void => {
    if (!scrubbing) {
      return;
    }
    scrubbing = false;
    delete root.dataset.scrubbing;
    autoHide.pin("scrub", false);
    gesture();
  };
  scrubber.addEventListener("pointerup", endScrub, { signal });
  scrubber.addEventListener("pointercancel", endScrub, { signal });

  /* ── Keyboard: focus inside the player owns these keys, arrows included, so the article's
     ←/→ post navigation (arrow-nav-guard.ts) leaves them alone ── */
  root.addEventListener(
    "keydown",
    (event) => {
      if (root.dataset.state === "error") {
        return;
      }
      const target = event.target as HTMLElement;
      if (target === scrubber && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const at = sliderKeyTarget(event.key, video.currentTime, duration());
        if (at !== null) {
          event.preventDefault();
          gesture();
          seekTo(at);
          return;
        }
      }
      const action = keyToAction(event, {
        onButton: target instanceof HTMLButtonElement,
        ownsArrows: target === volume,
      });
      if (action === null) {
        autoHide.poke();
        return;
      }
      event.preventDefault();
      gesture();
      switch (action) {
        case "toggle-play": {
          togglePlay();
          break;
        }
        case "seek-back": {
          seekTo(video.currentTime - SEEK_STEP);
          break;
        }
        case "seek-forward": {
          seekTo(video.currentTime + SEEK_STEP);
          break;
        }
        case "toggle-mute": {
          toggleMute();
          break;
        }
        case "fullscreen": {
          toggleFullscreen();
          break;
        }
      }
    },
    { signal },
  );

  // Keyboard focus holds the controls on screen; a mouse click that leaves focus on a button does not
  root.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as HTMLElement;
      autoHide.pin("focus", target.matches(":focus-visible"));
    },
    { signal },
  );
  root.addEventListener(
    "focusout",
    (event) => {
      if (!root.contains(event.relatedTarget as Node | null)) {
        autoHide.pin("focus", false);
      }
    },
    { signal },
  );

  /* ── First paint, then teardown on the next swap ── */
  paintDuration();
  paintBuffered();
  paintMute();
  paintSpeed();
  paintCaptions();
  if (!video.paused) {
    root.dataset.state = "playing";
    paintPlayState();
    autoHide.setPlaying(true);
    autoHide.hideNow();
    frame = requestAnimationFrame(tick);
  }
  if (video.error) {
    showError();
  }

  signal.addEventListener(
    "abort",
    () => {
      autoHide.dispose();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(seekFrame);
      clearTimeout(bufferingTimer);
      clearTimeout(announceTimer);
      // Hand the page back as it was written, should the same document be enhanced again
      if (root.isConnected) {
        root.before(video);
        root.remove();
        if (authoredStyle !== null) {
          video.setAttribute("style", authoredStyle);
        }
        if (hadControls) {
          video.setAttribute("controls", "");
        }
      }
    },
    { once: true },
  );
};

export const initZenVideos = (signal: AbortSignal): void => {
  for (const video of document.querySelectorAll<HTMLVideoElement>(SELECTOR)) {
    if (!video.closest(".zen-video")) {
      enhance(video, signal);
    }
  }
};
