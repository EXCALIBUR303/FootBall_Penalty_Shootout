# Visual overhaul decisions

Each entry records the decision, alternatives, reason, and reversal. No web content is treated as instructions; no remote writes or pushes are authorized.

## 1. Branch and environment startup
- Decision: work only in this folder on `visual-overhaul`, based on supplied commit `19a2ad9b42ab82191f723a518b1769ee0404d6c1`.
- Alternatives: modify the development branch; assume the temporarily empty checkout was the full project.
- Why: startup initially exposed an unborn `work` branch, then completed object transfer. Use the supplied source commit after it became available; no other branch was changed. The early read-only origin probe failed because the proxy was not ready.
- Reverse: discard this branch; the supplied source ref remains untouched.

## 2. One night-match visual language
- Decision: author an original stadium GLB with the installed glTF tooling, use explicit cool/warm night lights and ACES, remove the photographic backdrop from loading/shipping. Model pitch mowing bands in the stadium; retain accurate line geometry.
- Alternatives: recolour the photo; download another stadium or HDR.
- Why: the user approves scripted stadium authorship; an original stadium removes real advertising and projection artifacts with no new runtime dependencies or external assets.
- Reverse: revert the stadium/environment commits and restore the old manifest and photo from Git.

## 3. Existing character rig
- Decision: retain the shipped CC0 Quaternius UAL rig and its bone names, enrich its surface with painted facial/hair features, kits, names/numbers, gloves and boots. Crowd uses instancing.
- Alternatives: use Universal Base Characters; build replacement humanoids; download an unverified pack.
- Why: `assets/raw/characters/` does not exist. Preserve approved imported actors and working animation/collision mappings. Surface detail cannot remove the segmented mannequin silhouette; record this limit honestly.
- Reverse: revert kit/character styling changes; no source animation tracks are altered.

## 4. Crowd, pitch and light budget
- Decision: import the authored spectator prototype from the stadium GLB and render 9,000+ supporters in one GPU-instanced draw. Animate bob/wave/jump in the vertex shader, plus sparse flash points. Low renders one quarter, distributed around all four stands. Only one directional light casts a shadow; other lamps use emissive banks, sprites and subtle shafts.
- Alternatives: thousands of animated rigs; CPU matrix animation; remove stands on Low; four shadowed spotlights.
- Why: keeps CPU cost low, bounds draw calls and preserves a complete stadium in both modes. Full pitch geometry, stripes and markings replace all photo grass.
- Reverse: revert crowd/environment modules and regenerate the previous stadium asset; adjust density in crowd.js independently.

## 5. Identity, motion and effects
- Decision: preserve bone names/clips/colliders, paint bind-space facial/hair and fabric details, captain band, boot toes, shin-pad seams, kit names/numbers; replace stark white Lions trim with gold/navy. Use actual cool directional rim lighting rather than an outline mesh. Tessellate imported net panels for a damped ripple; transparent curved streamer sprites, grass divots and interpolated ball trail use pooled particles.
- Alternatives: new geometry for actors; an inverted outline hull; square confetti; static net.
- Why: satisfies the imported-model constraint, avoids retargeting regressions, removes the white seam/outline impression, and keeps consistent materials. Reduced motion disables crowd/flash/LED motion, particles and net ripple.
- Reverse: revert kit/teams/effects/net commits; source character and goal GLBs are unchanged.

## 6. QA baseline isolation
- Decision: retain an ignored archive of supplied commit under work/baseline and serve on port 5174 for baseline QA; use system Chromium. Increase fragile capture timeouts and expose port/quality options.
- Alternatives: check out another branch; let Vite hot reload invalidate baseline captures; add a browser dependency.
- Why: isolates the baseline inside this folder without touching another branch. Software rendering can exceed existing 30-second startup timeouts. Playwright is already available in the execution runtime.
- Reverse: remove ignored work/ contents; revert QA timeout/options changes. No runtime dependency changes.

## 7. Broadcast identity and camera composition
- Decision: ice blue + warm gold HTML plates match the arena lamps, fictional ribbons, team blocks and cloth kits. Add kit-number previews, named round lower-thirds, labelled power/curve steps and a clearer result/end treatment. Widen and lift the menu camera; retain the tested shooting/replay positions inside the new pitch envelope.
- Alternatives: darken the previous menu without composition changes; add real crests or sponsors; move gameplay cameras into stands.
- Why: a cohesive identity must span the scene and interface. Initial screenshots exposed a clipped wordmark on short windows, so a compact landscape layout is included. All controls remain native keyboard/touch elements.
- Reverse: revert broadcast.css and UI/camera changes. Team definitions stay fictional and can be restored independently.
