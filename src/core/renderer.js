import * as THREE from 'three';
import { preset } from './quality.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap was removed; PCF is now the soft filter
  return renderer;
}

/** Keeps drawing buffer, camera aspect and devicePixelRatio in sync with the window. */
export function watchResize(renderer, camera, canvas, onResize = () => {}) {
  const apply = () => {
    const { maxDpr } = preset();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    onResize();
  };
  apply();
  window.addEventListener('resize', apply);
  // DPR changes (moving between monitors, browser zoom) don't always fire 'resize'.
  const mq = () => matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  let media = mq();
  const onDpr = () => { apply(); media.removeEventListener('change', onDpr); media = mq(); media.addEventListener('change', onDpr); };
  media.addEventListener('change', onDpr);
  return { apply, dispose: () => window.removeEventListener('resize', apply) };
}
