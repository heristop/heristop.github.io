import { memo, useEffect, useState } from "react";
import { loadPretext, usesCoarsePointer } from "@zazencode/ui/pretext-loader";

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

interface PillProps {
  index: number;
  item: TagItem;
  textWidth: number | undefined;
}

// The entrance is a CSS keyframe staggered by --i, so it starts from the SSR markup
// and never delays the hover transition
const TagPill = memo(({ index, item, textWidth }: PillProps) => {
  const style = {
    "--i": index,
    ...(textWidth === undefined ? {} : { "--tag-text-width": `${textWidth}px` }),
  } as React.CSSProperties;

  const pillClass = ["tags-page__pill", SIZE_CLASS[item.size]].filter(Boolean).join(" ");

  return (
    <a className={pillClass} href={`/tags/${item.tag}/`} style={style}>
      <span className="tags-page__pill-name">{item.tag}</span>
      <span className="tags-page__pill-count">{item.count}</span>
      {/* A bare number after the tag reads as "agents 1"; say what it counts */}
      <span className="sr-only">{item.count === 1 ? " post" : " posts"}</span>
    </a>
  );
});

const ZenTagCloud = ({ tags }: Props) => {
  const textWidths = useTextWidths(tags);

  return (
    <div className="tags-page__cloud">
      {tags.map((item, index) => (
        <TagPill
          key={item.tag}
          index={index}
          item={item}
          textWidth={textWidths?.get(`${item.tag}\u0000${item.size}`)}
        />
      ))}
    </div>
  );
};

export default ZenTagCloud;
