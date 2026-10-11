import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  READER_FONT_KEY,
  READER_SIZE_KEY,
} from "../../../src/components/client/reader-preference";

/* The menu as ReaderSettings.astro renders it */
const markup = `
  <div class="theme-toggle reader-settings" data-reader-settings>
    <button class="reader-settings__button" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="reader-menu">Reading</button>
    <div class="reader-settings__menu" id="reader-menu" role="menu">
      <div role="group">
        <button role="menuitem" tabindex="-1" data-reader-step="-1">Smaller</button>
        <span data-reader-value>100%</span>
        <button role="menuitem" tabindex="-1" data-reader-step="1">Larger</button>
      </div>
      <div role="separator"></div>
      <button role="menuitemcheckbox" aria-checked="false" tabindex="-1" data-reader-legible>Dyslexia-friendly</button>
      <button role="menuitem" tabindex="-1" aria-disabled="true" data-reader-reset>Reset</button>
    </div>
    <span role="status" data-reader-status></span>
  </div>`;

let shortcutDirection: (event: KeyboardEvent) => 1 | -1 | undefined;

beforeAll(async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  localStorage.clear();
  document.body.innerHTML = markup;
  ({ readerShortcutDirection: shortcutDirection } = await import(
    "../../../src/components/client/reader-settings"
  ));
});

const get = (selector: string) => document.querySelector<HTMLElement>(selector) as HTMLElement;
const root = () => document.documentElement;
const press = (key: string, init: KeyboardEventInit = {}) =>
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }),
  );

describe("reading menu", () => {
  beforeEach(() => {
    if ("open" in get("[data-reader-settings]").dataset) {
      get(".reader-settings__button").click();
    }
    get("[data-reader-reset]").click();
  });

  it("opens from the keyboard on the first row and closes with Escape back on its button", () => {
    const button = get(".reader-settings__button");
    button.focus();
    press("ArrowDown");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(get('[data-reader-step="-1"]'));
    press("ArrowRight");
    expect(document.activeElement).toBe(get('[data-reader-step="1"]'));
    press("End");
    expect(document.activeElement).toBe(get("[data-reader-reset]"));
    press("Escape");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("steps the size, persists it, stamps <html> and announces it politely", () => {
    get('[data-reader-step="1"]').click();
    expect(root().dataset.readerSize).toBe("110");
    expect(localStorage.getItem(READER_SIZE_KEY)).toBe("110");
    expect(get("[data-reader-value]").textContent).toBe("110%");
    expect(get("[data-reader-status]").textContent).toBe("Text size 110%");
    expect(get("[data-reader-reset]").getAttribute("aria-disabled")).toBe("false");
    expect(get(".reader-settings__button").hasAttribute("data-active")).toBe(true);
  });

  it("holds at the largest size and says so", () => {
    for (let index = 0; index < 6; index += 1) {
      get('[data-reader-step="1"]').click();
    }
    expect(root().dataset.readerSize).toBe("140");
    expect(get('[data-reader-step="1"]').getAttribute("aria-disabled")).toBe("true");
    expect(get("[data-reader-status]").textContent).toBe("Text size 140%, the largest");
  });

  it("flips the dyslexia-friendly switch", () => {
    const legible = get("[data-reader-legible]");
    legible.click();
    expect(legible.getAttribute("aria-checked")).toBe("true");
    expect(root().dataset.readerFont).toBe("legible");
    expect(localStorage.getItem(READER_FONT_KEY)).toBe("legible");
    legible.click();
    expect(root().hasAttribute("data-reader-font")).toBe(false);
    expect(localStorage.getItem(READER_FONT_KEY)).toBeNull();
  });

  it("resets everything and forgets the stored keys", () => {
    get('[data-reader-step="-1"]').click();
    get("[data-reader-legible]").click();
    get("[data-reader-reset]").click();
    expect(root().hasAttribute("data-reader-size")).toBe(false);
    expect(root().hasAttribute("data-reader-font")).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(get("[data-reader-status]").textContent).toBe("Reading settings reset");
  });
});

describe("shortcuts", () => {
  const event = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

  it("take Ctrl/Cmd + Alt + = or -, by physical key", () => {
    expect(shortcutDirection(event({ code: "Equal", key: "≠", altKey: true, metaKey: true }))).toBe(1);
    expect(shortcutDirection(event({ code: "Minus", altKey: true, ctrlKey: true }))).toBe(-1);
  });

  it("leave the browser's own zoom alone", () => {
    expect(shortcutDirection(event({ code: "Equal", ctrlKey: true }))).toBeUndefined();
    expect(shortcutDirection(event({ code: "Minus", metaKey: true }))).toBeUndefined();
    expect(shortcutDirection(event({ code: "Equal", altKey: true }))).toBeUndefined();
  });
});
