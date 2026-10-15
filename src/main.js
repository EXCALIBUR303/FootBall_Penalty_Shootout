import './styles/tokens.css';
import './styles/base.css';
import './styles/loading.css';
import * as THREE from 'three';
import { GAME_ASSETS, TEST_ASSETS } from './assets/manifest.js';
import { loadAssets } from './assets/loader.js';
import { createRenderer, watchResize } from './core/renderer.js';
import { buildScene } from './world/scene.js';
import { disposeTree } from './core/dispose.js';

const loadingEl = document.getElementById('loading');
const fillEl = loadingEl.querySelector('.loading__fill');
const barEl = loadingEl.querySelector('.loading__bar');
const labelEl = loadingEl.querySelector('.loading__label');
const errorEl = loadingEl.querySelector('.loading__error');

const testMode = new URLSearchParams(location.search).has('test');

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = createRenderer(canvas);

  const entries = testMode ? TEST_ASSETS : GAME_ASSETS;
  const { assets, missing } = await loadAssets(entries, ({ fraction, label }) => {
    const pct = Math.round(fraction * 100);
    fillEl.style.width = `${pct}%`;
    barEl.setAttribute('aria-valuenow', String(pct));
    labelEl.textContent = fraction >= 1 ? 'Ready' : `Loading ${label}… ${pct}%`;
  });

  if (missing.length) {
    // Keep going so whatever did load is still visible, but tell the developer exactly what is absent.
    errorEl.hidden = false;
    errorEl.textContent = `Missing assets:\n${missing.join('\n')}`;
    console.warn('Missing assets', missing);
  }

  const { scene, camera, mixers } = buildScene(renderer, assets);
  const resize = watchResize(renderer, camera, canvas);

  const timer = new THREE.Timer();
  timer.connect(document); // pauses time while the tab is hidden
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1); // clamp so a stalled frame doesn't jump animations
    for (const m of mixers) m.update(dt);
    renderer.render(scene, camera);
  });

  if (!missing.length) loadingEl.classList.add('is-done');
  else setTimeout(() => loadingEl.classList.add('is-done'), 4000);

  // Handy for Playwright and the console during development only.
  if (import.meta.env.DEV) window.__game = { renderer, scene, camera, mixers, assets, missing };

  // Release GPU memory on page unload / hot reload.
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    resize.dispose();
    disposeTree(scene);
    renderer.dispose();
  });
}

boot().catch((err) => {
  console.error(err);
  errorEl.hidden = false;
  errorEl.textContent = `Failed to start: ${err.message}`;
});
