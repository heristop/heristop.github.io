import type { Element, Root, Text } from "hast";
import type { RehypePlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";

/*
 * rehype-mermaid bakes every colour into the SVG: the theme in its <style> block, classDef colours
 * in inline styles (as hex in SVG, rgb() in the foreignObject HTML labels), and a few shades khroma
 * derived as hsl(). The render needs hex (khroma cannot parse oklch, see astro.config.mjs), so the
 * diagram cannot follow the site theme on its own.
 *
 * This plugin runs after rehypeMermaid and rewrites each known colour into
 * `var(--mermaid-*, <original>)`. The custom properties are mapped to the semantic tokens in
 * src/styles/_mermaid.scss, so diagrams follow light/dark like everything else; the original value
 * stays as the fallback, so the markup still renders correctly without that stylesheet.
 *
 * Keys are lowercase #rrggbb. Keep them in sync with mermaidConfig.themeVariables and with the
 * classDef palette used in src/content/blog.
 */
export const MERMAID_COLOR_TOKENS: Readonly<Record<string, string>> = {
  // Theme: primaryTextColor / textColor, and the title shade mermaid derives for cluster labels
  "#4a1f2c": "--mermaid-text",
  "#050c17": "--mermaid-text",
  "#333333": "--mermaid-text",
  // Theme: mainBkg / primaryColor, primaryBorderColor / nodeBorder
  "#f9ecec": "--mermaid-node-bg",
  "#f7e9ec": "--mermaid-node-bg",
  "#9c4f63": "--mermaid-node-border",
  // Theme: lineColor, and the arrowhead shade
  "#a8687a": "--mermaid-line",
  "#0b0b0b": "--mermaid-line",
  // Theme: edgeLabelBackground (also emitted as rgba(..., 0.5) behind labels)
  "#f5efe3": "--mermaid-edge-label-bg",
  // Theme: tertiaryColor / clusterBkg, and the cluster border derived from it
  "#faf3e8": "--mermaid-surface-subtle",
  "#e1dace": "--mermaid-border-soft",
  // Theme: secondaryColor (sequence activations) and its derived border
  "#f3ded8": "--mermaid-secondary-bg",
  "#e7bdb1": "--mermaid-secondary-border",
  // Default note colours (sequence diagrams)
  "#fff5ad": "--mermaid-note-bg",
  "#e4db95": "--mermaid-note-border",
  // classDef palette used in the articles
  "#c4a294": "--mermaid-border-soft",
  "#f7dde3": "--mermaid-accent-bg",
  "#f4ece4": "--mermaid-muted-bg",
  "#f7e6c8": "--mermaid-warn-bg",
  "#a8722a": "--mermaid-warn-border",
  "#4a2c12": "--mermaid-warn-text",
  "#edf1e5": "--mermaid-ok-bg",
  "#738463": "--mermaid-ok-border",
  "#34442c": "--mermaid-ok-text",
};

// Properties (hast names) that can carry a colour inside a mermaid SVG
const COLOR_PROPERTIES = ["style", "fill", "stroke", "color", "stopColor", "floodColor"] as const;

// An already rewritten var(--mermaid-*, fallback) is matched first and kept as-is, so running the
// plugin twice never nests vars. The fallback may hold one level of parentheses (rgb()).
const COLOR_PATTERN =
  /var\(--mermaid-[\w-]+,\s*(?:[^()]|\([^()]*\))*\)|#[\da-f]{3,8}(?![\w-])|rgba?\([^()]*\)|hsla?\([^()]*\)/gi;

const toHexByte = (value: number): string =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");

const hslToRgb = (hue: number, saturation: number, lightness: number): number[] => {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [channel(0), channel(8), channel(4)];
};

/** Normalises a CSS colour literal to lowercase #rrggbb (alpha ignored); null if not parseable. */
export const normalizeColor = (literal: string): string | null => {
  const value = literal.trim().toLowerCase();
  if (value.startsWith("#")) {
    const digits = value.slice(1);
    if (digits.length === 3 || digits.length === 4) {
      return `#${digits.slice(0, 3).replace(/./g, "$&$&")}`;
    }
    if (digits.length === 6 || digits.length === 8) {
      return `#${digits.slice(0, 6)}`;
    }
    return null;
  }
  const numbers = value.match(/-?[\d.]+/g)?.map(Number);
  if (!numbers || numbers.length < 3 || numbers.some(Number.isNaN)) {
    return null;
  }
  const [first = 0, second = 0, third = 0] = numbers;
  const rgb = value.startsWith("hsl") ? hslToRgb(first, second, third) : [first, second, third];
  return `#${rgb.map(toHexByte).join("")}`;
};

/** Wraps every known colour in `value` as `var(--mermaid-*, <original>)`. */
export const tokenizeColors = (value: string): string =>
  value.replace(COLOR_PATTERN, (match) => {
    if (match.startsWith("var(")) {
      return match;
    }
    const hex = normalizeColor(match);
    const token = hex ? MERMAID_COLOR_TOKENS[hex] : undefined;
    return token ? `var(${token}, ${match})` : match;
  });

const isMermaidSvg = (element: Element): boolean => {
  const id = element.properties?.["id"];
  return (
    element.tagName === "svg" &&
    typeof id === "string" &&
    id.startsWith("mermaid-") &&
    element.properties?.["ariaRoleDescription"] !== undefined
  );
};

const rewriteDiagram = (svg: Element): void => {
  visit(svg, "element", (element: Element) => {
    const { properties } = element;
    for (const name of COLOR_PROPERTIES) {
      const value = properties?.[name];
      if (typeof value === "string") {
        properties[name] = tokenizeColors(value);
      }
    }
    // Only the <style> block's text is CSS; label text that happens to read "#333" stays as written
    if (element.tagName === "style") {
      for (const child of element.children) {
        if (child.type === "text") {
          (child as Text).value = tokenizeColors((child as Text).value);
        }
      }
    }
  });
};

// Only mermaid's own SVGs are touched: icons and other inline SVGs keep their colours
export const mermaidTokens: RehypePlugin = () => (tree: Root) => {
  visit(tree, "element", (element: Element) => {
    if (!isMermaidSvg(element)) {
      return;
    }
    rewriteDiagram(element);
    return "skip";
  });
};
