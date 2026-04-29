import { render, screen, waitFor } from "@testing-library/react";
import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ZenTagCloud from "../../../src/components/client/zen-tag-cloud";

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
  vi.mocked(measureNaturalWidth).mockClear();
  vi.mocked(prepareWithSegments).mockClear();
});

describe("<ZenTagCloud />", () => {
  it("renders one pill per tag with link and count", () => {
    render(
      <ZenTagCloud
        tags={[
          { tag: "zen", count: 3, size: "lg" },
          { tag: "astro", count: 1, size: "sm" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/tags/zen/");
    expect(links[1]).toHaveAttribute("href", "/tags/astro/");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("skips Pretext tag measurement on coarse pointer devices", async () => {
    mockMatchMedia(true);
    render(
      <ZenTagCloud
        tags={[
          { tag: "zen", count: 3, size: "lg" },
          { tag: "astro", count: 1, size: "sm" },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("link")).toHaveLength(2);
    });
    expect(prepareWithSegments).not.toHaveBeenCalled();
    expect(measureNaturalWidth).not.toHaveBeenCalled();
  });
});
