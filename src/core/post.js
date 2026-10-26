import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { preset } from './quality.js';

/**
 * Post-processing chain: scene (HDR, MSAA) → light bloom → OutputPass (tone mapping + sRGB).
 * On the low-quality preset the chain is skipped entirely and the renderer draws straight to the canvas
 * (tone mapping then happens in the material shaders), which saves the HDR targets and three passes.
 * Both paths use the renderer's tone mapping and output colour space, so they look the same apart from
 * the bloom (verified with screenshots).
 *
 * Safari / older GPUs: rendering to a half-float target needs EXT_color_buffer_float (or the half-float
 * variant). Without it the chain is not built and High falls back to direct rendering with a console note.
 */
export function createPost(renderer, scene, camera) {
  let composer = null;
  let bloom = null;
  let target = null;
  let enabled = false;
  const size = new THREE.Vector2();
  const canHdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  if (!canHdr) console.info('Post-processing disabled: no float render-target support (High renders without bloom).');

  // MSAA on top of a ≥1.75× pixel ratio (Retina) mostly re-samples pixels that are already supersampled;
  // 2 samples there costs half as much as 4 and looks the same.
  const samplesFor = () => (renderer.getPixelRatio() >= 1.75 ? 2 : 4);

  function build() {
    renderer.getDrawingBufferSize(size);
    target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: samplesFor() });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    // A high threshold blooms emissive floodlights and ribbon glints without haloing kit edges.
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.4, 1.45);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  const api = {
    get enabled() { return enabled; },
    /** Apply the active quality preset (call after changing it). */
    apply() {
      const want = preset().bloom && canHdr;
      if (want && !composer) build();
      enabled = want;
      api.resize();
    },
    resize() {
      if (!composer) return;
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(window.innerWidth, window.innerHeight);
      // The MSAA sample count follows the pixel ratio (moving a window between displays changes it).
      const samples = samplesFor();
      for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
        if (rt.samples !== samples) { rt.samples = samples; rt.dispose(); }
      }
    },
    render(dt) {
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
    dispose() {
      for(const pass of composer?.passes ?? [])pass.dispose?.();
      composer?.dispose();
      composer = null;
    },
  };
  api.apply();
  return api;
}
