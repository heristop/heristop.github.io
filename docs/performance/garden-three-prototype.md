# Three.js garden prototype

Branch: `codex/garden-three`, based on the merged garden redesign.

Open `/path-of-stones/?renderer=three`, or use **Try 3D** beside the HD-2D control.
**3D prototype** switches back to PixiJS without resetting the current run. PixiJS remains
the default; the experiment does not change the renderer preference stored on the device.

React continues to own gameplay, menus, discovery cards, pickup effects, input and the
accessible hit plane. Three.js exclusively renders the experimental board; it does not
share a WebGL context with PixiJS. Both implement the existing renderer lifecycle.

The board uses horizontal textured square meshes, a solid plinth, lit pixel-art cutout
billboards, a directional shadow map, local lantern lights, water glints, a low drifting
mist plane and suspended particles. The fixed orthographic camera has 30-degree elevation
and reproduces the existing 64 × 32 projection. A projection test checks every tile and
multiple character foot anchors against the React coordinates.

Textures load asynchronously, map rebuilds occur on immutable map changes, and actor motion
runs outside React on the render loop, capped at 60 updates per second. Hidden tabs pause.
Disposal releases geometries, materials, sprite frame textures, shadow resources and the
renderer. Context loss falls back to the existing DOM board without resetting gameplay.

## Limits of the experiment

- Scenery and characters remain camera-facing pixel art, not volumetric models.
- Camera rotation is intentionally unavailable: the React hit plane assumes the fixed
  projection. A free camera would require raycasting and projecting the DOM markers.
- The lighting and water are an alternative art treatment, not visual parity with every
  Pixi atmosphere effect. The existing background and React overlay effects remain.
- The 2048-pixel shadow map adds GPU work. The 60 Hz loop cap is not an FPS guarantee;
  this prototype has not been performance-benchmarked against PixiJS.
- Three.js is loaded only when selected. WebGL2 is required by this backend; initialization
  failure retains the DOM fallback.

Verification includes the garden unit/component suite, camera projection, renderer switching,
lantern map updates, movement and context-loss fallback on desktop and mobile emulation.

Current validation: 229 garden unit/component tests passed; production build and lint passed.
Four browser checks passed with Chromium using native ANGLE Metal on desktop and mobile
emulation. Software-rendered Chromium exceeded the opening-turn wait in the switching test;
the native run completed all four checks in 14.5 seconds. This is functional validation,
not a rendering benchmark.
