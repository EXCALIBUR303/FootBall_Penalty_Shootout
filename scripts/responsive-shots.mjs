// Screenshots of menu, setup and in-match HUD at tablet/phone sizes. Usage: node scripts/responsive-shots.mjs outDir
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] || 'docs/qa/responsive';
mkdirSync(out,{recursive:true});
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, touch] of [[1024, 768, true], [768, 1024, true], [390, 844, true]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 500 });
  page.setDefaultTimeout(120000);
  await page.addInitScript(q=>localStorage.setItem('penalty-kings.settings',JSON.stringify({quality:q,onboarded:true})),process.env.QUALITY || 'low');
  await page.goto(`http://localhost:${process.env.PORT || 5173}/`);
  await page.waitForSelector('[data-screen="menu"]:not([hidden])', { timeout: 120000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${w}x${h}-menu.png` });
  await page.tap('[data-action="play-1p"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${w}x${h}-setup.png` });
  await page.tap('.setup__go');
  await page.waitForFunction(() => window.__game?.game?.phase === 'aim', null, { timeout: 120000 });
  // touch: press and hold on the canvas to charge power
  const box = await page.locator('#game').boundingBox();
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.width*0.6,y:box.height*0.4}]});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${w}x${h}-hud.png` });
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>window.__game.game.phase==='curve');
  await cdp.detach();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(`${w}x${h}`, 'phase', await page.evaluate(() => window.__game.game.phase), 'horizontal overflow', overflow);
  await page.close();
}
await browser.close();
