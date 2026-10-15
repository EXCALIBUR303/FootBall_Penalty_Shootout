// Measures AI keeper save rates per difficulty: N home kicks to varied targets at 4x speed.
// Usage: NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/balance.mjs [kicks] [levels,csv]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const N = Number(process.argv[2] || 30);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
// Typical player shots: mostly corners-ish, some lazy central ones.
const target = (i) => { const r = (i * 0.618) % 1, s = (i * 0.414) % 1; const central = i % 5 === 0; return { x: central ? (r - 0.5) * 1.2 : (r < 0.5 ? -1 : 1) * (1.6 + 1.7 * s), y: 0.3 + ((i * 0.733) % 1) * 1.9 }; };
for (const level of (process.argv[3] || 'easy,normal,hard,legend').split(',')) {
  await page.goto(`http://localhost:5173/?play&difficulty=${level}&timescale=4`);
  await page.waitForFunction(() => window.__game?.game, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.settings.set('autoReplay', false)); // replays would only slow the measurement
  const tally = { goal: 0, saved: 0, post: 0, miss: 0 };
  let done = 0;
  while (done < N) {
    await page.waitForFunction(() => ['aim', 'keeper', 'over'].includes(window.__game.game.phase), null, { timeout: 20000 });
    const st = await page.evaluate(() => ({ phase: window.__game.game.phase, team: window.__game.game.kick.team }));
    if (st.phase === 'over') { await page.keyboard.press('Enter'); continue; }
    if (st.team === 'away') { await page.evaluate(() => window.__game.game.debugKeeper(0, 0.5)); }
    else await page.evaluate((t) => window.__game.game.debugShoot(t, 0.6 + ((Math.random() * 0.3)), (Math.random() - 0.5)), target(done));
    await page.waitForFunction(() => window.__game.game.phase === 'result', null, { timeout: 20000 });
    const k = await page.evaluate(() => window.__game.game.kick);
    if (k.team === 'home') { tally[k.outcome]++; done++; }
  }
  const pct = (n) => `${Math.round((100 * n) / N)}%`;
  console.log(`${level.padEnd(7)} goals ${pct(tally.goal)}  saved ${pct(tally.saved)}  post ${pct(tally.post)}  miss ${pct(tally.miss)}`);
}
await browser.close();
