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
import react from "@astrojs/react";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), sitemap(), react(), icon()],
  compressHTML: true,
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
              // no error, so this is not a mistake you catch from the build log.
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
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "prepend",
            properties: {
              className: ["heading-anchor"],
              ariaLabel: "Link to this section",
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

  site: "https://heristop.github.io",
});
