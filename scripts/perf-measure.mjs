// Relative frame cost at the aim shot (static camera) for High and Low quality, plus draw calls and triangles.
// Under software GL (swiftshader) the absolute numbers say nothing about real hardware: only compare runs
// made on the same machine, e.g. two commits served on two ports.
// Usage: [PORT=5173] [LABEL=x] NODE_PATH=$(npm root -g) CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/perf-measure.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const port = process.env.PORT || 5173;
const hardware=process.env.HARDWARE==='1';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless:!hardware, args: hardware?[]:['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const out = [];
for (const quality of ['high', 'low']) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.addInitScript((q) => localStorage.setItem('penalty-kings.settings', JSON.stringify({ quality: q, onboarded: true, autoReplay: false })), quality);
  await page.goto(`http://localhost:${port}/?play&stats`);
  await page.waitForFunction(() => window.__game?.game?.phase === 'aim', null, { timeout: 120000 });
  await page.waitForTimeout(4000); // let the camera settle and shaders finish compiling
  const r = await page.evaluate(() => new Promise((resolve) => {
    const times = []; let last = performance.now(); const t0 = last;
    const tick = (now) => {
      times.push(now - last); last = now;
      if (now - t0 < 12000) requestAnimationFrame(tick); else {
        const info = window.__game.renderer.info;
        const gl=window.__game.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
        const device=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
        times.sort((a, b) => a - b);
        resolve({
          device, frames: times.length,
          meanMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
          p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(1),
          calls: info.render.calls, tris: info.render.triangles,
          geometries: info.memory.geometries, textures: info.memory.textures,
          canvas: `${window.__game.renderer.domElement.width}x${window.__game.renderer.domElement.height}`,
          pixelRatio: window.__game.renderer.getPixelRatio(),
        });
      }
    };
    requestAnimationFrame(tick);
  }));
  if(hardware && /swiftshader|llvmpipe|software/i.test(r.device)){console.error('Hardware requested but the browser is using software rendering:',r.device);process.exitCode=1;}
  out.push({ label: process.env.LABEL || '', quality, ...r });
  await page.close();
}
console.table(out);
await browser.close();
