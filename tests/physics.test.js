import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhysics } from '../src/physics/world.js';
import { solveShot, GOAL } from '../src/game/shot.js';
import { predictCrossing, BALL } from '../src/physics/aero.js';

const spot = { x: 0, y: BALL.radius, z: 11 };
const noErr = () => 0.5;

/** Runs a shot for `seconds`, returning the ball trace and events. */
async function run(target, power, curve, seconds = 2.5) {
  const events = [];
  const phys = await createPhysics({ onEvent: (e) => events.push(e.type) });
  phys.resetBall();
  const { velocity, spin } = solveShot(spot, target, power, curve, noErr);
  phys.kick(velocity, spin);
  const trace = [];
  for (let i = 0; i < seconds * 120; i++) {
    phys.step();
    const p = phys.ball.translation();
    trace.push({ x: p.x, y: p.y, z: p.z });
  }
  phys.dispose();
  return { trace, events, velocity, spin };
}

const crossedLine = (trace) => trace.find((p) => p.z < -(GOAL.postRadius + BALL.radius));

test('Rapier flight matches the predictor at the goal line (within 12 cm)', async () => {
  for (const curve of [0, 1, -1]) {
    const target = { x: 2, y: 1.2 };
    const { trace, velocity, spin } = await run(target, 0.6, curve, 1);
    const pred = predictCrossing(spot, velocity, spin, 0);
    const i = trace.findIndex((p) => p.z <= 0);
    const a = trace[i - 1], b = trace[i];
    const t = a.z / (a.z - b.z);
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    assert.ok(Math.hypot(x - pred.x, y - pred.y) < 0.12, `curve ${curve}: sim (${x.toFixed(2)},${y.toFixed(2)}) vs pred (${pred.x.toFixed(2)},${pred.y.toFixed(2)})`);
  }
});

test('a shot into the corner is a goal and stays in the net', async () => {
  const { trace, events } = await run({ x: 2.8, y: 1.0 }, 0.8, 0);
  assert.ok(crossedLine(trace), 'ball must cross the line');
  const end = trace.at(-1);
  assert.ok(end.z < 0 && end.z > -GOAL.depth - 0.2, `ball should rest in the goal, z=${end.z.toFixed(2)}`);
  assert.ok(events.includes('net'));
});

test('a hard (92%, ~30 m/s) shot at the post bounces out (CCD, no tunnelling)', async () => {
  // Aim at the centre of the right post at 31 m/s.
  const { trace, events } = await run({ x: GOAL.halfWidth + GOAL.postRadius, y: 1.0 }, 0.92, 0, 1.2);
  assert.ok(events.includes('post'), `events: ${events}`);
  assert.ok(!crossedLine(trace.filter((p) => Math.abs(p.x) < GOAL.halfWidth)), 'must not be a goal');
});

test('a shot at the bar hits the bar', async () => {
  const { events } = await run({ x: 0.5, y: GOAL.height + GOAL.postRadius }, 0.7, 0, 1.2);
  assert.ok(events.includes('bar'), `events: ${events}`);
});

test('a shot wide misses and never enters the goal', async () => {
  const { trace } = await run({ x: 5, y: 1 }, 0.7, 0);
  assert.ok(!trace.some((p) => p.z < -0.2 && Math.abs(p.x) < GOAL.halfWidth));
});
