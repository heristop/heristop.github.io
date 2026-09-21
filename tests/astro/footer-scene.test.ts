import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import FooterScene from "../../src/components/FooterScene.astro";

let html = "";

beforeAll(async () => {
  const container = await AstroContainer.create();
  html = await container.renderToString(FooterScene);
});

describe("<FooterScene />", () => {
  it("is decorative: hidden from assistive tech and never focusable", () => {
    expect(html).toMatch(/<div class="footer-scene" aria-hidden="true" data-footer-scene>/);
    const planes = html.match(/<svg class="footer-scene__svg footer-scene__plane[^"]*"[^>]*>/g) ?? [];
    expect(planes).toHaveLength(5);
    for (const plane of planes) expect(plane).toContain('focusable="false"');
  });

  it("aligns every depth plane and keeps the pagoda side on narrow screens", () => {
    expect(html.match(/viewBox="0 0 1200 420"/g)).toHaveLength(5);
    expect(html.match(/preserveAspectRatio="xMaxYMax slice"/g)).toHaveLength(5);
  });

  it("draws the pagoda, the pine and the pilgrim's boat with its reflection", () => {
    expect(html).toContain('class="footer-scene__pagoda"');
    expect(html).toContain('class="footer-scene__pine"');
    expect(html).toMatch(/id="footer-voyager" class="footer-scene__boat" transform="translate\(0 344\)"/);
    expect(html).toContain('class="footer-scene__pilgrim"');
    expect(html).toContain('class="footer-scene__staff"');
    expect(html.match(/href="#footer-voyager"/g)).toHaveLength(1);
  });

  it("mirrors the reflection around the hull waterline (y = 354)", () => {
    // The voyager sits at y + 344 and the hull bottom is at y = 10, so the
    // waterline is 354 and the mirror is translate(0 708) scale(1 -1).
    expect(html).toMatch(
      /href="#footer-voyager" class="footer-scene__boat-reflection" transform="translate\(0 708\) scale\(1 -1\)"/,
    );
  });

  it("ships the wake-up script for the scene", () => {
    expect(html).toContain("<script>");
    expect(html).toContain("IntersectionObserver");
    expect(html).toContain("astro:page-load");
  });
});
