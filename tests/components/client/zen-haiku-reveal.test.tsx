import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ZenHaikuReveal from "../../../src/components/client/zen-haiku-reveal";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => "old pond / a frog jumps in / sound of water",
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("<ZenHaikuReveal />", () => {
  it("renders the haiku container while loading", () => {
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    expect(container.querySelector(".haiku-card__quote")).toBeTruthy();
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
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote .sr-only");
      expect(node?.textContent).toContain("A fresh haiku");
    });
  });
});
