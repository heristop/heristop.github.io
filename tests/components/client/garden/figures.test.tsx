import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStride from "../../../../src/components/client/garden/composables/use-stride";
import Frog from "../../../../src/components/client/garden/components/figures/frog";
import Cat from "../../../../src/components/client/garden/components/figures/cat";
import Companion from "../../../../src/components/client/garden/components/figures/companion";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const props = { position: { posX: 2, posY: 3 }, facingLeft: false, offsetX: 0, offsetY: 0 };

for (const [name, Figure, selector] of [
  ["cat", Cat, ".zazen-world__cat"],
  ["NPC-2", Companion, ".zazen-world__companion"],
] as const) {
  const AnimatedFigure = ({ position }: { position: typeof props.position }) => {
    const walking = useStride(position);
    return (
      <Figure
        {...props}
        position={position}
        greeting={false}
        transforming={false}
        walking={walking}
      />
    );
  };
  describe(name, () => {
    it("starts idle, walks only after a move, then settles", () => {
      const { container, rerender } = render(<AnimatedFigure position={props.position} />);
      expect(container.querySelector(selector)).not.toHaveClass(`${selector.slice(1)}--walking`);
      rerender(<AnimatedFigure position={{ posX: 3, posY: 3 }} />);
      expect(container.querySelector(selector)).toHaveClass(`${selector.slice(1)}--walking`);
      act(() => {
        vi.advanceTimersByTime(460);
      });
      expect(container.querySelector(selector)).not.toHaveClass(`${selector.slice(1)}--walking`);
    });
  });
}

describe("frog shadow", () => {
  it("keeps the ground shadow in the same moving actor as the jumping sprite", () => {
    const { container, rerender } = render(<Frog {...props} hopping={false} />);
    const actor = container.querySelector(".zazen-world__frog-actor")!;
    const shadow = container.querySelector(".zazen-world__frog-shadow")!;
    const sprite = container.querySelector("img")!;
    expect(shadow.parentElement).toBe(actor);
    expect(sprite.parentElement).toBe(actor);
    const start = (actor as HTMLElement).style.left;
    rerender(<Frog {...props} position={{ posX: 3, posY: 3 }} hopping />);
    expect(actor).toHaveAttribute("data-hopping", "true");
    expect((actor as HTMLElement).style.left).not.toBe(start);
    expect(shadow.parentElement).toBe(actor);
  });
});
