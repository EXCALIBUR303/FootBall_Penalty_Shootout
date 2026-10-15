import { predictCrossing, BALL } from '../physics/aero.js';

// Goal mouth (inside of posts / underside of bar) in pitch space. Goal line is z = 0.
export const GOAL = { halfWidth: 3.66, height: 2.44, postRadius: 0.06, depth: 2.0 };

export const SHOT = {
  minSpeed: 15, // m/s at 0% power: a gentle side-foot
  maxSpeed: 31, // m/s at 100% power: a hammered shot
  sweetSpot: 0.92, // power above this starts to sky the ball
  maxSpin: 48, // rad/s of sidespin at full curve
};

/**
 * Converts player intent (target on the goal plane, power, curve) into launch velocity and spin.
 * The target is where the ball should cross the goal line; curve changes the path, not the destination,
 * so the solver iterates on the actual flight model (drag + Magnus) until the predicted crossing hits it.
 * Overpower and timing error are applied *after* solving, so they show up as real misses.
 *
 * @param {{x:number,y:number,z:number}} ballPos
 * @param {{x:number,y:number}} target point on z = 0 (y is height)
 * @param {number} power 0..1
 * @param {number} curve -1..1 (positive bends towards +x, the shooter's right)
 * @param {() => number} rand random source (seeded in tests / replays)
 */
export function solveShot(ballPos, target, power, curve, rand = Math.random) {
  const speed = SHOT.minSpeed + (SHOT.maxSpeed - SHOT.minSpeed) * power;
  // ω × v with v ≈ (0,0,-s): ω = (0, wy, 0) gives force (-wy·s, 0, 0), so +x bend needs wy < 0.
  const spin = { x: -6 * power, y: -curve * SHOT.maxSpin, z: 0 }; // a little backspin keeps driven shots honest

  // Shooting method: adjust the aim point until the predicted crossing lands on target.
  let aim = { x: target.x, y: target.y };
  let vel = launchTowards(ballPos, aim, speed);
  for (let i = 0; i < 6; i++) {
    const hit = predictCrossing(ballPos, vel, spin, 0);
    if (!hit.reached) break;
    const ex = target.x - hit.x;
    const ey = target.y - hit.y;
    if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) break;
    aim = { x: aim.x + ex, y: aim.y + ey };
    vel = launchTowards(ballPos, aim, speed);
  }

  // Errors: overpower lifts the ball (up to ~1.6 m extra at 100%), and harder shots wobble more.
  const over = Math.max(0, power - SHOT.sweetSpot) / (1 - SHOT.sweetSpot);
  const wobble = 0.08 + 0.34 * power * power; // metres of random error at the goal line
  const errX = (rand() * 2 - 1) * wobble;
  const errY = (rand() * 2 - 1) * wobble * 0.6 + over * 1.6;
  if (errX || errY) vel = launchTowards(ballPos, { x: aim.x + errX, y: aim.y + errY }, speed);

  return { velocity: vel, spin, speed };
}

/**
 * Initial velocity of magnitude `speed` from p towards the vertical target (x, y, 0), compensating for
 * gravity only (drag/Magnus are handled by the iterative solve). Picks the low (direct) trajectory.
 */
function launchTowards(p, aim, speed) {
  const dx = aim.x - p.x;
  const dz = 0 - p.z;
  const d = Math.hypot(dx, dz); // horizontal distance
  const dy = aim.y - p.y;
  const g = 9.81;
  // Projectile angle for reaching (d, dy) at speed s: tanθ = (s² − √(s⁴ − g(g d² + 2 dy s²))) / (g d)
  const s2 = speed * speed;
  const disc = s2 * s2 - g * (g * d * d + 2 * dy * s2);
  const theta = disc >= 0 ? Math.atan((s2 - Math.sqrt(disc)) / (g * d)) : Math.PI / 4; // out of range: max distance
  const h = Math.cos(theta) * speed;
  return { x: (dx / d) * h, y: Math.sin(theta) * speed, z: (dz / d) * h };
}

/** Is a ball centre at (x, y) on the goal-line plane inside the goal mouth? (whole-ball rule handled by caller) */
export const insideMouth = (x, y) => Math.abs(x) < GOAL.halfWidth - BALL.radius * 0.5 && y < GOAL.height;
