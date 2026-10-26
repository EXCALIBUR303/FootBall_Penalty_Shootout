# Asset and bundle sizes

Measured from the local production build; byte counts are uncompressed unless stated.

| Model | Bytes | KiB | Geometry |
|---|---:|---:|---|
| ball.glb | 7,284 | 7.1 | Draco |
| character.glb | 2,321,220 | 2266.8 | Draco |
| goal.glb | 26,060 | 25.4 | Draco |
| stadium.glb | 66,972 | 65.4 | Draco |

| Build chunk | kB | gzip kB |
|---|---:|---:|
| draco_decoder-C32yEggz.wasm | 285.75 | 88.64 |
| draco_decoder-Z1_iN-Ht.wasm | 192.42 | 63.46 |
| draco_decoder-fzg4nYZr.js | 719.41 | 148.81 |
| draco_wasm_wrapper-DxJM36Ib.js | 58.76 | 11.90 |
| draco_wasm_wrapper-fZCQGLGb.js | 58.46 | 11.75 |
| index-CGUre4z_.js | 743.41 | 194.91 |
| index-Ce1ZokBw.css | 37.12 | 8.50 |
| match-BifKXLJy.js | 4358.02 | 1654.48 |

Total public payload: 3.40 MiB. Total production directory: 9.55 MiB.

The large lazy match chunk includes the existing Rapier compatibility build and embedded WASM. No new runtime dependencies were added. The daylight HDR and photo have been removed. The build retains the existing large-chunk warning. Gzip values are estimates from Node zlib; server compression can differ.
