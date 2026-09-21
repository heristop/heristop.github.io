# Zen footer scene implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paint a sumi-e ink-wash landscape under the site footer, with a monk drifting across the water on a sampan, so the footer reads like the engraved-illustration footer the user liked, translated into a zazen aesthetic.

**Architecture:** `FooterScene.astro` (already drafted, uncommitted) owns a single inline SVG plus a tiny inline script that toggles `.is-awake` on the wrapper while the footer is on screen. All colour, sizing and motion live in SCSS (`_layout.scss`) driven by one new token, `--footer-ink`, so the SVG carries only geometry and class hooks. `Footer.astro` mounts the scene between the link columns and the copyright band, and the copyright band is pulled down over the water.

**Tech Stack:** Astro 7 (`.astro` components, `astro/container` for tests), SCSS (`sass`), Vitest 4 (jsdom for the site project, a new `getViteConfig` project for `.astro` rendering), Playwright (visual snapshots), pnpm.

**Spec:** the "Design Spec" section below (there is no separate spec document).

## Design Spec

**Reference.** A footer (tweet by @elayadesigns) whose entire background is a monochrome engraved, toile-style illustration: clouds at the top, a mountain range mid-height, sea across the bottom, a Mediterranean church on a cliff at the right with trees, and a small boat drifting slowly left to right across the water. The boat is the only notable motion; clouds drift subtly. The brand and social links sit top-left and four link columns sit in the sky area over the art.

**Zen translation (decided).** Sumi-e ink wash instead of engraving. Monochrome warm ink (`--footer-ink`, `oklch(24% 0.02 350deg)`, hue matching the site's crimson) with one colour accent: a brushed vermilion sun disk using `--primary-color`. Layers back to front:

1. Brushed red sun (`.footer-scene__sun`, breathes: scale 1 to 1.04 over `--zen-duration-breath` x 2).
2. Three small birds (`.footer-scene__birds`) crossing the sky slowly with a slight bob.
3. Pale far range fading into mist (`#footer-far` vertical gradient, brush filter).
4. High mist band (`.footer-scene__mist--high`, radial gradient ellipse, drifts +/-40 viewBox units).
5. Mid range with the big left peak (`#footer-mid`, brush filter).
6. Low mist band (`.footer-scene__mist--low`).
7. Faint water ripple strokes (`.footer-scene__water`).
8. Sampan with a monk seated in zazen (`.footer-scene__voyage` > `.footer-scene__bob` > two `<use href="#footer-boat">`: the boat and a faint mirrored reflection). Drifts from x = -80 to x = 900 viewBox units in ~110 s, linear, looping; it disappears behind the right cliff before looping.
9. Dark right cliff (`#footer-cliff` gradient) with dry-brush strokes (`.footer-scene__stroke`).
10. Three-tier pagoda on the cliff (`.footer-scene__pagoda`).
11. Japanese pine with cloud-pad foliage leaning over the water (`.footer-scene__pine`, `.footer-scene__trunk`, `--thin`).
12. Left foreground rocks with reeds (`.footer-scene__rocks`).
13. Paper grain overlay (`#footer-grain` filter on a full-size rect).

**Rendering rules.** The SVG uses `viewBox="0 0 1200 420"` and `preserveAspectRatio="xMaxYMax slice"` so narrow screens keep the pagoda and pine side. Brushy edges come from `feTurbulence` + `feDisplacementMap` (`#footer-brush`) on static shapes only; the sun is the one exception (a ~70 px region, cheap). Mist uses `radialGradient`, never blur filters, because it animates. Gradient stops reference `var(--footer-ink)` and `var(--primary-bg-color)` so the whole scene re-tints from tokens.

**Motion rules.** Every animation is `animation-play-state: paused` until the wrapper has `.is-awake`, which an `IntersectionObserver` toggles while the footer intersects the viewport. Under `prefers-reduced-motion: reduce` there is no animation at all; the boat and birds are parked at fixed positions. Transforms that scale need `transform-box: fill-box; transform-origin: center`.

**Placement.** Scene height `clamp(11rem, 30vw, 20rem)`, its own `overflow: hidden`, a negative top margin so the sky tucks under the link columns, and a `mask-image` linear gradient that melts the top of the sky into the footer background. The link columns and the copyright band sit above the art (`z-index`); the copyright band overlaps the bottom of the scene (over the water) with a faint paper-coloured text halo for legibility. The footer keeps `overflow: visible` because the `--eof--` pill is translated -50% above its top edge.

**Accessibility.** The scene is decorative: wrapper `aria-hidden="true"`, `<svg focusable="false">`, `pointer-events: none`. All existing footer links, buttons, scripts and ARIA stay untouched.

## Global Constraints

- Package manager is **pnpm** (`pnpm@11.5.1`); never run `npm` or `npx`. Run tools via `pnpm exec`.
- Node `>=22.18.0`.
- Conventional commits (`feat(footer): ...`, `test(footer): ...`, `style(footer): ...`). End every commit message with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- The husky pre-commit hook runs `pnpm build` (astro check + build + verify-build), `pnpm test`, `pnpm format`, then lint-staged (`astro format` + stylelint on SCSS, `oxlint --fix` on ts/astro). Every commit takes a few minutes; never bypass it with `--no-verify`. The hook `git add`s files it reformats.
- Stylelint config: `.stylelintrc.json` (`stylelint-config-standard`; class pattern and descending specificity are off). Lint config: `oxlintrc.json`. Design notes in `.impeccable.md`: respect reduced motion, visible keyboard focus, 44 px controls.
- Colour token names are kebab-case custom properties defined on `:root` in `src/styles/_tokens.scss`. The site has no dark mode.
- SCSS for the footer lives in `src/styles/_layout.scss` as the `.site-footer` BEM block (nested `&__element` rules, breakpoints `@media screen and (width >= 640px)` and `(width >= 1024px)`, a `@media (prefers-reduced-motion: reduce)` block nested inside). Follow the same BEM + nesting style for `.footer-scene`.
- Rendered footer width is about 936 px at a 1280 px viewport (inside `.site-layout`).
- Do not create documentation or README files. Do not push.
- `packages/path-of-stones` (a submodule) already shows local modifications that are not part of this work; never stage or commit anything under it.

---

### Task 1: Harden and commit the drafted FooterScene component

**Files:**
- Modify: `src/components/FooterScene.astro` (uncommitted draft; full SVG already written)
- Modify: `vitest.config.ts` (register a second project for `.astro` rendering)
- Create: `tests/astro/vitest.config.ts`
- Create: `tests/astro/footer-scene.test.ts`
- Create: `tests/components/footer-scene-script.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<FooterScene />` (default export of `src/components/FooterScene.astro`, no props) rendering `<div class="footer-scene" aria-hidden="true" data-footer-scene>` around `<svg class="footer-scene__svg">`. Class hooks used by Task 2 CSS: `footer-scene`, `footer-scene__svg`, `footer-scene__sun`, `footer-scene__birds`, `footer-scene__mist`, `footer-scene__mist--high`, `footer-scene__mist--low`, `footer-scene__water`, `footer-scene__voyage`, `footer-scene__bob`, `footer-scene__boat`, `footer-scene__boat-reflection`, `footer-scene__stroke`, `footer-scene__pagoda`, `footer-scene__pine`, `footer-scene__trunk`, `footer-scene__trunk--thin`, `footer-scene__rocks`, and the state class `is-awake` on the wrapper. Vitest project name `astro-components` (run with `pnpm exec vitest run --project astro-components`).

Two bugs are in the draft and both get a failing test first:

1. **Boat reflection is mirrored around the middle of the hull, not the waterline.** With `<use y="344">`, the `y` attribute is applied to the referenced content *before* the element's `transform`, so under `translate(0 T) scale(1 -1)` a symbol point at `p.y` lands at `T - (p.y + 344)`. The hull spans `p.y` 0..10, so the waterline is `p.y = 10`, i.e. `y = 354`; mirroring around it needs `T = 2 * 354 = 708`. The draft uses `698`, which mirrors around `y = 349`: the mirrored hull is painted back over the real hull and the reflected monk floats 5 units too high.
2. **Two observers on the first page load.** The script calls `initFooterScene()` immediately *and* on `astro:page-load`; with `<ClientRouter />` in `Layout.astro`, `astro:page-load` also fires on the initial load, so the first page gets two observers on the same element, and only one is disconnected at `astro:before-swap`. Guard with a `data-footer-scene-init` flag on the element, like `Footer.astro` does with `dataset.initialized`.

- [ ] **Step 1: Register a vitest project that can render `.astro` files**

The existing `site` project (jsdom) cannot compile `.astro` imports. Astro's container API needs Astro's own Vite plugins, which `getViteConfig` from `astro/config` provides. Create `tests/astro/vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";

// Renders .astro components through Astro's container API. Loaded as a vitest
// project from the root config, so `include` resolves against this directory.
export default getViteConfig({
  test: {
    name: "astro-components",
    environment: "node",
    include: ["*.test.ts"],
  },
});
```

Then edit `vitest.config.ts` so the `site` project skips this directory and the new project is listed:

```ts
import { defineConfig } from "vitest/config";
import { sharedTest } from "./vitest.shared";

export default defineConfig({
  test: {
    maxWorkers: 3,
    projects: [
      {
        test: {
          ...sharedTest,
          name: "site",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/visual/**", "tests/astro/**"],
        },
      },
      "tests/astro/vitest.config.ts",
      "packages/*/vitest.config.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/components/client/**/*.{ts,tsx}",
        "src/plugins/**/*.ts",
        "packages/*/src/**/*.{ts,tsx}",
      ],
    },
  },
});
```

Note: `include: ["*.test.ts"]` is deliberate. When a project is loaded by path from the root config its root is the config file's directory; `tests/astro/*.test.ts` would find nothing. Always run this project through the root config (`pnpm exec vitest run --project astro-components`), never with `--config tests/astro/vitest.config.ts`.

- [ ] **Step 2: Write the failing container test**

Create `tests/astro/footer-scene.test.ts`:

```ts
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
    expect(html).toMatch(/<svg class="footer-scene__svg"[^>]*focusable="false"/);
  });

  it("keeps the pagoda side of the painting on narrow screens", () => {
    expect(html).toContain('viewBox="0 0 1200 420"');
    expect(html).toContain('preserveAspectRatio="xMaxYMax slice"');
  });

  it("draws the pagoda, the pine and the boat with its reflection", () => {
    expect(html).toContain('class="footer-scene__pagoda"');
    expect(html).toContain('class="footer-scene__pine"');
    expect(html).toContain('class="footer-scene__boat"');
    expect(html.match(/href="#footer-boat"/g)).toHaveLength(2);
  });

  it("mirrors the reflection around the hull waterline (y = 354)", () => {
    expect(html).toMatch(
      /class="footer-scene__boat-reflection" y="344" transform="translate\(0 708\) scale\(1 -1\)"/,
    );
  });

  it("ships the wake-up script for the scene", () => {
    expect(html).toContain("<script>");
    expect(html).toContain("IntersectionObserver");
    expect(html).toContain("astro:page-load");
  });
});
```

- [ ] **Step 3: Run the container test to verify only the reflection assertion fails**

Run: `pnpm exec vitest run --project astro-components`
Expected: 5 tests, 4 pass, 1 FAIL: "mirrors the reflection around the hull waterline" (the rendered markup contains `translate(0 698)`).

- [ ] **Step 4: Fix the reflection transform**

In `src/components/FooterScene.astro`, change the reflection `<use>`:

```html
<use href="#footer-boat" class="footer-scene__boat-reflection" y="344" transform="translate(0 708) scale(1 -1)" />
```

Run: `pnpm exec vitest run --project astro-components`
Expected: 5 passed.

- [ ] **Step 5: Write the failing script test (jsdom, site project)**

The inline script is not executed by the container, so test it by extracting it from the component source and running it against jsdom with a fake `IntersectionObserver`. Create `tests/components/footer-scene-script.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../../src/components/FooterScene.astro", import.meta.url), "utf8");
const script = /<script is:inline>([\s\S]*?)<\/script>/.exec(source)?.[1];
if (!script) {
  throw new Error("FooterScene.astro has no inline script");
}

type Entry = { isIntersecting: boolean };
type Callback = (entries: Entry[]) => void;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observe = vi.fn();
  disconnect = vi.fn();
  callback: Callback;

  constructor(callback: Callback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }
}

const mountScene = () => {
  document.body.innerHTML = '<div class="footer-scene" aria-hidden="true" data-footer-scene></div>';
  const scene = document.querySelector<HTMLElement>("[data-footer-scene]");
  if (!scene) {
    throw new Error("scene not mounted");
  }
  return scene;
};

// The script declares `const initFooterScene` at top level; wrapping it in a
// Function gives each run its own scope, as a fresh classic script would have.
const runScript = () => new Function(script)();

describe("FooterScene inline script", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("creates one observer even though astro:page-load also fires on the first load", () => {
    const scene = mountScene();
    runScript();
    document.dispatchEvent(new Event("astro:page-load"));

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(FakeIntersectionObserver.instances[0].observe).toHaveBeenCalledWith(scene);
  });

  it("wakes the scene while it intersects and sleeps it when it leaves", () => {
    const scene = mountScene();
    runScript();
    const [observer] = FakeIntersectionObserver.instances;

    observer.callback([{ isIntersecting: true }]);
    expect(scene.classList.contains("is-awake")).toBe(true);

    observer.callback([{ isIntersecting: false }]);
    expect(scene.classList.contains("is-awake")).toBe(false);
  });

  it("disconnects on astro:before-swap and observes the swapped-in scene", () => {
    mountScene();
    runScript();
    document.dispatchEvent(new Event("astro:before-swap"));
    expect(FakeIntersectionObserver.instances[0].disconnect).toHaveBeenCalledOnce();

    const nextScene = mountScene();
    document.dispatchEvent(new Event("astro:page-load"));
    expect(FakeIntersectionObserver.instances).toHaveLength(2);
    expect(FakeIntersectionObserver.instances[1].observe).toHaveBeenCalledWith(nextScene);
  });

  it("wakes the scene immediately when IntersectionObserver is unavailable", () => {
    vi.unstubAllGlobals(); // jsdom has no IntersectionObserver of its own
    const scene = mountScene();
    runScript();
    expect(scene.classList.contains("is-awake")).toBe(true);
  });
});
```

- [ ] **Step 6: Run the script test to verify the double-init case fails**

Run: `pnpm exec vitest run --project site tests/components/footer-scene-script.test.ts`
Expected: 4 tests, 2 FAIL: "creates one observer even though astro:page-load also fires on the first load" (received length 2) and "disconnects on astro:before-swap and observes the swapped-in scene" (received length 4: every earlier `runScript()` left an `astro:page-load` listener behind, and without the guard each one creates an observer). The other two pass.

- [ ] **Step 7: Guard the initialiser**

Replace the whole `<script is:inline>` block at the bottom of `src/components/FooterScene.astro` with:

```html
<script is:inline>
  const initFooterScene = () => {
    const scene = document.querySelector('[data-footer-scene]');
    if (!scene || scene.dataset.footerSceneInit === 'true') return;
    scene.dataset.footerSceneInit = 'true';
    if (!('IntersectionObserver' in globalThis)) {
      scene.classList.add('is-awake');
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      scene.classList.toggle('is-awake', entry.isIntersecting);
    });
    observer.observe(scene);
    document.addEventListener('astro:before-swap', () => observer.disconnect(), { once: true });
  };
  initFooterScene();
  document.addEventListener('astro:page-load', initFooterScene);
</script>
```

- [ ] **Step 8: Run both test files and the lint**

Run: `pnpm exec vitest run --project site tests/components/footer-scene-script.test.ts && pnpm exec vitest run --project astro-components && pnpm lint`
Expected: 4 passed, 5 passed, oxlint reports 0 errors (warnings about unrelated files are acceptable only if they existed before your change: compare with `git stash` if unsure).

- [ ] **Step 9: Record the visual-test baseline before any visible change ships**

The full-page desktop snapshots in `tests/visual/*-snapshots/` include the footer and will change once the scene is mounted (Task 3). Measure the baseline now so Task 4 can tell footer diffs from pre-existing drift. Run: `pnpm test:visual 2>&1 | tail -30`
Expected: all pass. If any test already fails, note its name in your task report; do not update snapshots yet.

- [ ] **Step 10: Commit**

```bash
git add src/components/FooterScene.astro vitest.config.ts tests/astro/vitest.config.ts tests/astro/footer-scene.test.ts tests/components/footer-scene-script.test.ts
git commit -m "feat(footer): add sumi-e footer scene component

Inline SVG landscape (sun, ranges, mist, boat with a monk, cliff, pagoda,
pine, rocks, paper grain) with an IntersectionObserver that wakes its
animations only while the footer is on screen. Adds an astro-components
vitest project so .astro files can be rendered in tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

The pre-commit hook runs the full build and test suite; wait for it.

---

### Task 2: Ink token and scene styles

**Files:**
- Modify: `src/styles/_tokens.scss:11` (add `--footer-ink` after `--footer-text-color`)
- Modify: `src/styles/_layout.scss` (add a `.footer-scene` block and its keyframes right after the closing `}` of the `.site-footer` block, immediately before the `@media screen and (width >= 640px) {` rule that starts with `.site-footer__container`, around line 971)

**Interfaces:**
- Consumes: class hooks and `.is-awake` from Task 1.
- Produces: token `--footer-ink: oklch(24% 0.02 350deg)`; the `.footer-scene` block (sizing, mask, fills, strokes, animations, paused/awake states, reduced-motion overrides); keyframes `footer-scene-voyage`, `footer-scene-bob`, `footer-scene-mist`, `footer-scene-birds`, `footer-scene-sun`. Task 3 relies on `.footer-scene` having `position: relative; z-index: 0; overflow: hidden` and the negative `margin-top`.

- [ ] **Step 1: Add the ink token**

In `src/styles/_tokens.scss`, directly after the line `--footer-text-color: oklch(28% 0.01 55deg);` add:

```scss
  --footer-ink: oklch(24% 0.02 350deg); /* sumi ink for the footer painting; hue follows --primary-color */
```

- [ ] **Step 2: Add the scene block and keyframes**

In `src/styles/_layout.scss`, find the end of the `.site-footer { ... }` block (the closing brace after the nested `@media (prefers-reduced-motion: reduce)` block, just before `@media screen and (width >= 640px) {` / `.site-footer__container {`). Insert this between them:

```scss
// Footer painting. Geometry lives in FooterScene.astro; everything visible is
// decided here so the scene re-tints from tokens. Motion runs only while the
// wrapper carries `.is-awake` (IntersectionObserver in the component) and never
// under reduced motion.
.footer-scene {
  position: relative;
  z-index: 0;
  height: clamp(11rem, 30vw, 20rem);
  margin-top: calc(-1 * clamp(3rem, 9vw, 5.5rem));
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(180deg, transparent 0%, #000 42%);

  &__svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  &__sun {
    fill: var(--primary-color);
    opacity: 0.8;
    transform-box: fill-box;
    transform-origin: center;
    animation: footer-scene-sun calc(var(--zen-duration-breath) * 2) var(--zen-ease-in-out) infinite alternate;
  }

  &__birds {
    stroke: var(--footer-ink);
    stroke-width: 1.4;
    stroke-linecap: round;
    opacity: 0.55;
    animation: footer-scene-birds 75s linear infinite;
  }

  &__mist {
    animation: footer-scene-mist 55s var(--zen-ease-in-out) infinite alternate;

    &--low {
      animation-duration: 40s;
      animation-direction: alternate-reverse;
    }
  }

  &__water {
    stroke: var(--footer-ink);
    stroke-width: 1.2;
    stroke-linecap: round;
    opacity: 0.32;
  }

  &__voyage {
    animation: footer-scene-voyage 110s linear infinite;
  }

  &__bob {
    animation: footer-scene-bob 6s var(--zen-ease-in-out) infinite alternate;
  }

  &__boat {
    fill: var(--footer-ink);
    opacity: 0.88;
  }

  &__boat-reflection {
    fill: var(--footer-ink);
    opacity: 0.16;
  }

  &__stroke {
    stroke: var(--footer-ink);
    stroke-width: 1.3;
    stroke-linecap: round;
    opacity: 0.5;
  }

  &__pagoda {
    fill: var(--footer-ink);
    opacity: 0.92;

    path {
      stroke: var(--footer-ink);
      stroke-linecap: round;
    }
  }

  &__pine {
    fill: var(--footer-ink);
    opacity: 0.85;
  }

  &__trunk {
    fill: none;
    stroke: var(--footer-ink);
    stroke-width: 5;
    stroke-linecap: round;
    stroke-linejoin: round;

    &--thin {
      stroke-width: 2.5;
    }
  }

  &__rocks {
    fill: var(--footer-ink);
    opacity: 0.7;
  }

  // Asleep by default: the first keyframe parks the boat and birds off-canvas.
  &__sun,
  &__birds,
  &__mist,
  &__voyage,
  &__bob {
    animation-play-state: paused;
  }

  &.is-awake &__sun,
  &.is-awake &__birds,
  &.is-awake &__mist,
  &.is-awake &__voyage,
  &.is-awake &__bob {
    animation-play-state: running;
  }
}

@keyframes footer-scene-voyage {
  from {
    transform: translateX(-80px);
  }

  to {
    transform: translateX(900px);
  }
}

@keyframes footer-scene-bob {
  from {
    transform: translateY(-2px);
  }

  to {
    transform: translateY(2px);
  }
}

@keyframes footer-scene-mist {
  from {
    transform: translateX(-40px);
  }

  to {
    transform: translateX(40px);
  }
}

@keyframes footer-scene-birds {
  0% {
    transform: translate(-60px, 150px);
  }

  50% {
    transform: translate(600px, 132px);
  }

  100% {
    transform: translate(1260px, 118px);
  }
}

@keyframes footer-scene-sun {
  from {
    transform: scale(1);
  }

  to {
    transform: scale(1.04);
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer-scene__sun,
  .footer-scene__birds,
  .footer-scene__mist,
  .footer-scene__voyage,
  .footer-scene__bob {
    animation: none;
  }

  // Without the keyframes the boat and birds would sit at their untransformed
  // origin (off-canvas / top-left), so park them in the painting instead.
  .footer-scene__voyage {
    transform: translateX(430px);
  }

  .footer-scene__birds {
    transform: translate(520px, 136px);
  }
}
```

Notes for the implementer:
- `px` inside an SVG CSS transform means viewBox user units here, so `translateX(900px)` is x = 900 of the 1200-wide viewBox; the cliff starts at x ≈ 770 and is painted after the boat, so the boat is hidden by the time it loops back to -80 (off-canvas).
- The paper-grain `<rect>` needs no CSS: `#footer-grain` replaces the source graphic with noise, so the rect's default fill is irrelevant.
- Only `__sun` scales, hence only it needs `transform-box` / `transform-origin`.

- [ ] **Step 3: Lint the stylesheets**

Run: `pnpm style:lint`
Expected: no output (0 problems). If `declaration-property-value-no-unknown` or `property-no-unknown` flags an SVG presentation property (`stroke-linecap`, `transform-box`), the value is correct CSS; keep it and add `/* stylelint-disable-next-line <rule-name> */` above that single declaration rather than disabling the rule globally.

- [ ] **Step 4: Confirm the SCSS compiles in the real build pipeline**

Run: `pnpm exec astro build 2>&1 | tail -5`
Expected: build completes (`Complete!` line) with no sass errors. (This is the same build the pre-commit hook runs; running it now surfaces problems before the commit.)

- [ ] **Step 5: Commit**

```bash
git add src/styles/_tokens.scss src/styles/_layout.scss
git commit -m "style(footer): paint the footer scene from the ink token

Adds --footer-ink and the .footer-scene block: fills and strokes per
layer, sizing with a masked sky, and the voyage/bob/mist/birds/sun
keyframes that stay paused until the scene is awake and are removed
under reduced motion.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Mount the scene in the footer and float the copyright over the water

**Files:**
- Modify: `src/components/Footer.astro` (import at the top of the frontmatter; `<FooterScene />` between `.site-footer__container` and `.site-footer__bottom`)
- Modify: `src/styles/_layout.scss` inside `.site-footer`: the root `padding` (line ~292), `&__container` (line ~316), `&__bottom` (line ~776), `&__copyright` (line ~792)

**Interfaces:**
- Consumes: `<FooterScene />` from Task 1; `.footer-scene` sizing (height, negative `margin-top`, `z-index: 0`) from Task 2.
- Produces: final footer DOM order `.site-footer__eof` → `.site-footer__container` → `.footer-scene` → `.site-footer__bottom`. Task 4's snapshot refresh depends on this layout being final.

- [ ] **Step 1: Import and mount the scene**

In `src/components/Footer.astro` frontmatter, after `import Icon from './Icon.astro';` add:

```ts
import FooterScene from './FooterScene.astro';
```

In the template, between the closing `</div>` of `.site-footer__container` and the `<!-- Copyright -->` comment, insert:

```html
  <FooterScene />

```

Nothing else in the template or the two inline scripts changes.

- [ ] **Step 2: Lift the columns above the art and pull the copyright over the water**

In `src/styles/_layout.scss`, inside `.site-footer`:

(a) Root padding: the copyright band will be in flow *inside* the last stretch of the scene, so the footer needs no bottom padding of its own. Change

```scss
  padding: 2.75rem 0 0.75rem;
```
to
```scss
  padding: 2.75rem 0 0;
```

(b) `&__container`: add positioning so the columns paint above the scene, which is `z-index: 0`:

```scss
  &__container {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }
```

(c) Replace the whole `&__bottom` rule (it currently carries the 1 px gradient hairline, which the painting replaces) with a band that overlaps the last `clamp(2.6rem, 6vw, 3.25rem)` of the scene and fills exactly that height, so the water reaches the footer's bottom edge and the copyright is always inside the footer box:

```scss
  &__bottom {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    min-height: clamp(2.6rem, 6vw, 3.25rem);
    margin-top: calc(-1 * clamp(2.6rem, 6vw, 3.25rem));
    padding: 0 1rem;
    text-align: center;
  }
```

(d) `&__copyright`: add a paper halo so the text stays legible when the boat or ripples pass behind it. Add to the existing rule:

```scss
    text-shadow:
      0 0 2px var(--primary-bg-color),
      0 0 8px var(--primary-bg-color),
      0 0 16px var(--primary-bg-color);
```

- [ ] **Step 3: Lint and unit-test**

Run: `pnpm style:lint && pnpm lint && pnpm test`
Expected: stylelint silent, oxlint 0 errors, all vitest projects pass (the `astro-components` and script tests from Task 1 included).

- [ ] **Step 4: Start the dev server**

Run (background): `pnpm dev --host 127.0.0.1 --port 4325`
Expected: `Local http://127.0.0.1:4325/` in the output. Port 4325 is the one `playwright.config.ts` uses, so a later `pnpm test:visual` reuses this server.

- [ ] **Step 5: Screenshot and probe the footer at 1280 px and 375 px, plus reduced motion**

Create `test-results/footer-check.mjs` (the `test-results/` folder is gitignored; `playwright` is a devDependency so the import resolves from the repo root):

```js
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:4325";
const out = "test-results/footer";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

for (const [name, width] of [["desktop", 1280], ["mobile", 375]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const footer = page.locator("footer.site-footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await footer.screenshot({ path: `${out}/footer-${name}.png` });
  const report = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    const scene = document.querySelector("[data-footer-scene]");
    const voyage = document.querySelector(".footer-scene__voyage");
    const footerBox = rect("footer.site-footer");
    const eof = rect(".site-footer__eof");
    const copyright = rect(".site-footer__copyright");
    return {
      awake: scene.classList.contains("is-awake"),
      playState: getComputedStyle(voyage).animationPlayState,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      eofStraddlesTopEdge: eof.top < footerBox.top && eof.bottom > footerBox.top,
      copyrightInsideFooter: copyright.top >= footerBox.top && copyright.bottom <= footerBox.bottom,
    };
  });
  console.log(name, report);
  await page.close();
}

const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.locator("footer.site-footer").scrollIntoViewIfNeeded();
console.log(
  "reduced-motion animationName:",
  await page.evaluate(() => getComputedStyle(document.querySelector(".footer-scene__voyage")).animationName),
);
await browser.close();
```

Run: `node test-results/footer-check.mjs`
Expected output:

```
desktop { awake: true, playState: 'running', horizontalScroll: false, eofStraddlesTopEdge: true, copyrightInsideFooter: true }
mobile { awake: true, playState: 'running', horizontalScroll: false, eofStraddlesTopEdge: true, copyrightInsideFooter: true }
reduced-motion animationName: none
```

- [ ] **Step 6: Inspect the screenshots**

Read `test-results/footer/footer-desktop.png` and `test-results/footer/footer-mobile.png` and check every item:

- The sky fades into the footer background under the link columns; no hard top edge on the painting.
- Column text, the RSS / Link in Bio buttons and the ink-wash avatar are fully legible; nothing dark sits behind them.
- The pagoda, pine and cliff are visible on the right in both sizes; the left rocks are visible on desktop (they may be cropped on mobile: that is the `xMaxYMax slice` choice, not a bug).
- The copyright line sits over the water, fully inside the footer, legible against ripples.
- The `-- eof --` pill straddles the footer's top edge, not clipped.
- No horizontal scrollbar.

If the copyright collides with the boat in a way that hurts legibility, adjust only the `min-height`/`margin-top` pair in `&__bottom` (both must stay equal) by up to 0.5rem and re-run Step 5.

- [ ] **Step 7: Check the scene sleeps when off screen**

Run: `node -e "
import('playwright').then(async ({ chromium }) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:4325/blog', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  console.log('top of page awake:', await page.evaluate(() => document.querySelector('[data-footer-scene]').classList.contains('is-awake')));
  console.log('observers:', await page.evaluate(() => document.querySelectorAll('[data-footer-scene-init=\"true\"]').length));
  await browser.close();
});
"`
Expected: `top of page awake: false` (blog listing is taller than one viewport) and `observers: 1`.

- [ ] **Step 8: Stop the dev server, then commit**

Stop the background dev server. Then:

```bash
git add src/components/Footer.astro src/styles/_layout.scss
git commit -m "feat(footer): mount the sumi-e scene under the footer

Places the painting between the link columns and the copyright band,
lifts the columns above it and floats the copyright over the water
with a paper halo. Replaces the bottom hairline with the painting.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Full verification and visual snapshot refresh

**Files:**
- Modify: `tests/visual/about.spec.ts-snapshots/*.png`, `tests/visual/blog.spec.ts-snapshots/*.png`, `tests/visual/homepage.spec.ts-snapshots/*.png`, `tests/visual/projects.spec.ts-snapshots/*.png` (regenerated by Playwright; only footer regions should differ)

**Interfaces:**
- Consumes: the final footer from Task 3 and the baseline noted in Task 1 Step 9.
- Produces: green `pnpm lint`, `pnpm style:lint`, `pnpm test`, `pnpm build`, `pnpm test:visual`.

- [ ] **Step 1: Run the static checks and unit tests**

Run: `pnpm lint && pnpm style:lint && pnpm test`
Expected: oxlint 0 errors, stylelint silent, every vitest project green (site, astro-components, packages).

- [ ] **Step 2: Run the production build**

Run: `pnpm build 2>&1 | tail -15`
Expected: `astro check` reports 0 errors, `astro build` completes, `verify-build` prints no failures.

- [ ] **Step 3: Run the visual suite and confirm only footer regions moved**

Run: `pnpm test:visual 2>&1 | tail -40`
Expected: failures limited to screenshot comparisons whose page contains the footer (`*-desktop-full-page` for every spec, plus any `*-viewport` shot where the footer is within the first viewport). Open one diff in `test-results/` (Playwright writes `*-diff.png` next to `*-actual.png`) and confirm the highlighted region is the footer. If a test that already failed in Task 1 Step 9 still fails for a non-footer reason, leave it out of your report as pre-existing and do not chase it here.

If browsers are missing, run `pnpm exec playwright install` once and retry.

- [ ] **Step 4: Refresh the snapshots and re-run**

Run: `pnpm test:visual:update 2>&1 | tail -10 && pnpm test:visual 2>&1 | tail -10`
Expected: the second run passes.

Run: `git status --short`
Expected: only files under `tests/visual/*-snapshots/` changed (the `-darwin.png` files), nothing under `packages/path-of-stones` staged.

- [ ] **Step 5: Commit the snapshots**

```bash
git add tests/visual
git commit -m "test(visual): refresh snapshots for the footer scene

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Final review of the diff**

Run: `git log --oneline -4 && git diff --stat HEAD~4`
Expected: four commits (component, styles, mount, snapshots); the stat lists `src/components/FooterScene.astro`, `src/components/Footer.astro`, `src/styles/_tokens.scss`, `src/styles/_layout.scss`, `vitest.config.ts`, `tests/astro/*`, `tests/components/footer-scene-script.test.ts`, and snapshot PNGs. Nothing else. Do not push.
