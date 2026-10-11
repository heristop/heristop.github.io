import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeMermaid from "rehype-mermaid";
import sitemap from "@astrojs/sitemap";
import { externalLink } from "./src/plugins/external-link";
import { codeRegion } from "./src/plugins/code-region";
import { mermaidTokens } from "./src/plugins/mermaid-tokens";
import { mermaidA11y } from "./src/plugins/mermaid-a11y";
import { hoverMedia } from "./src/plugins/hover-media";
import { isIndexablePage, readPostDates, sitemapLastmod } from "./src/plugins/sitemap-lastmod";
import { imageDimensions } from "./src/plugins/image-dimensions";
import react from "@astrojs/react";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  integrations: [
    mdx(),
    // lastmod from post frontmatter; redirect stubs and the 404 stay out of the sitemap
    sitemap({
      filter: isIndexablePage,
      serialize: sitemapLastmod(readPostDates("./src/content/blog")),
    }),
    react(),
    icon(),
  ],
  compressHTML: true,
  // The garden lived at /path for as long as it has existed, which is long enough for the
  // URL to be somewhere other than this repository. A static build emits this as a real
  // redirect page, so old links keep working rather than landing on the 404.
  redirects: {
    // Trailing slash: the target's canonical URL, so the stub's rel=canonical is not itself a redirect
    "/path": "/path-of-stones/",
  },
  markdown: {
    shikiConfig: {
      theme: "rose-pine",
      wrap: false,
    },
    // Shiki is registered before any user rehype plugin, so a ```mermaid fence is already a
    // highlighted <pre> by the time rehypeMermaid runs — it would silently do nothing. Excluding the
    // language leaves the fence as <code class="language-mermaid"> for rehypeMermaid to convert.
    // This has to live here rather than inside unified(), which forwards only remark/rehype plugins,
    // remarkRehype, gfm and smartypants — syntaxHighlight and shikiConfig come from this level.
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [
          externalLink,
          {
            domain: "heristop.github.io",
          },
        ],
        // width/height from the files in public/, so markdown images reserve their box (no CLS)
        [imageDimensions, { publicDir: "./public" }],
        rehypeKatex,
        // Renders ```mermaid fences to inline SVG at build time (via the Playwright already in
        // devDependencies), so diagrams ship as markup with no client-side mermaid bundle and no
        // pre-rendered image to keep in sync with the source.
        [
          rehypeMermaid,
          {
            strategy: "inline-svg",
            generateVar: false,
            mermaidConfig: {
              // `base` is the only built-in theme that honours themeVariables. Colours are hex, not
              // the oklch() used in _tokens.scss: mermaid derives shades with khroma, which cannot
              // parse oklch and fails the whole render — the page then builds with an EMPTY body and
              // no error, so this is not a mistake you catch from the build log. The theme follows
              // light/dark through mermaidTokens below: a new colour here (or in a classDef) needs an
              // entry in src/plugins/mermaid-tokens.ts, or it stays this hex in both themes.
              theme: "base",
              flowchart: {
                curve: "basis",
                padding: 8,
                nodeSpacing: 28,
                rankSpacing: 34,
              },
              themeVariables: {
                // Mermaid measures every label in the headless browser and bakes the resulting box
                // widths into the SVG. Naming a webfont here (or restyling the font in CSS
                // afterwards) makes the render font differ from the measured one and every label
                // clips — "descriptor.json" came out as "descriptor.jsor". A stack the headless
                // Chromium definitely has is the only safe choice; do not swap it for Comfortaa.
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
                fontSize: "13px",
                primaryColor: "#f7e9ec",
                primaryBorderColor: "#9c4f63",
                primaryTextColor: "#4a1f2c",
                secondaryColor: "#f3ded8",
                tertiaryColor: "#faf3e8",
                lineColor: "#a8687a",
                textColor: "#4a1f2c",
                mainBkg: "#f9ecec",
                nodeBorder: "#9c4f63",
                clusterBkg: "#faf3e8",
                edgeLabelBackground: "#f5efe3",
              },
            },
          },
        ],
        // Rewrites the hex baked into each diagram as var(--mermaid-*, <hex>), mapped to the design
        // tokens in src/styles/_mermaid.scss, so diagrams follow light/dark like the rest of the page
        mermaidTokens,
        // One named image per diagram (accTitle/accDescr, else a summary of its node labels)
        mermaidA11y,
        // After rehypeMermaid, so only real code blocks (Shiki <pre>s) become scrollable regions
        codeRegion,
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            // A link inside a heading lends its label to the heading's accessible name, whatever
            // aria-label/labelledby it carries, so the heading names itself with its own text and
            // the "#" is announced as its permalink. Helpers stay inside the callbacks: Astro
            // re-renders cached content only when the serialisable part of this config changes,
            // and module-scope closures are not available where the callbacks run.
            behavior: "append",
            headingProperties: (heading) => {
              const text = (node) =>
                node.type === "text"
                  ? node.value
                  : node.properties?.className?.includes?.("heading-anchor")
                    ? ""
                    : (node.children ?? []).map(text).join("");
              return { ariaLabel: text(heading).replaceAll(/\s+/g, " ").trim() };
            },
            properties: (heading) => {
              const text = (node) =>
                node.type === "text"
                  ? node.value
                  : node.properties?.className?.includes?.("heading-anchor")
                    ? ""
                    : (node.children ?? []).map(text).join("");
              return {
                className: ["heading-anchor"],
                ariaLabel: `Permalink: ${text(heading).replaceAll(/\s+/g, " ").trim()}`,
              };
            },
            content: {
              type: "text",
              value: "#",
            },
          },
        ],
      ],
    }),
  },

  vite: {
    css: {
      // Hover styles only for hover-capable pointers: no "stuck" hover after a tap on touch
      postcss: { plugins: [hoverMedia()] },
    },
  },

  site: "https://heristop.github.io",
});
