# Game workspace implementation plan

**Goal:** Extract the complete game into a private pnpm workspace package while preserving gameplay and the Astro page URL.

**Architecture:** The root Astro application consumes `@zazencode/path-of-stones` and `@zazencode/ui` through explicit package exports and `workspace:*` dependencies. The game owns its model, renderer, styles, loading screen, assets, source artwork, saved activity snapshot, scripts, documentation and tests. Shared icons and text animation belong to the UI package so neither package imports the application.

**Constraints:** Work on `codex/game-workspace`, based on rebased `master`. Use English in all new or moved prompts, comments, documentation and identifiers. Preserve game rules, trained weights, storage keys, sprite pixels, asset density and the daily GitHub refresh. Keep existing root commands usable. Do not push without a new request.

## Implementation

- [x] Add a regression test that imports the package's headless entry in Node and verifies package ownership of runtime assets. Confirm it fails before extraction.
- [x] Move the game to `packages/path-of-stones`, shared UI to `packages/ui`, and update imports by resolving their original targets. Give both packages manifests, narrow exports and local test commands.
- [x] Bundle game images and sounds using Vite asset imports, preserving source image bytes. Rename the scenery, character and ground folders in English. Translate source-art notes and prompts.
- [x] Move the game shell and loading fallback into the game package; retain site metadata, navigation integration and global styling at the Astro host. Expose the saved activity snapshot as a package export.
- [x] Move unit, browser, ingestion and art tests with their owners. Update architecture checks, shared Vitest configuration, Playwright discovery, root scripts and the deployment workflow.
- [x] Update documentation and regenerate the pnpm lockfile without upgrading dependency versions. Verify a frozen install.
- [x] Run the full unit suite, package type checks, Astro checks, game coverage and production build. Smoke-test the headless evaluator and preview in desktop/mobile browsers, checking image and audio requests as well as hydration and movement.

## Verification contracts

`tests/workspace.test.ts` must run the real Node loader and import `@zazencode/path-of-stones/headless` without a DOM. Architecture tests must reject source imports across package boundaries and undeclared production dependencies. Existing simulation, sprite geometry, rendering and interaction tests remain the behavior baseline. Browser tests must exercise the built site so missing packaged assets cannot pass through development-only paths.

## Validation results

- All 415 unit tests pass across 54 files. The final shared UI and boundary subset passes all 38 tests after stylesheet extraction.
- Package type checks and Astro checks pass without errors, warnings or hints. The full build emits 119 pages and verifies all 66 articles.
- Game coverage: 97.19% lines, 96.67% statements, 96.01% functions and 91.34% branches.
- The offline evaluator completes 24 games per policy on eight validation gardens, with no unsolved sampled gardens, early wins or simulation loops.
- All 113 moved binary assets retain their original bytes, and all 103 runtime assets are emitted by the production build. The 15 checked model, policy, schema, score and snapshot files are unchanged.
- All 46 selected desktop/mobile production checks pass across the initial run and serial retries. Screenshot comparisons were excluded; layout, hydration, interactions, turns, rendering, image requests and music requests were exercised. The restarted development server passes its loading and asset checks.
- Both package archives contain every declared export, retain private/restricted publication settings and exclude tests, training reports and source artwork. Registry publishing remains disabled.
