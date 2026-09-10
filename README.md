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

The garden uses the last fourteen completed UTC days. `pnpm fetch:github` refreshes the
snapshot; GitHub Actions also refreshes it daily at 05:00 UTC and on pushes to `master`.
Calendar counts are contributions, while the partial fallback counts public push events.
Repository names and primary languages come from recent public activity, independently of
plant species, which use a dedicated seeded random stream. Terrain and best scores remain
stable when only refresh metadata changes.
Failed refreshes retain the saved snapshot and display its age/status; the committed snapshot
is also the offline development fallback. Deployments do not commit fetched data back to Git.

The coverage suite includes 72 complete games using three route strategies across the
published snapshot and contrasting activity profiles. It runs the actual gardener actions,
checks that each sampled board has a winning strategy and requires paving and gardener refills.
Stones are at least five tiles apart with no three aligned; the starting reserve leaves part
of the tour budget for later refills. The gardener’s turn ends with his last rake.
He targets the nearest reachable stone, following the player’s cheapest route to it.
He rakes firm cells on that approach and finishes with the one closest to the stone.
It compares complete plans of up to three targets, then minimizes steps and bends while keeping that finish.
Recent rakes discourage repetitive optional work; the shipped weights are tuned by an offline genetic algorithm.
Bare sand, discoveries and structures cannot be raked. New close passes trigger visible swings,
with at most one stone deducted per round; turn banners wait for the swing to finish. Stone deductions still
preserve a feasible tour.
Run just these simulations with
`pnpm exec vitest run tests/components/client/garden/board/generation-simulation.test.ts`.
Set `GARDEN_BALANCE_VARIANTS=12` to sample 96 boards (288 games), and
`GARDEN_BALANCE_REPORT=/tmp/garden-balance.json` to save per-game results and round statistics.
An opening check also tries reward orders and frog detours on the published board.
These checks sample difficulty and catch regressions; they do not prove every board winnable.

See [gardener AI and tuning](docs/gardener-ai.md) for the decision rules, measured balance,
and the `pnpm tune:garden` / `pnpm evaluate:garden` commands. Training never runs in the browser.

With a production preview running, use `pnpm benchmark:garden` to measure the opening turn and
24 walking steps on desktop and mobile emulation. Pass `--url=http://localhost:4327/path-of-stones/`
for another preview or `--cpu=4` to simulate a slower CPU. The report includes frame cadence,
long frames and JavaScript/layout work; validate the 60 FPS target on physical devices too.

The hybrid WebGL board is the default when supported. The in-game **HD-2D** toggle
switches instantly to the classic renderer and remembers the preference on this device.
React retains rules, menus, cards, controls, accessible tile targets and atmospheric overlays;
Pixi renders terrain, scenery and animated characters in WebGL. Use `?renderer=dom` or `?renderer=webgl` for explicit comparisons. Graphics initialization or context loss returns to that
renderer without resetting the run. The WebGL bundle loads only when HD-2D is enabled and supported.
Compare with `pnpm benchmark:garden --url="http://127.0.0.1:4327/path-of-stones/?renderer=webgl"`. Measurements report browser frame cadence and
main-thread work, not guaranteed GPU frame presentation. The report identifies the GPU backend;
use `--angle=metal` on macOS to compare with the Apple GPU instead of software rendering.

## Author

**Alexandre Mogère** — [GitHub](https://github.com/heristop) · [LinkedIn](https://linkedin.com/in/alexandre-mogere) · [Bluesky](https://bsky.app/profile/heristop.bsky.social)

If you enjoy the content, you can [buy me a coffee](https://buymeacoffee.com/heristop). ☕
