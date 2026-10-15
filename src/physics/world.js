import RAPIER from '@dimforge/rapier3d-compat';
import { BALL, airForce, SPIN_DECAY_PER_S, GRAVITY } from './aero.js';
import { GOAL } from '../game/shot.js';

export const STEP = 1 / 120; // fixed physics rate; rendering interpolates between steps

/**
 * Rapier world for the shootout: pitch, goal frame (posts, bar), net walls, the ball and the keeper's
 * kinematic limb colliders. All colliders here are invisible physics proxies — the visuals are the GLBs.
 *
 * Events reported through `onEvent`: { type: 'post'|'bar'|'net'|'keeper'|'ground', speed }.
 */
export async function createPhysics({ onEvent = () => {} } = {}) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: GRAVITY, z: 0 });
  world.timestep = STEP;
  const events = new RAPIER.EventQueue(true);
  const tag = new Map(); // collider handle -> label

  const fixed = (desc, label, x, y, z, rot) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    if (rot) body.setRotation(rot, false);
    const c = world.createCollider(desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    tag.set(c.handle, label);
    return c;
  };

  // Pitch: grass takes a lot of energy out of a bounce and grips the ball.
  fixed(RAPIER.ColliderDesc.cuboid(60, 0.5, 60).setRestitution(0.55).setFriction(0.8), 'ground', 0, -0.5, 0);

  // Goal frame. Posts sit on the goal line (z = 0); 12 cm diameter, inside edges at ±3.66 m.
  const r = GOAL.postRadius;
  const postX = GOAL.halfWidth + r;
  const postH = GOAL.height + r; // posts run up to the top of the bar
  const woodwork = (d) => d.setRestitution(0.7).setFriction(0.3);
  fixed(woodwork(RAPIER.ColliderDesc.cylinder(postH / 2, r)), 'post', -postX, postH / 2, 0);
  fixed(woodwork(RAPIER.ColliderDesc.cylinder(postH / 2, r)), 'post', postX, postH / 2, 0);
  // Bar: a Y-aligned cylinder rotated 90° about Z to lie along X.
  const s = Math.SQRT1_2;
  fixed(woodwork(RAPIER.ColliderDesc.cylinder(postX, r)), 'bar', 0, GOAL.height + r, 0, { x: 0, y: 0, z: s, w: s });

  // Net: thin walls behind the line. Restitution 0 with "Min" combine so the ball dies in the net
  // instead of bouncing back out; extra damping is added while the ball is inside (see step()).
  const net = (hx, hy, hz) =>
    RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setRestitution(0)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setFriction(1);
  const d = GOAL.depth;
  const netH = GOAL.height + 2 * r;
  fixed(net(postX, netH / 2, 0.02), 'net', 0, netH / 2, -d - 0.02); // back
  fixed(net(0.02, netH / 2, d / 2), 'net', -postX - 0.02, netH / 2, -d / 2); // left side
  fixed(net(0.02, netH / 2, d / 2), 'net', postX + 0.02, netH / 2, -d / 2); // right side
  fixed(net(postX, 0.02, d / 2), 'net', 0, netH + 0.02, -d / 2 - r); // roof

  // Ball: CCD so a 30 m/s shot can't tunnel through a 12 cm post in one step.
  const ballBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, BALL.radius, 11).setCcdEnabled(true).setAngularDamping(0.4),
  );
  const ballCollider = world.createCollider(
    RAPIER.ColliderDesc.ball(BALL.radius)
      .setMass(BALL.mass)
      .setRestitution(0.6)
      .setFriction(0.6)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    ballBody,
  );
  tag.set(ballCollider.handle, 'ball');

  // Keeper limbs: kinematic balls driven from the animated skeleton every step.
  const limbs = new Map(); // name -> body
  function setKeeperLimbs(defs) {
    for (const [name, radius] of defs) {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -10, 0));
      const c = world.createCollider(
        RAPIER.ColliderDesc.ball(radius).setRestitution(0.35).setFriction(0.9).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      tag.set(c.handle, 'keeper');
      limbs.set(name, body);
    }
  }
  /** Moves limb colliders to positions sampled from the skeleton (Map name -> THREE.Vector3). */
  function driveKeeperLimbs(positions) {
    for (const [name, p] of positions) limbs.get(name)?.setNextKinematicTranslation(p);
  }

  const force = { x: 0, y: 0, z: 0 };
  const spinDecay = Math.pow(SPIN_DECAY_PER_S, STEP);
  let inFlight = false;

  function step() {
    const v = ballBody.linvel();
    const w = ballBody.angvel();
    const p = ballBody.translation();
    ballBody.resetForces(true);
    if (inFlight && p.y > BALL.radius + 0.01) {
      airForce(v, w, force);
      ballBody.addForce(force, true);
      ballBody.setAngvel({ x: w.x * spinDecay, y: w.y * spinDecay, z: w.z * spinDecay }, true);
    }
    // Inside the goal the net soaks up energy (a real net gives, our walls don't).
    if (p.z < -GOAL.postRadius && Math.abs(p.x) < GOAL.halfWidth + 0.2 && p.y < GOAL.height + 0.3) {
      ballBody.setLinvel({ x: v.x * 0.985, y: v.y, z: v.z * 0.985 }, true);
    }
    world.step(events);
    events.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const a = tag.get(h1);
      const b = tag.get(h2);
      if (a !== 'ball' && b !== 'ball') return;
      const other = a === 'ball' ? b : a;
      const lv = ballBody.linvel();
      onEvent({ type: other, speed: Math.hypot(lv.x, lv.y, lv.z) });
    });
  }

  return {
    RAPIER,
    world,
    step,
    ball: ballBody,
    setKeeperLimbs,
    driveKeeperLimbs,
    /** Places the ball on a spot, at rest. */
    resetBall(x = 0, z = 11) {
      inFlight = false;
      ballBody.setTranslation({ x, y: BALL.radius, z }, true);
      ballBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
    kick(velocity, spin) {
      inFlight = true;
      ballBody.setLinvel(velocity, true);
      ballBody.setAngvel(spin, true);
    },
    dispose() {
      events.free();
      world.free();
    },
  };
}
