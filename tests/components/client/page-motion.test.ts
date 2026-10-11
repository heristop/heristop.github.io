import { describe, expect, it } from "vitest";
import {
  MORPH_CLASS,
  claimReturnMorph,
  claimTitleMorph,
  getNavDirection,
  morphsPosts,
  pageDepth,
  pageTitleName,
} from "../../../src/components/client/page-motion";

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

const articleDoc = (name: string) =>
  parse(
    `<div class="site-layout__meta-title"><h1 data-reveal="pending" style="view-transition-name: ${name}">T</h1></div>`,
  );

const stubRect = (el: Element, top: number) => {
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + 20, left: 10, right: 200, width: 190, height: 20 }) as DOMRect;
};

describe("pageDepth", () => {
  it("puts home on the same level as the other top-level pages", () => {
    expect(pageDepth("/")).toBe(1);
    expect(pageDepth("/blog/")).toBe(1);
    expect(pageDepth("/about")).toBe(1);
    expect(pageDepth("/blog/2026-01-01-a/")).toBe(2);
    expect(pageDepth("/tags/zen/")).toBe(2);
  });
});

describe("getNavDirection", () => {
  it("goes forward into a post and back out of it, mirrored", () => {
    expect(getNavDirection({ from: "/", to: "/blog/2026-01-01-a/" })).toBe("forward");
    expect(getNavDirection({ from: "/blog/2026-01-01-a/", to: "/", history: "back" })).toBe("back");
    expect(getNavDirection({ from: "/tags/", to: "/tags/zen/" })).toBe("forward");
  });

  it("slides siblings toward the side of their header link", () => {
    expect(getNavDirection({ from: "/", to: "/blog/" })).toBe("next");
    expect(getNavDirection({ from: "/about/", to: "/blog" })).toBe("prev");
    expect(getNavDirection({ from: "/blog/", to: "/about/" })).toBe("next");
  });

  it("treats older posts as previous, matching the pager", () => {
    expect(getNavDirection({ from: "/blog/2026-09-06-b/", to: "/blog/2026-08-17-a/" })).toBe("prev");
    expect(getNavDirection({ from: "/blog/2026-08-17-a/", to: "/blog/2026-09-06-b/" })).toBe("next");
  });

  it("lets the link's rel decide when present", () => {
    expect(getNavDirection({ from: "/blog/2026-08-17-a/", to: "/blog/2026-09-06-b/", rel: "prev" })).toBe(
      "prev",
    );
  });

  it("falls back on the history direction for unordered siblings", () => {
    expect(getNavDirection({ from: "/tags/a/", to: "/tags/b/", history: "back" })).toBe("prev");
    expect(getNavDirection({ from: "/tags/a/", to: "/tags/b/" })).toBe("next");
  });

  it("does not move for the same page", () => {
    expect(getNavDirection({ from: "/blog", to: "/blog/" })).toBe("none");
  });
});

describe("pageTitleName", () => {
  it("reads the heading's transition name", () => {
    expect(pageTitleName(articleDoc("post-title-abc"))).toBe("post-title-abc");
    expect(pageTitleName(parse("<h1>x</h1>"))).toBeUndefined();
  });
});

describe("claimTitleMorph", () => {
  it("names the clicked card title so it becomes the heading", () => {
    const current = parse(
      `<a class="blog-card" href="/blog/x/"><h3 class="blog-card__title">T</h3></a>`,
    );
    const card = current.querySelector("a")!;
    const title = current.querySelector("h3")!;
    stubRect(title, 100);

    expect(claimTitleMorph(current, articleDoc("post-title-x"), card)).toBe(true);
    expect(title.style.viewTransitionName).toBe("post-title-x");
    expect(title.style.getPropertyValue("view-transition-class")).toBe(MORPH_CLASS);
  });

  it("reuses a title that already carries the name (home list)", () => {
    const current = parse(`<span style="view-transition-name: post-title-x">T</span>`);
    stubRect(current.querySelector("span")!, 100);

    expect(claimTitleMorph(current, articleDoc("post-title-x"), null)).toBe(true);
  });

  it("drops the morph when the origin is off-screen", () => {
    const current = parse(`<span style="view-transition-name: post-title-x">T</span>`);
    const span = current.querySelector("span")!;
    stubRect(span, 5000);

    expect(claimTitleMorph(current, articleDoc("post-title-x"), null)).toBe(false);
    expect(span.style.viewTransitionName).toBe("none");
  });

  it("does nothing without a source or an incoming heading", () => {
    expect(claimTitleMorph(parse("<p></p>"), articleDoc("post-title-x"), null)).toBe(false);
    expect(claimTitleMorph(parse("<p></p>"), parse("<p></p>"), null)).toBe(false);
  });
});

describe("claimReturnMorph", () => {
  it("names the incoming card that links back to the post being left", () => {
    const incoming = parse(
      `<main><a href="/blog/x/"><h3 class="blog-card__title">T</h3></a><a href="/blog/y/"><h3>U</h3></a></main>`,
    );
    claimReturnMorph(articleDoc("post-title-x"), incoming, "/blog/x");

    expect(incoming.querySelectorAll("h3")[0].style.viewTransitionName).toBe("post-title-x");
    expect(incoming.querySelectorAll("h3")[1].style.viewTransitionName).toBe("");
  });

  it("leaves a list that already names the title alone (no duplicate names)", () => {
    const incoming = parse(
      `<main><a href="/blog/x/"><span class="latest-posts__title" style="view-transition-name: post-title-x">T</span><h3>dup</h3></a></main>`,
    );
    claimReturnMorph(articleDoc("post-title-x"), incoming, "/blog/x/");

    expect(incoming.querySelector("h3")!.style.viewTransitionName).toBe("");
  });
});

describe("morphsPosts", () => {
  it("lets shared elements travel only when a post is opened or left", () => {
    expect(morphsPosts("/", "/blog/2026-01-01-a/")).toBe(true);
    expect(morphsPosts("/blog/2026-01-01-a", "/blog/")).toBe(true);
    expect(morphsPosts("/", "/blog/")).toBe(false);
    expect(morphsPosts("/blog/", "/tags/zen/")).toBe(false);
  });
});
