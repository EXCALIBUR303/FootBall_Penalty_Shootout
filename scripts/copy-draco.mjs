// Copy three's Draco decoder into public/draco so DRACOLoader can fetch it at runtime (no CDN).
import { cp, mkdir } from 'node:fs/promises';
await mkdir('public/draco', { recursive: true });
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  await cp(`node_modules/three/examples/jsm/libs/draco/${f}`, `public/draco/${f}`);
}
console.log('Draco decoder copied to public/draco');
