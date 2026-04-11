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

  it("fetches haiku text and updates aria-label", async () => {
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote");
      expect(node?.getAttribute("aria-label")).toContain("old pond");
    });
  });

  it("falls back to default message when fetch fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("nope")) as unknown as typeof fetch;
    const { container } = render(<ZenHaikuReveal url="/api/haiku" />);
    await waitFor(() => {
      const node = container.querySelector(".haiku-card__quote");
      expect(node?.getAttribute("aria-label")).toContain("A fresh haiku");
    });
  });
});
