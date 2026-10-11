import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FEEDBACK_DURATION_MS,
  LIVE_REGION_ID,
  announce,
  copyText,
  copyWithFeedback,
  ensureLiveRegion,
  showDone,
} from "../../../src/components/client/feedback";

const setClipboard = (writeText?: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
};

const setExecCommand = (result: boolean | Error) => {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => {
      if (result instanceof Error) {
        throw result;
      }
      return result;
    }),
  });
};

const button = (): HTMLButtonElement => {
  document.body.innerHTML = `
    <button type="button" data-tooltip="Copy link">
      <span data-feedback-default>copy</span>
      <span data-feedback-done hidden>check</span>
    </button>`;
  const element = document.querySelector("button");
  if (!element) {
    throw new Error("button");
  }
  return element;
};

const part = (control: HTMLElement, name: string): HTMLElement => {
  const element = control.querySelector<HTMLElement>(`[data-feedback-${name}]`);
  if (!element) {
    throw new Error(name);
  }
  return element;
};

const liveText = () => document.getElementById(LIVE_REGION_ID)?.textContent;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
  setClipboard(vi.fn(async () => {}));
  setExecCommand(false);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("ensureLiveRegion", () => {
  it("creates one polite, atomic status region and reuses it", () => {
    const region = ensureLiveRegion();
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(ensureLiveRegion()).toBe(region);
    expect(document.querySelectorAll(`#${LIVE_REGION_ID}`)).toHaveLength(1);
  });

  it("comes back after the body is swapped", () => {
    const first = ensureLiveRegion();
    document.body.innerHTML = "";
    expect(ensureLiveRegion()).not.toBe(first);
  });
});

describe("announce", () => {
  it("clears the region, then speaks, so a repeated message is heard again", () => {
    announce("Link copied");
    vi.runAllTimers();
    expect(liveText()).toBe("Link copied");

    announce("Link copied");
    expect(liveText()).toBe("");
    vi.runAllTimers();
    expect(liveText()).toBe("Link copied");
  });
});

describe("copyText", () => {
  it("writes through the Clipboard API", async () => {
    const writeText = vi.fn(async () => {});
    setClipboard(writeText);
    await expect(copyText("https://example.com/")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/");
  });

  it("falls back to a selection copy when the API refuses", async () => {
    setClipboard(vi.fn(async () => {
      throw new Error("NotAllowedError");
    }));
    setExecCommand(true);
    await expect(copyText("x")).resolves.toBe(true);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when neither route works", async () => {
    setClipboard();
    setExecCommand(new Error("unsupported"));
    await expect(copyText("x")).resolves.toBe(false);
  });
});

describe("showDone", () => {
  it("swaps the icon for the check and reverts after the beat", () => {
    const control = button();
    showDone(control);
    expect(part(control, "default").hidden).toBe(true);
    expect(part(control, "done").hidden).toBe(false);
    expect(control.dataset.feedback).toBe("done");

    vi.advanceTimersByTime(FEEDBACK_DURATION_MS);
    expect(part(control, "default").hidden).toBe(false);
    expect(part(control, "done").hidden).toBe(true);
    expect(control.dataset.feedback).toBeUndefined();
  });

  it("restarts the beat when pressed again", () => {
    const control = button();
    showDone(control);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS - 100);
    showDone(control);
    vi.advanceTimersByTime(200);
    expect(part(control, "done").hidden).toBe(false);
    vi.advanceTimersByTime(FEEDBACK_DURATION_MS);
    expect(part(control, "done").hidden).toBe(true);
  });
});

describe("copyWithFeedback", () => {
  it("shows the check and announces Link copied", async () => {
    const control = button();
    await expect(copyWithFeedback(control, "https://example.com/")).resolves.toBe(true);
    vi.advanceTimersByTime(100);
    expect(part(control, "done").hidden).toBe(false);
    expect(liveText()).toBe("Link copied");
  });

  it("keeps the icon, says so in the tooltip and the live region when copying fails", async () => {
    setClipboard();
    const control = button();
    await expect(copyWithFeedback(control, "x")).resolves.toBe(false);
    vi.advanceTimersByTime(100);
    expect(part(control, "done").hidden).toBe(true);
    expect(control.dataset.feedback).toBe("failed");
    expect(control.dataset.tooltip).toBe("Couldn't copy the link");
    expect(liveText()).toBe("Couldn't copy the link");

    vi.advanceTimersByTime(FEEDBACK_DURATION_MS);
    expect(control.dataset.tooltip).toBe("Copy link");
    expect(control.dataset.feedback).toBeUndefined();
  });

  it("restores the tooltip when a retry succeeds", async () => {
    setClipboard();
    const control = button();
    await copyWithFeedback(control, "x");
    setClipboard(vi.fn(async () => {}));
    await copyWithFeedback(control, "x");
    expect(control.dataset.tooltip).toBe("Copy link");
    expect(control.dataset.feedback).toBe("done");
  });
});
