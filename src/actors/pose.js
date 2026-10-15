import * as THREE from 'three';

// Authoring keyframed clips for the imported Quaternius rig.
//
// The free Universal Animation Library has no dive, parry or kick, so those clips are written here as
// data. Rotations are given in *character space* (X = character's left, Y = up, Z = forward, i.e. the
// model faces +Z) relative to the rig's rest pose (a T-pose), which is far easier to reason about than
// each bone's own local axes. At build time every rotation is converted into the bone's local frame:
//
//   q_local = P⁻¹ · R · P · q_rest     where P is the parent's rest rotation in character space.
//
// A spec looks like:  { name, duration, keys: [ { t: 0.2, pose: { upperarm_l: [['z', 70]], ... } } ] }
// Each bone entry is a list of [axis, degrees] rotations applied in order.

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/**
 * @param {THREE.Object3D} characterRoot the GLTF scene (character space)
 * @param {object} spec clip spec (see above)
 * @param {{ mirror?: boolean, name?: string }} opts mirror swaps _l/_r bones and reflects rotations across
 *   the YZ plane (turning a dive to the keeper's left into one to his right)
 */
export function buildClip(characterRoot, spec, { mirror = false, name = spec.name } = {}) {
  const rest = restFrames(characterRoot);
  const bones = new Set(spec.keys.flatMap((k) => Object.keys(k.pose)));
  const tracks = [];
  for (const authored of bones) {
    const boneName = mirror ? swapSide(authored) : authored;
    const info = rest.get(boneName);
    if (!info) continue; // tolerate rigs without this bone
    const times = [];
    const values = [];
    for (const key of spec.keys) {
      const rot = key.pose[authored];
      // A bone missing from a key returns to rest at that key.
      const q = localFromCharacterSpace(info, rot ? rot : [], mirror);
      times.push(key.t);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${info.node.name}.quaternion`, times, values));
  }
  return new THREE.AnimationClip(name, spec.duration, tracks);
}

const swapSide = (n) => (n.endsWith('_l') ? n.slice(0, -2) + '_r' : n.endsWith('_r') ? n.slice(0, -2) + '_l' : n);

// Rest-pose rotations of every bone and of its parent, both expressed in character space.
const restCache = new WeakMap();
function restFrames(root) {
  if (restCache.has(root)) return restCache.get(root);
  const map = new Map();
  const rootInv = new THREE.Quaternion();
  root.updateMatrixWorld(true);
  root.getWorldQuaternion(rootInv).invert();
  root.traverse((node) => {
    if (!node.isBone) return;
    const parentQ = new THREE.Quaternion();
    node.parent.getWorldQuaternion(parentQ);
    parentQ.premultiply(rootInv); // parent rotation in character space
    map.set(node.name, { node, rest: node.quaternion.clone(), parentQ });
  });
  restCache.set(root, map);
  return map;
}

const _r = new THREE.Quaternion();
const _a = new THREE.Quaternion();
function localFromCharacterSpace(info, rotations, mirror) {
  // R = product of the authored character-space rotations
  _r.identity();
  for (const [axis, deg] of rotations) {
    // Mirroring across the YZ plane keeps rotations about X and flips those about Y and Z.
    const sign = mirror && axis !== 'x' ? -1 : 1;
    _a.setFromAxisAngle(AXES[axis], THREE.MathUtils.degToRad(deg * sign));
    _r.premultiply(_a);
  }
  // q_local = P⁻¹ R P q_rest
  const p = info.parentQ;
  return p.clone().invert().multiply(_r).multiply(p).multiply(info.rest);
}
