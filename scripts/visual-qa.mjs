// Visual QA: drives the real game through every screen and gameplay moment and saves a screenshot of each.
// Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium \
//        node scripts/visual-qa.mjs <outDir> [width height] [quality=high|low]
// Needs the dev server (npm run dev). Software GL is slow, so the game runs at ?timescale=2 and every wait
// is condition-based. Shots: 01-menu … 14-end (see the list below).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'qa';
const W = Number(process.argv[3] || 1440), H = Number(process.argv[4] || 900);
const quality = process.argv[5] || 'high';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(120000); // software GL on High can stall the page for a while (e.g. starting a match)
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(m.text()); });
// Wait for two fresh animation frames before each capture: under software GL a slow frame can otherwise
// be captured half-drawn.
const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (name, settle = 600) => { await page.waitForTimeout(settle); await frames(); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const phase = (p, timeout = 60000) => page.waitForFunction((p) => [].concat(p).includes(window.__game?.game?.phase), p, { timeout });
const g = (fn, arg) => page.evaluate(fn, arg);

await page.addInitScript(([q]) => {
  if (sessionStorage.getItem('qa')) return;
  sessionStorage.setItem('qa', '1');
  localStorage.setItem('penalty-kings.settings', JSON.stringify({ quality: q, onboarded: true, difficulty: 'normal', homeTeam: 'lions', awayTeam: 'foxes' }));
  localStorage.setItem('penalty-kings.quality', q);
}, [quality]);
await page.goto(`http://localhost:${process.env.PORT || 5173}/?timescale=2`);
await page.waitForSelector('[data-screen="menu"]:not([hidden])', { timeout: 60000 });
await shot('01-menu', 2500);

await page.click('[data-action="play-1p"]');
await shot('02-setup');
await page.click('input[name="difficulty"][value="hard"]', { force: true }).catch(() => {});
await g(() => { const r = document.querySelector('input[name="difficulty"][value="hard"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await shot('03-difficulty', 300);
await g(() => { const r = document.querySelector('input[name="difficulty"][value="normal"]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); });
await page.click('.setup__go');

// --- Home kick: aim → power → curve → run-up → goal → replay
await phase('aim');
const target = await g(() => { // screen position of the top-right corner area of the goal
  const c = window.__game.world.camera; const v = c.position.clone().set(2.6, 1.7, 0).project(c);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.move(target.x, target.y, { steps: 4 });
await shot('04-aim', 1500);
await page.keyboard.down('Space');
await shot('05-power', 700);
await page.keyboard.up('Space');
await shot('06-curve', 500);
await g(() => { const gm = window.__game.game; gm.debugForceSave({ kind: 'low', side: -1, reach: 1.2, speed: 1, height: 0.5 }, 0.15); gm.debugShoot({ x: 2.7, y: 1.6 }, 0.8, 0.2); });
await shot('07-runup', 450);
await phase('result');
await shot('08-goal', 500);
await phase('replay');
await shot('10-replay', 1800);

// --- Away kick: keeper view, then a human save
await phase('keeper');
await shot('11-keeper-view', 900);
await g(() => { const k = window.__game.game.kick; window.__game.game.debugKeeper(k.ai.target.x, k.ai.target.y); });
await phase('result');
await shot('09-save-or-result', 500);
console.log('away kick outcome', await g(() => window.__game.game.kick.outcome));

// --- Pause + settings
await phase(['aim']);
await page.keyboard.press('Escape');
await shot('12-pause', 500);
await page.click('[data-dialog="pause"] [data-action="settings"]');
await shot('13-settings', 500);
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

// --- Finish the match through the hooks, then the end screen
await g(() => window.__game.settings.set('autoReplay', false));
await g(async () => {
  const gm = window.__game.game; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40 && gm.phase !== 'over'; i++) {
    while (!['aim', 'keeper', 'over'].includes(gm.phase)) await wait(100);
    if (gm.phase === 'over') break;
    if (gm.kick.shooterHuman) gm.debugShoot({ x: 0, y: 0.5 }, 0.3, 0); else gm.debugKeeper(3, 0.5);
    while (gm.phase !== 'result' && gm.phase !== 'over') await wait(100);
  }
});
await page.waitForSelector('[data-dialog="end"]:not([hidden])', { timeout: 60000 });
await shot('14-end', 800);
console.log('errors', errors.length ? errors : 'none');
if(errors.length)process.exitCode=1;
await browser.close();
