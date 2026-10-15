// Plays a full shootout headlessly through the debug hooks and reports every kick.
// Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/play-test.mjs [difficulty] [screenshotDir]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const level = process.argv[2] || 'normal';
const shots = process.argv[3];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5173/?play&difficulty=${level}`);
await page.waitForFunction(() => window.__game?.game, null, { timeout: 30000 });
await page.evaluate(() => { window.__game.settings.set('quality', 'low'); window.__game.settings.set('autoReplay', false); }); // software GL: keep it fast
const targets = [[2.8, 0.6], [-2.9, 1.9], [0.2, 1.0], [3.2, 2.0], [-2.5, 0.4], [2.4, 1.2], [-3.1, 1.5]];
const log = [];
for (let i = 0; i < 24; i++) {
  await page.waitForFunction(() => ['aim', 'keeper', 'over'].includes(window.__game.game.phase), null, { timeout: 20000 });
  const st = await page.evaluate(() => ({ phase: window.__game.game.phase, team: window.__game.game.kick.team }));
  if (st.phase === 'over') break;
  if (st.team === 'home') {
    const [x, y] = targets[i % targets.length];
    await page.evaluate(([x, y]) => window.__game.game.debugShoot({ x, y }, 0.75, 0), [x, y]);
  } else {
    // human keeper guesses a side half a second into the wait
    await page.waitForTimeout(500);
    await page.evaluate((s) => window.__game.game.debugKeeper(s * 2.6, 0.8), i % 4 < 2 ? 1 : -1);
  }
  await page.waitForFunction(() => window.__game.game.phase === 'result', null, { timeout: 20000 });
  if (shots && i < 4) await page.screenshot({ path: `${shots}/kick${i}.png` });
  const k = await page.evaluate(() => { const k = window.__game.game.kick; return { team: k.team, outcome: k.outcome, keeper: k.touchedKeeper, held: k.held, wood: k.woodwork, target: k.shot?.target }; });
  log.push(k);
  console.log(`${String(i + 1).padStart(2)} ${k.team.padEnd(4)} ${k.outcome.padEnd(5)} target=(${k.target.x.toFixed(1)},${k.target.y.toFixed(1)}) keeperTouch=${k.keeper} held=${k.held} woodwork=${k.wood}`);
}
const final = await page.evaluate(() => { const s = window.__game.game.shootout; return { winner: s.winner, home: s.kicks.home, away: s.kicks.away, phase: window.__game.game.phase }; });
console.log('final', JSON.stringify(final));
console.log('errors', errors.length ? errors : 'none');
await browser.close();
