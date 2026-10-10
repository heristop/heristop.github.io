import { memo, useEffect, useMemo, useState } from "react";
import { loadPretext, usesCoarsePointer } from "@zazencode/ui/pretext-loader";
import type { LayoutLine } from "@chenglou/pretext";
import textReveal from "@zazencode/ui/text-reveal-motion";
import type { CharDrift } from "@zazencode/ui/text-reveal-motion";

const { buildCharDrifts, getCharClass, getSmokeStyle, maxAnimationEnd, useReducedMotion } = textReveal;

interface TagItem {
  tag: string;
  count: number;
  size: "sm" | "md" | "lg";
}

interface Props {
  tags: TagItem[];
}

const BASE_PX = 16;
// Matches the pill's CSS letter-spacing: 0.02em
const LETTER_SPACING_EM = 0.02;
const FONT_BY_SIZE: Record<TagItem["size"], { font: string; px: number }> = {
  sm: { font: "500 0.85rem Comfortaa, sans-serif", px: 0.85 * BASE_PX },
  md: { font: "600 0.95rem Comfortaa, sans-serif", px: 0.95 * BASE_PX },
  lg: { font: "600 1.05rem Comfortaa, sans-serif", px: 1.05 * BASE_PX },
};

const SIZE_CLASS: Record<TagItem["size"], string> = {
  sm: "",
  md: "tags-page__pill--md",
  lg: "tags-page__pill--lg",
};

const TAG_DURATION_MS = 700;
const TAG_STAGGER_MS = 45;
const APPEAR_DELAY_MS = 80;
const SETTLE_BUFFER_MS = 250;
const NBSP = "\u00A0";

const makeSingleLine = (text: string): LayoutLine[] => [
  {
    end: { graphemeIndex: 0, segmentIndex: 0 },
    start: { graphemeIndex: 0, segmentIndex: 0 },
    text,
    width: 0,
  },
];

// All pills switch to "in" together at APPEAR_DELAY_MS; the stagger lives in the CSS delays
const getPillDelayMs = (index: number) => APPEAR_DELAY_MS + 2 * index * TAG_STAGGER_MS;

const buildPillChars = (tag: string, index: number): CharDrift[][] => {
  const offset = index * TAG_STAGGER_MS;
  return buildCharDrifts(makeSingleLine(tag), TAG_DURATION_MS).map((line) =>
    line.map((charDrift) => ({ ...charDrift, delay: charDrift.delay + offset }))
  );
};

const waitForFonts = async (fonts: string[]): Promise<void> => {
  const faceSet = globalThis.document?.fonts;
  if (!faceSet) {
    return;
  }
  await Promise.all(fonts.map((font) => faceSet.load(font).catch(() => [])));
};

// One pretext load and one state update for the whole cloud instead of one per pill
const useTextWidths = (tags: TagItem[]): Map<string, number> | null => {
  const [widths, setWidths] = useState<Map<string, number> | null>(null);

  useEffect(() => {
    if (usesCoarsePointer() || tags.length === 0) {
      setWidths(null);
      return;
    }
    let cancelled = false;
    const fonts = [...new Set(tags.map((item) => FONT_BY_SIZE[item.size].font))];
    void Promise.all([loadPretext(), waitForFonts(fonts)])
      .then(([{ measureNaturalWidth, prepareWithSegments }]) => {
        if (cancelled) {
          return;
        }
        const next = new Map<string, number>();
        for (const item of tags) {
          const { font, px } = FONT_BY_SIZE[item.size];
          try {
            const prepared = prepareWithSegments(item.tag, font, {
              letterSpacing: LETTER_SPACING_EM * px,
            });
            next.set(`${item.tag}\u0000${item.size}`, measureNaturalWidth(prepared));
          } catch {
            // Leave unmeasured; CSS falls back to 100%
          }
        }
        setWidths(next);
      })
      .catch(() => {
        if (!cancelled) {
          setWidths(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tags]);

  return widths;
};

const useRevealPhases = (tags: TagItem[], reducedMotion: boolean) => {
  const [mounted, setMounted] = useState(false);
  const [appeared, setAppeared] = useState(false);
  const [settled, setSettled] = useState(false);

  const charsByTag = useMemo(
    () => tags.map((item, index) => buildPillChars(item.tag, index)),
    [tags]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (reducedMotion || appeared) {
      return;
    }
    const timer = setTimeout(() => {
      setAppeared(true);
    }, APPEAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !appeared || settled) {
      return;
    }
    let lastEnd = 0;
    for (const chars of charsByTag) {
      lastEnd = Math.max(lastEnd, maxAnimationEnd(chars));
    }
    const timer = setTimeout(() => {
      setSettled(true);
    }, lastEnd + SETTLE_BUFFER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, charsByTag, reducedMotion, settled]);

  return {
    appeared: appeared || reducedMotion,
    charsByTag,
    mounted,
    settled: settled || reducedMotion,
  };
};

interface PillProps {
  appeared: boolean;
  charsByLine: CharDrift[][];
  index: number;
  item: TagItem;
  reducedMotion: boolean;
  showPlainText: boolean;
  textWidth: number | undefined;
}

const TagPill = memo(
  ({ appeared, charsByLine, index, item, reducedMotion, showPlainText, textWidth }: PillProps) => {
    const style = {
      "--tag-pill-delay": `${getPillDelayMs(index)}ms`,
      ...(textWidth === undefined ? {} : { "--tag-text-width": `${textWidth}px` }),
    } as React.CSSProperties;

    const pillClass = [
      "tags-page__pill",
      SIZE_CLASS[item.size],
      reducedMotion ? "" : "tags-page__pill--flow",
      appeared ? "tags-page__pill--in" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const charClass = getCharClass(false, appeared, reducedMotion);

    return (
      <a className={pillClass} href={`/tags/${item.tag}/`} style={style}>
        <span className="tags-page__pill-name" aria-label={item.tag}>
          {showPlainText ? (
            <span aria-hidden="true">{item.tag}</span>
          ) : (
            charsByLine.map((lineChars, lineIndex) => (
              <span key={`line-${lineIndex}`} aria-hidden="true" style={{ display: "inline" }}>
                {lineChars.map((charDrift) => (
                  <span
                    key={charDrift.key}
                    className={charClass}
                    style={getSmokeStyle(charDrift, reducedMotion)}
                  >
                    {charDrift.char === " " ? NBSP : charDrift.char}
                  </span>
                ))}
              </span>
            ))
          )}
        </span>
        <span className="tags-page__pill-count">{item.count}</span>
      </a>
    );
  }
);

const ZenTagCloud = ({ tags }: Props) => {
  const reducedMotion = useReducedMotion();
  const textWidths = useTextWidths(tags);
  const { appeared, charsByTag, mounted, settled } = useRevealPhases(tags, reducedMotion);
  const showPlainText = !mounted || settled;

  return (
    <div className="tags-page__cloud">
      {tags.map((item, index) => (
        <TagPill
          key={item.tag}
          appeared={appeared}
          charsByLine={charsByTag[index]}
          index={index}
          item={item}
          reducedMotion={reducedMotion}
          showPlainText={showPlainText}
          textWidth={textWidths?.get(`${item.tag}\u0000${item.size}`)}
        />
      ))}
    </div>
  );
};

export default ZenTagCloud;
