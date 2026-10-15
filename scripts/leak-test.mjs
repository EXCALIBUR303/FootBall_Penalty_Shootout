// Starts and quits a match several times and checks that GPU resource counts (geometries / textures) and
// the JS heap stay flat. Usage: [RUNS=8] NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/leak-test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
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
const RUNS = +(process.env.RUNS || 6);
for (let n = 0; n < RUNS; n++) {
  await page.evaluate((n) => window.__game.ui && document.querySelector('[data-action="play-1p"]').click(), n);
  await page.waitForSelector('.setup__go', { state: 'visible' });
  await page.click('.setup__go');
  await page.waitForFunction(() => window.__game.game?.phase === 'aim', null, { timeout: 30000 });
  // play one kick so physics, effects and the recorder are all exercised
  // alternate a corner shot with one at the post, so goal, save and woodwork effects all get drawn
  await page.evaluate((n) => window.__game.game.debugShoot(n % 2 ? { x: 3.66, y: 1.2 } : { x: 2.5, y: 1.0 }, 0.8, 0), n);
  await page.waitForFunction(() => ['result', 'replay'].includes(window.__game.game.phase), null, { timeout: 30000 });
  await page.evaluate(() => window.gc?.());
  rows.push({ run: n + 1, outcome: await page.evaluate(() => window.__game.game.kick?.outcome ?? '?'), ...(await snap()) });
  await page.keyboard.press('Escape');
  await page.click('[data-action="quit"]');
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (window.gc) window.gc(); });
}
console.table(rows);
// Each match builds its own effects and frees them on quit, and three.js only counts a texture or geometry
// once it is drawn: a goal draws confetti, a save or woodwork draws sparks, a miss neither. So counts are only
// comparable between kicks with the same outcome; a real leak grows run after run whatever the outcome.
const grew = [];
for (const outcome of new Set(rows.map((r) => r.outcome))) {
  const same = rows.filter((r) => r.outcome === outcome && r.run > 1);
  if (same.length < 2) continue;
  const a = same[0], b = same[same.length - 1];
  if (b.geometries > a.geometries || b.textures > a.textures) grew.push(`${outcome}: run ${a.run} -> ${b.run}`);
}
const heapGrowth = rows[rows.length - 1].heapMB - rows[1].heapMB;
console.log(grew.length ? `LEAK: GPU resource counts grew (${grew.join(', ')})` : 'GPU resources flat between kicks with the same outcome');
console.log(`heap after GC: ${rows[1].heapMB} MB (run 2) -> ${rows[rows.length - 1].heapMB} MB (run ${rows.length})`);
console.log('errors', errors.length ? errors : 'none');
await browser.close();
process.exit(grew.length || heapGrowth > 10 || errors.length ? 1 : 0);
