# Credits

Every asset that ships in the game is listed here with name, author, license and URL.
Entries marked **not included** were chosen in `docs/PLAN.md` but could not be downloaded (Poly Pizza sits behind a bot challenge and Sketchfab downloads need a login). The game runs without them; see the README for how to add a goal model.

## Shipping assets

| Asset | Name | Author | License | URL | Status |
|---|---|---|---|---|---|
| Ball | Football (inflated variant only; 2K textures, Draco/WebP) | Amal Kumar (Poly Haven) | CC0 | https://polyhaven.com/a/football | **in repo** |
| Goal + net | soccerGoal (normal version; stray poles removed, converted from .blend to GLB, Draco) | almaPerdida (OpenGameArt) | CC0 | https://opengameart.org/content/soccergoal | **in repo** |
| Goalkeeper, striker | Mannequin + 43 clips, Universal Animation Library [Standard] (UAL1_Standard.glb) | Quaternius | CC0 | https://quaternius.itch.io/universal-animation-library | **in repo** |
| Stadium | Stadium | Zsky (Poly Pizza) | CC-BY 3.0 | https://poly.pizza/search/stadium | **not included** (the HDRI provides the stadium) |
| Stadium backdrop | Stadium 01 — Poly Haven's tonemapped JPG, resized to 4096×2048; the photo's own goal behind ours painted out | Sergej Majboroda (Poly Haven) | CC0 | https://polyhaven.com/a/stadium_01 | **in repo** (`public/assets/hdri/stadium_01_bg_4k.jpg`) |
| Lighting HDRI | Stadium 01 (1K .hdr) | Sergej Majboroda (Poly Haven) | CC0 | https://polyhaven.com/a/stadium_01 | **in repo** |
| Sound effects (kick, post/bar, glove, catch, net) | Impact Sounds (12 files, trimmed to 7) | Kenney | CC0 | https://kenney.nl/assets/impact-sounds | **in repo** (`public/assets/audio/`) |
| UI sounds (click, select, confirm, back, tick) | Interface Sounds (5 files) | Kenney | CC0 | https://kenney.nl/assets/interface-sounds | **in repo** |
| Pitch markings, kit colours/patterns | drawn at runtime (`src/world/pitch.js`, `src/world/kit.js`) | this project | — | — | no file |
| Crowd, cheers, groans, whistle | synthesised at runtime with Web Audio (`src/audio/audio.js`) | this project | — | — | no file |

## Development-only test models (never shipped)

Used by `?test=1` and `npm run assets:test` to check the loader, Draco and skinned animation. They live in the git-ignored `assets/raw/khronos/` and are excluded from the normal asset build.

| Name | Author | License | URL |
|---|---|---|---|
| CesiumMan | © 2017 Cesium | CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan |
| Fox | PixelMannen (model, CC0); tomkranis (rigging and animation, CC-BY 4.0); @AsoboStudio and @scurest (glTF conversion, CC-BY 4.0) | CC0 / CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox |

Licence details checked against the Khronos glTF-Sample-Assets model READMEs.
