import { describe, expect, it } from "vitest";
import {
  sitemapLocations,
  sitemapVariants,
  withoutIndexLastmod,
} from "../../src/plugins/sitemap-output";

describe("sitemap output", () => {
  it("omits misleading child modification dates without changing index URLs", () => {
    const xml =
      "<sitemapindex><sitemap><loc>https://example.com/sitemap-0.xml</loc><lastmod>2026-10-23</lastmod></sitemap></sitemapindex>";
    expect(withoutIndexLastmod(xml)).not.toContain("lastmod");
    expect(sitemapLocations(withoutIndexLastmod(xml))).toEqual(sitemapLocations(xml));
  });

  it("keeps the same URLs in both formats with format-appropriate escaping", () => {
    const locations = ["https://example.com/", "https://example.com/page?a=1&amp;b=2"];
    const variants = sitemapVariants(locations);
    expect(sitemapLocations(variants.xml)).toEqual(locations);
    expect(variants.xml).not.toContain("lastmod");
    expect(variants.text).toBe("https://example.com/\nhttps://example.com/page?a=1&b=2\n");
  });
});
