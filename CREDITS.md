# Credits

Every asset that ships in the game is listed here with name, author, license and URL.
Entries marked **planned** are chosen in `docs/PLAN.md` but not yet downloaded (blocked by the network allowlist in Phase 1).

## Shipping assets

| Asset | Name | Author | License | URL | Status |
|---|---|---|---|---|---|
| Ball | Football (2K textures, optimised with Draco/WebP) | Amal Kumar (Poly Haven) | CC0 | https://polyhaven.com/a/football | **in repo** |
| Goal + net | Soccer goal | Poly by Google | CC-BY 3.0 | https://poly.pizza/search/Soccer | planned |
| Goalkeeper, striker | Quaternius character + Universal Animation Library rig | Quaternius | CC0 | https://quaternius.com/packs/universalanimationlibrary.html | planned |
| Stadium | Stadium | Zsky (Poly Pizza) | CC-BY 3.0 | https://poly.pizza/search/stadium | planned |
| Sky HDRI | Stadium 01 (2K) | Sergej Majboroda (Poly Haven) | CC0 | https://polyhaven.com/a/stadium_01 | **in repo** |
| Sound effects | Impact Sounds, Interface Sounds | Kenney | CC0 | https://kenney.nl/assets | planned |
| UI font | Kenney Future | Kenney | CC0 | https://kenney.nl/assets | planned |

## Development-only test models (never shipped)

Used by `?test=1` and `npm run assets:test` to check the loader, Draco and skinned animation. They live in the git-ignored `assets/raw/khronos/` and are excluded from the normal asset build.

| Name | Author | License | URL |
|---|---|---|---|
| CesiumMan | Cesium | CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan |
| Fox | PixelMannen (model), @tomkranis (rig and animation) | CC0 (model), CC-BY 4.0 (rig and animation) | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox |

License details above are from memory of the Khronos sample-asset READMEs and will be re-verified when those pages can be opened.
