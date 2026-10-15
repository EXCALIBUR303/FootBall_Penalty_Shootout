import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { preset } from './quality.js';

/**
 * Post-processing chain: scene (HDR, 4x MSAA) → light bloom → OutputPass (ACES tone mapping + sRGB).
 * On the low-quality preset the chain is skipped entirely and the renderer draws straight to the canvas
 * (tone mapping then happens in the material shaders), which saves two full-screen passes and the HDR targets.
 */
export function createPost(renderer, scene, camera) {
  let composer = null;
  let bloom = null;
  let enabled = false;
  const size = new THREE.Vector2();

  function build() {
    renderer.getDrawingBufferSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    // The HDRI's sky is ~2–7 in linear HDR and its lamps/sun reach ~12–40, so a threshold of 14 keeps the
    // glow to floodlights and glare instead of washing out the whole sky.
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.18, 0.4, 14);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const api = {
    get enabled() { return enabled; },
    /** Apply the active quality preset (call after changing it). */
    apply() {
      const want = preset().bloom;
      if (want && !composer) build();
      enabled = want;
      api.resize();
    },
    resize() {
      if (!composer) return;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(window.innerWidth, window.innerHeight);
    },
    render(dt) {
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    dispose() {
      composer?.dispose();
      composer = null;
    },
  };
  api.apply();
  return api;
}
