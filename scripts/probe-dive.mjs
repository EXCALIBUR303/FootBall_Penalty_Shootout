// Dev: prints glove/hip positions during dives (pose preview), to tune reach and height.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
for (const kind of ['low', 'high', 'block', 'jump']) {
  for (const t of [0.25, 0.42, 0.55]) {
    await page.goto(`http://localhost:5173/?pose=${kind}&side=1&t=${t}`);
    await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
    const r = await page.evaluate(() => {
      const k = window.__game.world.keeper; k.root.updateMatrixWorld(true);
      const p = (n) => { const v = k.bones.get(n).getWorldPosition(window.__game.world.camera.position.clone()); return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`; };
      return `hand_l ${p('hand_l')} hand_r ${p('hand_r')} head ${p('Head')} pelvis ${p('pelvis')}`;
    });
    console.log(kind.padEnd(5), `t=${t}`, r);
  }
}
await browser.close();
