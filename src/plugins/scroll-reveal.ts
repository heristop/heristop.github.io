import type { Element, ElementContent, Root } from "hast";
import type { RehypePlugin } from "@astrojs/markdown-remark";

/* Marks an article's top-level blocks for the scroll reveal (client/scroll-reveal.ts): prose rises
   in as it is reached, rules fade, code, tables and diagrams settle. Blocks that already have an
   entrance of their own are left alone: images are drawn by the ink reveal, and media keep their
   player. Raw HTML (image containers, videos) reaches rehype as strings and is never marked. */

const FADE = new Set(["hr"]);
const SETTLE = new Set(["pre", "table", "svg"]);
const OWN_ENTRANCE = new Set(["img", "picture", "video", "audio", "iframe", "canvas"]);

const hasOwnEntrance = (node: ElementContent): boolean =>
  node.type === "element" &&
  (OWN_ENTRANCE.has(node.tagName) || node.children.some((child) => hasOwnEntrance(child)));

export const revealVariant = (element: Element): string | undefined => {
  if (hasOwnEntrance(element)) {
    return undefined;
  }
  if (FADE.has(element.tagName)) {
    return "fade";
  }
  return SETTLE.has(element.tagName) ? "settle" : "";
};

export const scrollReveal: RehypePlugin = () => (tree: Root) => {
  for (const node of tree.children) {
    if (node.type !== "element") {
      continue;
    }
    const variant = revealVariant(node);
    if (variant !== undefined) {
      node.properties ??= {};
      node.properties["dataScrollReveal"] = variant;
    }
  }
};
