// Checks the audio graph in headless Chromium: samples decode, and kick / cheer / groan actually produce
// signal on the master output. Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/audio-test.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
await page.addInitScript(()=>localStorage.setItem('penalty-kings.settings',JSON.stringify({quality:'low'})));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173/?play');
await page.waitForFunction(() => window.__game?.game, null, { timeout: 120000 });
await page.mouse.click(640, 360); // a user gesture unlocks audio
await page.waitForFunction(() => Object.keys(window.__game.audio.stats().samples).length >= 11, null, { timeout: 15000 });
// Software GL keeps the main thread busy, and the ScriptProcessor tap used by measure() then drops blocks.
await page.evaluate(() => window.__game.renderer.setAnimationLoop(null));
console.log('stats', JSON.stringify(await page.evaluate(() => window.__game.audio.stats())));
const level = async (fn) => {
  const m = page.evaluate(() => window.__game.audio.measure(500));
  await page.evaluate(fn);
  return m;
};
console.log('silence (crowd bed only) peak', (await level(() => {})).toFixed(4));
console.log('kick peak', (await level(() => window.__game.audio.onMatchEvent('strike', { power: 0.9, x: 1 }))).toFixed(4));
console.log('whistle peak', (await level(() => window.__game.audio.onMatchEvent('whistle', {}))).toFixed(4));
console.log('post peak', (await level(() => window.__game.audio.onMatchEvent('woodwork', { type: 'post', speed: 20, x: 3 }))).toFixed(4));
console.log('cheer peak', (await level(() => window.__game.audio.onMatchEvent('result', { outcome: 'goal' }))).toFixed(4));
console.log('groan peak', (await level(() => window.__game.audio.onMatchEvent('result', { outcome: 'saved' }))).toFixed(4));
await page.evaluate(() => window.__game.settings.set('muted', true));
await page.waitForTimeout(400);
console.log('muted peak', (await level(() => window.__game.audio.onMatchEvent('strike', { power: 1 }))).toFixed(4));
console.log('errors', errors.length ? errors : 'none');
await browser.close();
if(errors.length)process.exitCode=1;
