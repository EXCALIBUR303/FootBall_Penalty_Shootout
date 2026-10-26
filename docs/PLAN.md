# Phase 0 — Research & Plan

Status: **historical Phase 0 research**. The game and subsequent night-league overhaul are implemented. This document preserves the original research and its uncertainties; current architecture, approved exceptions and verification live in [VISUAL-OVERHAUL.md](VISUAL-OVERHAUL.md) and [../DECISIONS.md](../DECISIONS.md).

Legend: ✅ confirmed via search · ⚠️ needs verification in Phase 1 (could not open the page from this environment) · ❌ gap

---

## 0. Blocker found during research: network access

This cloud environment can only reach **npm** and **GitHub**. Every approved asset host refused the connection:

| Host | Status |
|---|---|
| registry.npmjs.org, github.com, raw.githubusercontent.com | reachable |
| poly.pizza, static.poly.pizza | **blocked** |
| quaternius.com | **blocked** |
| kenney.nl | **blocked** |
| polyhaven.com, api.polyhaven.com, dl.polyhaven.org | **blocked** |
| sketchfab.com | **blocked** |
| freesound.org, cdn.freesound.org | **blocked** |

So the asset pages below were found through web search. I could **not** open them to read exact file sizes or animation clip lists. Those values are marked ⚠️ and will be measured in Phase 1.

**Before Phase 1**, add these hosts under *Allowed domains* in the environment's network settings (cloud environment menu → Edit → Network access; see https://code.claude.com/docs/en/cloud-environments#network-access):
`poly.pizza`, `static.poly.pizza`, `quaternius.com`, `kenney.nl`, `polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org`.
Quaternius and Kenney packs are hosted on itch.io or Google Drive, so those hosts may also need allowing. I'll report the exact host when a download fails.

### Rule conflict: Sketchfab and Freesound require login
Both sites require a free account to download, even for CC0 and CC-BY files. That conflicts with "no sites needing login". Options:
- **(a)** You download the few files I name and put them in `assets/raw/`. I never log in.
- **(b)** Skip both sites and use the fallbacks below. **(Recommended for the first pass)**

---

## 1. Asset shortlist

All main visuals are imported GLB/glTF files. Physics colliders are invisible helper shapes, not visuals.

| # | Need | Primary pick | Source / URL | License | Size (est.) | Clips | Fallback |
|---|---|---|---|---|---|---|---|
| 1 | **Ball** | "Soccer ball" (Poly by Google) or "Soccer ball" (jeremy) | Poly Pizza search: https://poly.pizza/search/Soccer%20Ball ✅ (76 results) | CC-BY 3.0 (Poly by Google) ✅ / per-model ⚠️ | < 0.3 MB ⚠️ | — | Ball from the ARandomFrenchDev "modern football stadium props" collection: https://poly.pizza/l/bZBTgWRa9m ✅ |
| 2 | **Goal + net** | "Soccer goal" (Poly by Google) | Listed on https://poly.pizza/l/cCOMNksEDO/credits ✅; also in https://poly.pizza/search/Soccer ✅ | CC-BY 3.0 ✅ | < 0.5 MB ⚠️ | — | Sketchfab CC-BY goal (needs login, option a). If the net is not a separate mesh, I'll ask before using a textured alpha plane. |
| 3 | **Goalkeeper** (idle + dives L/R/centre + parry) | Quaternius character on the **Universal Animation Library** (UAL) rig | https://quaternius.com/packs/universalanimationlibrary.html ✅, clip viewer https://quaternius.com/animviewer.html | CC0 ✅ | 2–4 MB after Draco ⚠️ | Free Standard tier has 45 clips (idle, locomotion, jump, roll, …) ✅. **No confirmed dive/parry clip** ❌ | **F1:** author dive-left/right/centre/parry as keyframe `AnimationClip`s on the imported UAL skeleton (bone rotations + root motion; mirror L/R). This is animation data on an imported model, not procedural geometry. **F2 (login):** "Goalkeeper Stylized – Rig and Animation" by P-Vi.Art, CC-BY, ~17.4k tris, https://sketchfab.com/3d-models/goalkeeper-stylized-rig-and-animation-7de86f9c36f84152a777f27a73646ada ✅ (clip list ⚠️) |
| 4 | **Striker** (idle, run-up, kick, celebrate, dejected) | Second Quaternius UAL character (different kit colour) | Same as #3 | CC0 ✅ | 2–4 MB ⚠️ | Idle, jog, sprint, cheer-type clips likely ⚠️; **kick not confirmed** ❌ | Same as F1: one keyframed kick clip on the shared rig. |
| 5 | **Stadium** | "Stadium" by Zsky or "Football stadium" (Poly by Google) | https://poly.pizza/search/stadium ✅ (32 results), credits https://poly.pizza/l/cCOMNksEDO/credits ✅ | CC-BY 3.0 ✅ | 1–3 MB ⚠️ | — | Sketchfab CC-BY (login): "Low Poly Football Stadium" by AWBMECREATIONS, ~21.8k tris, https://sketchfab.com/3d-models/low-poly-football-stadium-2ef76246010e435eafb316539cd9c260 ✅ |
| 6 | **Crowd** | Instanced Quaternius low-poly characters in the stands (2–3 variants, GPU instancing, cheer bob in the vertex shader) | Quaternius / Poly Pizza ⚠️ | CC0 | reuses #3/#4 meshes | idle / cheer | The stand photography inside the stadium HDRI (#7) as the far backdrop. Low-quality mode uses that only. |
| 7 | **HDRI sky** | **Stadium 01**: sunrise, grass field, empty tiered stands | https://polyhaven.com/a/stadium_01 ✅ | CC0 ✅ | 2K .hdr ≈ 6 MB, 1K ≈ 1.5 MB ⚠️ | — | Orlando Stadium (midday) https://polyhaven.com/a/orlando_stadium ✅; Rooftop Night (floodlit night) https://polyhaven.com/a/rooftop_night ✅ for a night look |
| 8 | **Pitch** | Pitch mesh inside the stadium GLB (#5) | — | — | — | — | ❓ If the stadium has no usable pitch with markings, I'll need a **textured plane** with a Poly Haven CC0 grass texture and painted line decals. **Asking now (Q4).** |
| 9 | **Audio: kick, post clang, UI** | Kenney **Impact Sounds** and **Interface Sounds** | https://kenney.nl/assets ⚠️ | CC0 | < 1 MB total | — | — |
| 10 | **Audio: crowd ambience, cheer, groan, whistle, net** | ❌ Kenney has none | Freesound CC0 (login, option a) | CC0 | ~2–3 MB (OGG, mono, 96 kbps) | — | Synthesise in Web Audio (filtered noise beds, swells, whistle oscillator). No extra dependency, but it sounds less real. |
| 11 | **Fonts** | **Kenney Future** (display) | Kenney Fonts pack ⚠️ | CC0 | ~50 KB | — | System UI stack only |

Every model goes through `gltf-transform optimize --compress draco --texture-compress webp` (textures max 1K, or 2K for the stadium). Each file stays under 5 MB. The script reports the size of each file before and after.

Pipeline smoke test (no network needed): Khronos glTF Sample Assets (`CesiumMan`, `Fox`) over GitHub can check the loader, Draco, animation mixer and progress bar before the real assets arrive. They will not ship in the game.

---

## 2. Physics library: **Rapier** (`@dimforge/rapier3d-compat` 0.21.x)

| | Rapier (compat build) | cannon-es 0.20 |
|---|---|---|
| Fast ball vs thin posts (≈30 m/s vs 12 cm post) | **Continuous collision detection (CCD)** stops the ball passing through posts | No CCD. Needs substeps and still risks tunnelling |
| Performance | Rust compiled to WASM, fast and deterministic | Pure JS, fine for a few bodies |
| Maintenance | Active | Last release several years old |
| Vite setup | `-compat` build inlines the WASM. No plugin needed | Trivial |
| Size | ~1.5 MB WASM (gzip ~600 KB), loaded once behind the loading screen | ~150 KB |

**Recommendation: Rapier.** CCD is decisive for post and bar hits. Determinism also makes replays exact: I store the inputs and re-simulate, or record transforms.

How it's used:
- Fixed 120 Hz step with an accumulator. Rendering interpolates between steps.
- Ball: dynamic ball collider (r = 0.11 m, 0.43 kg), CCD on, restitution 0.6, linear and angular damping for air drag.
- **Spin and curve:** each step adds a Magnus force `F = k · (ω × v)` and quadratic drag. Rapier has no aerodynamics, so I add these forces myself.
- Posts and bar: fixed cylinder colliders sized to the goal GLB's frame. Net: thin cuboid colliders (back, sides, roof) with low restitution and high friction, so the ball dies in the net.
- Goal detection: a sensor box behind the goal line, inside the frame. A goal needs the **whole ball** across the line (centre past the line by more than r).
- Keeper: kinematic capsule colliders on the hands, forearms and torso bones, synced from the animated skeleton each step. Saves come from real contacts, and a parry deflects the ball.

---

## 3. File structure (proposed)

```
/
├─ CLAUDE.md  README.md  CREDITS.md
├─ index.html                 # canvas + UI root
├─ vite.config.js
├─ package.json
├─ scripts/
│  └─ optimize-assets.mjs     # gltf-transform: raw → public/assets, size report
├─ assets/raw/                # original downloads (git-ignored if large)
├─ public/
│  ├─ assets/models/*.glb     # optimised (Draco)
│  ├─ assets/hdri/*.hdr
│  ├─ assets/audio/*.ogg
│  ├─ assets/fonts/*.woff2
│  └─ draco/                  # decoder copied from three/examples/jsm/libs/draco
├─ src/
│  ├─ main.js                 # boot: loader → game
│  ├─ core/  renderer.js  loop.js  resize.js  quality.js  dispose.js  events.js
│  ├─ assets/ manifest.js  loader.js          # GLTF+Draco+RGBE, progress events
│  ├─ world/  stadium.js  goal.js  ball.js  lighting.js  crowd.js
│  ├─ actors/ keeper.js  striker.js  anim-clips.js   # mixers, crossfades, keyframed fallback clips
│  ├─ physics/ world.js  ball-aero.js  colliders.js  goal-sensor.js
│  ├─ game/   state.js (finite-state machine)  shootout.js (rules)  shot.js (aim/power/curve)  keeper-ai.js
│  ├─ camera/ director.js  shots/{menu,aim,runup,follow,reaction,replay}.js
│  ├─ fx/     post.js (bloom, output)  goal-fx.js  net-ripple.js
│  ├─ replay/ recorder.js  player.js
│  ├─ audio/  audio.js (Web Audio buses: sfx, crowd, ui)
│  └─ ui/     ui.js  screens/*.js  hud.js  styles/{tokens,base,components,screens}.css
└─ docs/PLAN.md
```

Language: **vanilla JS (ES modules)** with JSDoc comments. TypeScript would add `typescript` and `@types/three` as dependencies, so it needs your approval (Q2).

---

## 4. Camera shots

| Shot | When | Framing | Motion | Reduced motion |
|---|---|---|---|---|
| **Menu orbit** | Main menu | Wide, goal + stands, FOV 40 | Slow 60 s orbit, gentle bob | Static wide |
| **Aim (broadcast)** | Aiming | 6 m behind ball, 1.7 m high, FOV 45, goal centred | Small parallax that follows the aim point | Same, no parallax |
| **Run-up** | After power and curve lock | Low 30° side angle on the striker | 1.2 s dolly-in, FOV 45→38, ease-in-out | Hard cut |
| **Follow-ball** | Ball in flight | Spring-damped chase, 3 m behind and 0.8 m above the ball | Hands off to the goal-line cam when the ball is within 4 m of the line | Fixed behind-the-goal view |
| **Reaction** | Result | Goal: reverse angle from behind the net. Save: side-on of the keeper | 2 s push-in. Light shake on a post hit | No shake, cut |
| **Replay** | Result screen, "Replay" | 3 angles: sideline telephoto (FOV 20), behind goal, ball-cam | 0.35× slow motion, letterbox bars (HTML) | Single angle, 1×, no letterbox animation |

A camera director blends shots by interpolating position, target and FOV with critically damped springs. Each shot is a small module.

---

## 5. Gameplay design summary

- **Shot:** aim the reticle on the goal mouth (mouse or touch drag; arrow keys/WASD). Hold Space, click or tap to start the **power meter**, a ping-pong bar from 0 to 100%. Release to lock it. A **curve meter** then swings between −1 and +1; press again to lock it. Power above about 92% risks skying the ball. Higher power also adds more aim wobble.
- **Keeper AI per difficulty:** reaction delay, prediction error (noise on the predicted crossing point), dive reach, pre-commit guess rate, and memory of the player's favourite corners.
  - Easy: 380 ms, ±1.2 m, 40% guess
  - Normal: 260 ms, ±0.7 m
  - Hard: 180 ms, ±0.4 m, uses memory
  - Legend: 120 ms, ±0.25 m
- **Rules:** 5 rounds each, alternating turns. The shootout ends early once one side can't catch up. If level after 5, sudden death in pairs. Teams are cosmetic: kit tint and name.
- **2-player (stretch goal):** shooter uses the mouse. Keeper picks a dive with keys (Q/W/E + Shift for a high dive) during the run-up.

---

## 6. UI wireframe (HTML/CSS over the canvas)

"Penalty Kings" is a placeholder title; you can rename it.

```
┌─ LOADING ───────────────────────────────────────────────┐
│                      PENALTY  KINGS                     │
│            [██████████████░░░░░░░░]  62%                │
│              Loading stadium… (4 / 9 files)             │
│                 Tip: Curve beats keepers                │
└─────────────────────────────────────────────────────────┘

┌─ MAIN MENU ─────────────────────────────────────────────┐
│ PENALTY KINGS                                   ⚙  ?    │
│                                                         │
│  ▶ PLAY vs CPU        (focused: lime ring)              │
│    2 PLAYERS                                            │
│    HOW TO PLAY                                          │
│    SETTINGS                                             │
│                                       (3D orbit behind) │
└─────────────────────────────────────────────────────────┘

┌─ MATCH SETUP ───────────────────────────────────────────┐
│ ← Back                    MATCH SETUP                   │
│  YOUR TEAM        [◀  ■ Blue Lions  ▶]                  │
│  OPPONENT         [◀  ■ Red Foxes   ▶]                  │
│  DIFFICULTY   ( Easy )( Normal )( Hard )( Legend )      │
│                               [ KICK OFF  → ]           │
└─────────────────────────────────────────────────────────┘

┌─ IN-GAME HUD ───────────────────────────────────────────┐
│ ■ LIONS ●●○◌◌  2 – 1  ●○◌◌◌ FOXES ■      Round 3   ❚❚   │
│                                                         │
│                ┌──────── goal ────────┐                 │
│                │        ⊕ reticle     │                 │
│                                                         │
│  [hint] Drag to aim · Hold SPACE for power              │
│                                     POWER ▮▮▮▮▮▮▯▯ 74%  │
│                                     CURVE ◀──●──▶       │
└─────────────────────────────────────────────────────────┘
   round dots: ● scored (lime)  ○ missed (red)  ◌ to come

┌─ RESULT / REPLAY ───────────────────────────────────────┐
│                    ▬▬ letterbox ▬▬                      │
│                   GOAL!  /  SAVED!                      │
│        [ ↻ Replay ]   [ Next kick → ]   (Enter)         │
│  — end of match —                                       │
│                   LIONS WIN 4 – 3                       │
│      [ Rematch ]  [ Change setup ]  [ Main menu ]       │
└─────────────────────────────────────────────────────────┘

┌─ PAUSE (Esc) ──────────┐  ┌─ SETTINGS ─────────────────────┐
│  PAUSED                │  │ Quality   ( Low )( High )      │
│  [ Resume ]            │  │ Master volume  ───●────        │
│  [ Settings ]          │  │ Crowd volume   ─────●──        │
│  [ Controls ]          │  │ ☐ Mute                         │
│  [ Quit to menu ]      │  │ ☐ Reduced motion (follows OS)  │
└────────────────────────┘  │ ☐ Show hints                   │
                            └────────────────────────────────┘
┌─ CONTROLS HELP (? / H) ───────────────────────────────────┐
│ Aim: mouse / drag / arrows · Power: hold Space / click    │
│ Curve: press again · Pause: Esc · Replay: R · Next: Enter │
└───────────────────────────────────────────────────────────┘
```

Onboarding: three coach-mark hints on the first match (aim → power → curve). They are dismissed on success and remembered in `localStorage`.

Accessibility:
- Every control is a real `<button>` or `<input>`, with a logical tab order and `:focus-visible` rings.
- An `aria-live` region announces goals and saves.
- Dialogs trap focus.
- `prefers-reduced-motion` turns on reduced motion by default.
- Touch targets are at least 44 px.

---

## 7. Colour and type palette

Night-stadium navy with floodlight white and an electric-lime action colour. Contrast ratios below were calculated with the WCAG 2 formula.

| Token | Hex | Use | Contrast on `--bg` / `--panel` |
|---|---|---|---|
| `--bg` | `#0B1220` | Page, overlays (90% alpha + blur) | — |
| `--panel` | `#141E33` | Cards, HUD plates | — |
| `--line` | `#2A3A55` | Borders, inactive dots | decorative |
| `--text` | `#F4F7FB` | Primary text | 17.4 / 15.5 |
| `--text-muted` | `#A9B6CC` | Secondary text | 9.1 / 8.1 |
| `--accent` | `#C6F432` | Primary buttons, focus ring, scored dot | 14.6 / 13.0 (navy text on lime: 14.6) |
| `--gold` | `#FFC83D` | GOAL!, winner, power-meter sweet spot | 12.1 / 10.8 |
| `--danger` | `#FF6B6B` | Miss/saved dot, overpower zone | 6.8 / 6.0 |
| `--home` | `#5B9CFF` | Home team | 6.8 / 6.1 |
| `--away` | `#FF8A3D` | Away team | 8.0 / 7.1 |
| `--success` | `#2EE6A8` | Toasts, "best" markers | 11.6 / 10.3 |

All text pairs meet WCAG AA, and most meet AAA. Status is never shown by colour alone: dots also differ in shape (● ○ ◌) and results have text labels.

**Type**
- Display: *Kenney Future* (CC0, self-hosted woff2), uppercase, letter-spacing 0.04em.
- UI/body: `system-ui, "Segoe UI", Roboto, sans-serif`.
- Numbers: `font-variant-numeric: tabular-nums`, so scores don't jitter.
- Scale: major third (1.25), 16 px base, fluid with `clamp()`: 12.8 · 16 · 20 · 25 · 31 · 39 · 49 · 61 px (`--fs--1` … `--fs-6`).
- Spacing: 4 px grid (4, 8, 12, 16, 24, 32, 48, 64). Radius 10 / 16 px.

**Motion**
- 160 ms for micro-interactions (hover, press scale 0.97); 280 ms for screen transitions (fade + 12 px slide).
- Easing `cubic-bezier(.2,.8,.2,1)`.
- All of it is disabled or shortened under reduced motion.

---

## 8. Rendering plan

- `WebGLRenderer`: ACES Filmic tone mapping, `SRGBColorSpace` output, exposure about 1.0.
- PCFSoft shadow map: 2048 on high quality, 1024 on low.
- Lighting: Poly Haven HDRI through PMREM for environment light and background. Three.js `GroundedSkybox` makes the HDRI's stands meet the ground.
- One shadow-casting key light aligned to the HDRI sun, plus four floodlight spots with no shadows on low quality.
- Post-processing with three's built-in `EffectComposer`, `UnrealBloomPass` and `OutputPass` (no extra dependency). Bloom is off in low quality.
- DPR capped at 2 on high quality and 1 on low. Adaptive resolution steps down if the frame time stays above 18 ms.
- `dispose.js` walks scenes and disposes geometries, materials, textures and render targets when leaving a match.

---

## 9. Dependencies (proposed)

| Package | Type | Status |
|---|---|---|
| `three` 0.186.x | runtime | pre-approved |
| `vite` 8.x | dev | pre-approved |
| `@gltf-transform/cli` 4.5.x | dev (asset script) | pre-approved; pulls in its own Draco and meshoptimizer encoders |
| `@dimforge/rapier3d-compat` 0.21.x | runtime | **needs your OK** (Q1) |
| `typescript`, `@types/three` | dev | only if you choose TS (Q2) |
| `@playwright/test` | dev (Phase 5 QA) | **will ask in Phase 5**; Chromium is already installed |

No UI framework and no audio library. Bloom and the post-processing passes come from `three/examples`.
