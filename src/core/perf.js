/**
 * Frame-time monitor.
 *  - `?stats` shows a small overlay: FPS, frame ms, draw calls, triangles and live GPU resource counts
 *    (the counts are how disposal is checked: they must not grow across matches).
 *  - If the game is running slowly on High quality for a few seconds, `onSlow` fires once so the app can
 *    drop to Low automatically. (Skipped under automation: software rendering is always slow.)
 */
export function createPerf(renderer, { showStats = false, onSlow = () => {} } = {}) {
  const SLOW_MS = 1000 / 40; // below ~40 fps
  const WINDOW = 150; // frames averaged before judging (~2.5 s at 60 fps)
  let acc = 0;
  let frames = 0;
  let slowFired = false;
  let el = null;
  let shown = 0;
  let fpsAcc = 0;
  let fpsFrames = 0;

  if (showStats) {
    renderer.info.autoReset = false; // otherwise only the last pass of the frame (post-processing) is counted
    el = document.createElement('pre');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;margin:0;padding:6px 8px;background:#000a;color:#9f9;font:12px/1.35 ui-monospace,monospace;z-index:50;pointer-events:none;border-radius:6px';
    document.body.appendChild(el);
  }

  return {
    /** @param {number} dt real seconds for the frame; @param {boolean} active true while a match is live and unpaused */
    frame(dt, active) {
      if (el) {
        fpsAcc += dt; fpsFrames++;
        shown += dt;
        if (shown >= 0.5) {
          const i = renderer.info;
          el.textContent = `${(fpsFrames / fpsAcc).toFixed(0)} fps  ${(1000 * fpsAcc / fpsFrames).toFixed(1)} ms\n`
            + `calls ${i.render.calls}  tris ${i.render.triangles}\n`
            + `geometries ${i.memory.geometries}  textures ${i.memory.textures}`;
          shown = 0; fpsAcc = 0; fpsFrames = 0;
        }
        renderer.info.reset(); // start counting the frame that is about to be drawn
      }
      if (slowFired || !active || dt > 0.25) { acc = 0; frames = 0; return; } // ignore pauses and tab switches
      acc += dt; frames++;
      if (frames >= WINDOW) {
        if (acc / frames > SLOW_MS) { slowFired = true; onSlow(1000 * acc / frames); }
        acc = 0; frames = 0;
      }
    },
    dispose() { el?.remove(); },
  };
}
