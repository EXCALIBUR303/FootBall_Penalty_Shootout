# Penalty Kings

A 3D football penalty shootout for desktop browsers (developed and tested in Chromium), built with Vite and Three.js. Take five penalties each against an AI goalkeeper (then sudden death), or play a friend on the same keyboard.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build
npm test           # unit tests (rules, shot solver, Rapier physics, replay recorder)
```

Needs a current browser with WebGL 2. Developed and tested in Chromium; Safari 15+ should work (the High-quality post-processing falls back to direct rendering if float render targets are unavailable) but has not been tested here.

## How to play

**Taking a penalty** (aim → power → curve):

1. **Aim:** move the mouse (or drag on touch), or use the arrow keys.
2. **Power:** hold <kbd>Space</kbd> (or press and hold) and release. The red striped end of the bar skies the ball.
3. **Curve:** press again to stop the swinging marker. Curve bends the flight, not where it ends up.

**In goal:** the camera sits just inside your goal, behind the keeper. Click or tap where to dive (the screen maps onto the goal mouth; a gold marker follows the pointer), before the kick to guess or after it to react. Keys: <kbd>←</kbd>/<kbd>A</kbd> <kbd>→</kbd>/<kbd>D</kbd> low dive, <kbd>Q</kbd> <kbd>E</kbd> high dive, <kbd>↓</kbd>/<kbd>S</kbd> block, <kbd>↑</kbd>/<kbd>W</kbd> jump.

**2 players:** the shooter uses the mouse or arrows plus <kbd>Space</kbd>; the keeper uses <kbd>A</kbd> <kbd>D</kbd> <kbd>Q</kbd> <kbd>E</kbd> <kbd>S</kbd> <kbd>W</kbd>.

**Other keys:** <kbd>Esc</kbd>/<kbd>P</kbd> pause, <kbd>?</kbd>/<kbd>H</kbd> help, <kbd>Space</kbd> or click skips a replay.

**Rules:** five kicks each, the shootout ends early once one side cannot catch up, then sudden death in pairs.

**Settings** (saved in the browser): graphics quality (Low/High), master and crowd volume, mute, reduced motion, hints, auto replay. Difficulty (Easy, Normal, Hard, Legend) and teams are chosen on the match setup screen.

## Features

- Imported GLB models only for the ball, goal and players. The stadium is one CC0 panorama used twice: a sharp 4K tonemapped photo projected onto a grounded dome (what you see) and its HDR (what lights the scene). Painted pitch markings to Laws of the Game sizes; team kits painted onto the shared character in a shader.
- Rapier physics with CCD ball, post/bar/net colliders, plus hand-written drag and Magnus (spin) forces. A shot solver aims the ball so the *predicted* line crossing hits your target; power overshoot and wobble are applied afterwards.
- Keeper dive, block and jump animations authored as keyframes (the library rig has none) and a keeper AI with per-difficulty reaction time, read error, guessing and reach.
- Cinematic cameras (aim, run-up, follow, reaction, keeper view, two replay angles) driven by damped springs; hard cuts under reduced motion.
- Goal and save effects (confetti, sparks, ball trail, slow motion), light bloom, auto replay at 0.6× speed.
- Audio: CC0 impact and UI samples plus a synthesised crowd, cheers, groans and whistle.
- HTML/CSS interface over the canvas: menu, setup, HUD with round dots, pause, settings, help, end screen; keyboard and touch support, visible focus, dialogs trap focus, WCAG AA contrast.
- Performance: 60 fps target, resize and devicePixelRatio handling, resource disposal, Low quality mode, automatic downgrade when frames run slow.

## Stack

| | |
|---|---|
| Build | Vite 8, vanilla JavaScript (ES modules) |
| 3D | three 0.186 (GLTFLoader + DRACOLoader, HDRLoader, GroundedSkybox, EffectComposer bloom, Neutral tone mapping (ACES via `?tm=aces` in dev), sRGB) |
| Physics | `@dimforge/rapier3d-compat` |
| Asset tooling | `@gltf-transform/*` (dedupe, prune, resample, WebP textures, Draco) |
| Tests | `node:test`; Playwright is used for QA scripts but is **not** a project dependency |

## Project layout

```
src/
  main.js            app controller: loading, menu orbit camera, match lifecycle, settings
  assets/            manifest.js (single list of every asset) + loader with progress
  world/             scene construction, model fitting
  physics/           Rapier world, ball aerodynamics (drag, Magnus), crossing predictor
  game/              match state machine, shootout rules, shot solver, keeper AI, input, replay
  actors/            keeper and striker, authored clips and the pose converter
  camera/            camera director and shots
  fx/                particles
  audio/             sample playback and synthesised crowd
  core/              renderer, post-processing, quality presets, settings, perf, disposal
  ui/                screens/dialogs, HUD, toast
  styles/            tokens (palette, type scale), base, ui, hud, loading
public/assets/       models/, hdri/ (backdrop JPG + lighting HDR), audio/
scripts/             asset pipeline and QA scripts (below)
tests/               unit tests
docs/PLAN.md         the Phase 0 research and plan
```

## Swapping models

All loaded files are listed in `src/assets/manifest.js`; nothing else refers to file names.

1. Put the source GLB in `assets/raw/` (git-ignored) and run `npm run assets`. It optimises with Draco and WebP into `public/assets/models/`.
2. To **replace the goal**: save the new model as `assets/raw/goal/goal.glb`, run `npm run assets`. It is scaled to the 7.56 m outer width and slid back so the front of the posts sits on the goal line (z = 0). It must open towards +z (net towards -z); rotate it in `src/world/scene.js` otherwise. The physics goal (`GOAL` in `src/game/shot.js`: posts, bar, net depth 1.5 m) should match the model. The shipped goal came from a Blender file via `scripts/convert-goal-blend.py`. An optional `stadium.glb` works the same way.
3. To **replace the ball or character**, overwrite `ball.glb` / `character.glb`. The character must be a skinned humanoid with the Quaternius UAL bone names; the dive, block, jump and kick clips are authored per bone in `src/actors/clips.js` and mapped by `src/actors/pose.js`.
4. Target real-world sizes live in `TARGET_SIZE` in the manifest.

Keep each model under about 5 MB.

## Developer tools

| Tool | Use |
|---|---|
| `?debug` | draws every Rapier collider |
| `?stats` | FPS, draw calls, triangles, geometries and textures |
| `?play` | skip the menu (dev server only); also `&mode=2p&difficulty=hard` |
| `?timescale=4` | fast-forward the simulation (dev server only) |
| `?pose=low&side=1&t=0.4` | freeze a keeper/striker pose for inspection (dev server only) |

QA scripts (need the dev server running and a global Playwright: `NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/<name>.mjs`):
`smoke-test` (loader and scene), `play-test` (a full shootout), `ui-tour` (every screen, keyboard only), `responsive-shots` (tablet/phone and touch), `audio-test`, `leak-test` (GPU resources across matches), `balance` (AI save rates).

## Credits

See [CREDITS.md](CREDITS.md) for every asset with author, licence and URL.
