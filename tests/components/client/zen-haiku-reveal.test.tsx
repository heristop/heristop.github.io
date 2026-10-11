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

const respond = (body: string) => ({ ok: true, text: async () => body });

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue(
    respond("old pond / a frog jumps in / sound of water"),
  ) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("<ZenHaikuReveal />", () => {
  it("renders the haiku container while loading", () => {
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    expect(container.querySelector(".haiku-card__quote")).toBeTruthy();
    expect(container.querySelector(".haiku-skeleton")).toBeTruthy();
  });

  it("exposes the fetched haiku once as visually hidden text", async () => {
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
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
    const { container } = render(<ZenHaikuReveal url="/api/haiku" sourceUrl="/api/social" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote .sr-only");
      expect(node?.textContent).toContain("A fresh haiku");
    });
    expect(container.querySelector(".haiku-card__riddle")?.textContent).toContain("Can you trace it back?");
    expect(container.querySelector(".haiku-card__trace")).toBeNull();
  });

  it("dates the note and counts down to the next verse once mounted", async () => {
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__eyebrow time")?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(container.querySelector(".haiku-card__next")?.textContent).toMatch(/Next verse in \d+ (h|min)/);
    });
  });

  it("leads with the first sentence and keeps it out of the reading", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      respond("A quiet meal by the water. The forest hums back."),
    ) as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    await waitFor(() => {
      expect(container.querySelector(".haiku-card__lead")?.textContent).toBe("A quiet meal by the water.");
    });
    expect(container.querySelector(".haiku-card__quote .sr-only")?.textContent).toBe("The forest hums back.");
  });

  it("titles the note and traces the source from GutenKu's post", async () => {
    globalThis.fetch = vi.fn((input: string) =>
      Promise.resolve(respond(input.startsWith("/api/social") ? SOCIAL : "The reading. More reading.")),
    ) as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal url="/api/haiku" sourceUrl="/api/social" />);
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
    render(<ZenHaikuReveal url="/api/haiku" />);
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
