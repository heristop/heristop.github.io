import { memo } from "react";

interface TagItem {
  tag: string;
  count: number;
  size: "sm" | "md" | "lg";
}

interface Props {
  tags: TagItem[];
}

const SIZE_CLASS: Record<TagItem["size"], string> = {
  sm: "",
  md: "tags-page__pill--md",
  lg: "tags-page__pill--lg",
};

interface PillProps {
  index: number;
  item: TagItem;
}

// The entrance is a CSS keyframe staggered by --i, so it starts from the SSR markup
// and never delays the hover transition
const TagPill = memo(({ index, item }: PillProps) => {
  const style = { "--i": index } as React.CSSProperties;
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

const ZenTagCloud = ({ tags }: Props) => (
  <div className="tags-page__cloud">
    {tags.map((item, index) => (
      <TagPill key={item.tag} index={index} item={item} />
    ))}
  </div>
);

export default ZenTagCloud;
