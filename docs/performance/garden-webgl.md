# Hybrid garden renderer

WebGL is now the default when supported, with a persistent HD-2D toggle.
Use `?renderer=dom` for the classic baseline and `?renderer=webgl` to force the GPU preference. Game state and input have one owner in React. Pixi receives snapshots and draws terrain,
scenery, water atlas frames and characters, with a ticker capped at 60 updates per second. React
keeps accessible tile targets, tactical markers, discovery effects, weather overlays and the HUD.
Textures use nearest-neighbour sampling. Figure depth follows isometric footing. Terrain is
rebuilt only when the map changes; movement interpolates existing figures without React frames.

The engine loads dynamically, renders its first frame before handing off, stops its ticker in
hidden documents, and respects reduced motion. Unsupported WebGL, failed textures or context
loss restore the DOM board without resetting rules or player progress. Pixi is explicitly
restricted to WebGL rather than silently falling back to Canvas.

## Validation

- Unit tests cover atlas cropping, movement and facing, frog/mermaid placement, attacks,
  asynchronous update races, cleanup, reduced motion and fallback.
- Browser tests exercise controls and context loss on desktop and mobile emulation.
- The existing game suite retains its 90% minimum across all four coverage metrics, including
  the renderer. The original route remains covered by existing visual/gameplay tests.

## Local comparison — 8 September 2026

Production build, Chromium, Apple M2 Pro via `--angle=metal`, 24 identical alternating steps,
no CPU throttling. Each renderer was measured separately. These are single lab runs, not a
statistical study or a physical-phone result. Browser requestAnimationFrame intervals are not
GPU presentation measurements; a 120 Hz browser cadence does not mean the board renders at 120 FPS.

| Walking metric | DOM desktop | WebGL desktop | DOM mobile emulation | WebGL mobile emulation |
| --- | ---: | ---: | ---: | ---: |
| Browser frame interval p95 (ms) | 9.2 | 9.3 | 9.0 | 9.1 |
| Intervals above 25 ms | 0 | 0 | 0 | 0 |
| Script work (ms) | 115 | 245 | 112 | 171 |
| Total task work (ms) | 1155 | 1183 | 1190 | 868 |

There is no demonstrated steady-state frame-rate advantage on this board with this GPU.
The first WebGL opening also showed a cold-start stall, so startup and real mobile hardware
need further profiling before changing the default. Earlier headless results used SwiftShader;
they must not be presented as hardware GPU performance. The benchmark now reports its backend.

Run `pnpm benchmark:garden --angle=metal --url="http://127.0.0.1:4327/path-of-stones/?renderer=webgl"`
and repeat with `?renderer=dom` for the baseline. Drop `--angle=metal` on other platforms.

## HD-2D atmosphere

The WebGL board adds warm emissive lantern/shrine light, directional scenery shadows, a cooler
foreground, two soft sun shafts, water-bound reflection fragments, up to six low mist patches
and eighteen fireflies. A single 64×64 light texture is shared by every soft effect; pixel-art
textures keep nearest-neighbour sampling. Effects reuse the renderer ticker and freeze under
reduced motion. Map rebuilds dispose their old effect containers and preserve animation phases.
Water reflection geometry is tested against all four edges of each isometric diamond. Depth is
an optical effect; no terrain elevation or rules were changed.

With this atmosphere enabled, the same Metal benchmark recorded a 9.2 ms browser-frame p95
and zero intervals over 25 ms during walking on both desktop and mobile emulation. Total task
work was 863 ms and 901 ms respectively. This is a separate single run, so differences from
the earlier measurements should not be interpreted as a proven speedup.

The default-renderer rollout adds capability detection and a stored `path-stones:hd2d`
preference. Toggling keeps the active game and removes diagnostic renderer parameters so a
reload respects the explicit choice. Unavailable graphics or context loss hide the toggle and
restore the classic board. The pilgrim's entrance animation is suppressed after a renderer
switch to prevent a temporary invisible character. This visual pass adds water caustics,
clipped lantern reflections, collectible auras and coherent character lighting. A GPU color
grade strengthens contrast and saturation while the redundant CSS veil is reduced.

A Metal run with this pass measured walking browser-frame p95 at 9.1 ms desktop and 9.2 ms
mobile emulation, with no intervals over 25 ms. Opening still recorded four and three such
intervals respectively. These are local browser scheduling measurements, not guaranteed GPU
presentation rates or measurements on a physical phone.
