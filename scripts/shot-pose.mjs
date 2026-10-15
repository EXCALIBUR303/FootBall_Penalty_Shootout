// Dev: screenshot pose previews. Usage: node scripts/shot-pose.mjs "pose=low&t=0.42" out.png [...more pairs]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const pairs = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
for (let i = 0; i < pairs.length; i += 2) {
  await page.goto(`http://localhost:5173/?${pairs[i]}`);
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: pairs[i + 1] });
}
await browser.close();
