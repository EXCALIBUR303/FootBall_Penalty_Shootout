import * as THREE from 'three';

/**
 * Camera director: each shot is a function returning where the camera wants to be this frame
 * ({ pos, target, fov }). The director chases that with critically-damped springs, so cuts between
 * shots become smooth moves — or hard cuts when reduced motion is on or a shot asks for one.
 */
export class Director {
  constructor(camera) {
    this.camera = camera;
    this.pos = camera.position.clone();
    this.target = new THREE.Vector3(0, 1, 0);
    this.fov = camera.fov;
    this.vel = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 0 };
    this.shot = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.shake = 0;
  }

  /**
   * @param {(t: number) => { pos: THREE.Vector3, target: THREE.Vector3, fov?: number, stiffness?: number }} shot
   * @param {{ cut?: boolean }} opts
   */
  cut(shot, { cut = false } = {}) {
    this.shot = { fn: shot, t: 0 };
    if (cut || this.reducedMotion) {
      const want = shot(0);
      this.pos.copy(want.pos);
      this.target.copy(want.target);
      this.fov = want.fov ?? this.fov;
      this.vel.pos.set(0, 0, 0);
      this.vel.target.set(0, 0, 0);
      this.vel.fov = 0;
    }
  }

  addShake(amount) { if (!this.reducedMotion) this.shake = Math.max(this.shake, amount); }

  update(dt) {
    if (!this.shot) return;
    this.shot.t += dt;
    const want = this.shot.fn(this.shot.t);
    // Critically damped spring towards the wanted values; higher stiffness = snappier tracking.
    const k = want.stiffness ?? 6;
    spring(this.pos, want.pos, this.vel.pos, k, dt);
    spring(this.target, want.target, this.vel.target, k * 1.4, dt);
    const fovWant = want.fov ?? this.fov;
    const a = k * k * (fovWant - this.fov) - 2 * k * this.vel.fov;
    this.vel.fov += a * dt;
    this.fov += this.vel.fov * dt;

    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-8 * dt);
    }
    cam.lookAt(this.target);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}

const _d = new THREE.Vector3();
function spring(value, goal, vel, k, dt) {
  // x'' = k²(goal − x) − 2k x'  (critical damping); semi-implicit Euler is stable at these rates
  _d.subVectors(goal, value).multiplyScalar(k * k).addScaledVector(vel, -2 * k);
  vel.addScaledVector(_d, dt);
  value.addScaledVector(vel, dt);
}

// --- Shots -------------------------------------------------------------------------------------
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const SHOTS = {
  /** Broadcast view behind the ball while aiming; drifts slightly with the aim point. */
  aim: (ball, aim) => () => ({
    pos: v(ball.x * 0.5 + aim.x * 0.08, 1.75, ball.z + 6.2),
    target: v(aim.x * 0.12, 1.15, 0),
    fov: 45,
    stiffness: 4,
  }),
  /** Run-up: low angle from the striker's left, slowly pushing in. */
  runUp: (ball) => (t) => ({
    pos: v(ball.x - 4.2 + Math.min(t, 1.3) * 0.9, 1.15, ball.z + 2.6 - Math.min(t, 1.3) * 0.6),
    target: v(ball.x - 0.2, 0.7, ball.z - 1),
    fov: 42 - Math.min(t, 1.3) * 3,
    stiffness: 5,
  }),
  /** Follows the ball in flight, then holds a goal-mouth framing as it arrives. */
  follow: (getBall) => () => {
    const b = getBall();
    const near = b.z < 5;
    return {
      pos: near ? v(b.x * 0.35, 1.7, 6.0) : v(b.x * 0.6, Math.max(1.2, b.y + 0.8), b.z + 3.5),
      target: near ? v(b.x * 0.7, Math.max(0.9, b.y * 0.8), b.z) : v(b.x, b.y, b.z - 4),
      fov: near ? 40 : 48,
      stiffness: near ? 4 : 9,
    };
  },
  /** Goal: reverse angle from behind the net. Save/miss: side-on to the keeper. */
  reaction: (kind, ball) => (t) =>
    kind === 'goal'
      ? { pos: v(ball.x * 0.4 + 1.2, 1.9 + t * 0.1, -7.5 + t * 0.6), target: v(ball.x * 0.6, 1.0, 1.0), fov: 42, stiffness: 3 }
      : { pos: v(6.5 - t * 0.4, 1.5, 3.5), target: v(0, 0.9, 0.3), fov: 40, stiffness: 3 },
  /**
   * Replay cameras. 'side': low, wide angle from the side of the penalty area, following the ball.
   * 'behind': from behind the goal line looking back up the pitch, so the ball flies at the lens.
   * `side` (±1) is the side the shot went to.
   */
  replay: (angle, side, getBall) => () => {
    const b = getBall();
    if (angle === 'behind') {
      return { pos: v(-side * 2.4, 1.4, -6.5), target: v(b.x * 0.6, Math.max(0.8, b.y * 0.8), Math.min(Math.max(b.z, -1), 9)), fov: 44, stiffness: 6 };
    }
    return { pos: v(-side * 9, 1.5, 6.5), target: v(b.x * 0.85, Math.max(0.7, b.y), Math.min(Math.max(b.z, 0.5), 9)), fov: 36, stiffness: 6 };
  },
  /** Player in goal: just behind the keeper, looking out at the striker. */
  keeperView: () => () => ({ pos: v(0, 1.85, -3.2), target: v(0, 1.0, 11), fov: 52, stiffness: 5 }),
};
