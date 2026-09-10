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

## Workspace layout

- `packages/path-of-stones` — the private `heristop/zazen-garden` submodule: game, assets, activity snapshot, training tools and tests.
- `packages/ui` — icons and text animations shared by the game and site.
- `src` — the Astro site; `src/pages/path-of-stones.astro` hosts the game through its public package exports.

Packages are private and linked with `workspace:*`. Use the pnpm version pinned in `package.json` and Node 22.18 or newer. Run `pnpm test` for all workspace test projects and `pnpm check:packages` for package type checks. The root development, build, game coverage, training, evaluation, art generation and snapshot commands remain available.

See the [game package guide](packages/path-of-stones/README.md) for commands, rendering, balance, daily GitHub refresh and offline training. The [shared UI guide](packages/ui/README.md) describes its exports.

## Author

**Alexandre Mogère** — [GitHub](https://github.com/heristop) · [LinkedIn](https://linkedin.com/in/alexandre-mogere) · [Bluesky](https://bsky.app/profile/heristop.bsky.social)

If you enjoy the content, you can [buy me a coffee](https://buymeacoffee.com/heristop). ☕

## Private garden checkout

The site pins the garden to a commit in [heristop/zazen-garden](https://github.com/heristop/zazen-garden). GitHub access to that private repository is required. After cloning or pulling this site, initialize the pinned source before installing dependencies:

```sh
git submodule update --init --recursive
pnpm install --frozen-lockfile
pnpm dev
```

See [private garden deployment](docs/private-garden.md) for CI credentials and the release order.
