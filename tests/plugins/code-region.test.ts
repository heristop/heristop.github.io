import { describe, expect, it } from "vitest";
import type { Element, Root } from "hast";
import { codeRegion } from "../../src/plugins/code-region";

type Transformer = (tree: Root, file: unknown, next: () => void) => void;

const makePre = (properties: Element["properties"]): Element => ({
  type: "element",
  tagName: "pre",
  properties,
  children: [],
});

const run = (...children: Element[]): Root => {
  const tree: Root = { type: "root", children };
  const transformer = codeRegion.call(undefined as never) as unknown as Transformer;
  transformer(tree, { path: "test" }, () => {});
  return tree;
};

describe("codeRegion plugin", () => {
  it("makes a highlighted block a focusable group named after its language", () => {
    const pre = makePre({ dataLanguage: "ts" });
    run(pre);
    expect(pre.properties).toMatchObject({ tabIndex: 0, role: "group", ariaLabel: "ts code block" });
  });

  it("uses a generic name for plain text blocks", () => {
    const pre = makePre({ dataLanguage: "plaintext" });
    run(pre);
    expect(pre.properties["ariaLabel"]).toBe("Code block");
  });

  it("names repeated languages alike, since groups are not landmarks", () => {
    const first = makePre({ dataLanguage: "rust" });
    const second = makePre({ dataLanguage: "rust" });
    const other = makePre({ dataLanguage: "ts" });
    const third = makePre({ dataLanguage: "rust" });
    run(first, second, other, third);
    expect([first, second, other, third].map((pre) => pre.properties["ariaLabel"])).toEqual([
      "rust code block",
      "rust code block",
      "ts code block",
      "rust code block",
    ]);
  });

  it("leaves other elements untouched", () => {
    const div: Element = { type: "element", tagName: "div", properties: {}, children: [] };
    run(div);
    expect(div.properties).toEqual({});
  });
});
