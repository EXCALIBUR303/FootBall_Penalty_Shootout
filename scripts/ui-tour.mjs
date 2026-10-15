// Walks every screen with the KEYBOARD ONLY and screenshots each one; reports console errors.
// Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/ui-tour.mjs outDir [width height]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const [w, h] = [Number(process.argv[3] || 1280), Number(process.argv[4] || 720)];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${name}.png` }); };
const focused = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.textContent || a.getAttribute('aria-label') || a.name || a.tagName).trim().slice(0, 30) : null; });
const steps = [];
const log = async (label) => steps.push(`${label}: focus="${await focused()}"`);

// Fresh profile (first-run onboarding); cleared before the first load rather than reloading mid-load.
await page.addInitScript(() => { if (!sessionStorage.getItem('tour')) { localStorage.clear(); sessionStorage.setItem('tour', '1'); } });
await page.goto('http://localhost:5173/');
await page.waitForSelector('[data-screen="menu"]:not([hidden])', { timeout: 30000 });
// Software GL is ~2 fps with bloom, so QA runs on Low with replays off (replays have their own test).
await page.evaluate(() => { window.__game.settings.set('quality', 'low'); window.__game.settings.set('autoReplay', false); });
await log('menu'); await shot('01-menu');
await page.keyboard.press('Tab'); await log('menu tab'); await page.keyboard.press('Tab'); await log('menu tab2');
await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await log('settings (from menu)'); await shot('02-settings');
await page.keyboard.press('Escape'); await log('settings closed');
await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Enter'); await log('help'); await shot('03-help');
await page.keyboard.press('Escape');
await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await log('back to play'); await page.keyboard.press('Enter');
await log('setup'); await shot('04-setup');
// change team with keyboard: Tab to "next team" and press Enter
await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await log('team next'); await page.keyboard.press('Enter');
// pick difficulty: Tab into the radio group, arrow right
for (let i = 0; i < 2; i++) await page.keyboard.press('Tab'); // ▶ (away), then the radio group (one tab stop)
await log('difficulty'); await page.keyboard.press('ArrowRight'); await log('difficulty →');
await page.keyboard.press('Tab'); await log('kick off'); await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__game?.game?.phase === 'aim', null, { timeout: 30000 });
await page.waitForTimeout(300); await shot('05-hud-aim-coach');
await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
await page.keyboard.down('Space'); await page.waitForTimeout(500); await shot('06-hud-power');
await page.keyboard.up('Space'); await page.waitForTimeout(300); await shot('07-hud-curve');
await page.keyboard.press('Escape'); await log('pause'); await shot('08-pause');
const pausedPhase = await page.evaluate(() => [window.__game.game.phase, window.__game.game.paused]);
await page.keyboard.press('Enter'); // Resume
await page.waitForFunction(() => !window.__game.game.paused && !window.__game.ui.dialogOpen); // wait for the resume to land (slow frames under software GL)
await page.waitForTimeout(300);
await page.keyboard.press('Space');

await page.waitForFunction(() => window.__game.game.phase === 'result', null, { timeout: 15000 }).catch(async (e) => {
  console.log('stuck:', await page.evaluate(() => [window.__game.game.debugInput.primaryHeld, window.__game.game.phase, window.__game.game.paused, window.__game.ui.dialogOpen, document.activeElement.outerHTML.slice(0, 80)]));
  throw e;
});
await page.waitForTimeout(200); await shot('09-result');
// finish the match quickly through the hooks, then check the end dialog
await page.evaluate(async () => {
  const g = window.__game.game; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 30 && g.phase !== 'over'; i++) {
    while (!['aim', 'keeper', 'over'].includes(g.phase)) await wait(100);
    if (g.phase === 'over') break;
    if (g.kick.shooterHuman) g.debugShoot({ x: 0, y: 0.5 }, 0.3, 0); // weak, central: likely saved
    else g.debugKeeper(0, 0.5);
    while (g.phase !== 'result') await wait(100);
  }
});
await page.waitForSelector('[data-dialog="end"]:not([hidden])', { timeout: 30000 });
await log('end'); await shot('10-end');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); // Main menu
await page.waitForSelector('[data-screen="menu"]:not([hidden])', { timeout: 10000 });
await log('menu again');
console.log(steps.join('\n'));
console.log('paused state', pausedPhase);
console.log('errors', errors.length ? errors : 'none');
await browser.close();
