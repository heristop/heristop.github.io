import { describe, expect, it } from "vitest";
import type { Element, ElementContent, Root } from "hast";
import { mermaidA11y, summarizeDiagram } from "../../src/plugins/mermaid-a11y";

type Transformer = (tree: Root, file: unknown, next: () => void) => void;

// hast types some aria props as token lists; mermaid emits plain strings, so the fixtures do too
const el = (tagName: string, properties: Record<string, unknown>, children: ElementContent[] = []): Element => ({
  type: "element",
  tagName,
  properties: properties as Element["properties"],
  children,
});

const text = (value: string): ElementContent => ({ type: "text", value });

const nodeLabel = (value: string): Element =>
  el("foreignObject", {}, [el("div", {}, [el("span", { className: ["nodeLabel"] }, [text(value)])])]);

const run = (...children: Element[]): Root => {
  const tree: Root = { type: "root", children };
  const transformer = mermaidA11y.call(undefined as never) as unknown as Transformer;
  transformer(tree, { path: "test" }, () => {});
  return tree;
};

describe("mermaidA11y plugin", () => {
  it("keeps the accTitle/accDescr naming and turns the diagram into one image", () => {
    const svg = el(
      "svg",
      {
        id: "mermaid-0",
        role: "graphics-document document",
        ariaRoleDescription: "flowchart-v2",
        ariaLabelledBy: "chart-title-mermaid-0",
        ariaDescribedBy: "chart-desc-mermaid-0",
      },
      [el("title", { id: "chart-title-mermaid-0" }, [text("The loop")]), nodeLabel("Intent")],
    );
    run(svg);
    expect(svg.properties).toMatchObject({
      role: "img",
      ariaLabelledBy: "chart-title-mermaid-0",
      ariaDescribedBy: "chart-desc-mermaid-0",
    });
    expect(svg.properties["ariaRoleDescription"]).toBeUndefined();
    expect(svg.properties["ariaLabel"]).toBeUndefined();
  });

  it("summarises the node labels when the fence has no accTitle", () => {
    const svg = el(
      "svg",
      { id: "mermaid-1", ariaRoleDescription: "flowchart-v2" },
      [nodeLabel("descriptor.json"), nodeLabel("Engine"), nodeLabel("Engine"), nodeLabel("  ")],
    );
    run(svg);
    expect(svg.properties["role"]).toBe("img");
    expect(svg.properties["ariaLabel"]).toBe("Flowchart: descriptor.json, Engine");
  });

  it("makes the wide scroller a focusable group named after the diagram", () => {
    const svg = el("svg", { id: "mermaid-2" }, [el("title", {}, [text("Build matrix")])]);
    const wide = el("div", { className: ["mermaid-wide"] }, [text("\n"), svg]);
    run(wide);
    expect(wide.properties).toMatchObject({ tabIndex: 0, role: "group", ariaLabel: "Diagram: Build matrix" });
  });

  it("labels a raw-HTML scroller from markdown through its opening tag", () => {
    const open = { type: "raw", value: '<div class="mermaid-wide">' } as unknown as Element;
    const svg = el("svg", { id: "mermaid-3" }, [el("title", {}, [text('Say "hi" & go')])]);
    const close = { type: "raw", value: "</div>" } as unknown as Element;
    run(open, svg, close);
    expect((open as unknown as { value: string }).value).toBe(
      '<div class="mermaid-wide" tabindex="0" role="group" aria-label="Diagram: Say &quot;hi&quot; &amp; go">',
    );
    run(open, svg, close);
    expect((open as unknown as { value: string }).value.match(/tabindex/g)).toHaveLength(1);
  });

  it("leaves non-mermaid SVGs alone", () => {
    const svg = el("svg", { id: "icon" }, []);
    run(svg);
    expect(svg.properties).toEqual({ id: "icon" });
  });
});

describe("summarizeDiagram", () => {
  it("caps long diagrams", () => {
    const labels = Array.from({ length: 15 }, (_, index) => `n${index}`);
    expect(summarizeDiagram("Flowchart", labels)).toMatch(/n11, and 3 more$/);
  });

  it("falls back to the kind alone", () => {
    expect(summarizeDiagram("Diagram", [])).toBe("Diagram");
  });
});
