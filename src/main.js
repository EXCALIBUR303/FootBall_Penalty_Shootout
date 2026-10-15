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

const params = new URLSearchParams(location.search);
const testMode = params.has('test');

async function boot() {
  const canvas = document.getElementById('game');
  const renderer = createRenderer(canvas);

  const entries = testMode ? TEST_ASSETS : GAME_ASSETS;
  const { assets, missing, optionalMissing } = await loadAssets(entries, ({ fraction, label }) => {
    const pct = Math.round(fraction * 100);
    fillEl.style.width = `${pct}%`;
    barEl.setAttribute('aria-valuenow', String(pct));
    labelEl.textContent = fraction >= 1 ? 'Ready' : `Loading ${label}… ${pct}%`;
  });

  if (optionalMissing.length) console.info('Optional assets not present:', optionalMissing);
  if (missing.length) {
    // Keep going so whatever did load is still visible, but say exactly what is absent.
    errorEl.hidden = false;
    errorEl.textContent = `Missing assets:\n${missing.join('\n')}`;
    console.warn('Missing assets', missing);
  }

  const world = buildScene(renderer, assets);
  const { scene, camera } = world;
  const resize = watchResize(renderer, camera, canvas);

  let game = null;
  if (import.meta.env.DEV && params.has('pose')) {
    (await import('./dev/pose-preview.js')).applyPosePreview(world, params);
  } else if (world.keeper && world.striker && world.ball) {
    const { createMatch } = await import('./game/match.js');
    game = await createMatch({ world, renderer, canvas, params });
  }

  // Dev-only ?timescale=4 fast-forwards the simulation (used by the balancing script).
  const timeScale = import.meta.env.DEV ? Number(params.get('timescale') ?? 1) : 1;
  const timer = new THREE.Timer();
  timer.connect(document); // pauses time while the tab is hidden
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1) * timeScale; // clamp so a stalled frame doesn't jump the simulation
    if (game) game.update(dt);
    else { world.keeper?.update(dt); world.striker?.update(dt); }
    renderer.render(scene, camera);
  });

  if (!missing.length) loadingEl.classList.add('is-done');
  else setTimeout(() => loadingEl.classList.add('is-done'), 4000);

  // Handy for Playwright and the console during development only.
  if (import.meta.env.DEV) window.__game = { renderer, world, game, assets, missing };

  // Release GPU memory on page unload.
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    resize.dispose();
    game?.dispose();
    disposeTree(scene);
    renderer.dispose();
  });
}

boot().catch((err) => {
  console.error(err);
  errorEl.hidden = false;
  errorEl.textContent = `Failed to start: ${err.message}`;
});
