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
