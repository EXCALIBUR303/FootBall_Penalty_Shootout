// Headless Chromium check of the Phase 1 pipeline. Run: node scripts/smoke-test.mjs [url]
// Needs `npm run dev` (or `npm run preview`) running. Run with NODE_PATH=$(npm root -g).
import { createRequire } from 'node:module';
// Playwright is preinstalled globally in this environment, so it is deliberately NOT a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] || 'http://localhost:5173/?test=1';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const g = window.__game;
  return { actors: Object.keys(g.assets), missing: g.missing, calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles };
});
await page.screenshot({ path: 'docs/phase1-smoke.png' });
console.log(JSON.stringify(info, null, 2));
console.log(logs.join('\n') || '(no console output)');
await browser.close();
