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
  /**
   * Broadcast view from behind and to the right of the ball: striker on the left third, ball low centre,
   * whole goal and keeper in frame. Deliberately static — mouse aiming is a ray through this camera, so a
   * camera that followed the aim would feed back into it (it used to spin the view off the goal).
   */
  aim: (ball) => () => ({
    pos: v(ball.x + 1.0, 2.35, ball.z + 8.6),
    target: v(ball.x - 0.35, 1.05, 2.0),
    fov: 40,
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
  /**
   * After the kick. Both angles stay in FRONT of the goal line so the net is behind the action, never across
   * the lens: a goal is seen from the opposite side of the box looking into the corner the ball went in;
   * a save or miss side-on to the keeper.
   */
  reaction: (kind, ball) => (t) => {
    const side = ball.x >= 0 ? 1 : -1;
    return kind === 'goal'
      ? { pos: v(-side * 3.4 + ball.x * 0.25, 1.45 + t * 0.05, 6.2 - t * 0.25), target: v(ball.x * 0.75, Math.max(0.8, ball.y * 0.7), -0.4), fov: 38, stiffness: 3 }
      : { pos: v(6.5 - t * 0.4, 1.5, 3.5), target: v(0, 0.9, 0.3), fov: 40, stiffness: 3 };
  },
  /**
   * Player in goal: just inside the goal mouth, above and behind the keeper's head, looking out at the
   * striker. The crossbar frames the top of the shot; the net is behind the camera.
   */
  keeperView: () => () => ({ pos: v(0, 2.2, -1.05), target: v(0, 0.8, 11), fov: 56, stiffness: 5 }),
  /**
   * Replay angles, all clear of the net. `side` (±1) is the side the shot went to.
   *  'side'     broadcast sideline camera, level with the six-yard box, tracking the ball
   *  'goalline' low on the goal line beyond the far post: the ball comes across the lens into the corner
   *  'striker'  high behind the striker: the whole flight and the keeper's dive in one frame
   */
  replay: (angle, side, getBall) => () => {
    const b = getBall();
    if (angle === 'goalline') {
      return { pos: v(-side * 6.2, 0.75, 1.6), target: v(b.x * 0.7, Math.max(0.6, b.y * 0.85), Math.min(Math.max(b.z, 0), 8) * 0.6), fov: 40, stiffness: 6 };
    }
    if (angle === 'striker') {
      return { pos: v(-0.6, 3.1, 18.5), target: v(b.x * 0.35, 1.0, Math.min(b.z, 11) * 0.3), fov: 34, stiffness: 5 };
    }
    return { pos: v(-side * 9, 1.6, 6.5), target: v(b.x * 0.85, Math.max(0.7, b.y), Math.min(Math.max(b.z, 0.5), 9)), fov: 36, stiffness: 6 };
  },
};
