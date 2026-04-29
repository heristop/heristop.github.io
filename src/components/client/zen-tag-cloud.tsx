import { useEffect, useMemo, useRef, useState } from "react";
import { loadPretext, usesCoarsePointer } from "./pretext-loader";
import type { LayoutLine } from "@chenglou/pretext";
import textReveal from "./use-text-reveal";

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

interface PillProps {
  item: TagItem;
  index: number;
  reducedMotion: boolean;
}

const TagPill = ({ item, index, reducedMotion }: PillProps) => {
  const [mounted, setMounted] = useState(false);
  const [appeared, setAppeared] = useState(reducedMotion);
  const [settled, setSettled] = useState(reducedMotion);
  const [textWidth, setTextWidth] = useState<number | null>(null);
  const measuredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const charsByLine = useMemo(
    () => buildCharDrifts(makeSingleLine(item.tag), TAG_DURATION_MS),
    [item.tag]
  );

  useEffect(() => {
    const measuredKey = `${item.tag}\u0000${item.size}`;
    if (measuredKeyRef.current === measuredKey) {
      return;
    }
    measuredKeyRef.current = measuredKey;
    if (usesCoarsePointer()) {
      setTextWidth(null);
      return;
    }
    let cancelled = false;
    void loadPretext()
      .then(({ measureNaturalWidth, prepareWithSegments }) => {
        if (cancelled) {
          return;
        }
        try {
          const prepared = prepareWithSegments(item.tag, FONT_BY_SIZE[item.size].font);
          setTextWidth(measureNaturalWidth(prepared));
        } catch {
          setTextWidth(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTextWidth(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item.tag, item.size]);

  useEffect(() => {
    if (reducedMotion || appeared) {
      return;
    }
    const delay = APPEAR_DELAY_MS + index * TAG_STAGGER_MS;
    const timer = setTimeout(() => {
      setAppeared(true);
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, index, reducedMotion]);

  useEffect(() => {
    if (reducedMotion || !appeared || settled) {
      return;
    }
    const totalMs = maxAnimationEnd(charsByLine) + SETTLE_BUFFER_MS;
    const timer = setTimeout(() => {
      setSettled(true);
    }, totalMs);
    return () => {
      clearTimeout(timer);
    };
  }, [appeared, charsByLine, reducedMotion, settled]);

  const pillDelayMs = APPEAR_DELAY_MS + index * TAG_STAGGER_MS;
  const style: React.CSSProperties = {
    "--tag-pill-delay": `${pillDelayMs}ms`,
  } as React.CSSProperties;
  if (textWidth !== null) {
    (style as Record<string, string>)["--tag-text-width"] = `${textWidth}px`;
  }

  const pillClass = [
    "tags-page__pill",
    SIZE_CLASS[item.size],
    reducedMotion ? "" : "tags-page__pill--flow",
    appeared || reducedMotion ? "tags-page__pill--in" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showPlainText = !mounted || settled;

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
                  className={getCharClass(settled, appeared, reducedMotion)}
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
};

const ZenTagCloud = ({ tags }: Props) => {
  const reducedMotion = useReducedMotion();
  return (
    <div className="tags-page__cloud">
      {tags.map((item, index) => (
        <TagPill
          key={item.tag}
          index={index}
          item={item}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
};

export default ZenTagCloud;
