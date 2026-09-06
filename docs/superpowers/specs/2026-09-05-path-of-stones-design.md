# Path of Stones — pixel garden rework

Date: 2026-09-05
Status: approved design, pending implementation plan

## Goal

Turn `/path` from a borrowed-asset isometric demo into a 2D pixel game that reads as
part of Zazen Code, and make the garden itself a picture of the author's recent
GitHub activity.

Two features, one page:

- **F1 — new skin, new feel.** Original pixel art in the site palette, plus the
  animation and responsiveness that make a grid of tiles read as a game.
- **F2 — the garden is the work.** The last 100 days of public GitHub activity
  shape the terrain and the planting.

F2 depends on F1's tile taxonomy. F1 does not depend on F2 and ships alone.

## Decisions

| Question | Decision |
|---|---|
| Perspective | Isometric, restyled. `posX/posY` math and `TILE_HALF_*` unchanged. |
| Art pipeline | Committed generator script. Pixel maps live in source, emit PNGs. |
| Gameplay | Same loop — 5 stones, 5 haiku lines, shrine, finale. New game-feel. |
| Palette | Paper daylight. 12 colours, continuous with the page's cream + rose. |

## What exists today

`/path` renders `ZazenWorld` as a `client:only="react"` island.

- `zazen-world.tsx` (429) — presentation, compass, keyboard, swipe, scale
- `use-zazen-game.ts` (123) — state machine
- `zazen-world-helpers.ts` (379) — terrain, geometry, movement, key handling
- `world.scss` (673)
- 28 borrowed GIFs in `public/images/zazen/`
- Tests: `zazen-world.test.tsx` (35), `zazen-world-helpers.test.ts` (224)
- No Playwright spec for `/path`

Strengths to preserve: the accessibility layer is unusually good —
`role="application"`, an `aria-live` announcer, per-tile `role="button"` with
labels, `sr-only` instructions, tooltips on the compass.

Defects the rework fixes:

- `getProceduralTerrain` calls `Math.random()` per mount — the garden differs on
  every load, so it cannot be snapshot-tested and is not "yours".
- `mapScale` is fractional (`Math.min(1, available / naturalWidth)`). Fractional
  scaling destroys pixel art.
- The player's position is *derived* by scanning 144 tiles (`findPlayer`) on every
  render, and the player lives inside a tile's DOM — which makes a smooth
  tile-to-tile tween impossible, because you cannot tween across DOM parents.
- `zazen-world-helpers.ts` is a grab-bag of four unrelated concerns.

## Architecture

Each unit has one job and is testable alone.

**Build time (Node)**

| Module | Responsibility |
|---|---|
| `scripts/fetch-github-garden.mjs` | Network only. GitHub REST, optionally GraphQL. Writes `src/data/github-garden.json`. Knows nothing about tiles. |
| `scripts/generate-zazen-art.mjs` | Palette + pixel maps → PNGs in `public/images/zazen/`. Knows nothing about the game. |
| `src/data/github-garden.json` | Committed artifact. The contract between build and runtime. |

**Runtime (client)**

| Module | Responsibility |
|---|---|
| `zazen-rng.ts` | mulberry32. ~10 lines, no dependency. |
| `zazen-world-geometry.ts` | Iso projection, `TILE_*`, `calculateMapDimensions`, `directionFromDelta`. Pure. |
| `zazen-world-terrain.ts` | `GardenSeed` + seed → `MapTile[]`. Day→tile mapping, stone placement, reachability repair. Pure. |
| `zazen-world-rules.ts` | `performMove`, `isWalkableTile`, `collectStoneAt`, `activateShrine`. Pure. |
| `src/data/garden-schema.ts` | `GardenSeed` type, `parseGardenSeed()`, `FALLBACK_SEED`. |
| `use-zazen-game.ts` | State machine. Takes a seed. |
| `use-zazen-step.ts` | Walk animation state: facing, frame, tween progress. |
| `zazen-world.tsx` | Presentation only. |

`zazen-world-helpers.ts` survives the refactor as a thin re-export barrel so the
existing 224-line test file stays green throughout, and is deleted in the last
step once tests point at the new modules.

Data flows one way, at build time:

```
fetch script → github-garden.json → path.astro (build) → island props → terrain → MapTile[]
```

No runtime fetch. The island is `client:only`, but Astro still serialises props
into it, so the seed arrives with the page: no request, no loading state, no
runtime failure mode. The seed is a reduced structure — roughly 2–4 KB — not a
raw API response. The GitHub API shape never reaches the game.

## Phasing

Phase A builds the whole pipeline and runs it on `FALLBACK_SEED`. Phase B only
swaps the seed's *source* from a constant to a fetched file. There is no
throwaway "static terrain" code path to delete later, and Phase B cannot break
Phase A's rendering, because both feed the same `terrain(seed, rng) → MapTile[]`.

This changes two things in Phase A that the current code hard-codes:

- `STONES` stops being a constant list of positions with lines. The five haiku
  *lines* stay constant; the five *positions* become part of the seed.
- `SHRINE_POSITION` likewise becomes seed-derived rather than `{ posX: 10, posY: 6 }`.

`FALLBACK_SEED` carries today's hand-authored positions, so Phase A looks
deliberate rather than arbitrary.

## F1 — art and feel

### Palette

Six families, seventeen values, fixed, no anti-aliasing on sprite edges:

```
sand   #f2ece0  #e6dccb  #d4c7b2
moss   #a8b295  #8b9a78  #6d7d5c
water  #c3cbc9  #93a3a3  #6a7c80
stone  #cdbfba  #a8968f  #7d6c68
rose   #c2566e  #9b3f56  #6e2b3e     ← --primary-color family
ink    #4a4038  #2e2721
```

Sand sits on `--primary-bg-color` so the garden and the page read as one sheet of
paper. Rose is reserved for stones, the shrine and sakura — the colour marks
progress.

### Pixel discipline

These are requirements, not preferences. They are what separates pixel art from a
small image.

- 2:1 isometric. The diamond edge steps 2px horizontal per 1px vertical. Any other
  slope reads as wrong immediately.
- One light direction, top-left, on every sprite.
- No partial alpha except a deliberate contact shadow.
- Authored at 1x, displayed at integer scale only, `image-rendering: pixelated`.

### Geometry

Unchanged: 64×32 diamond drawn in a 64×64 cell, `TILE_HALF_WIDTH` 32,
`TILE_HALF_HEIGHT` 16. Keeping these means no geometry code changes.

### Assets (~26 PNGs)

- Ground: `sand-0/1/2` (raked variants), `moss-light/mid/deep`, `water-still`
  (4 frames), `stone-slab`, `gravel-edge`, `bridge-plank`
- Decor, 32×64, bottom-anchored: `pine`, `maple`, `bamboo-a/b`, `lantern-lit`,
  `lantern-unlit`, `rock-small`, `rock-mound`, `reed`, `torii`, `post`
- Stones: `stone-marker`, `stone-marker-lit`
- Shrine: `shrine-locked`, `shrine-active`
- Pilgrim: one sheet, 4 facings × 3 frames (idle + 2 walk), ~24×40 per cell
- Effects: `dust-puff` (3 frames), `ripple` (3 frames)

One sheet for the pilgrim, because frame-stepping is natural with
`background-position`. Individual PNGs for tiles and decor, because the CSS is
simpler and the files are tiny.

### Feel

- Pilgrim leaves the tile grid and becomes its own absolutely-positioned layer,
  placed by iso projection. Required for tweening; also removes the `findPlayer`
  scan. `perso` stays on `MapTile` for the decorative NPCs only.
- 4-direction facing, 3-frame walk cycle, ~200ms eased slide between tiles, dust
  puff on landing, idle bob at rest.
- Ambient life: water cycles 4 frames via CSS `steps()`, decor sways on a GPU
  transform. No permanent `requestAnimationFrame` loop — the rAF tween runs only
  during a move.
- Stone pickup: stone sinks, a ripple ring spreads through the raked sand, petals
  burst (reusing the existing `sakura:burst` event), chime plays, haiku line
  brushes in.
- Shrine wake: lanterns light, torii catches rose.

### Scaling

Replace fractional `mapScale` with an integer scale ∈ {1, 2, 3}. Screens too
narrow for scale 1 get a pan/scroll container rather than a fractional shrink.

### Motion preferences

`prefers-reduced-motion` must be honoured in **two** places: CSS in `world.scss`,
and JS in `use-zazen-step` — CSS alone will not stop a rAF tween. Reduced motion
collapses every transition to an instant jump.

## F2 — the garden is the work

### Source

Token-optional by design, so nothing blocks on a secret:

- **With a token** (Actions' `GITHUB_TOKEN`): GraphQL `contributionsCollection`
  gives a real daily calendar.
- **Without**: REST `/users/heristop/events/public` (last 90 days, ≤300 events)
  plus `/users/heristop/repos` for languages. Daily counts are derived from
  PushEvents.

Two requests either way. Unauthenticated REST allows 60/hr per IP; builds are
rare, so rate limits are a non-issue. 403/429 falls back rather than failing.

### Fallback ladder

1. Live fetch at build time → fresh
2. Committed `src/data/github-garden.json` → stale but real
3. `FALLBACK_SEED` constant in source → always builds

Level 3 guarantees `pnpm build` works offline. Level 2 keeps `pnpm dev` fast and
network-free: the fetch is a separate `pnpm run fetch:github`, and the build only
ever reads the JSON.

### Mapping

The 12×12 grid splits into an authored frame and a data field.

- **Outer ring** (44 tiles) — authored landscape: the pond, pines, the torii gate.
  Frames the garden and keeps data away from the map edge.
- **Inner 10×10** (100 tiles) — the last 100 days, newest last.

When the source supplies fewer than 100 days — the REST window is 90 — the seed is
left-padded: the oldest `100 − n` tiles carry no day and render as plain raked
sand, indistinguishable from a zero-commit day. So the mapping is source-agnostic,
and switching a token on later lengthens the history without changing any layout
code.

Days are laid out **boustrophedon** — rows alternate direction, so consecutive
days are always adjacent:

```
day  0 →  1 →  2 →  3 → … →  9
                             ↓
day 19 ← 18 ← 17 ← 16 ← … ← 10
 ↓
day 20 → 21 → …
```

`col = row % 2 === 0 ? i : 9 - i`. One line, and it earns the whole design: a
streak of consecutive active days becomes an unbroken mossy trail through the
sand. Row-major ordering breaks that adjacency at every row wrap.

Intensity → ground cover:

| Commits that day | Tile |
|---|---|
| 0 | raked sand — empty, composed, walkable |
| 1–3 | sand with moss creeping in |
| 4–8 | moss |
| 9+ | deep moss, and a plant |

Zero days are **sand, never water**. Weekends are common; water-on-zero would
fragment the garden into an archipelago and fight the repair pass. Empty raked
sand is also the more honest zen reading: a quiet day is calm, not impassable.
Water stays an authored feature of the outer ring.

Other channels:

- The dominant language of that day's repos picks the plant species — TypeScript →
  bamboo, PHP → pine, JS → maple, and so on. A small legend makes it legible.
- Total contributions in the window set sakura bloom density.
- Stars → lanterns. Optional, deferred.

### Placement

- **Stones** sit on the 5 highest-contribution days, chosen greedily with a minimum
  Manhattan separation of 3 so they spread across the garden. If fewer than 5
  days qualify, fall back to fixed authored positions. **Invariant: always exactly
  5 stones** — the haiku has 5 lines and the loop depends on it. Asserted in a test.
- **Shrine** sits on today's tile — the last data tile.
- **Pilgrim** starts on the oldest day. The walk runs past → present.

### Reachability

Data shapes appearance; a repair pass guarantees the game is winnable.

1. Stone and shrine tiles are always walkable ground.
2. Flood-fill from the pilgrim's start.
3. Any stone or the shrine outside the reachable set: carve the cheapest path,
   converting blocking tiles to sand, until reachable.

Tested as a property: over N synthetic seeds — including empty, single-day and
maximally sparse ones — every stone and the shrine are reachable.

### Privacy

Public events only, so private and work repos never appear. Even so: show repo
name, date and count — **not raw commit messages**, which can carry text that
should not land on a public page. A repo allow/deny list in the fetch script
costs nothing and prevents a bad surprise.

### Announcements

The data makes the accessibility layer *better*: "Stone 3 of 5 — 14 March, 11
commits in zazen-code" is richer than the current visual-only garden. The existing
`aria-live` announcer carries it.

## CI

- Add a fetch step before `pnpm run build`.
- Add `schedule: cron: '0 5 * * *'` so the garden tracks activity rather than only
  refreshing when a post ships.
- **Do not commit the fetched JSON back to master.** A push from the deploy
  workflow re-triggers the deploy workflow. The committed snapshot is the offline
  fallback and is refreshed by hand; if auto-commit is ever wanted, it needs a
  `paths-ignore` or `[skip ci]` guard.
- Note: GitHub disables scheduled workflows on repos with 60 days of no activity.
  Not a concern for an active blog.

## Testing

- Unit: geometry, rules, terrain mapping, RNG determinism, stone-count invariant,
  reachability property test, seed parsing and fallback.
- Component: the existing `zazen-world.test.tsx` assertions, plus facing and
  reduced-motion behaviour.
- Visual: a new Playwright spec for `/path` with the seed pinned — **chromium
  desktop and mobile only**. Five projects × three viewports would mean 15 PNGs
  for art that changes often.

## Out of scope

- Changing the haiku text, the audio, or the finale overlay
- Dark mode (the site is light-only)
- Any gameplay mechanic beyond the existing walk-and-gather loop
- Runtime GitHub fetching from the browser

## Risks

| Risk | Mitigation |
|---|---|
| Data makes the garden unwinnable | Appearance-only mapping + flood-fill repair + property test |
| Pixel art looks blurry | Integer scale only, `image-rendering: pixelated`, 2:1 slope discipline |
| Build breaks when GitHub is down | Three-level fallback ladder; level 3 needs no network |
| CI push loop | Never commit fetched data from the deploy workflow |
| Accessibility regression | Existing roles/labels/announcer are explicit non-regression requirements |
| Scope overrun | Phase A ships alone; Phase B layers on top |
