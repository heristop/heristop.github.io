import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useStride from "../../../../src/components/client/garden/composables/use-stride";
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
    return <Figure {...props} position={position} greeting={false} walking={walking} />;
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
