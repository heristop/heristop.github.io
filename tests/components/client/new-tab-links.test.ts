import { beforeEach, describe, expect, it } from "vitest";
import {
  NEW_TAB_HINT_ID,
  NEW_TAB_HINT_TEXT,
  describeNewTabLinks,
} from "../../../src/components/client/new-tab-links";

beforeEach(() => {
  document.body.replaceChildren();
});

const link = (attributes: Record<string, string>): HTMLAnchorElement => {
  const anchor = document.createElement("a");
  anchor.href = "https://example.com";
  for (const [name, value] of Object.entries(attributes)) {
    anchor.setAttribute(name, value);
  }
  document.body.append(anchor);
  return anchor;
};

describe("describeNewTabLinks", () => {
  it("describes new-tab links with one shared hidden hint", () => {
    const first = link({ target: "_blank" });
    const second = link({ target: "_blank", "aria-label": "GitHub Profile" });
    expect(describeNewTabLinks()).toBe(2);
    const hint = document.getElementById(NEW_TAB_HINT_ID);
    expect(hint?.hidden).toBe(true);
    expect(hint?.textContent).toBe(NEW_TAB_HINT_TEXT);
    expect(first.getAttribute("aria-describedby")).toBe(NEW_TAB_HINT_ID);
    expect(second.getAttribute("aria-describedby")).toBe(NEW_TAB_HINT_ID);
  });

  it("keeps existing descriptions and is idempotent", () => {
    const anchor = link({ target: "_blank", "aria-describedby": "tip" });
    describeNewTabLinks();
    expect(describeNewTabLinks()).toBe(0);
    expect(anchor.getAttribute("aria-describedby")).toBe(`tip ${NEW_TAB_HINT_ID}`);
    expect(document.querySelectorAll(`#${NEW_TAB_HINT_ID}`)).toHaveLength(1);
  });

  it("leaves same-tab links and pages without new-tab links alone", () => {
    const anchor = link({});
    expect(describeNewTabLinks()).toBe(0);
    expect(anchor.hasAttribute("aria-describedby")).toBe(false);
    expect(document.getElementById(NEW_TAB_HINT_ID)).toBeNull();
  });
});
