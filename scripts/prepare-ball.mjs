// Poly Haven's "Football" ships a deflated and an inflated ball side by side.
// Keep only the inflated one, centred on the origin, and write assets/raw/ball/ball.glb for the optimiser.
import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
const doc = await io.read('assets/raw/ball/football_src/football.gltf');
for (const node of doc.getRoot().listNodes()) {
  if (node.getName() === 'football_deflated') node.dispose();
  if (node.getName() === 'football_inflated') node.setTranslation([0, 0.111, 0]);
}
await io.write('assets/raw/ball/ball.glb', doc);
console.log('ball.glb written (inflated only)');
