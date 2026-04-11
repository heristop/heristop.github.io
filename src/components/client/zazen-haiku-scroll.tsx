import ZenTextReveal from "./zen-text-reveal";
import type { HaikuEntry } from "./zazen-world-types";
import { STONES } from "./zazen-world-helpers";

interface Props {
  lines: readonly HaikuEntry[];
}

const HAIKU_FONT = "italic 0.95rem Georgia, serif";
const HAIKU_LINE_HEIGHT = 0.95 * 16 * 1.6;

const ZazenHaikuScroll = ({ lines }: Props) => {
  const total = STONES.length;
  const found = lines.length;

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
      {found === 0 ? (
        <p className="path-stones__scroll-placeholder">Walk the path. Find the stones.</p>
      ) : (
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
      )}
      <p className="path-stones__scroll-progress" aria-hidden="true">
        {found} of {total} stones
      </p>
    </aside>
  );
};

export default ZazenHaikuScroll;
