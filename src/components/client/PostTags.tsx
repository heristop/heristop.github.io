import { useEffect, useMemo, useState } from "react";
import type { LayoutLine } from "@chenglou/pretext";
import textReveal from "./use-text-reveal";

const { buildCharDrifts, getCharClass, getSmokeStyle, maxAnimationEnd, useReducedMotion } =
  textReveal;

const TAG_DURATION_MS = 700;
const TAG_STAGGER_MS = 120;
const APPEAR_DELAY_MS = 120;
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

interface TagProps {
  index: number;
  reducedMotion: boolean;
  tag: string;
}

const PostTag = ({ index, reducedMotion, tag }: TagProps) => {
  const [appeared, setAppeared] = useState(reducedMotion);
  const [settled, setSettled] = useState(reducedMotion);

  const charsByLine = useMemo(
    () => buildCharDrifts(makeSingleLine(tag), TAG_DURATION_MS),
    [tag],
  );

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

  return (
    <a className="post-page__tag" href={`/tags/${tag}/`} aria-label={tag}>
      {settled ? (
        <span aria-hidden="true">{tag}</span>
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
    </a>
  );
};

interface Props {
  tags: string[];
}

const PostTags = ({ tags }: Props) => {
  const reducedMotion = useReducedMotion();
  return (
    <div className="post-page__tags">
      {tags.map((tag, index) => (
        <PostTag key={tag} index={index} reducedMotion={reducedMotion} tag={tag} />
      ))}
    </div>
  );
};

export default PostTags;
