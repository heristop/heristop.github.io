import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Defeat from "../../../../src/components/client/garden/components/hud/defeat-overlay";
import Heatmap from "../../../../src/components/client/garden/components/hud/heatmap";
import Scroll from "../../../../src/components/client/garden/components/hud/haiku-scroll";

it("explains a defeat, focuses replay and restores prior scrolling on dismissal", () => {
  document.body.style.overflow = "auto";
  document.documentElement.style.overflow = "scroll";
  const replay = vi.fn();
  const { unmount } = render(
    <Defeat stonesFound={3} stonesLaid={9} steps={42} onReplay={replay} />,
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("3 / 5");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "No stone, shrine or frog rescue is within reach",
  );
  expect(screen.getByRole("button", { name: "Try a new route" })).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.click(screen.getByRole("button"));
  expect(replay).toHaveBeenCalledOnce();
  unmount();
  expect(document.body.style.overflow).toBe("auto");
  expect(document.documentElement.style.overflow).toBe("scroll");
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
});

it("lets pointer and keyboard users inspect and select history, including days without data", () => {
  const hover = vi.fn();
  const select = vi.fn();
  const { container } = render(
    <Heatmap
      days={[null, { date: "2026-09-01", count: 1, repo: "garden", language: "TypeScript" }]}
      pilgrimDay={0}
      inspectDay={1}
      focusDay={1}
      stoneDays={new Set([1])}
      shrineDay={0}
      onHoverDay={hover}
      onSelectDay={select}
    />,
  );
  const empty = screen.getByRole("button", { name: "Walk to Day 1, no data" });
  const day = screen.getByRole("button", { name: /1 September 2026, 1 contribution$/ });
  expect(container.querySelector(".path-stones__heat-readout")).toHaveTextContent("1 contribution");
  fireEvent.mouseEnter(day);
  expect(hover).toHaveBeenLastCalledWith(1);
  fireEvent.mouseLeave(day);
  expect(hover).toHaveBeenLastCalledWith(undefined);
  fireEvent.focus(empty);
  expect(hover).toHaveBeenLastCalledWith(0);
  fireEvent.blur(empty);
  expect(hover).toHaveBeenLastCalledWith(undefined);
  fireEvent.click(empty);
  fireEvent.click(day);
  expect(select.mock.calls).toEqual([[0], [1]]);
});

it("reveals the poem only after finding a stone and keeps earlier verses", () => {
  const { rerender } = render(<Scroll lines={[]} />);
  expect(screen.queryByRole("log")).toBeNull();
  rerender(
    <Scroll
      lines={[
        { stoneIndex: 0, text: "A quiet footstep" },
        { stoneIndex: 1, text: "The water listens" },
      ]}
    />,
  );
  expect(screen.getByRole("log")).toHaveTextContent("A quiet footstep");
  expect(screen.getByRole("log")).toHaveTextContent("The water listens");
  expect(screen.getByRole("log")).toHaveTextContent("2 of 5 stones");
});

it("separates counts from observed repositories and lists their actual languages", async () => {
  const { default: DayCard } = await import("../../../../src/components/client/garden/components/hud/day-card");
  render(<DayCard dayIndex={0} totalDays={14} inspecting={true} tile={{ posX: 1, posY: 1, sprite: "sand-0", walkable: true, decor: "", npc: 0, day: { date: "2026-09-09", count: 2, unit: "pushes", repo: "old/ignored", language: "PHP", projects: [{ repo: "current/one", language: "TypeScript" }, { repo: "current/two", language: "Rust" }, { repo: "current/three", language: "TypeScript" }] } }} />);
  expect(screen.getByText("2 pushes")).toBeInTheDocument();
  expect(screen.getByText("Public activity: current/one · current/two · current/three")).toBeInTheDocument();
  expect(screen.getByText("TypeScript · Rust")).toBeInTheDocument();
  expect(screen.queryByText("PHP")).not.toBeInTheDocument();
});
