import type { Element, ElementContent, Root, RootContent } from "hast";
import type { RehypePlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";

/*
 * Mermaid ships its SVG as role="graphics-document document" with aria-roledescription
 * "flowchart-v2", and its labels live in <foreignObject> HTML: a screen reader either reads a stray
 * list of box labels or announces "flowchart-v2" with no name. Each diagram becomes one image:
 * named by its accTitle/accDescr (<title>/<desc>) when the fence has them, otherwise by a short
 * summary built from its node labels. The `.mermaid-wide` scroller around a diagram becomes a
 * focusable, named group so keyboard users can scroll it (like the code blocks).
 */

const MAX_SUMMARY_LABELS = 12;

const DIAGRAM_KINDS: Readonly<Record<string, string>> = {
  flowchart: "Flowchart",
  sequence: "Sequence diagram",
  class: "Class diagram",
  state: "State diagram",
  er: "Entity relationship diagram",
  gantt: "Gantt chart",
  pie: "Pie chart",
  mindmap: "Mind map",
  timeline: "Timeline",
};

const hasClass = (element: Element, name: string): boolean => {
  const value = element.properties?.["className"];
  return Array.isArray(value) ? value.includes(name) : value === name;
};

const textOf = (node: ElementContent): string => {
  if (node.type === "text") {
    return node.value;
  }
  if (node.type === "element") {
    return node.children.map(textOf).join("");
  }
  return "";
};

const findChild = (svg: Element, tagName: string): Element | undefined =>
  svg.children.find(
    (child): child is Element => child.type === "element" && child.tagName === tagName,
  );

const isMermaidSvg = (element: Element): boolean => {
  const id = element.properties?.["id"];
  return element.tagName === "svg" && typeof id === "string" && id.startsWith("mermaid-");
};

const describeKind = (roleDescription: unknown): string => {
  const raw = typeof roleDescription === "string" ? roleDescription.toLowerCase() : "";
  const key = Object.keys(DIAGRAM_KINDS).find((kind) => raw.startsWith(kind));
  return key === undefined ? "Diagram" : (DIAGRAM_KINDS[key] ?? "Diagram");
};

/** The node labels of a diagram, in document order, without blanks or repeats. */
export const collectNodeLabels = (svg: Element): string[] => {
  const labels: string[] = [];
  visit(svg, "element", (element: Element) => {
    if (!hasClass(element, "nodeLabel")) {
      return;
    }
    const label = textOf(element).replaceAll(/\s+/g, " ").trim();
    if (label !== "" && !labels.includes(label)) {
      labels.push(label);
    }
  });
  return labels;
};

/** "Flowchart: a, b, c" — capped, so a large diagram stays a summary, not a transcript. */
export const summarizeDiagram = (kind: string, labels: string[]): string => {
  if (labels.length === 0) {
    return kind;
  }
  const shown = labels.slice(0, MAX_SUMMARY_LABELS);
  const more = labels.length - shown.length;
  return `${kind}: ${shown.join(", ")}${more > 0 ? `, and ${more} more` : ""}`;
};

const labelSvg = (svg: Element): string => {
  svg.properties ??= {};
  const kind = describeKind(svg.properties["ariaRoleDescription"]);
  svg.properties["role"] = "img";
  delete svg.properties["ariaRoleDescription"];
  const title = findChild(svg, "title");
  if (title !== undefined) {
    return textOf(title).trim();
  }
  // No accTitle: mermaid still points aria-labelledby/-describedby at ids that do not exist
  delete svg.properties["ariaLabelledBy"];
  delete svg.properties["ariaDescribedBy"];
  const summary = summarizeDiagram(kind, collectNodeLabels(svg));
  svg.properties["ariaLabel"] = summary;
  return summary;
};

const scrollerName = (svg: Element | undefined): string => {
  const title = svg === undefined ? undefined : findChild(svg, "title");
  const name = title === undefined ? "" : textOf(title).trim();
  return name === "" ? "Scrollable diagram" : `Diagram: ${name}`;
};

const escapeAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const SCROLLER_OPEN_TAG = /<div class="mermaid-wide"(?![^>]*tabindex)/;

/* In markdown, `<div class="mermaid-wide">` around a fence stays a raw HTML node beside the
   rendered SVG, so the attributes go into the raw opening tag */
// Raw nodes come from mdast-util-to-hast (allowDangerousHtml); hast's own types omit them
interface RawNode {
  type: "raw";
  value: string;
}

const isRawNode = (node: unknown): node is RawNode =>
  typeof node === "object" &&
  node !== null &&
  (node as { type?: unknown }).type === "raw" &&
  typeof (node as { value?: unknown }).value === "string";

const labelRawScroller = (
  node: RawNode,
  index: number | undefined,
  siblings: RootContent[],
): void => {
  if (!SCROLLER_OPEN_TAG.test(node.value) || index === undefined) {
    return;
  }
  const svg = siblings
    .slice(index + 1)
    .find((sibling): sibling is Element => sibling.type === "element" && isMermaidSvg(sibling));
  const name = escapeAttribute(scrollerName(svg));
  node.value = node.value.replace(
    SCROLLER_OPEN_TAG,
    `<div class="mermaid-wide" tabindex="0" role="group" aria-label="${name}"`,
  );
};

export const mermaidA11y: RehypePlugin = () => (tree: Root) => {
  visit(tree, "element", (element: Element) => {
    if (isMermaidSvg(element)) {
      labelSvg(element);
    }
  });
  visit(tree, "element", (element: Element) => {
    if (!hasClass(element, "mermaid-wide")) {
      return;
    }
    const svg = element.children.find(
      (child): child is Element => child.type === "element" && isMermaidSvg(child),
    );
    element.properties ??= {};
    element.properties["tabIndex"] = 0;
    element.properties["role"] = "group";
    element.properties["ariaLabel"] = scrollerName(svg);
  });
  visit(tree, isRawNode, (node, index, parent) => {
    if (isRawNode(node)) {
      labelRawScroller(node, index, (parent as Root | Element | undefined)?.children ?? []);
    }
  });
};
