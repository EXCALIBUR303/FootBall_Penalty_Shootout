import * as THREE from 'three';

/**
 * Pointer + keyboard input, mapped onto the goal plane (z = 0) where useful.
 * "Primary" is Space / Enter / mouse button / touch: press and release are reported separately because
 * the power meter is hold-to-charge.
 */
export function createInput(canvas, camera) {
  const keys = new Set();
  const listeners = { primarydown: [], primaryup: [], key: [] };
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const goalPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let pointerSeen = false;
  let primaryHeld = false;

  const emit = (type, e) => listeners[type].forEach((fn) => fn(e));

  const onPointerMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerSeen = true;
  };
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    onPointerMove(e);
    canvas.setPointerCapture?.(e.pointerId);
    if (!primaryHeld) { primaryHeld = true; emit('primarydown', { source: 'pointer' }); }
  };
  const onPointerUp = () => {
    if (primaryHeld) { primaryHeld = false; emit('primaryup', { source: 'pointer' }); }
  };
  const isPrimaryKey = (code) => code === 'Space' || code === 'Enter' || code === 'NumpadEnter';
  const onKeyDown = (e) => {
    if (e.target instanceof HTMLElement && e.target.closest('button, input, select, textarea')) return; // UI keeps its keys
    if (isPrimaryKey(e.code)) {
      e.preventDefault();
      if (!e.repeat && !primaryHeld) { primaryHeld = true; emit('primarydown', { source: 'key' }); }
      return;
    }
    keys.add(e.code);
    if (!e.repeat) emit('key', e);
  };
  const onKeyUp = (e) => {
    if (isPrimaryKey(e.code)) {
      if (primaryHeld) { primaryHeld = false; emit('primaryup', { source: 'key' }); }
      return;
    }
    keys.delete(e.code);
  };
  const onBlur = () => { keys.clear(); if (primaryHeld) { primaryHeld = false; emit('primaryup', { source: 'blur' }); } };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    on(type, fn) { listeners[type].push(fn); return () => listeners[type].splice(listeners[type].indexOf(fn), 1); },
    held: (...codes) => codes.some((c) => keys.has(c)),
    /** Where the pointer ray meets the goal plane, or null if the pointer hasn't moved yet. */
    pointerOnGoalPlane(out = new THREE.Vector3()) {
      if (!pointerSeen) return null;
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(goalPlane, out);
    },
    /** Forget the pointer (so keyboard aiming isn't overridden until the mouse moves again). */
    resetPointer() { pointerSeen = false; },
    dispose() {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
