/* The garden is rebuilt from the day's activity once a day by the deploy workflow. It is
   scheduled for 05:00 UTC, but GitHub starts scheduled runs late: over 23 runs from
   22 October to 13 November 2026 they finished between 09:23 and 13:42 UTC. Counting to
   14:00 means the countdown never reaches zero before the new garden is live; on most days
   the garden is a little early. Keep in step with GARDEN_REFRESH_HOUR_UTC in the game's
   progression/walks.ts. */
export const GARDEN_REFRESH_HOUR_UTC = 14;

const SELECTOR = "[data-garden-countdown]";

/** The next refresh strictly after `now`. */
export const nextGardenAt = (now: Date): Date => {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), GARDEN_REFRESH_HOUR_UTC),
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
};

export interface CountdownParts {
  /** The leading units, which carry the reading: "3h 28m", "28m", or "" in the last minute. */
  main: string;
  /** The ticking seconds, set quieter beside the main part. */
  seconds: string;
  /** The same time in words, for the link's tooltip. */
  label: string;
}

/**
 * Units rather than a clock face: "03:28:39" above a nav link reads as a time of day, while
 * "3h 28m 39s" can only be a duration. Rounded up, so it reaches 0s exactly at the refresh.
 */
export const countdownParts = (milliseconds: number): CountdownParts => {
  const total = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  const main = hours > 0 ? `${hours}h ${pad(minutes)}m` : minutes > 0 ? `${minutes}m` : "";
  const words =
    hours > 0 ? `${hours} h ${minutes} min` : minutes > 0 ? `${minutes} min` : "less than a minute";
  return {
    main,
    seconds: `${main ? "\u2009" : ""}${main ? pad(seconds) : seconds}s`,
    label: `A new garden in ${words}`,
  };
};

let stop: (() => void) | undefined;

/** Starts one shared ticker for every countdown on the page; returns its stop function. */
export const startGardenCountdown = (doc: Document = document): (() => void) => {
  stop?.();
  const targets = [...doc.querySelectorAll<HTMLElement>(SELECTOR)];
  if (targets.length === 0) {
    stop = undefined;
    return () => {};
  }
  const render = (): void => {
    // A hidden tab has nobody to read the seconds; the next visible tick catches up.
    if (doc.hidden) {
      return;
    }
    const now = new Date();
    const { main, seconds, label } = countdownParts(nextGardenAt(now).getTime() - now.getTime());
    for (const target of targets) {
      let [hm, ss] = [...target.children] as HTMLElement[];
      if (!hm || !ss) {
        hm = doc.createElement("span");
        ss = doc.createElement("span");
        ss.className = "header__timer-seconds";
        target.replaceChildren(hm, ss);
      }
      if (hm.textContent !== main) hm.textContent = main;
      ss.textContent = seconds;
      // The tag itself is decorative (aria-hidden, no pointer events); the link carries the
      // sentence, changed only when the wording does.
      const link = target.closest("a");
      if (link && link.title !== label) link.title = label;
    }
  };
  render();
  const timer = setInterval(render, 1000);
  doc.addEventListener("visibilitychange", render);
  const stopThis = (): void => {
    clearInterval(timer);
    doc.removeEventListener("visibilitychange", render);
    if (stop === stopThis) {
      stop = undefined;
    }
  };
  stop = stopThis;
  return stopThis;
};
