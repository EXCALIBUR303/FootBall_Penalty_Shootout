import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GOAL } from '../game/shot.js';

/**
 * Painted pitch markings around the goal we play on, to Laws of the Game dimensions (metres, pitch space:
 * goal line z = 0, field towards +z). The projected stadium photo has no lines at our end, so without these
 * the penalty spot and box are invisible. They are paint, not props: thin flat strips merged into one mesh
 * (one draw call) that receive the players' shadows.
 */
export const MARKINGS = {
  line: 0.12, // line width
  halfWidth: 34, // goal line runs the width of a 68 m pitch
  goalArea: { depth: 5.5, halfWidth: GOAL.halfWidth + 5.5 },
  penaltyArea: { depth: 16.5, halfWidth: GOAL.halfWidth + 16.5 },
  spot: { z: 11, radius: 0.11 },
  arcRadius: 9.15,
};

export function addPitchMarkings(scene) {
  const M = MARKINGS;
  const w = M.line;
  const parts = [];
  const strip = (x0, z0, x1, z1) => parts.push(stripGeometry(x0, z0, x1, z1, w));

  strip(-M.halfWidth, 0, M.halfWidth, 0); // goal line (centred on the posts)
  for (const box of [M.goalArea, M.penaltyArea]) {
    const x = box.halfWidth, z = box.depth;
    strip(-x, 0, -x, z + w / 2);
    strip(x, 0, x, z + w / 2);
    strip(-x - w / 2, z, x + w / 2, z);
  }
  // Penalty mark and the arc of the penalty area (only the part outside the box is painted).
  parts.push(new THREE.CircleGeometry(M.spot.radius, 24).rotateX(-Math.PI / 2).translate(0, 0, M.spot.z));
  const outside = Math.acos((M.penaltyArea.depth - M.spot.z) / M.arcRadius); // half-angle of the visible arc
  parts.push(arcGeometry(0, M.spot.z, M.arcRadius, w, -outside, outside));

  const geometry = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  const material = new THREE.MeshStandardMaterial({
    name: 'pitch_lines',
    color: 0xdfe5d8, // chalk white, a touch green from the grass under it (pure white glows next to the photo)
    roughness: 1,
    metalness: 0,
    envMapIntensity: 0.6,
    side: THREE.DoubleSide, // strips are built facing up, but the arc's winding is not worth fussing over
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const lines = new THREE.Mesh(geometry, material);
  lines.name = 'pitch-markings';
  lines.position.y = 0.004; // just above the shadow-catcher floor
  lines.receiveShadow = true;
  lines.renderOrder = 0;
  scene.add(lines);
  return lines;
}

/** Flat rectangle of width w from (x0, z0) to (x1, z1), lying on y = 0, facing up. */
function stripGeometry(x0, z0, x1, z1, w) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const g = new THREE.PlaneGeometry(len, w);
  g.rotateX(-Math.PI / 2);
  g.rotateY(-Math.atan2(dz, dx));
  g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  return g;
}

/** Ring segment centred at (cx, cz), angles measured from +z towards +x. */
function arcGeometry(cx, cz, r, w, a0, a1, segments = 48) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    const sx = Math.sin(a), sz = Math.cos(a);
    pos.push(cx + sx * (r - w / 2), 0, cz + sz * (r - w / 2), cx + sx * (r + w / 2), 0, cz + sz * (r + w / 2));
    if (i < segments) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normals must point up for lighting regardless of winding.
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}
