import type { Element } from "hast";
import type { RehypePlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";

const PLAIN_LANGUAGES = new Set(["", "text", "plaintext", "txt"]);

const getLanguage = (element: Element): string => {
  const value = element.properties?.["dataLanguage"];
  return typeof value === "string" ? value : "";
};

// Overflowing code blocks scroll sideways; a focusable, named group lets keyboard and screen
// reader users reach and scroll them (Shiki adds tabindex, but not a role or a name).
// A group, not a region: a region is a landmark, and an article with nine code blocks would
// bury the real landmarks (banner, main, footer) in the screen reader's landmark list
export const codeRegion: RehypePlugin = () => (tree) => {
  visit(tree, "element", (element: Element) => {
    if (element.tagName !== "pre") {
      return;
    }
    const language = getLanguage(element);
    element.properties ??= {};
    element.properties["tabIndex"] = 0;
    element.properties["role"] = "group";
    element.properties["ariaLabel"] = PLAIN_LANGUAGES.has(language.toLowerCase())
      ? "Code block"
      : `${language} code block`;
  });
};
