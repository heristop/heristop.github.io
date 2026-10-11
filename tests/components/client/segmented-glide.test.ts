import { afterEach, describe, expect, it } from "vitest";
import { mountSegmentedGlide } from "../../../src/components/client/segmented-glide";

const setup = () => {
  document.body.innerHTML = `<div class="index-seg">
    <button class="index-seg__option" aria-pressed="true">All</button>
    <button class="index-seg__option" aria-pressed="false">Essays</button>
    <button class="index-seg__option" aria-pressed="false">Digests</button>
  </div>`;
  const root = document.querySelector<HTMLElement>(".index-seg") as HTMLElement;
  const options = [...root.querySelectorAll<HTMLButtonElement>("button")];
  options.forEach((option, index) => {
    Object.defineProperty(option, "offsetLeft", { value: 3 + index * 80 });
    Object.defineProperty(option, "offsetWidth", { value: 70 + index * 5 });
  });
  // The page owns the selection: a click presses the clicked option
  for (const option of options) {
    option.addEventListener("click", () => {
      for (const other of options) {
        other.setAttribute("aria-pressed", String(other === option));
      }
    });
  }
  return { root, options, teardown: mountSegmentedGlide(root) };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("mountSegmentedGlide", () => {
  it("places one pill under the pressed option", () => {
    const { root } = setup();
    const pill = root.querySelector<HTMLElement>(".index-seg__pill");
    expect(pill).not.toBeNull();
    expect(pill?.getAttribute("aria-hidden")).toBe("true");
    expect(pill?.style.width).toBe("70px");
    expect(pill?.style.transform).toBe("translateX(3px)");
  });

  it("follows a change of aria-pressed", async () => {
    const { root, options } = setup();
    options[2]?.click();
    await flush();
    const pill = root.querySelector<HTMLElement>(".index-seg__pill");
    expect(pill?.style.width).toBe("80px");
    expect(pill?.style.transform).toBe("translateX(163px)");
  });

  it("moves the selection with the arrow keys, wrapping", async () => {
    const { root, options } = setup();
    options[0]?.focus();
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await flush();
    expect(options[2]).toHaveAttribute("aria-pressed", "true");
    expect(options[2]).toHaveFocus();
  });

  it("leans toward a hovered option and settles on leave", async () => {
    const { root, options } = setup();
    const pill = root.querySelector<HTMLElement>(".index-seg__pill");
    options[1]?.dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(pill?.style.transform).toBe("translateX(6px)");
    root.dispatchEvent(new Event("pointerleave"));
    expect(pill?.style.transform).toBe("translateX(3px)");
  });

  it("reuses a pill the markup already has, and mounts once", () => {
    document.body.innerHTML = `<div class="index-seg"><span class="index-seg__pill"></span><button class="index-seg__option" aria-pressed="true">A</button></div>`;
    const root = document.querySelector<HTMLElement>(".index-seg") as HTMLElement;
    mountSegmentedGlide(root);
    mountSegmentedGlide(root);
    expect(root.querySelectorAll(".index-seg__pill")).toHaveLength(1);
  });
});
