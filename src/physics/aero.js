// Ball aerodynamics shared by the Rapier simulation and the trajectory predictor.
// Rapier has no air model, so each physics step adds quadratic drag and a Magnus (spin) force.
// Keeping the formulas here means the shot solver and keeper AI predict exactly what the physics does.

export const BALL = {
  radius: 0.11, // m (size-5 ball, 68-70 cm circumference)
  mass: 0.43, // kg
};

const AIR_DENSITY = 1.2; // kg/m³
const DRAG_COEFF = 0.25; // a struck football is in the low-drag regime
const AREA = Math.PI * BALL.radius * BALL.radius;

/** Quadratic drag factor: F = -K_DRAG · |v| · v */
export const K_DRAG = 0.5 * AIR_DENSITY * DRAG_COEFF * AREA;

/**
 * Magnus factor: F = K_MAGNUS · (ω × v).
 * Tuned so ~45 rad/s of sidespin at ~25 m/s bends the ball about 1.5 m over a penalty (11 m).
 */
export const K_MAGNUS = 0.0021;

/** Spin decays slowly in the air (air torque); per-second multiplier. */
export const SPIN_DECAY_PER_S = 0.9;

export const GRAVITY = -9.81;

/**
 * Air force on the ball for velocity v and angular velocity w (plain {x,y,z} objects), written to `out`.
 * @returns {{x:number,y:number,z:number}}
 */
export function airForce(v, w, out = { x: 0, y: 0, z: 0 }) {
  const speed = Math.hypot(v.x, v.y, v.z);
  // drag
  out.x = -K_DRAG * speed * v.x;
  out.y = -K_DRAG * speed * v.y;
  out.z = -K_DRAG * speed * v.z;
  // Magnus: ω × v
  out.x += K_MAGNUS * (w.y * v.z - w.z * v.y);
  out.y += K_MAGNUS * (w.z * v.x - w.x * v.z);
  out.z += K_MAGNUS * (w.x * v.y - w.y * v.x);
  return out;
}

/**
 * Integrates a free flight (no collisions) until the ball reaches plane z = zPlane or `maxT` passes.
 * Semi-implicit Euler at the physics rate, so it matches Rapier's integrator closely.
 *
 * @param {{x,y,z}} p0 start position
 * @param {{x,y,z}} v0 start velocity
 * @param {{x,y,z}} w0 spin (rad/s)
 * @returns {{ x:number, y:number, z:number, t:number, reached:boolean, vz:number }} where/when it crossed zPlane
 */
export function predictCrossing(p0, v0, w0, zPlane = 0, dt = 1 / 120, maxT = 3) {
  const p = { ...p0 };
  const v = { ...v0 };
  const w = { ...w0 };
  const f = { x: 0, y: 0, z: 0 };
  const spinDecay = Math.pow(SPIN_DECAY_PER_S, dt);
  for (let t = 0; t < maxT; t += dt) {
    airForce(v, w, f);
    v.x += (f.x / BALL.mass) * dt;
    v.y += (f.y / BALL.mass + GRAVITY) * dt;
    v.z += (f.z / BALL.mass) * dt;
    const pz = p.z;
    p.x += v.x * dt;
    p.y += v.y * dt;
    p.z += v.z * dt;
    w.x *= spinDecay; w.y *= spinDecay; w.z *= spinDecay;
    // Bounce off the ground in prediction too (low driven shots), with the same restitution as Rapier.
    if (p.y < BALL.radius && v.y < 0) { p.y = BALL.radius; v.y = -v.y * 0.55; v.x *= 0.85; v.z *= 0.85; }
    if ((pz - zPlane) * (p.z - zPlane) <= 0) {
      // interpolate to the plane for sub-step accuracy
      const a = (pz - zPlane) / (pz - p.z || 1);
      return { x: p.x - v.x * dt * (1 - a), y: p.y - v.y * dt * (1 - a), z: zPlane, t: t + dt * a, reached: true, vz: v.z };
    }
  }
  return { ...p, t: maxT, reached: false, vz: v.z };
}
