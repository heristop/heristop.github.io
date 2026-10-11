import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PETALS_CHANGE_EVENT, PETALS_STORAGE_KEY } from "../../../src/components/client/sakura-petals";
import { THEME_STORAGE_KEY } from "../../../src/components/client/theme-preference";

/* The menu as ThemeToggle.astro renders it: three choices, a separator, the Petals switch */
const markup = (id: string) => `
  <div class="theme-toggle" data-theme-toggle>
    <button class="theme-toggle__button" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="theme-menu-${id}"></button>
    <div class="theme-toggle__menu" id="theme-menu-${id}" role="menu">
      <button role="menuitemradio" aria-checked="false" tabindex="-1" data-theme-value="light">Light</button>
      <button role="menuitemradio" aria-checked="false" tabindex="-1" data-theme-value="dark">Dark</button>
      <button role="menuitemradio" aria-checked="false" tabindex="-1" data-theme-value="system">System</button>
      <div class="theme-toggle__extras">
        <div role="separator"></div>
        <button role="menuitemcheckbox" aria-checked="true" tabindex="-1" data-petals-toggle>Petals</button>
      </div>
    </div>
  </div>`;

const getClientRects = Element.prototype.getClientRects;

beforeAll(async () => {
  // jsdom lays nothing out; every row counts as visible
  Element.prototype.getClientRects = function () {
    return [{}] as unknown as DOMRectList;
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  localStorage.clear();
  document.body.innerHTML = markup("initial") + markup("sticky");
  await import("../../../src/components/client/theme-toggle");
});

afterAll(() => {
  Element.prototype.getClientRects = getClientRects;
});

const toggles = () => [...document.querySelectorAll<HTMLElement>("[data-theme-toggle]")];
const petalsOf = (toggle: HTMLElement) =>
  toggle.querySelector<HTMLButtonElement>("[data-petals-toggle]") as HTMLButtonElement;
const buttonOf = (toggle: HTMLElement) =>
  toggle.querySelector<HTMLButtonElement>(".theme-toggle__button") as HTMLButtonElement;
const press = (key: string) =>
  document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));


describe("theme menu: Petals switch", () => {
  beforeEach(() => {
    for (const toggle of toggles()) {
      if ("open" in toggle.dataset) {
        buttonOf(toggle).click();
      }
    }
  });

  it("starts on, on every instance, when nothing is stored", () => {
    for (const toggle of toggles()) {
      expect(petalsOf(toggle).getAttribute("aria-checked")).toBe("true");
    }
  });

  it("flips in place, persists, tells the petals and keeps the menu open", () => {
    const [toggle, other] = toggles();
    const heard = vi.fn();
    document.addEventListener(PETALS_CHANGE_EVENT, heard);
    buttonOf(toggle).click();
    expect(toggle.dataset.open).toBe("");

    petalsOf(toggle).click();

    expect(petalsOf(toggle).getAttribute("aria-checked")).toBe("false");
    expect(petalsOf(other).getAttribute("aria-checked")).toBe("false");
    expect(localStorage.getItem(PETALS_STORAGE_KEY)).toBe("off");
    const event = heard.mock.calls[0]?.[0] as CustomEvent | undefined;
    expect(event?.detail).toEqual({ enabled: false });
    expect("open" in toggle.dataset).toBe(true);

    petalsOf(toggle).click();
    expect(localStorage.getItem(PETALS_STORAGE_KEY)).toBe("on");
    document.removeEventListener(PETALS_CHANGE_EVENT, heard);
  });

  it("is part of the arrow-key loop: End lands on it, ArrowDown wraps to the first choice", async () => {
    const [toggle] = toggles();
    buttonOf(toggle).focus();
    buttonOf(toggle).dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await vi.waitFor(() => expect(document.activeElement).toBe(petalsOf(toggle)));

    press("ArrowDown");
    expect(document.activeElement?.textContent).toBe("Light");
    press("ArrowUp");
    expect(document.activeElement).toBe(petalsOf(toggle));
    press("Home");
    expect(document.activeElement?.textContent).toBe("Light");
    press("End");
    expect(document.activeElement).toBe(petalsOf(toggle));
  });

  it("follows a choice made in another tab", () => {
    localStorage.setItem(PETALS_STORAGE_KEY, "off");
    globalThis.dispatchEvent(new StorageEvent("storage", { key: PETALS_STORAGE_KEY, newValue: "off" }));
    for (const toggle of toggles()) {
      expect(petalsOf(toggle).getAttribute("aria-checked")).toBe("false");
    }
  });
});

describe("theme menu: choosing a garden", () => {
  it("switches at once when View Transitions are unavailable, and leaves no transition class", () => {
    const [toggle] = toggles();
    buttonOf(toggle).click();
    toggle.querySelector<HTMLButtonElement>('[data-theme-value="dark"]')?.click();

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("theme-transition")).toBe(false);
    expect(buttonOf(toggle).getAttribute("aria-expanded")).toBe("false");
    for (const each of toggles()) {
      expect(each.querySelector('[data-theme-value="dark"]')?.getAttribute("aria-checked")).toBe("true");
    }
  });
});
