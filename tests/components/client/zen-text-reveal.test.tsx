import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ZenTextReveal from "../../../src/components/client/zen-text-reveal";

type MediaQueryListener = (event: MediaQueryListEvent) => void;

const createMockMediaQueryList = (initial: boolean) => {
  const listeners = new Set<MediaQueryListener>();
  const mql = {
    matches: initial,
    media: "",
    addEventListener: (_type: string, listener: MediaQueryListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MediaQueryListener) => {
      listeners.delete(listener);
    },
  };
  return mql;
};

const mockMatchMedia = (coarsePointer: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const isReducedMotionQuery = query.includes("prefers-reduced-motion");
    return createMockMediaQueryList(!isReducedMotionQuery && coarsePointer) as unknown as MediaQueryList;
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 240,
  });
});

describe("<ZenTextReveal />", () => {
  it("renders a span tag by default with aria-label", () => {
    const { container } = render(<ZenTextReveal text="quiet mind" />);
    const node = container.querySelector("span[aria-label='quiet mind']");
    expect(node).toBeTruthy();
    expect(node?.tagName).toBe("SPAN");
  });

  it("respects the tag prop", () => {
    const { container } = render(<ZenTextReveal text="block" tag="p" />);
    const node = container.querySelector("p[aria-label='block']");
    expect(node).toBeTruthy();
  });

  it("forwards className", () => {
    const { container } = render(<ZenTextReveal text="x" className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeTruthy();
  });

  it("renders a single text span for mobile simple strategy on coarse pointer devices", () => {
    mockMatchMedia(true);
    const { container } = render(<ZenTextReveal text="quiet mind" mobileStrategy="text" />);
    const node = container.querySelector("span[aria-label='quiet mind']");

    expect(node?.textContent).toBe("quiet mind");
    expect(node?.querySelectorAll("span")).toHaveLength(1);
    expect(node?.querySelector("[class*='haiku-char']")).toBeNull();
  });

  it("keeps character reveal for mobile simple strategy on desktop", async () => {
    mockMatchMedia(false);
    const { container } = render(<ZenTextReveal text="abc" mobileStrategy="text" />);

    await waitFor(() => {
      expect(container.querySelector("[class*='haiku-char']")).toBeTruthy();
    });
  });
});
