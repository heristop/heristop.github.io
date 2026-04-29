import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldBindSakuraTouchBursts } from "../../../src/components/client/sakura-petals";

const mockMatchMedia = (coarsePointer: boolean) => {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query.includes("pointer: coarse") && coarsePointer,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("shouldBindSakuraTouchBursts", () => {
  it("does not bind touch bursts on coarse pointer devices", () => {
    mockMatchMedia(true);

    expect(shouldBindSakuraTouchBursts()).toBe(false);
  });

  it("binds touch bursts on fine pointer devices", () => {
    mockMatchMedia(false);

    expect(shouldBindSakuraTouchBursts()).toBe(true);
  });
});
