import './styles/tokens.css';
import './styles/base.css';
import './styles/loading.css';
import * as THREE from 'three';
import { GAME_ASSETS, TEST_ASSETS, PITCH } from './assets/manifest.js';
import { loadAssets } from './assets/loader.js';
import { createRenderer, watchResize } from './core/renderer.js';
import { buildScene } from './world/scene.js';
import { disposeTree } from './core/dispose.js';
import { settings } from './core/settings.js';
import { setQuality, preset } from './core/quality.js';
import { createPost } from './core/post.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './audio/audio.js';
import { createPerf } from './core/perf.js';
import { toast } from './ui/toast.js';
import { fitPortraitFov } from './camera/framing.js';
import './styles/broadcast.css';

const loadingEl = document.getElementById('loading');
const fillEl = loadingEl.querySelector('.loading__fill');
const barEl = loadingEl.querySelector('.loading__bar');
const labelEl = loadingEl.querySelector('.loading__label');
const errorEl = loadingEl.querySelector('.loading__error');

const params = new URLSearchParams(location.search);
const testMode = params.has('test');

async function boot() {
  const canvas = document.getElementById('game');
  setQuality(settings.get('quality')); // quality.js reads its own key; keep the two in step
  const renderer = createRenderer(canvas);
  renderer.info.autoReset=false; // include the scene and every post pass in frame statistics

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
  let post = null; // created below; resize may fire first
  const resize = watchResize(renderer, camera, canvas, () => post?.resize());
  post = createPost(renderer, scene, camera);
  const playable = world.keeper && world.striker && world.ball;

  // --- App state: menu (orbiting camera) or a match --------------------------------------------
  let game = null;
  let starting = false;
  let menuT = 0;

  async function startMatch(options) {
    if (starting) return;
    starting = true;
    game?.dispose();
    const { createMatch } = await import('./game/match.js');
    game = await createMatch({ world, renderer, canvas, params, options, settings, onEvent });
    starting = false;
    expose();
  }
  function endMatch() {
    audio.crowd(0.3);
    game?.dispose();
    game = null;
    world.keeper.ready();
    world.striker.setUp(new THREE.Vector3(0, PITCH.ballRadius, PITCH.penaltySpotZ));
    world.ball.position.set(0, PITCH.ballRadius, PITCH.penaltySpotZ);
    world.ball.quaternion.identity();
    ui.showMenu();
    expose();
  }
  const audio = createAudio(settings);
  const perf = createPerf(renderer, {
    showStats: params.has('stats'),
    // Not under automation: software GL is always slow and would flip the quality mid-test.
    onSlow: (ms) => {
      if (navigator.webdriver || settings.get('quality') !== 'high') return;
      settings.set('quality', 'low');
      toast(`Running slowly (${Math.round(1000 / ms)} fps), so graphics were switched to Low. You can change this in Settings.`, 8000);
    },
  });
  function onEvent(type, data) {
    audio.onMatchEvent(type, data);
    if (type === 'result' && ['goal','saved'].includes(data.outcome)) world.environment.crowd.react();
    if (type === 'over') ui.showEnd(data);
  }
  // UI sounds: one delegated listener over the whole interface layer.
  document.getElementById('ui').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const a = btn.dataset.action;
    audio.ui(a === 'close' || a === 'back' || a === 'resume' ? 'back' : btn.classList.contains('btn--primary') ? 'confirm' : 'click');
  });
  document.getElementById('ui').addEventListener('change', (e) => { if (e.target.matches('input')) audio.ui('tick'); });

  const ui = createUI({
    onKickOff: (opts) => startMatch(opts),
    onPause: (p) => { game?.setPaused(p); audio.setPaused(p); },
    onQuit: endMatch,
    onRematch: () => game?.restart(),
    onSettingChanged: (k, v) => {
      if (k === 'quality') {
        setQuality(v);
        resize.apply(); // devicePixelRatio cap
        post.apply(); // bloom on/off
        world.environment.quality();
        const size = preset(v).shadowMap;
        world.sun.shadow.mapSize.set(size, size);
        world.sun.shadow.map?.dispose(); // re-allocated at the new size on the next frame
        world.sun.shadow.map = null;
      }
    },
  });

  // Dev shortcuts: ?pose=… freezes a pose, ?play starts a match straight away (used by test scripts).
  if (import.meta.env.DEV && params.has('pose')) {
    (await import('./dev/pose-preview.js')).applyPosePreview(world, params);
  } else if (playable && import.meta.env.DEV && params.has('play')) {
    ui.enterMatch(); // so Esc / P pause works as in a normal match
    await startMatch({ mode: params.get('mode') ?? '1p', difficulty: params.get('difficulty') ?? 'normal' });
  } else if (playable) {
    ui.showMenu();
  }

  // Dev-only ?timescale=4 fast-forwards the simulation (used by the balancing script).
  const timeScale = import.meta.env.DEV ? Number(params.get('timescale') ?? 1) : 1;
  const timer = new THREE.Timer();
  timer.connect(document); // pauses time while the tab is hidden
  renderer.setAnimationLoop((now) => {
    timer.update(now);
    const realDt = timer.getDelta();
    perf.frame(realDt, Boolean(game) && !game.paused);
    const dt = Math.min(realDt, 0.1) * timeScale; // clamp so a stalled frame doesn't jump the simulation
    if (game) game.update(dt);
    else {
      world.keeper?.update(dt);
      world.striker?.update(dt);
      if (!params.has('pose')) orbit(dt);
    }
    world.net.update(game?.paused ? 0 : dt, settings.get('reducedMotion'));
    world.environment.update(game?.paused ? 0 : dt, settings.get('reducedMotion'));
    renderer.info.reset();
    post.render(dt);
  });

  // Slow broadcast-style orbit behind the menu (a static wide shot with reduced motion).
  function orbit(dt) {
    menuT += settings.get('reducedMotion') ? 0 : dt;
    const a = 0.20 + Math.sin(menuT * 0.06) * 0.16;
    camera.position.set(Math.sin(a)*38, 5.5 + Math.sin(menuT*0.11)*0.2, 6+Math.cos(a)*38);
    camera.lookAt(0, 7.0, -5);
    const menuFov=fitPortraitFov(48,camera.aspect);
    if (camera.fov !== menuFov) { camera.fov = menuFov; camera.updateProjectionMatrix(); }
  }

  loadingEl.classList.add('is-done');
  if (missing.length) loadingEl.classList.remove('is-done');

  // Handy for Playwright and the console during development only.
  function expose() { if (import.meta.env.DEV) window.__game = { renderer, world, game, ui, assets, missing, settings, audio, post }; }
  expose();

  // A lost WebGL context (GPU reset, driver crash) can't be recovered mid-match; say so instead of freezing silently.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    errorEl.hidden = false;
    errorEl.textContent = 'The graphics context was lost. Please reload the page.';
    loadingEl.classList.remove('is-done');
  });

  // Release GPU memory on page unload.
  window.addEventListener('pagehide', () => {
    renderer.setAnimationLoop(null);
    resize.dispose();
    post.dispose();
    perf.dispose();
    game?.dispose();
    audio.dispose();
    Object.values(world.kits).forEach(k=>k.dispose?.());
    world.environment.dispose();
    disposeTree(scene);
    renderer.dispose();
  });
}

boot().catch((err) => {
  console.error(err);
  errorEl.hidden = false;
  errorEl.textContent = `Failed to start: ${err.message}`;
});
