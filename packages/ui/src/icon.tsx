import type { LucideProps } from "lucide-react";
import "./icon.css";
import { icons, type IconName } from "./icon-registry";

export interface IconProps extends Omit<LucideProps, "name"> {
  name: IconName;
}

export default function Icon({
  name,
  size = 24,
  strokeWidth = 1.5,
  className,
  ...props
}: IconProps) {
  const Glyph = icons[name];
  const labelled = Boolean(props["aria-label"] || props["aria-labelledby"]);
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={["icon", className].filter(Boolean).join(" ")}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      {...props}
    />
  );
}
