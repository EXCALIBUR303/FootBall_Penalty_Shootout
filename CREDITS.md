# Credits

Every asset that ships in the game is listed here with name, author, license and URL.
Entries marked **planned** are chosen in `docs/PLAN.md` but not yet downloaded (blocked by the network allowlist in Phase 1).

## Shipping assets

| Asset | Name | Author | License | URL | Status |
|---|---|---|---|---|---|
| Ball | Football (inflated variant only; 2K textures, Draco/WebP) | Amal Kumar (Poly Haven) | CC0 | https://polyhaven.com/a/football | **in repo** |
| Goal + net | Soccer goal | Poly by Google | CC-BY 3.0 | https://poly.pizza/search/Soccer | planned |
| Goalkeeper, striker | Mannequin + 43 clips, Universal Animation Library [Standard] (UAL1_Standard.glb) | Quaternius | CC0 | https://quaternius.itch.io/universal-animation-library | **in repo** |
| Stadium | Stadium | Zsky (Poly Pizza) | CC-BY 3.0 | https://poly.pizza/search/stadium | planned |
| Sky HDRI | Stadium 01 (2K) | Sergej Majboroda (Poly Haven) | CC0 | https://polyhaven.com/a/stadium_01 | **in repo** |
| Sound effects (kick, post/bar, glove, catch, net) | Impact Sounds (12 files, trimmed to 7) | Kenney | CC0 | https://kenney.nl/assets/impact-sounds | **in repo** (`public/assets/audio/`) |
| UI sounds (click, select, confirm, back, tick) | Interface Sounds (5 files) | Kenney | CC0 | https://kenney.nl/assets/interface-sounds | **in repo** |
| Crowd, cheers, groans, whistle | synthesised at runtime with Web Audio (`src/audio/audio.js`) | this project | — | — | no file |
| UI font | Kenney Future (from Kenney Fonts) | Kenney | CC0 | https://kenney.nl/assets/kenney-fonts | **in repo** |

## Development-only test models (never shipped)

Used by `?test=1` and `npm run assets:test` to check the loader, Draco and skinned animation. They live in the git-ignored `assets/raw/khronos/` and are excluded from the normal asset build.

| Name | Author | License | URL |
|---|---|---|---|
| CesiumMan | Cesium | CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan |
| Fox | PixelMannen (model), @tomkranis (rig and animation) | CC0 (model), CC-BY 4.0 (rig and animation) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox |

License details above are from memory of the Khronos sample-asset READMEs and will be re-verified when those pages can be opened.
