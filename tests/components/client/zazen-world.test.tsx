import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/components/client/world.scss", () => ({}));

import ZazenWorld from "../../../src/components/client/zazen-world";

describe("<ZazenWorld />", () => {
  it("renders title and instructions", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("heading", { level: 1, name: /zazen world/i })).toBeInTheDocument();
    expect(screen.getByText(/use wasd keys/i)).toBeInTheDocument();
  });

  it("renders the four compass buttons", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("button", { name: /move north/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move south/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move east/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move west/i })).toBeInTheDocument();
  });

  it("renders a game map region", () => {
    render(<ZazenWorld />);
    expect(screen.getByRole("application", { name: /game world map/i })).toBeInTheDocument();
  });

  it("responds to a keyboard move without crashing", () => {
    render(<ZazenWorld />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("application")).toBeInTheDocument();
  });
});
