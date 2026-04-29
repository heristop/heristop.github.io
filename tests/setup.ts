import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

vi.mock("@chenglou/pretext", async () => {
  const emptyPos = { graphemeIndex: 0, segmentIndex: 0 };
  return {
    prepareWithSegments: vi.fn((text: string) => ({ text, segments: [] })),
    layoutWithLines: vi.fn((prepared: { text: string }) => ({
      lines: [{ text: prepared.text, width: 0, start: emptyPos, end: emptyPos }],
    })),
    measureNaturalWidth: vi.fn(() => 0),
  };
});

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
