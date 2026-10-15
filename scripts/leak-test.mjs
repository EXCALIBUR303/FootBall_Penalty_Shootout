// Starts and quits a match several times and checks that GPU resource counts (geometries / textures) and
// the JS heap stay flat. Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/leak-test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(m.text()); });
await page.goto('http://localhost:5173/');
await page.waitForFunction(() => window.__game?.ui, null, { timeout: 30000 });
const snap = () => page.evaluate(() => {
  const i = window.__game.renderer.info;
  return { geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs?.length, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) };
});
const rows = [];
for (let n = 0; n < 4; n++) {
  await page.evaluate((n) => window.__game.ui && document.querySelector('[data-action="play-1p"]').click(), n);
  await page.waitForSelector('.setup__go', { state: 'visible' });
  await page.click('.setup__go');
  await page.waitForFunction(() => window.__game.game?.phase === 'aim', null, { timeout: 30000 });
  // play one kick so physics, effects and the recorder are all exercised
  await page.evaluate(() => window.__game.game.debugShoot({ x: 2.5, y: 1.0 }, 0.8, 0));
  await page.waitForFunction(() => ['result', 'replay'].includes(window.__game.game.phase), null, { timeout: 30000 });
  rows.push({ run: n + 1, ...(await snap()) });
  await page.keyboard.press('Escape');
  await page.click('[data-action="quit"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (window.gc) window.gc(); });
}
console.table(rows);
const first = rows[1], last = rows[rows.length - 1];
const grew = last.geometries > first.geometries || last.textures > first.textures;
console.log(grew ? 'LEAK: GPU resource counts grew between runs 2 and 4' : 'GPU resources flat between runs 2 and 4');
console.log('errors', errors.length ? errors : 'none');
await browser.close();
process.exit(grew || errors.length ? 1 : 0);
