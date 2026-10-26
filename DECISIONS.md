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

## 8. Verification scope and net event ordering
- Decision: keep unit/physics/animation behavior intact and run the existing browser scripts using system Chromium. Initialize Low before compiling shaders for routine software-rendered QA, extend startup/capture timeouts, and exercise genuine CDP touch start/hold/end in responsive captures. Layout-only checks use an explicit end-screen fixture rather than repeat a whole match per viewport; full-match tests still run independently. Add an overhaul-specific integration check for crowd density, no photo/HDR loads, skeleton track bindings, reduced-motion ribbon freeze and a real shot hitting the net.
- Alternatives: suppress slow tests; add Playwright as a dependency; change game speed/physics globally; fake end-of-game results in the full-match tests.
- Why: verifies the requested behaviors while keeping the suite practical on software rendering. A goal is detected before the ball reaches the net collider, so net events now remain active during the result phase. Far goal is a clone of the existing imported asset.
- Reverse: revert the QA script changes and net-event ordering hunk; remove overhaul-check.mjs. Source physics and animation data are untouched.

## 9. Remove obsolete daylight payloads
- Decision: remove the unused backdrop JPG and lighting HDR from public assets; add the stadium rebuild command without changing dependencies.
- Alternatives: keep unused HDR/JPG files shipped in dist; retain a daytime HDR for reflections.
- Why: explicit night lighting already provides consistent illumination and rim light, and unused images waste download/storage budget and preserve real advertising unnecessarily.
- Reverse: restore public/assets/hdri from the supplied source commit and re-enable the old manifest/environment implementation.

## 10. Preserve runtime texture coordinates and valid emission
- Decision: preserve unused vertex attributes during GLB pruning because runtime LED, turf and flag textures need their UVs. Use glTF’s emissive-strength extension for bright lamps, keeping emissive factors within the glTF range. Give the authored spectator prototype a tapered torso, arms and short legs.
- Alternatives: disable pruning entirely; ship untextured ribbons; rebuild UVs at runtime; retain out-of-range emissive factors.
- Why: visual QA revealed colour-only ad strips; the runtime-assigned textures had lost UVs during asset optimization. Integration checks now assert those UVs are present. The more readable spectator silhouette still uses one instanced draw and stays within the small GLB budget.
- Reverse: revert this builder change and regenerate the previous asset; remove the UV assertions only if runtime texture hooks are removed too.

## 11. Unbranded match ball
- Decision: retain the imported Poly Haven ball geometry and replace its scuffed photographic surface with original ivory/navy polygon-panel paint and fine warm seams. Remove the unused photo maps from the shipping GLB with scripts/style-ball.mjs.
- Alternatives: keep the visibly dirty photo ball; create a procedural replacement sphere; download a branded match ball.
- Why: texture inspection found worn printed markings, and the grey ball read like a stone against the stylized arena. Original surface paint shares the night palette, removes brand ambiguity and reduces the asset payload. Geometry, physics radius and replay transforms are unchanged.
- Reverse: restore public/assets/models/ball.glb from the supplied commit; remove the styleBall call/module. To reproduce from the exact original mesh, export that Git blob inside work/ and pass its path to scripts/style-ball.mjs.

## 12. Preserve the actual penalty mark
- Decision: retain the regulation-sized white penalty spot under the ball after close-up inspection.
- Alternatives: hide the spot to remove the white oval seen in extreme ball close-ups; add a replacement shadow decal.
- Why: the oval is the painted 0.22 m penalty mark, not a ball mesh or shadow artifact. It is correct pitch information and reads properly at the gameplay camera distance.
- Reverse: change MARKINGS.spot.radius in src/world/pitch.js if a different artistic size is preferred.

## 13. Export indexed panel meshes correctly
- Decision: write source index buffers into glTF primitives for the LED boxes and segmented cloth planes. Validate expected board and flag index counts as well as UV presence.
- Alternatives: convert every source mesh to non-indexed data; patch UVs or geometry at runtime; accept colour-only boards.
- Why: close visual inspection after the UV fix showed stretched horizontal bands. The builder emitted indexed vertex arrays without their indices, so some triangles were degenerate or connected across faces. Preserve the actual source topology in the reproducible GLB.
- Reverse: convert indexed inputs to non-indexed geometry before emission instead; do not remove indices without that conversion.

## 14. Scope QA process cleanup
- Decision: stop only task-owned QA Node processes and their directly verified browser children, using their exact PIDs after inspecting the parent relationship.
- Alternatives: terminate all Chromium processes; leave abandoned QA renders consuming CPU.
- Why: automatic approval review rejected a broad Chromium cleanup because it could affect unrelated browser sessions. Exact ownership checks allow a safer task-scoped cleanup without requesting approval or disturbing unrelated sessions.
- Reverse: rerun the documented QA command; only temporary test sessions were closed.

## 15. Short-window setup layout
- Decision: compact the setup form on short desktop/landscape windows and use safe centring so overflowing forms start at a reachable top edge.
- Alternatives: allow the kick-off button and header to be clipped; hide kit previews; reduce touch targets below 44 px.
- Why: a 960×540 screenshot exposed an oversized setup card. Smaller decorative spacing/previews and hidden difficulty descriptions preserve the full interaction and button sizes.
- Reverse: remove the final short-window rules in broadcast.css; form controls and game state are unchanged.

## 16. Balanced Low crowd distribution
- Decision: deterministically permute spectator placements before selecting the Low prefix, rather than take a fixed stride through paired stand placements. Add a runtime lower-stand population check for all four sides.
- Alternatives: keep the stride (which aliases with near/far and west/east pairs); render the full High crowd on Low; remove architectural sections.
- Why: a replay screenshot showed empty lower sections despite the correct total count. Balanced selection preserves 2,400 spectators and the same draw/memory budget while populating every lower stand.
- Reverse: replace the permutation with another balanced selection algorithm. Restoring the old stride reintroduces visible empty sections.

## 17. Separate functional timing from visual frame cost in QA
- Decision: non-screenshot play-test and AI balance checks keep game/physics updates but skip drawing after the loaded scene is checked. UI tour restores drawing for every capture and only skips it during the remaining full-match completion loop. Leak tests keep real drawing and use the existing dev timescale=4 hook. Full visual-qa, responsive/layout checks, leak and performance measurement retain actual rendering.
- Alternatives: run every logical kick through slow software drawing; infer hardware FPS from test throughput; drop end-of-match checks.
- Why: the full rendered walkthrough passed, including the end screen and zero browser errors, but took many minutes on SwiftShader. Functional and AI tests do not measure rendering; this change keeps their real state-machine/physics checks practical without weakening visual/leak/performance coverage.
- Reverse: remove the test-only post.render overrides and dev timescale in the QA scripts. The shipping game loop is unchanged.

## 18. Keep repository guidance current
- Decision: update CLAUDE.md working notes to describe the shipped night arena, the explicitly approved offline stadium-authoring exception, preserved imported actors, and current QA entry points.
- Alternatives: leave old guidance claiming the stadium is missing and the photo/HDR pipeline still ships; alter the general imported-model requirement.
- Why: future work should not accidentally restore the rejected photo backdrop or remove stadium geometry on Low. The general model/dependency rules remain in force; this records the user’s existing exception.
- Reverse: restore the previous working-notes sections from Git. README/docs remain the implementation reference.
