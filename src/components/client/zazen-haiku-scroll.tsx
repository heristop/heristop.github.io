import ZenTextReveal from "./zen-text-reveal";
import type { HaikuEntry } from "./zazen-garden-types";
import { STONE_COUNT } from "../../data/garden-schema";

interface Props {
  lines: readonly HaikuEntry[];
}

const HAIKU_FONT = "italic 0.95rem Georgia, serif";
const HAIKU_LINE_HEIGHT = 0.95 * 16 * 1.6;

// The poem, as it assembles. It used to render from the first moment of the game as an
// empty card holding a summary of the rules and a count of nothing — both of which the
// header now says better and says once. An empty panel is not a promise of content, it is
// furniture, so the scroll waits until it has a line to show.
const ZazenHaikuScroll = ({ lines }: Props) => {
  if (lines.length === 0) {
    return null;
  }

  return (
    <aside
      className="path-stones__scroll"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-labelledby="path-stones-scroll-title"
    >
      <h2 id="path-stones-scroll-title" className="path-stones__scroll-title">
        The Path
      </h2>
      <div className="path-stones__scroll-lines">
        {lines.map((entry) => (
          <ZenTextReveal
            key={entry.stoneIndex}
            text={entry.text}
            tag="p"
            className="path-stones__haiku-line"
            font={HAIKU_FONT}
            lineHeight={HAIKU_LINE_HEIGHT}
          />
        ))}
      </div>
      <p className="path-stones__scroll-progress" aria-hidden="true">
        {lines.length} of {STONE_COUNT} stones
      </p>
    </aside>
  );
};

export default ZazenHaikuScroll;
