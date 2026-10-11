import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daypartFor } from "../../../src/components/client/daypart";

describe("daypartFor", () => {
  it.each([
    [4, undefined],
    [5, "dawn"],
    [8, "dawn"],
    [9, undefined],
    [12, undefined],
    [16, undefined],
    [17, "dusk"],
    [19, "dusk"],
    [20, undefined],
    [0, undefined],
  ])("hour %i → %s", (hour, expected) => {
    expect(daypartFor(hour)).toBe(expected);
  });
});

describe("the BaseHead daypart script", () => {
  const source = readFileSync("src/components/BaseHead.astro", "utf8");
  const script = /<script is:inline>\s*(\(function \(\) \{\s*var part[\s\S]*?)<\/script>/.exec(source)?.[1];

  const boot = (hour: number) => {
    const doc = document.implementation.createHTMLDocument("t");
    const listeners: string[] = [];
    const fakeDocument = {
      documentElement: doc.documentElement,
      addEventListener: (name: string) => listeners.push(name),
    };
    class FakeDate {
      getHours() {
        return hour;
      }
    }
    // Runs the repository's own inline source, as the browser would
    new Function("window", "document", "Date", script ?? "")({}, fakeDocument, FakeDate);
    return { root: doc.documentElement, listeners };
  };

  it("exists", () => {
    expect(script).toBeTruthy();
  });

  it.each([0, 5, 8, 9, 12, 17, 19, 20, 23])("agrees with daypartFor at %i h", (hour) => {
    const { root } = boot(hour);
    expect(root.getAttribute("data-daypart") ?? undefined).toBe(daypartFor(hour));
  });

  it("fades only on the first load and re-applies around page swaps", () => {
    const { root, listeners } = boot(6);
    expect(root.hasAttribute("data-daypart-fade")).toBe(true);
    expect(listeners).toEqual(["astro:before-swap", "astro:after-swap"]);
  });
});
