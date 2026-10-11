import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import { mermaidTokens, normalizeColor, tokenizeColors } from "../../src/plugins/mermaid-tokens";

type Transformer = (tree: Root, file: unknown, next: () => void) => void;

const run = (...children: Element[]): Root => {
  const tree: Root = { type: "root", children };
  const transformer = mermaidTokens.call(undefined as never) as unknown as Transformer;
  transformer(tree, { path: "test" }, () => {});
  return tree;
};

// A trimmed rehype-mermaid flowchart: theme <style>, a classDef'd node shape and its HTML label
const makeDiagram = (): Element => ({
  type: "element",
  tagName: "svg",
  properties: { id: "mermaid-0", ariaRoleDescription: ["flowchart-v2"] },
  children: [
    {
      type: "element",
      tagName: "style",
      properties: {},
      children: [
        {
          type: "text",
          value:
            "#mermaid-0{fill:#4a1f2c;}#mermaid-0 .node rect{fill:#f9ecec;stroke:#9c4f63;}" +
            "#mermaid-0 .cluster rect{stroke:hsl(36.6666666667, 24.2857142857%, 84.5098039216%);}" +
            "#mermaid-0 .labelBkg{background-color:rgba(245, 239, 227, 0.5);}" +
            "#mermaid-0 .node .katex path{fill:#000;}",
        },
      ],
    },
    {
      type: "element",
      tagName: "rect",
      properties: { style: "fill:#f7dde3 !important;stroke:#9c4f63 !important", fill: "#a8687a" },
      children: [],
    },
    {
      type: "element",
      tagName: "foreignObject",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "div",
          properties: { style: "color: rgb(74, 44, 18) !important; display: table-cell;" },
          children: [{ type: "text", value: "#333 stays" }],
        },
      ],
    },
  ],
});

const styleText = (svg: Element): string => {
  const style = svg.children[0] as Element;
  return (style.children[0] as { value: string }).value;
};

describe("normalizeColor", () => {
  it("reads hex, rgb() and hsl() literals as #rrggbb", () => {
    expect(normalizeColor("#ABC")).toBe("#aabbcc");
    expect(normalizeColor("#4a1f2cff")).toBe("#4a1f2c");
    expect(normalizeColor("rgb(74, 31, 44)")).toBe("#4a1f2c");
    expect(normalizeColor("rgba(245, 239, 227, 0.5)")).toBe("#f5efe3");
    expect(normalizeColor("hsl(36.6666666667, 24.2857142857%, 84.5098039216%)")).toBe("#e1dace");
  });
});

describe("tokenizeColors", () => {
  it("keeps the original colour as the fallback", () => {
    expect(tokenizeColors("fill:#f9ecec")).toBe("fill:var(--mermaid-node-bg, #f9ecec)");
  });

  it("leaves unknown colours and selector ids alone", () => {
    expect(tokenizeColors("#mermaid-0 .a{fill:#000;}")).toBe("#mermaid-0 .a{fill:#000;}");
  });

  it("is idempotent", () => {
    const once = tokenizeColors("color:rgb(74, 31, 44)");
    expect(once).toBe("color:var(--mermaid-text, rgb(74, 31, 44))");
    expect(tokenizeColors(once)).toBe(once);
  });
});

describe("mermaidTokens plugin", () => {
  it("rewrites the style block, style and colour attributes of a mermaid svg", () => {
    const svg = makeDiagram();
    run(svg);
    const css = styleText(svg);
    expect(css).toContain("#mermaid-0{fill:var(--mermaid-text, #4a1f2c);}");
    expect(css).toContain("stroke:var(--mermaid-node-border, #9c4f63)");
    expect(css).toContain(
      "stroke:var(--mermaid-border-soft, hsl(36.6666666667, 24.2857142857%, 84.5098039216%))",
    );
    expect(css).toContain("var(--mermaid-edge-label-bg, rgba(245, 239, 227, 0.5))");
    expect(css).toContain("fill:#000;");

    const rect = svg.children[1] as Element;
    expect(rect.properties["style"]).toBe(
      "fill:var(--mermaid-accent-bg, #f7dde3) !important;stroke:var(--mermaid-node-border, #9c4f63) !important",
    );
    expect(rect.properties["fill"]).toBe("var(--mermaid-line, #a8687a)");

    const label = (svg.children[2] as Element).children[0] as Element;
    expect(label.properties["style"]).toBe(
      "color: var(--mermaid-warn-text, rgb(74, 44, 18)) !important; display: table-cell;",
    );
    expect(label.children[0]).toMatchObject({ value: "#333 stays" });
  });

  it("leaves other svgs untouched", () => {
    const icon: Element = {
      type: "element",
      tagName: "svg",
      properties: { id: "icon", fill: "#4a1f2c", style: "color:#9c4f63" },
      children: [
        {
          type: "element",
          tagName: "style",
          properties: {},
          children: [{ type: "text", value: "a{fill:#f9ecec}" }],
        },
      ],
    };
    run(icon);
    expect(icon.properties).toEqual({ id: "icon", fill: "#4a1f2c", style: "color:#9c4f63" });
    expect(styleText(icon)).toBe("a{fill:#f9ecec}");
  });
});
