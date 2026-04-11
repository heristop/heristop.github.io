import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import { externalLink } from "../../src/plugins/externalLink";

type Transformer = (tree: Root, file: unknown, next: () => void) => void;

const makeAnchor = (href: string | null | undefined): Element => ({
  type: "element",
  tagName: "a",
  properties: href === undefined ? {} : { href },
  children: [{ type: "text", value: "link" }],
});

const wrap = (...children: Element[]): Root => ({
  type: "root",
  children,
});

const run = (tree: Root, domain: string) => {
  const transformer = externalLink.call(
    undefined as never,
    { domain },
  ) as unknown as Transformer;
  transformer(tree, { path: "test" }, () => {});
  return tree;
};

describe("externalLink plugin", () => {
  it("adds target=_blank to external links", () => {
    const anchor = makeAnchor("https://other.com/path");
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBe("_blank");
  });

  it("does not add target for same-domain links", () => {
    const anchor = makeAnchor("https://mysite.com/about");
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBeUndefined();
  });

  it("ignores relative links", () => {
    const anchor = makeAnchor("/blog");
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBeUndefined();
  });

  it("ignores hash links", () => {
    const anchor = makeAnchor("#section");
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBeUndefined();
  });

  it("ignores mailto links", () => {
    const anchor = makeAnchor("mailto:foo@bar.com");
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBeUndefined();
  });

  it("skips anchors without href", () => {
    const anchor = makeAnchor(undefined);
    run(wrap(anchor), "mysite.com");
    expect(anchor.properties?.target).toBeUndefined();
  });

  it("walks nested trees", () => {
    const inner = makeAnchor("https://external.dev");
    const parent: Element = {
      type: "element",
      tagName: "div",
      properties: {},
      children: [inner],
    };
    run(wrap(parent), "mysite.com");
    expect(inner.properties?.target).toBe("_blank");
  });

  it("defaults domain to empty string (matches every url, so nothing is external)", () => {
    const tree = wrap(makeAnchor("https://anywhere.com/post"));
    const transformer = externalLink.call(
      undefined as never,
    ) as unknown as Transformer;
    transformer(tree, { path: "test" }, () => {});
    const anchor = tree.children[0] as Element;
    expect(anchor.properties?.target).toBeUndefined();
  });
});
