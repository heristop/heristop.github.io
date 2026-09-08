# Zazen Code

> Coding & AI notes, tutorials, and a quiet Path of Stones.

**Live site:** [heristop.github.io](https://heristop.github.io)

## About

Zazen Code is a personal blog started in 2014 by [Alexandre Mogère](https://github.com/heristop).
It gathers practical tips, tutorials, and the occasional experiment around
JavaScript, TypeScript, PHP, and frontend development — including a long-running
*Frontend Weekly Digest* series and notes on coding & AI.

## Features

- Long-form posts in MDX with KaTeX math and rose-pine syntax highlighting
- Mermaid diagrams rendered to inline SVG at build time — no client-side bundle
- Tags, RSS feed, and generated sitemap
- **Path of Stones** — a small meditative experience
- View transitions and a dark, focused reading theme

## Tech stack

Built with [Astro 7](https://astro.build), [React 19](https://react.dev), MDX,
and TypeScript. Hosted on [GitHub Pages](https://pages.github.com).

## Local development

```bash
git clone https://github.com/heristop/heristop.github.io.git
cd heristop.github.io
pnpm install
pnpm dev
```

See `package.json` for the full list of scripts (build, lint, tests, visual tests, image optimization).

Run `pnpm test:garden:coverage` to test Path of Stones and generate `coverage/garden/index.html`.
CI requires at least 90% line, statement, function and branch coverage across the complete garden module.

With a production preview running, use `pnpm benchmark:garden` to measure the opening turn and
24 walking steps on desktop and mobile emulation. Pass `--url=http://localhost:4327/path-of-stones/`
for another preview or `--cpu=4` to simulate a slower CPU. The report includes frame cadence,
long frames and JavaScript/layout work; validate the 60 FPS target on physical devices too.

The experimental hybrid board is available at `/path-of-stones/?renderer=webgl`.
React retains rules, menus, cards, controls, accessible tile targets and atmospheric overlays;
Pixi renders terrain, scenery and animated characters in WebGL. The default URL keeps the
original renderer for comparison. Graphics initialization or context loss returns to that
renderer without resetting the run. The WebGL bundle loads only for the opt-in route.
Compare with `pnpm benchmark:garden --url="http://127.0.0.1:4327/path-of-stones/?renderer=webgl"`. Measurements report browser frame cadence and
main-thread work, not guaranteed GPU frame presentation. The report identifies the GPU backend;
use `--angle=metal` on macOS to compare with the Apple GPU instead of software rendering.

## Author

**Alexandre Mogère** — [GitHub](https://github.com/heristop) · [LinkedIn](https://linkedin.com/in/alexandre-mogere) · [Bluesky](https://bsky.app/profile/heristop.bsky.social)

If you enjoy the content, you can [buy me a coffee](https://buymeacoffee.com/heristop). ☕
