import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ZenHaikuReveal from "../../../src/components/client/zen-haiku-reveal";

const originalFetch = globalThis.fetch;

const SOCIAL = `🌸 “Whispers in the Grove” 🗻

~~~

💡 Hint 1 (Bookmoji):
📢🌪️

📗 The sound and the fury by William Faulkner

~~~

eating by the branch
I listened to the water
The trees were buzzing

~~~
`;

const API_URL = "https://gutenku.test/api/daily-haiku";

const DAILY = {
  book: { author: "Friedrich Wilhelm Nietzsche", emoticons: "📜🧔‍♂️🏔️", title: "Thus Spake Zarathustra" },
  cardUrl: "https://gutenku.test/api/daily-haiku/card.jpg?d=2026-10-23&v=1",
  date: "2026-10-23",
  nextRolloverAt: "2026-10-24T10:00:00.000Z",
  publishedAt: "2026-10-23T10:00:00.000Z",
  reading: "Radiance tips into longing.",
  title: "Gilded Joy, Sudden Cry",
  verses: ["the golden marvel", "longeth thy smiling for tears", "the spontaneous bark"],
};

const respond = (body: string) => ({ ok: true, text: async () => body });
const respondJson = (body: unknown) => ({ json: async () => body, ok: true, status: 200 });
const notFound = { json: async () => ({ error: "not_found" }), ok: false, status: 404 };

/* The API misses (404, as before the first publication); every other URL answers with `text` */
const fallbackFetch = (text: (input: string) => string) =>
  vi.fn((input: string) =>
    Promise.resolve(input.startsWith(API_URL) ? notFound : respond(text(input))),
  ) as unknown as typeof fetch;

beforeEach(() => {
  globalThis.fetch = fallbackFetch(() => "old pond / a frog jumps in / sound of water");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("<ZenHaikuReveal />", () => {
  it("renders the haiku container while loading", () => {
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    expect(container.querySelector(".haiku-card__quote")).toBeTruthy();
    expect(container.querySelector(".haiku-skeleton")).toBeTruthy();
  });

  it("exposes the fetched haiku once as visually hidden text", async () => {
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote");
      expect(node?.hasAttribute("aria-label")).toBe(false);
      expect(node?.querySelector(".sr-only")?.textContent).toContain("old pond");
      const visible = [...(node?.children ?? [])].filter((child) => !child.classList.contains("sr-only"));
      expect(visible.every((child) => child.getAttribute("aria-hidden") === "true")).toBe(true);
    });
  });

  it("falls back to default message when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("nope")) as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" sourceUrl="/api/social" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote .sr-only");
      expect(node?.textContent).toContain("A fresh haiku");
    });
    expect(container.querySelector(".haiku-card__riddle")?.textContent).toContain("Can you trace it back?");
    expect(container.querySelector(".haiku-card__trace")).toBeNull();
  });

  it("dates the note and counts down to the next verse once mounted", async () => {
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__eyebrow time")?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(container.querySelector(".haiku-card__next")?.textContent).toMatch(/Next verse in \d+ (h|min)/);
    });
  });

  it("leads with the first sentence and keeps it out of the reading", async () => {
    globalThis.fetch = fallbackFetch(() => "A quiet meal by the water. The forest hums back.");
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__lead")?.textContent).toBe("A quiet meal by the water.");
    });
    expect(container.querySelector(".haiku-card__quote .sr-only")?.textContent).toBe("The forest hums back.");
  });

  it("titles the note and traces the source from GutenKu's post", async () => {
    globalThis.fetch = fallbackFetch((input) =>
      input.startsWith("/api/social") ? SOCIAL : "The reading. More reading.",
    );
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" sourceUrl="/api/social" />);
    const trace = await screen.findByRole("button", { name: /trace the source/i });
    expect(container.querySelector(".haiku-card__lead")?.textContent).toBe("Whispers in the Grove");
    expect(container.querySelector(".haiku-card__quote .sr-only")?.textContent).toBe("The reading. More reading.");
    expect(screen.getByText(/Today’s haiku: eating by the branch/)).toBeTruthy();
    expect(trace.getAttribute("aria-expanded")).toBe("false");
    const panel = document.getElementById(trace.getAttribute("aria-controls") ?? "");
    expect(panel?.querySelector("cite")?.textContent).toBe("The Sound and the Fury");
    fireEvent.click(trace);
    expect(trace.getAttribute("aria-expanded")).toBe("true");
    expect(panel?.dataset.open).toBe("true");
    expect(container.querySelector(".haiku-card__riddle")).toBeNull();
  });

  it("reads the day from GutenKu's API without touching the raw files", async () => {
    const fetchMock = vi.fn((input: string) =>
      Promise.resolve(input === API_URL ? respondJson(DAILY) : respond("raw")),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" sourceUrl="/api/social" />);
    const trace = await screen.findByRole("button", { name: /trace the source/i });
    expect(container.querySelector(".haiku-card__lead")?.textContent).toBe("Gilded Joy, Sudden Cry");
    expect(container.querySelector(".haiku-card__quote .sr-only")?.textContent).toBe("Radiance tips into longing.");
    expect(screen.getByText(/Today’s haiku: the golden marvel \/ longeth/)).toBeTruthy();
    const panel = document.getElementById(trace.getAttribute("aria-controls") ?? "");
    expect(panel?.querySelector("cite")?.textContent).toBe("Thus Spake Zarathustra");
    expect(panel?.textContent).toContain("Friedrich Wilhelm Nietzsche");
    expect(panel?.querySelector(".haiku-card__bookmoji")?.textContent).toBe("📜🧔‍♂️🏔️");
    expect(fetchMock.mock.calls.map(([input]) => input)).toEqual([API_URL]);
  });

  it("counts down to the API's announced rollover", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-24T07:30:00Z"), toFake: ["Date"] });
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(respondJson({ ...DAILY, nextRolloverAt: "2026-10-24T12:00:00.000Z" })),
    ) as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__lead")?.textContent).toBe("Gilded Joy, Sudden Cry");
    });
    expect(container.querySelector(".haiku-card__next")?.textContent).toBe("Next verse in 4 h");
  });

  it("swaps the API's card into the page once it has loaded", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<img data-haiku-card-image src="https://raw.githubusercontent.com/card.jpg" alt="">',
    );
    const image = document.querySelector<HTMLImageElement>("[data-haiku-card-image]");
    const loads: HTMLImageElement[] = [];
    const { Image: NativeImage } = globalThis;
    vi.stubGlobal(
      "Image",
      class extends NativeImage {
        constructor() {
          super();
          loads.push(this);
        }
      },
    );
    globalThis.fetch = vi.fn(() => Promise.resolve(respondJson(DAILY))) as unknown as typeof fetch;
    render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      expect(loads[0]?.src).toBe(DAILY.cardUrl);
    });
    expect(image?.src).toBe("https://raw.githubusercontent.com/card.jpg");
    loads[0]?.dispatchEvent(new Event("load"));
    expect(image?.src).toBe(DAILY.cardUrl);
    image?.remove();
  });

  it("keeps the raw card when the API misses", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<img data-haiku-card-image src="https://raw.githubusercontent.com/card.jpg" alt="">',
    );
    const image = document.querySelector<HTMLImageElement>("[data-haiku-card-image]");
    const { container } = render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__quote .sr-only")?.textContent).toContain("old pond");
    });
    expect(image?.src).toBe("https://raw.githubusercontent.com/card.jpg");
    image?.remove();
  });

  it("offers the whole reading only when it overflows the clamp", async () => {
    const offset = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
    const style = globalThis.getComputedStyle;
    vi.spyOn(globalThis, "getComputedStyle").mockImplementation((el: Element) => {
      const real = style(el);
      return {
        ...real,
        getPropertyValue: (name: string) => (name === "--haiku-lines" ? "5" : real.getPropertyValue(name)),
        lineHeight: "24px",
      } as CSSStyleDeclaration;
    });
    render(<ZenHaikuReveal apiUrl={API_URL} url="/api/haiku" />);
    const more = await screen.findByRole("button", { name: /read the whole reading/i });
    const clamp = document.getElementById(more.getAttribute("aria-controls") ?? "");
    expect(clamp?.classList.contains("haiku-card__clamp")).toBe(true);
    fireEvent.click(more);
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(more.textContent).toContain("Show less");
    expect(clamp?.dataset.open).toBe("true");
    offset.mockRestore();
  });
});
