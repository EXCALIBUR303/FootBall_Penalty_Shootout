import * as THREE from 'three';

const ease = {
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  smooth: (a, b, x) => { const u = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); },
};
const clamp01 = (u) => THREE.MathUtils.clamp(u, 0, 1);

/** Kinematic collider spheres attached to keeper bones: [bone, radius in metres]. */
export const KEEPER_LIMBS = [
  ['hand_l', 0.13], ['hand_r', 0.13], // gloved hands are generous on purpose: saves should feel fair
  ['lowerarm_l', 0.09], ['lowerarm_r', 0.09],
  ['upperarm_l', 0.09], ['upperarm_r', 0.09],
  ['Head', 0.12], ['spine_03', 0.19], ['spine_01', 0.18], ['pelvis', 0.17],
  ['thigh_l', 0.11], ['thigh_r', 0.11], ['calf_l', 0.09], ['calf_r', 0.09], ['foot_l', 0.08], ['foot_r', 0.08],
];

/**
 * Goalkeeper controller: plays the authored clips and adds root motion (travel, rise, roll onto the side),
 * which the clips themselves don't contain. Facing +Z (towards the penalty spot).
 *
 *   root (placed on the goal line) → roll (pivot at hip height) → offset → model holder
 */
export class Keeper {
  /**
   * @param {THREE.Object3D} holder fitted model holder (see fitModel)
   * @param {THREE.Object3D} skinnedRoot the cloned GLTF scene inside holder (animation root)
   * @param {Map<string, THREE.AnimationClip>} clips
   */
  constructor(holder, skinnedRoot, clips, { height = 1.88 } = {}) {
    this.pivotH = height * 0.52; // hip height
    this.root = new THREE.Group();
    this.roll = new THREE.Group();
    this.offset = new THREE.Group();
    this.roll.position.y = this.pivotH;
    this.offset.position.y = -this.pivotH;
    this.root.add(this.roll);
    this.roll.add(this.offset);
    this.offset.add(holder);
    this.root.name = 'keeper';

    this.mixer = new THREE.AnimationMixer(skinnedRoot);
    this.actions = new Map([...clips].map(([name, clip]) => [name, this.mixer.clipAction(clip)]));
    this.bones = new Map();
    skinnedRoot.traverse((o) => { if (o.isBone) this.bones.set(o.name, o); });

    this.state = null; // current move { kind, side, reach, speed, t }
    this.current = null;
    this.home = new THREE.Vector3(0, 0, 0.35); // just off the line
    this.ready();
  }

  /** Back to the set position on the line. */
  ready() {
    this.state = null;
    this.root.position.copy(this.home);
    this.roll.rotation.set(0, 0, 0);
    this.offset.position.set(0, -this.pivotH, 0);
    this.play('GK_Ready', { loop: true, fade: 0.25 });
  }

  /**
   * Starts a save attempt.
   * @param {{ kind: 'low'|'high'|'block'|'jump', side?: 1|-1, reach?: number, speed?: number }} move
   *   side +1 dives towards +X (the keeper's left, the striker's right); reach is how far the hips travel;
   *   height is where the gloves should be (m).
   */
  dive({ kind, side = 1, reach = 1.4, speed = 1, height = kind === 'high' ? 1.9 : 0.5 }) {
    this.state = { kind, side, reach, speed, height, t: 0 };
    const clip =
      kind === 'low' ? (side > 0 ? 'GK_DiveLow_L' : 'GK_DiveLow_R')
      : kind === 'high' ? (side > 0 ? 'GK_DiveHigh_L' : 'GK_DiveHigh_R')
      : kind === 'block' ? 'GK_Block' : 'GK_Jump';
    this.play(clip, { loop: false, fade: 0.08, timeScale: speed });
  }

  /** Celebrate a save / react to a goal. Uses library clips when present. */
  react(kind) {
    if (kind === 'celebrate' && this.actions.has('Dance_Loop')) this.play('Dance_Loop', { loop: true, fade: 0.3 });
  }

  play(name, { loop, fade = 0.2, timeScale = 1 }) {
    const next = this.actions.get(name);
    if (!next) return;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.timeScale = timeScale;
    next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  update(dt) {
    this.mixer.update(dt);
    const s = this.state;
    if (!s) return;
    s.t += dt * s.speed;
    const t = s.t;
    let x = 0, y = 0, roll = 0;

    if (s.kind === 'low' || s.kind === 'high') {
      const high = s.kind === 'high';
      const Ts = high ? 0.45 : 0.42; // time to full stretch
      const u = clamp01((t - 0.08) / (Ts - 0.08)); // brief load before take-off
      x = s.side * s.reach * ease.out(u);
      const maxRoll = high ? 62 : 78;
      roll = -s.side * THREE.MathUtils.degToRad(maxRoll * ease.inOut(u) + (90 - maxRoll) * ease.smooth(Ts, Ts + 0.6, t));
      // Hips travel to a height that puts the gloves at the read ball height (gloves sit ~0.1 m above
      // the hips in a low dive, ~0.5 m in a high one), then the body comes down onto its side.
      const hipsY = high
        ? THREE.MathUtils.clamp(s.height - 0.5, 0.95, 1.75)
        : THREE.MathUtils.clamp(s.height - 0.1, 0.35, 0.95);
      const dy = hipsY - this.pivotH;
      const ground = 0.28 - this.pivotH; // hips resting on the grass
      const airborne = high ? Math.sin(Math.PI * 0.5 * u) : ease.out(u);
      const fall = ease.smooth(Ts * 0.95, Ts + (high ? 0.7 : 0.5), t);
      y = dy * airborne * (1 - fall) + ground * fall;
    } else if (s.kind === 'block') {
      y = -0.34 * ease.smooth(0, 0.22, t); // the crouch would lift the feet otherwise
      x = s.side * Math.min(s.reach, 0.4) * ease.smooth(0, 0.25, t);
    } else if (s.kind === 'jump') {
      const u = clamp01((t - 0.1) / 0.7);
      y = 0.55 * Math.sin(Math.PI * u);
      x = s.side * Math.min(s.reach, 0.3) * ease.out(clamp01(t / 0.4));
    }
    this.root.position.set(this.home.x + x, this.home.y + y, this.home.z);
    this.roll.rotation.z = roll;
  }

  /** World positions of the limb colliders (KEEPER_LIMBS). */
  limbPositions(out = new Map()) {
    for (const [bone] of KEEPER_LIMBS) {
      const b = this.bones.get(bone);
      if (!b) continue;
      const v = out.get(bone) ?? new THREE.Vector3();
      b.getWorldPosition(v);
      out.set(bone, v);
    }
    return out;
  }

  /** Midpoint between the gloves, used to hold a caught ball. */
  handsCentre(out = new THREE.Vector3()) {
    const l = this.bones.get('hand_l').getWorldPosition(new THREE.Vector3());
    const r = this.bones.get('hand_r').getWorldPosition(new THREE.Vector3());
    return out.addVectors(l, r).multiplyScalar(0.5);
  }
}
