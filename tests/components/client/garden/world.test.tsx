import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/components/client/garden/world.scss", () => ({}));

import ZazenWorld, { chooseMapScale } from "../../../../src/components/client/garden/world";

describe("chooseMapScale", () => {
  it("only ever returns an integer, so pixel art is never resampled", () => {
    for (const available of [100, 383, 640, 900, 1400, 2600]) {
      const scale = chooseMapScale(available, 768);
      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
    }
  });

  it("never shrinks below 1 — narrow screens pan instead", () => {
    expect(chooseMapScale(320, 768)).toBe(1);
  });

  it("uses the extra room on a wide viewport", () => {
    expect(chooseMapScale(1600, 768)).toBe(2);
  });

  it("caps the zoom so the garden cannot outgrow the page", () => {
    expect(chooseMapScale(100000, 768)).toBe(3);
  });
});

describe("<ZazenWorld />", () => {
  it("renders the Path of Stones heading and states the rule", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("heading", { level: 1, name: /path of stones/i })).toBeInTheDocument();
    expect(screen.getByText(/without disturbing the sand/i)).toBeInTheDocument();
  });

  // A resource the player cannot see is not a resource, it is a trap. The supply has to
  // be on screen from the first frame, before anyone spends any of it.
  it("shows how many stepping stones are left to lay", () => {
    render(<ZazenWorld />);
    expect(screen.getByLabelText(/stepping stones left to lay/i)).toBeInTheDocument();
  });

  // Labels name the direction the pilgrim actually travels on screen. Every tile step is
  // diagonal, and calling them north/south/east/west promised axis-aligned movement the
  // projection cannot deliver.
  it("renders the four compass buttons, labelled by where they actually walk", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("button", { name: /walk up and left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /walk up and right/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /walk down and left/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /walk down and right/i })).toBeInTheDocument();
  });

  it("keeps the application role and the instructions it describes", () => {
    render(<ZazenWorld />);
    const map = screen.getByRole("application", { name: /game world map/i });
    expect(map).toBeInTheDocument();
    expect(map).toHaveAttribute("aria-describedby", "game-instructions");
    expect(document.getElementById("game-instructions")).toBeInTheDocument();
  });

  it("keeps a polite live region for announcements", () => {
    const { container } = render(<ZazenWorld />);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("renders the pilgrim as its own layer, not inside a tile", () => {
    const { container } = render(<ZazenWorld />);
    const pilgrim = container.querySelector(".zazen-world__pilgrim");
    expect(pilgrim).toBeInTheDocument();
    expect(pilgrim?.closest(".zazen-world__tile")).toBeNull();
  });

  it("serves every tile sprite as a png", () => {
    const { container } = render(<ZazenWorld />);
    const tiles = container.querySelectorAll<HTMLElement>(".zazen-world__tile-image");
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.style.backgroundImage).toMatch(/^url\(.*\/images\/zazen\/sol\/[\w-]+\.png.*\)$/);
    }
  });

  it("offers the walkable neighbours as buttons", () => {
    render(<ZazenWorld />);
    expect(screen.getAllByRole("button", { name: /walk to \d+, \d+/i }).length).toBeGreaterThan(0);
  });

  it("responds to a keyboard move without crashing", () => {
    render(<ZazenWorld />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("application")).toBeInTheDocument();
  });
});
