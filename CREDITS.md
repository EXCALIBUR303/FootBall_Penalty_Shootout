# Credits

Every asset that ships in the game is listed here with name, author, license and URL.
All shipping scene art uses the project’s fictional night-league direction. No real sponsors, club crests or logos are used. No external assets were downloaded for this overhaul.

## Shipping assets

| Asset | Name | Author | License | URL | Status |
|---|---|---|---|---|---|
| Ball | Football (inflated mesh only; original unbranded ivory/navy panel paint replaces photo maps, Draco) | Amal Kumar (Poly Haven) | CC0 | https://polyhaven.com/a/football | **in repo** |
| Goal + net | soccerGoal (normal version; stray poles removed, converted from .blend to GLB, Draco) | almaPerdida (OpenGameArt) | CC0 | https://opengameart.org/content/soccergoal | **in repo** |
| Goalkeeper, striker | Mannequin + 43 clips, Universal Animation Library [Standard] (UAL1_Standard.glb) | Quaternius | CC0 | https://quaternius.itch.io/universal-animation-library | **in repo** |
| Stadium, pitch, spectator prototype, towers, flags, dugouts | Meridian Arena — original scripted model, Draco-compressed | this project | project source; no third-party asset | `scripts/build-stadium.mjs` | **in repo** (`public/assets/models/stadium.glb`) |
| LED ribbon and supporter banners | NOVA / SPORT, MERIDIAN / NIGHT LEAGUE, APEX / ENERGY, Lions Roar, Foxes Rise (fictional artwork) | this project | project source; no third-party asset | `src/world/environment.js` | generated canvas textures |
| Sound effects (kick, post/bar, glove, catch, net) | Impact Sounds (12 files, trimmed to 7) | Kenney | CC0 | https://kenney.nl/assets/impact-sounds | **in repo** (`public/assets/audio/`) |
| UI sounds (click, select, confirm, back, tick) | Interface Sounds (5 files) | Kenney | CC0 | https://kenney.nl/assets/interface-sounds | **in repo** |
| Pitch markings, facial/hair details, kit colours/patterns/names/numbers | drawn at runtime (`src/world/pitch.js`, `src/world/kit.js`) | this project | — | — | no file |
| Crowd audio, cheers, groans, whistle | synthesised at runtime with Web Audio (`src/audio/audio.js`) | this project | — | — | no file |

## Development-only test models (never shipped)

Used by `?test=1` and `npm run assets:test` to check the loader, Draco and skinned animation. They live in the git-ignored `assets/raw/khronos/` and are excluded from the normal asset build.

| Name | Author | License | URL |
|---|---|---|---|
| CesiumMan | © 2017 Cesium | CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan |
| Fox | PixelMannen (model, CC0); tomkranis (rigging and animation, CC-BY 4.0); @AsoboStudio and @scurest (glTF conversion, CC-BY 4.0) | CC0 / CC-BY 4.0 | https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox |

Licence details checked against the Khronos glTF-Sample-Assets model READMEs.

## Removed from shipping

Stadium 01’s 4K photographic backdrop and 1K lighting HDR by Sergej Majboroda / Poly Haven (CC0, https://polyhaven.com/a/stadium_01) were removed. Explicit night lights now illuminate the scene. The previously suggested Zsky stadium was never included.

Character source check: `assets/raw/characters/` is absent. The original Quaternius UAL mannequin remains unmodified as a GLB; authored surface styling does not change its skeleton or source animations. Universal Base Characters were not downloaded or represented as shipping assets.

Floodlight glare, streamer sprites, grass grain, camera flashes and nameplates are original canvas/shader work in this project, without third-party imagery or fonts. UI uses the system font stack. No new runtime dependencies were introduced.
