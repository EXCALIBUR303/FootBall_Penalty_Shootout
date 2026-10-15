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
    this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    [this.fov, this.vel.fov] = spring1(this.fov, want.fov ?? this.fov, this.vel.fov, k, dt);

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

/**
 * Critically damped spring x'' = k²(goal − x) − 2k x', advanced with its exact solution, so it is stable for
 * any frame time. (The old semi-implicit Euler step blew up once k·dt passed ~2 — at a low frame rate the
 * camera was flung out of the stadium and rendered a black frame.)
 */
function spring1(x, goal, v, k, dt) {
  const e = Math.exp(-k * dt);
  const c = x - goal;
  const t = (v + k * c) * dt;
  return [goal + (c + t) * e, (v - k * t) * e];
}
function spring(value, goal, vel, k, dt) {
  for (const a of ['x', 'y', 'z']) [value[a], vel[a]] = spring1(value[a], goal[a], vel[a], k, dt);
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
  /**
   * Run-up: over the striker's left shoulder, looking down the pitch at the goal, slowly pushing in. Same
   * general direction as the aim and follow shots, so the cuts between them never swing the view away from
   * the striker, ball and goal (the old side-on angle ended up framing empty grass at the strike).
   */
  runUp: (ball) => (t) => {
    const u = Math.min(t, 1.2) / 1.2;
    return {
      pos: v(ball.x - 2.5 + u * 0.6, 1.55 - u * 0.15, ball.z + 5.2 - u * 1.2),
      target: v(ball.x * 0.4 + 0.1, 0.95, 3.5),
      fov: 36 - u * 2,
      stiffness: 5,
    };
  },
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
  reaction: (kind, ball, keeperX = 0) => (t) => {
    const side = ball.x >= 0 ? 1 : -1;
    if (kind === 'goal') {
      return { pos: v(-side * 3.4 + ball.x * 0.25, 1.45 + t * 0.05, 6.2 - t * 0.25), target: v(ball.x * 0.75, Math.max(0.8, ball.y * 0.7), -0.4), fov: 38, stiffness: 3 };
    }
    // Save or miss: the same front-diagonal, centred on the keeper (who may be lying on either side).
    const k = THREE.MathUtils.clamp(keeperX, -3, 3);
    const kside = k >= 0 ? 1 : -1;
    return { pos: v(-kside * 2.8 + k * 0.4, 1.35 + t * 0.05, 6.6 - t * 0.25), target: v(k * 0.85, 0.7, 0.2), fov: 40, stiffness: 3 };
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
      // Low, just in front of the line beyond the far post, looking across the goal mouth: the keeper
      // dives towards the lens and the ball arrives from the right of frame. Eases onto the ball late on.
      const near = THREE.MathUtils.clamp(1 - b.z / 6, 0, 1);
      return {
        pos: v(-side * 7.2, 1.05, 1.9),
        target: v(side * 1.2 * (1 - near) + b.x * near, 1.0 + (b.y - 1.0) * near * 0.6, 2.2 * (1 - near) + Math.max(b.z, 0) * near),
        fov: 36,
        stiffness: 5,
      };
    }
    if (angle === 'striker') {
      return { pos: v(-0.6, 3.1, 18.5), target: v(b.x * 0.35, 1.0, Math.min(b.z, 11) * 0.3), fov: 34, stiffness: 5 };
    }
    return { pos: v(-side * 9, 1.6, 6.5), target: v(b.x * 0.85, Math.max(0.7, b.y), Math.min(Math.max(b.z, 0.5), 9)), fov: 36, stiffness: 6 };
  },
};
