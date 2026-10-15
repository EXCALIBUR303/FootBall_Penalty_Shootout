// Layout check across viewports: screenshots of menu, setup, the in-match HUD (aim + power), settings and
// the end screen, plus measured checks — no horizontal overflow, key elements inside the viewport, the
// scoreboard clear of the pause button, hints clear of the meters.
// Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/layout-check.mjs <outDir>
// (PORT env selects the dev server, default 5173)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'docs/qa/layout';
mkdirSync(out, { recursive: true });
const port = process.env.PORT || 5173;
const VIEWPORTS = (process.env.VIEWPORTS || '1366x768,1440x900,1680x1050,1920x1080,2560x1440,1024x768,390x844')
  .split(',').map((v) => v.split('x').map(Number));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
for (const [w, h] of VIEWPORTS) {
  const tag = `${w}x${h}`;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GPU stall/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('penalty-kings.settings', JSON.stringify({ quality: 'low', onboarded: true, autoReplay: false })));
  await page.goto(`http://localhost:${port}/`);
  await page.waitForSelector('[data-screen="menu"]:not([hidden])', { timeout: 60000 });
  await page.waitForTimeout(600);

  const check = async (where, selectors) => {
    const r = await page.evaluate((sels) => {
      const vw = innerWidth, vh = innerHeight, res = { overflowX: document.documentElement.scrollWidth > vw + 1, boxes: {} };
      for (const s of sels) {
        const el = [...document.querySelectorAll(s)].find((n) => n.offsetParent !== null || getComputedStyle(n).position === 'fixed');
        if (!el) { res.boxes[s] = null; continue; }
        const b = el.getBoundingClientRect();
        res.boxes[s] = { l: b.left, t: b.top, r: b.right, b: b.bottom, inside: b.left >= -1 && b.top >= -1 && b.right <= vw + 1 && b.bottom <= vh + 1 };
      }
      return res;
    }, selectors);
    if (r.overflowX) problems.push(`${tag} ${where}: horizontal overflow`);
    for (const [s, b] of Object.entries(r.boxes)) if (b && !b.inside) problems.push(`${tag} ${where}: ${s} outside viewport ${JSON.stringify(b)}`);
    return r.boxes;
  };
  const overlap = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

  await check('menu', ['.menu', '.menu__nav']);
  await page.screenshot({ path: `${out}/${tag}-menu.png` });
  await page.click('[data-action="play-1p"]');
  await page.waitForTimeout(400);
  await check('setup', ['.setup', '.setup__go', '.team-card[data-side="away"]', '.diff:last-child']);
  await page.screenshot({ path: `${out}/${tag}-setup.png` });
  await page.click('.setup__go');
  await page.waitForFunction(() => window.__game?.game?.phase === 'aim', null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  let hud = await check('aim', ['.sb', '.hud__pause', '.hints']);
  if (overlap(hud['.sb'], hud['.hud__pause'])) problems.push(`${tag} aim: scoreboard overlaps the pause button`);
  await page.screenshot({ path: `${out}/${tag}-aim.png` });
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  hud = await check('power', ['.meters', '.hints']);
  if (overlap(hud['.meters'], hud['.hints'])) problems.push(`${tag} power: meters overlap the hints`);
  await page.screenshot({ path: `${out}/${tag}-power.png` });
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await page.click('[data-dialog="pause"] [data-action="settings"]');
  await page.waitForTimeout(400);
  await check('settings', ['[data-dialog="settings"] .dialog__card']);
  await page.screenshot({ path: `${out}/${tag}-settings.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  // finish the match through the hooks for the end screen
  await page.evaluate(async () => {
    const g = window.__game.game; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 40 && g.phase !== 'over'; i++) {
      while (!['aim', 'power', 'curve', 'keeper', 'over'].includes(g.phase)) await wait(80);
      if (g.phase === 'over') break;
      if (g.kick.shooterHuman) g.debugShoot({ x: 0, y: 0.5 }, 0.3, 0); else g.debugKeeper(3, 0.5);
      while (g.phase !== 'result' && g.phase !== 'over') await wait(80);
    }
  });
  await page.waitForSelector('[data-dialog="end"]:not([hidden])', { timeout: 120000 });
  await page.waitForTimeout(500);
  await check('end', ['[data-dialog="end"] .dialog__card', '.end__actions', '.end__title']);
  await page.screenshot({ path: `${out}/${tag}-end.png` });
  if (errors.length) problems.push(`${tag}: console errors ${JSON.stringify(errors)}`);
  console.log('checked', tag);
  await page.close();
}
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'layout OK at every viewport');
await browser.close();
process.exit(problems.length ? 1 : 0);
