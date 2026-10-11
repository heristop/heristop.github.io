import { beforeEach, describe, expect, it } from "vitest";
import { arrowKeysOwnedByFocus, mayNavigateWithArrows } from "../../../src/components/client/arrow-nav-guard";

const key = (init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true, ...init });

beforeEach(() => {
  document.body.innerHTML = `
    <main>
      <p><a id="link" href="#">link</a></p>
      <input id="search" />
      <pre role="region" tabindex="0" id="code"><code><span id="token">x</span></code></pre>
      <div class="mermaid-wide" tabindex="0" id="diagram"></div>
      <div role="menu"><button role="menuitemradio" id="item">Dark</button></div>
      <div contenteditable="true" id="editor"></div>
    </main>`;
});

const byId = (id: string): Element => {
  const element = document.querySelector(`#${id}`);
  if (element === null) {
    throw new Error(id);
  }
  return element;
};

describe("arrowKeysOwnedByFocus", () => {
  it("leaves the page and plain links to the article navigation", () => {
    expect(arrowKeysOwnedByFocus(null)).toBe(false);
    expect(arrowKeysOwnedByFocus(document.body)).toBe(false);
    expect(arrowKeysOwnedByFocus(byId("link"))).toBe(false);
  });

  it("gives the keys to fields, code regions, diagrams and menus", () => {
    for (const id of ["search", "code", "token", "diagram", "item"]) {
      expect(arrowKeysOwnedByFocus(byId(id)), id).toBe(true);
    }
  });
});

describe("mayNavigateWithArrows", () => {
  it("allows a bare arrow on a link", () => {
    expect(mayNavigateWithArrows(key(), byId("link"))).toBe(true);
  });

  it("refuses modified arrows and keys another handler already used", () => {
    expect(mayNavigateWithArrows(key({ shiftKey: true }), byId("link"))).toBe(false);
    expect(mayNavigateWithArrows(key({ altKey: true }), byId("link"))).toBe(false);
    const handled = key();
    handled.preventDefault();
    expect(mayNavigateWithArrows(handled, byId("link"))).toBe(false);
  });

  it("refuses while a code block is focused", () => {
    expect(mayNavigateWithArrows(key(), byId("code"))).toBe(false);
  });
});
