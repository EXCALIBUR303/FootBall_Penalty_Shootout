# Meridian Arena / Night league

The original daytime photo stadium has been replaced by an original imported 3D arena, authored offline by `scripts/build-stadium.mjs`. Every scene/UI surface follows a restrained navy, ice-blue and warm-gold broadcast palette. All team identities, advertisements and banners are fictional. No network assets or new runtime dependencies were added.

## Architecture and editing

- Pitch space is unchanged: goal line z=0, penalty mark z=11, +z into the 68 × 105 m field. Two imported goal instances, mowing bands, touchlines, boxes, halfway line and centre circle complete the field. Sharp markings sit 4 mm above the modelled turf; subtle seeded canvas grain replaces blurry photo grass.
- Stadium: two-tier stands on four sides, canopy roofs, four lamp towers, tunnel openings, covered dugouts, corner flags and supporter cloth. The complete bowl remains present on Low. The static asset is Draco-compressed and comfortably below 5 MiB.
- `CROWD_TEMPLATE` is an imported spectator prototype removed from direct rendering and reused in a single InstancedMesh. A vertex shader handles idle bob, travelling wave and goal/save jumps. High: **9,600** supporters; Low: **2,400**, distributed across all four sides. Sparse camera flashes are a small Points system. There are no thousands of CPU animation mixers or per-frame instance matrix uploads.
- `LED_end`, `LED_far`, `LED_west`, `LED_east` use a shared canvas ribbon with scrolling UVs and fictional advertising. `BANNER_0` through `BANNER_3` use original cloth artwork and gentle shader movement. These names are required hooks if replacing the GLB.
- Explicit cool hemisphere/fill/rim and warm directional key illuminate players and pitch. Only the key casts shadows. Tower lamp banks are emissive; glare sprites/shafts and High-only bloom provide a restrained floodlight effect. ACES rolls off highlights. No HDR or photographic backdrop is loaded or shipped.
- The imported ball mesh keeps its dimensions and transforms; original ivory/navy panel paint replaces its scuffed printed photo maps. `node scripts/style-ball.mjs [source.glb]` strips the unused maps without generating replacement geometry.
- Characters retain the shipped CC0 Quaternius UAL rig. `assets/raw/characters/` was absent, so no Base Characters pack or new retarget was introduced. All original clips and authored `clips.js`/`pose.js` bone mappings remain intact. Bind-space kit shaders add hair, eyes, brows, mouth, skin tones, boots, glove colour, shin-pad seams, captain band and canvas names/numbers. Kit selection changes uniforms and identity textures, preserving team selection.
- No outline hull is used. Navy shorts/gold trim replace the stark white Lions seams; the real cool directional light supplies the rim. The two named/numbered role avatars are reused across kicks; this does not add a five-player roster. The segmented shoulders/hips remain visible and require a supplied replacement character to improve the silhouette.
- The imported net panels are tessellated once and displaced by a damped, spatial ripple on impact. Net events are processed during the result phase because scoring occurs before the later net collision. Curved transparent streamer sprites replace square confetti; pooled grass divots and an interpolated trail add contact/flight feedback.
- Portrait projection widens vertical FOV while preserving horizontal play space, capped at 85°. Both posts, striker and ball stay in view; the ball clears the lower meter. Landscape shot positions/FOVs are unchanged. Unit tests check actual projected bounds and portrait-to-landscape resize behavior.
- Reduced motion freezes supporter/LED/flag animation and disables camera flashes, particles and net ripple. Existing camera cuts, CSS motion reduction, keyboard/focus trapping and touch controls are retained. Meters now have explicit power/curve labels, risk guidance and accessible values.

## Screenshots

[Before and after contact sheet](visual-overhaul.jpg). Representative captures are in `screenshots/`; full local captures and logs live under ignored `work/` and may be regenerated using the commands below. Screenshots use real system Chromium and SwiftShader. Bloom and colour can differ on a hardware GPU.

## Verification

The source commit is `19a2ad9b42ab82191f723a518b1769ee0404d6c1`; all work is on `visual-overhaul`. A temporary baseline archive was served inside `work/baseline` on port 5174. No other branch or external application was modified and nothing was pushed.

The QA scripts initialize Low before first render where appropriate and allow 120-second software-rendering timeouts. Responsive screenshots dispatch real touch-start/hold/end events and require the power-to-curve transition. Layout testing draws the actual scene once per capture while keeping DOM/game updates active between checks; visual/leak/performance scripts render continuously. It covers nine resolutions (including short laptop and phone-landscape windows) and uses a deterministic end-screen fixture at each resolution; full-match tests independently exercise actual completion. Animation pose captures cover low/high dives, block, jump, kick, celebration and ready/idle. `overhaul-check` verifies loaded assets, crowd density, animation track bindings, reduced-motion ribbon freeze, both quality modes, and an actual shot/net-impact event.

Validation results and measured limits are recorded below. Asset/bundle measurements are in [ASSET-SIZES.md](ASSET-SIZES.md).

## Reproduce

Use a Node version compatible with Vite 8 and system Chromium. Playwright is provided by the execution environment; outside it, expose an existing global Playwright installation via NODE_PATH. Do not add it as a runtime dependency.

```bash
npm ci
npm run assets:stadium
npm test
npm run build
node scripts/asset-report.mjs
npm run dev -- --host 0.0.0.0
```

In a second shell, with the dev server running:

```bash
export CHROMIUM_PATH=/usr/bin/chromium
# If needed: export NODE_PATH="$(npm root -g)${NODE_PATH:+:$NODE_PATH}"
node scripts/smoke-test.mjs http://localhost:5173/
node scripts/visual-qa.mjs docs/qa/after 960 540 low
node scripts/responsive-shots.mjs docs/qa/responsive
node scripts/ui-tour.mjs docs/qa/ui-tour 960 540
node scripts/play-test.mjs normal
node scripts/audio-test.mjs
node scripts/leak-test.mjs
node scripts/probe-dive.mjs
node scripts/balance.mjs 6 easy,normal,hard,legend
node scripts/layout-check.mjs docs/qa/layout
node scripts/perf-measure.mjs
# On a desktop with a real GPU/display (the report names the actual WebGL device):
HARDWARE=1 node scripts/perf-measure.mjs
node scripts/overhaul-check.mjs docs/qa/overhaul
node scripts/capture-arena.mjs docs/qa/arena
node scripts/shot-pose.mjs 'pose=low&t=0.42' docs/qa/low.png \
  'pose=high&side=-1&t=0.42' docs/qa/high.png \
  'pose=block&t=0.42' docs/qa/block.png 'pose=jump&t=0.42' docs/qa/jump.png \
  'pose=kick&t=0.28' docs/qa/kick.png 'pose=celebrate&t=0.5' docs/qa/celebrate.png \
  'pose=ready' docs/qa/idle.png
```

Use `node scripts/visual-qa.mjs docs/qa/high 1440 900 high` for a full High-quality walkthrough. This is substantially slower under software rendering. The regular overhaul integration check captures a 960×540 Low menu, 1440×900 High menu/setup, and 960×540 High/Low match views. Physics initializes on Low before switching to High to avoid software-GL startup stalls. The High capture timeout is 240 seconds.

`?stats` shows total scene + shadow + post draw calls/triangles. The count was corrected to include all post passes (the earlier High count only reflected the last fullscreen pass). Performance comparisons must use the same viewport, quality and renderer. A 60 fps hardware target cannot be certified from SwiftShader frame times.

## Remaining limits

- The fallback character still has a segmented mannequin silhouette. Painted eyes/hair and cloth identity help at gameplay distance; a rig-compatible Universal Base Character would improve close-ups.
- The arena is deliberately low-poly and the spectator prototype is simple. Crowds are stylized colour blocks; no individual crowd AI or articulated crowd arms are simulated.
- Shafts/glare approximate volumetric light. Low has no bloom, but retains all architecture and lamps.
- The existing lazy Rapier compatibility chunk is large. No engine or dependency migration was made for this art task.
- Software rendering is useful for error/layout checks, not a substitute for the requested normal-GPU 60 fps acceptance test.

## Measured software rendering cost

The isolated 1440×900, DPR 1 SwiftShader run reported the following. Low reduces rendered triangles by about 69% and draw calls by about 23%. Four/eight frames are small samples; the absolute timing and p95 are unsuitable for hardware predictions.

| Quality | Sampled frames | Mean ms | p95 ms | Draw calls | Triangles | Geometries | Textures |
|---|---:|---:|---:|---:|---:|---:|---:|
| High | 4 | 3067.9 | 4299.8 | 61 | 960,578 | 34 | 28 |
| Low | 8 | 1510.0 | 2116.6 | 47 | 298,164 | 33 | 15 |

**Real-GPU 60 fps acceptance remains unverified.** Run the headed `HARDWARE=1` command above on the target machine; it reports the WebGL device and rejects a software renderer masquerading as a hardware result. The measurement tool does not reinterpret functional-test throughput as rendering performance. The later far-end/corner paint completion adds 304 static triangles, with unchanged draw counts. A final Low aim capture measured 47 calls / 298,468 triangles and explicitly identified the device as SwiftShader.

## Completed QA record

| Check | Result |
|---|---|
| `npm test` | PASS: six test files, including projected portrait bounds and resize behavior |
| `npm run build` | PASS; existing large lazy Rapier chunk warning remains |
| Reproducible stadium build | PASS: identical SHA-256 across consecutive runs |
| Asset report | PASS: all four GLBs use Draco, all below 5 MiB; LED/flag UV and index contracts checked |
| Full `visual-qa` before/after walkthrough | PASS: menu through actual match-end, goal/save, replay, pause/settings; no browser errors |
| `smoke-test` on the shipping game URL | PASS: required models loaded |
| `play-test normal` | PASS: real shootout reached a winner, no browser errors |
| `ui-tour` | PASS: keyboard-only screens, charging/curve, pause/resume, result/end and return to menu; focus intact |
| `responsive-shots` | PASS: 1024×768, 768×1024, 390×844; held CDP touch transitions power → curve; no horizontal overflow |
| `layout-check` | PASS: all nine viewports; bounds, overflow, scoreboard/pause and hint/meter separation |
| `audio-test` | PASS: samples decoded; nonzero kick/whistle/post/cheer/groan output and near-zero muted output (peak 0.0004); no errors |
| `leak-test` | PASS: six real-rendered match cycles; GPU resources flat for repeated outcomes; post-GC heap 56.1 → 56.6 MB |
| `probe-dive` and pose captures | PASS: low/high dives, block/jump, kick, celebrate and idle/ready; binding check passes for all tracks |
| `balance 6 easy,normal,hard,legend` | PASS as a small smoke sample; not statistical evidence for difficulty tuning |
| `perf-measure` | Completed isolated High/Low software run; values above; no hardware FPS claim |
| `overhaul-check` | PASS: four mapped LED boards, four indexed/UV-mapped flags, 2,400/9,600 supporters, every lower stand populated, no photo/HDR, reduced-motion ribbon freeze, animation bindings, actual net hit and replay; no errors |
| Final arena capture | PASS: complete pitch and stadium inspection, 2,400 Low spectators, actual SwiftShader device identified; no errors |

The full rendered walkthrough was followed by focused captures/checks after the Low-density, portrait-framing and static paint fixes. The late touch-copy update received a focused phone touch regression check; it does not change input behavior or allocate listeners. Interrupted exploratory QA attempts remain in ignored `work/` logs; they are not counted as successful runs.

The [arena inspection view](screenshots/stadium-overview.jpg) shows the actual 3D bowl on Low. It is deliberately a distant inspection camera, so night fog darkens it; the menu and match screenshots represent the intended broadcast cameras.

To regenerate the documented capture set inside this folder (with a dev server running):

```bash
node scripts/visual-qa.mjs work/after 960 540 low
node scripts/overhaul-check.mjs work/overhaul
node scripts/capture-arena.mjs work/arena-final
node scripts/responsive-shots.mjs work/after-responsive-final
node scripts/publish-screenshots.mjs work/before
```

The comparison script uses the saved supplied-source captures in `work/before` and the final focused captures. The original baseline archive is not committed; recreate it with `git archive 19a2ad9b42ab82191f723a518b1769ee0404d6c1` inside `work/` if needed, and serve it on port 5174 for `PORT=5174` baseline captures. All published images are actual Chromium output, with only JPEG conversion and contact-sheet assembly.
