/* Copy feedback shared by every "copy" control: the RSS address on /blog/, the share button's link
   fallback. One polite live region per page says what happened; the control itself swaps its icon
   for a check ([data-feedback-default] / [data-feedback-done]) and settles back after a beat. */

export const FEEDBACK_DURATION_MS = 1600;
export const LIVE_REGION_ID = "feedback-live";

const ANNOUNCE_DELAY_MS = 50;

const revertTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
let announceTimer: ReturnType<typeof setTimeout> | undefined;

/* Screen readers only announce changes to a region that already exists, so pages create it on
   load. It is recreated after a client-side navigation swaps the body. */
export const ensureLiveRegion = (doc: Document = document): HTMLElement => {
  const existing = doc.getElementById(LIVE_REGION_ID);
  if (existing) {
    return existing;
  }
  const region = doc.createElement("div");
  region.id = LIVE_REGION_ID;
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  Object.assign(region.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    margin: "-1px",
    padding: "0",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
  });
  doc.body.append(region);
  return region;
};

/* Clearing first lets the same message ("Link copied" twice) be announced again */
export const announce = (message: string, doc: Document = document): void => {
  const region = ensureLiveRegion(doc);
  region.textContent = "";
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => {
    region.textContent = message;
  }, ANNOUNCE_DELAY_MS);
};

/* The async Clipboard API needs a secure context and focus; the selection fallback covers older
   browsers and embedded webviews. Either way the caller only learns whether it worked. */
const copyWithSelection = (text: string, doc: Document): boolean => {
  const field = doc.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  field.style.pointerEvents = "none";
  doc.body.append(field);
  const active = doc.activeElement;
  field.select();
  let copied = false;
  try {
    // Deprecated, but still the only synchronous copy where the Clipboard API is missing
    copied = (doc as { execCommand: (command: string) => boolean }).execCommand("copy");
  } catch {
    copied = false;
  }
  field.remove();
  if (active instanceof HTMLElement) {
    active.focus({ preventScroll: true });
  }
  return copied;
};

export const copyText = async (text: string, doc: Document = document): Promise<boolean> => {
  const clipboard = doc.defaultView?.navigator.clipboard;
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or document not focused: try the selection route
    }
  }
  return copyWithSelection(text, doc);
};

/* The icon coming back settles exactly like the check did (_pages.scss, feedback-settle), so the
   return reads as the same gesture played backwards rather than a cut. Opacity only when the
   reader asks for less motion. */
const SETTLE_MS = 140;
const SETTLE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const settleBack = (glyph: HTMLElement): void => {
  if (typeof glyph.animate !== "function") {
    return;
  }
  const still =
    glyph.ownerDocument.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ===
    true;
  glyph.animate(
    still
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "scale(0.9)" },
          { opacity: 1, transform: "scale(1)" },
        ],
    { duration: SETTLE_MS, easing: SETTLE_EASE },
  );
};

/* Swap the control's icon for a check and back. Pressing again restarts the timer instead of
   stacking reverts. */
export const showDone = (control: HTMLElement, duration = FEEDBACK_DURATION_MS): void => {
  const regular = control.querySelector<HTMLElement>("[data-feedback-default]");
  const done = control.querySelector<HTMLElement>("[data-feedback-done]");
  clearTimeout(revertTimers.get(control));
  if (control.dataset.feedbackTooltip !== undefined) {
    control.dataset.tooltip = control.dataset.feedbackTooltip;
    delete control.dataset.feedbackTooltip;
  }
  control.dataset.feedback = "done";
  if (regular && done) {
    regular.hidden = true;
    done.hidden = false;
  }
  revertTimers.set(
    control,
    setTimeout(() => {
      delete control.dataset.feedback;
      if (regular && done) {
        regular.hidden = false;
        done.hidden = true;
        settleBack(regular);
      }
      revertTimers.delete(control);
    }, duration),
  );
};

/* Nothing was copied: the icon stays, and the tooltip (seen on hover and focus) says so until the
   same beat has passed */
export const showFailed = (
  control: HTMLElement,
  message: string,
  duration = FEEDBACK_DURATION_MS,
): void => {
  clearTimeout(revertTimers.get(control));
  const { tooltip } = control.dataset;
  const original = control.dataset.feedbackTooltip ?? tooltip;
  control.dataset.feedback = "failed";
  if (original !== undefined) {
    control.dataset.feedbackTooltip = original;
    control.dataset.tooltip = message;
  }
  revertTimers.set(
    control,
    setTimeout(() => {
      delete control.dataset.feedback;
      if (original !== undefined) {
        control.dataset.tooltip = original;
        delete control.dataset.feedbackTooltip;
      }
      revertTimers.delete(control);
    }, duration),
  );
};

export interface CopyFeedbackOptions {
  failureMessage?: string;
  message?: string;
}

export const copyWithFeedback = async (
  control: HTMLElement,
  text: string,
  { message = "Link copied", failureMessage = "Couldn't copy the link" }: CopyFeedbackOptions = {},
): Promise<boolean> => {
  const doc = control.ownerDocument;
  const copied = await copyText(text, doc);
  if (copied) {
    showDone(control);
    announce(message, doc);
  } else {
    showFailed(control, failureMessage);
    announce(failureMessage, doc);
  }
  return copied;
};
