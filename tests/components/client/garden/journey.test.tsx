import { StrictMode } from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Journey from "../../../../src/components/client/garden/components/hud/journey";

const walk = { steps: 20, stonesLaid: 2, stonesLeft: 4, catMet: false, frogFreed: false };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("journey records", () => {
  it("only saves a score when the shrine is reached", () => {
    const { rerender } = render(<Journey {...walk} recordKey="garden-a" complete={false} />);
    expect(window.localStorage.getItem("garden-a")).toBeNull();
    rerender(<Journey {...walk} recordKey="garden-a" complete />);
    expect(Number(window.localStorage.getItem("garden-a"))).toBeGreaterThan(0);
    expect(screen.getByText("New personal best")).toBeInTheDocument();
  });
  it("preserves a higher record and separates gardens", () => {
    window.localStorage.setItem("garden-a", "9999");
    render(<Journey {...walk} recordKey="garden-a" complete />);
    expect(window.localStorage.getItem("garden-a")).toBe("9999");
    expect(window.localStorage.getItem("garden-b")).toBeNull();
    expect(screen.queryByText("New personal best")).not.toBeInTheDocument();
  });
  it("survives unavailable storage and ignores malformed records", () => {
    window.localStorage.setItem("garden-a", "NaN");
    const { rerender } = render(<Journey {...walk} recordKey="garden-a" complete={false} />);
    expect(screen.getByText("No completed run yet")).toBeInTheDocument();
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    rerender(<Journey {...walk} recordKey="garden-a" complete />);
    expect(screen.getByText("New personal best")).toBeInTheDocument();
  });
});

it("keeps a completed record label stable, then resets it for the next walk", () => {
  const { rerender } = render(<Journey {...walk} recordKey="garden-a" complete />);
  const best = window.localStorage.getItem("garden-a");
  rerender(<Journey {...walk} recordKey="garden-a" complete />);
  expect(screen.getByText("New personal best")).toBeInTheDocument();
  rerender(<Journey {...walk} recordKey="garden-a" complete={false} />);
  expect(screen.getByText("Garden best")).toBeInTheDocument();
  expect(window.localStorage.getItem("garden-a")).toBe(best);
  rerender(<Journey {...walk} recordKey="garden-a" complete />);
  expect(screen.queryByText("New personal best")).not.toBeInTheDocument();
});

it("loads the correct record when switching gardens during a walk", () => {
  window.localStorage.setItem("garden-a", "9000");
  window.localStorage.setItem("garden-b", "8000");
  const { rerender } = render(<Journey {...walk} recordKey="garden-a" complete={false} />);
  expect(screen.getByText("9,000")).toBeInTheDocument();
  rerender(<Journey {...walk} recordKey="garden-b" complete={false} />);
  expect(screen.queryByText("9,000")).not.toBeInTheDocument();
  expect(screen.getByText("8,000")).toBeInTheDocument();
});

it("preserves new-record feedback when Strict Mode replays persistence effects", () => {
  render(
    <StrictMode>
      <Journey {...walk} recordKey="garden-a" complete summary />
    </StrictMode>,
  );
  expect(screen.getByText("New personal best")).toBeInTheDocument();
  expect(Number(window.localStorage.getItem("garden-a"))).toBeGreaterThan(0);
});
