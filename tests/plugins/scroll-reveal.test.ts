import { describe, expect, it } from "vitest";
import type { Element, ElementContent, Root, RootContent } from "hast";
import { scrollReveal } from "../../src/plugins/scroll-reveal";

type Transformer = (tree: Root, file: unknown, next: () => void) => void;

const el = (tagName: string, children: ElementContent[] = []): Element => ({
  type: "element",
  tagName,
  properties: {},
  children,
});

const run = (...children: RootContent[]): Root => {
  const tree: Root = { type: "root", children };
  const transformer = scrollReveal.call(undefined as never) as unknown as Transformer;
  transformer(tree, { path: "test" }, () => {});
  return tree;
};

describe("scrollReveal plugin", () => {
  it("marks prose to rise, rules to fade, and code, tables and diagrams to settle", () => {
    const [p, h2, hr, pre, table, svg] = ["p", "h2", "hr", "pre", "table", "svg"].map((tag) => el(tag));
    run(p, h2, hr, pre, table, svg);
    expect(p.properties.dataScrollReveal).toBe("");
    expect(h2.properties.dataScrollReveal).toBe("");
    expect(hr.properties.dataScrollReveal).toBe("fade");
    expect(pre.properties.dataScrollReveal).toBe("settle");
    expect(table.properties.dataScrollReveal).toBe("settle");
    expect(svg.properties.dataScrollReveal).toBe("settle");
  });

  it("leaves blocks with their own entrance alone (the ink reveal, media players)", () => {
    const image = el("p", [el("a", [el("img")])]);
    const video = el("div", [el("video")]);
    run(image, video);
    expect(image.properties).not.toHaveProperty("dataScrollReveal");
    expect(video.properties).not.toHaveProperty("dataScrollReveal");
  });

  it("only marks top-level elements, never nested ones, text or raw HTML", () => {
    const inner = el("p");
    const quote = el("blockquote", [inner]);
    const raw = { type: "raw", value: '<div class="img-container"></div>' } as unknown as RootContent;
    run(quote, { type: "text", value: "\n" }, raw);
    expect(quote.properties.dataScrollReveal).toBe("");
    expect(inner.properties).not.toHaveProperty("dataScrollReveal");
    expect(raw).not.toHaveProperty("properties");
  });
});
