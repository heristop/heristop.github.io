import { describe, expect, it } from "vitest";
import { HOVER_QUERY, hoverMedia, splitHoverSelectors } from "../../src/plugins/hover-media";

// A minimal stand-in for the slice of the PostCSS node API the plugin touches
interface FakeNode {
  type: string;
  name?: string;
  params?: string;
  selectors: string[];
  parent?: FakeNode;
  nodes: FakeNode[];
}

const makeNode = (fields: Partial<FakeNode> & { type: string }): FakeNode => ({
  selectors: [],
  nodes: [],
  ...fields,
});

const detach = (node: FakeNode) => {
  if (node.parent) {
    node.parent.nodes = node.parent.nodes.filter((child) => child !== node);
  }
};

const withApi = (node: FakeNode) =>
  Object.assign(node, {
    clone: (overrides: { selectors: string[] }) => withApi(makeNode({ type: node.type, ...overrides })),
    before: (other: FakeNode) => {
      detach(other);
      const siblings = node.parent!.nodes;
      siblings.splice(siblings.indexOf(node), 0, other);
      other.parent = node.parent;
    },
    append: (child: FakeNode) => {
      detach(child);
      node.nodes.push(child);
      child.parent = node;
    },
  });

class AtRule {
  constructor(defaults: { name: string; params: string }) {
    return withApi(makeNode({ type: "atrule", ...defaults }));
  }
}

const run = (selectors: string[], parent: FakeNode = makeNode({ type: "root" })) => {
  const rule = withApi(makeNode({ type: "rule", selectors, parent }));
  parent.nodes.push(rule);
  hoverMedia().Rule(rule as never, { AtRule } as never);
  return parent;
};

describe("splitHoverSelectors", () => {
  it("separates hover selectors from the rest", () => {
    expect(splitHoverSelectors([".a:hover", ".a:focus-visible", ".b:hover .c"])).toEqual({
      hover: [".a:hover", ".b:hover .c"],
      rest: [".a:focus-visible"],
    });
  });
});

describe("hoverMedia", () => {
  it("wraps a hover rule in a hover-capable media query", () => {
    const root = run([".card:hover"]);
    expect(root.nodes).toHaveLength(1);
    const [media] = root.nodes;
    expect(media).toMatchObject({ type: "atrule", name: "media", params: HOVER_QUERY });
    expect(media!.nodes[0]!.selectors).toEqual([".card:hover"]);
  });

  it("keeps the keyboard half of a mixed rule unconditional", () => {
    const root = run([".card:hover", ".card:focus-within"]);
    expect(root.nodes.map((node) => node.type)).toEqual(["rule", "atrule"]);
    expect(root.nodes[0]!.selectors).toEqual([".card:focus-within"]);
    expect(root.nodes[1]!.nodes[0]!.selectors).toEqual([".card:hover"]);
  });

  it("leaves rules without :hover alone", () => {
    const root = run([".card:active"]);
    expect(root.nodes[0]!.type).toBe("rule");
  });

  it("leaves rules already scoped to an input type alone", () => {
    const media = makeNode({ type: "atrule", name: "media", params: "(hover: none) and (pointer: coarse)" });
    run([".card:hover"], media);
    expect(media.nodes[0]!.type).toBe("rule");
  });

  it("wraps hover rules inside unrelated media queries", () => {
    const media = makeNode({ type: "atrule", name: "media", params: "(width >= 48rem)" });
    run([".card:hover"], media);
    expect(media.nodes[0]).toMatchObject({ type: "atrule", params: HOVER_QUERY });
  });

  it("leaves natively nested rules to their parent", () => {
    const parent = makeNode({ type: "rule", selectors: [".card"] });
    run(["&:hover"], parent);
    expect(parent.nodes[0]!.type).toBe("rule");
  });
});
