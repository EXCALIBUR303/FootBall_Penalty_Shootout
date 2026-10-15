import * as THREE from 'three';

const _box = new THREE.Box3();
const _size = new THREE.Vector3();

/**
 * Wraps a loaded model in a group scaled to a real-world size and sitting on y = 0, centred on x/z.
 * This is what makes "drop in a different GLB" work regardless of the artist's units or origin.
 *
 * @param {THREE.Object3D} model
 * @param {'height'|'width'|'diameter'} axis which bounding-box dimension to match
 * @param {number} target size in metres
 */
export function fitModel(model, axis, target) {
  model.updateMatrixWorld(true);
  _box.setFromObject(model).getSize(_size);
  const current = axis === 'height' ? _size.y : axis === 'width' ? _size.x : Math.max(_size.x, _size.y, _size.z);
  const s = current > 0 ? target / current : 1;
  model.scale.multiplyScalar(s);
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  const c = _box.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= _box.min.y;
  const holder = new THREE.Group();
  holder.add(model);
  return holder;
}

export function enableShadows(root, { cast = true, receive = true } = {}) {
  root.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
}
