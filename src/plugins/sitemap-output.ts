import { readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";

// These inputs are XML emitted by @astrojs/sitemap, not arbitrary XML documents.
export const sitemapLocations = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

export const withoutIndexLastmod = (xml: string) => xml.replace(/<lastmod>[^<]*<\/lastmod>/g, "");

export const sitemapVariants = (locations: string[]) => ({
  xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n")}\n</urlset>\n`,
  text: `${locations
    .map((loc) =>
      loc
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">"),
    )
    .join("\n")}\n`,
});

export default function sitemapOutput(): AstroIntegration {
  return {
    name: "sitemap-output",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const indexPath = new URL("sitemap-index.xml", dir);
        const index = await readFile(indexPath, "utf8");
        const locations: string[] = [];
        for (const child of sitemapLocations(index)) {
          const filename = new URL(child).pathname.split("/").pop();
          if (!filename || !/^sitemap-\d+\.xml$/.test(filename)) {
            throw new Error(`Unexpected generated sitemap: ${child}`);
          }
          locations.push(...sitemapLocations(await readFile(new URL(filename, dir), "utf8")));
        }
        // The newest article date is not the modification date of the child XML file.
        // Omit the optional index date rather than inventing one on every build.
        await writeFile(indexPath, withoutIndexLastmod(index));
        const variants = sitemapVariants(locations);
        await writeFile(new URL("sitemap-minimal.xml", dir), variants.xml);
        await writeFile(new URL("sitemap.txt", dir), variants.text);
      },
    },
  };
}
