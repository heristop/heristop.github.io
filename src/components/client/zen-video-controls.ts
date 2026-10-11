/* Article video player: the parts that decide, kept free of the DOM so they can be pinned down in
   tests. zen-video.ts wires them to the <video> and its controls. Times are in seconds. */

export const SEEK_STEP = 5;
export const SEEK_PAGE_STEP = 10;
export const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

// Long enough to read the time after a glance, short enough to give the picture back
export const AUTO_HIDE_DELAY_MS = 2500;

const pad = (value: number): string => String(value).padStart(2, "0");

/* 0:07, 1:02, 1:02:03. Unknown or live durations read as 0:00 rather than NaN:NaN */
export const formatTime = (seconds: number): string => {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
};

/* What the scrubber says to a screen reader: "0:12 of 0:22" */
export const formatValueText = (current: number, duration: number): string =>
  Number.isFinite(duration) && duration > 0
    ? `${formatTime(current)} of ${formatTime(duration)}`
    : formatTime(current);

export const formatSpeed = (rate: number): string => `${rate}×`;

/* The next speed in the cycle; an off-list rate (set elsewhere) rejoins at normal speed */
export const nextSpeed = (rate: number): number => {
  const index = SPEEDS.indexOf(rate as (typeof SPEEDS)[number]);
  return index === -1 ? 1 : SPEEDS[(index + 1) % SPEEDS.length];
};

export const clampTime = (time: number, duration: number): number => {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (!Number.isFinite(time)) {
    return 0;
  }
  return Math.min(Math.max(time, 0), end);
};

/* Pointer → time: the fraction of the track under the finger, clamped to the track */
export const timeAtPosition = (x: number, left: number, width: number, duration: number): number =>
  width > 0 ? clampTime(((x - left) / width) * duration, duration) : 0;

/* Where a key on the scrubber moves the playhead, or null when the key is not the slider's */
export const sliderKeyTarget = (key: string, current: number, duration: number): number | null => {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown": {
      return clampTime(current - SEEK_STEP, duration);
    }
    case "ArrowRight":
    case "ArrowUp": {
      return clampTime(current + SEEK_STEP, duration);
    }
    case "PageDown": {
      return clampTime(current - SEEK_PAGE_STEP, duration);
    }
    case "PageUp": {
      return clampTime(current + SEEK_PAGE_STEP, duration);
    }
    case "Home": {
      return 0;
    }
    case "End": {
      return clampTime(duration, duration);
    }
    default: {
      return null;
    }
  }
};

export type PlayerAction =
  | "toggle-play"
  | "seek-back"
  | "seek-forward"
  | "toggle-mute"
  | "fullscreen";

export interface KeyContext {
  /* Focus is on a control that answers Space/Enter itself (a button) */
  onButton: boolean;
  /* Focus is on a control that answers the arrows itself (the volume range) */
  ownsArrows: boolean;
}

/* The player's shortcuts while focus is inside it. Space plays and pauses unless a button has
   focus, which Space presses instead; modified keys stay with the browser and assistive tech. */
export const keyToAction = (
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
  context: KeyContext,
): PlayerAction | null => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  switch (event.key) {
    case " ": {
      return context.onButton ? null : "toggle-play";
    }
    case "k":
    case "K": {
      return "toggle-play";
    }
    case "ArrowLeft": {
      return context.ownsArrows ? null : "seek-back";
    }
    case "ArrowRight": {
      return context.ownsArrows ? null : "seek-forward";
    }
    case "m":
    case "M": {
      return "toggle-mute";
    }
    case "f":
    case "F": {
      return "fullscreen";
    }
    default: {
      return null;
    }
  }
};

type Timers = Pick<typeof globalThis, "setTimeout" | "clearTimeout">;

/* Controls fade after a quiet spell of playback and come back on any sign of the reader. They
   stay while paused, and while anything pins them (keyboard focus, a pointer on the bar, a drag
   on the scrubber). onChange fires only when visibility actually flips. */
export class AutoHide {
  #visible = true;
  #playing = false;
  #pins = new Set<string>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #delay: number;
  readonly #onChange: (visible: boolean) => void;
  readonly #timers: Timers;

  constructor(
    onChange: (visible: boolean) => void,
    delay = AUTO_HIDE_DELAY_MS,
    timers: Timers = globalThis,
  ) {
    this.#onChange = onChange;
    this.#delay = delay;
    this.#timers = timers;
  }

  get visible(): boolean {
    return this.#visible;
  }

  /* The reader moved, tapped or pressed a key: show, and restart the quiet spell */
  poke(): void {
    this.#set(true);
    this.#schedule();
  }

  /* Hide now if nothing holds the controls (a clip that started on its own, a second tap) */
  hideNow(): void {
    this.#cancel();
    if (this.#playing && this.#pins.size === 0) {
      this.#set(false);
    }
  }

  setPlaying(playing: boolean): void {
    this.#playing = playing;
    if (playing) {
      this.#schedule();
    } else {
      this.#cancel();
      this.#set(true);
    }
  }

  pin(reason: string, pinned: boolean): void {
    if (pinned) {
      this.#pins.add(reason);
      this.#cancel();
      this.#set(true);
    } else if (this.#pins.delete(reason)) {
      this.#schedule();
    }
  }

  dispose(): void {
    this.#cancel();
  }

  #schedule(): void {
    this.#cancel();
    if (!this.#playing || this.#pins.size > 0) {
      return;
    }
    this.#timer = this.#timers.setTimeout(() => {
      this.#timer = undefined;
      this.#set(false);
    }, this.#delay);
  }

  #cancel(): void {
    if (this.#timer !== undefined) {
      this.#timers.clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  #set(visible: boolean): void {
    if (visible !== this.#visible) {
      this.#visible = visible;
      this.#onChange(visible);
    }
  }
}
