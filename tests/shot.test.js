import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveShot, GOAL } from '../src/game/shot.js';
import { predictCrossing } from '../src/physics/aero.js';

const spot = { x: 0, y: 0.11, z: 11 };
const noErr = () => 0.5; // rand() = 0.5 -> zero wobble

for (const [power, curve] of [[0.3, 0], [0.7, 0], [0.7, 1], [0.7, -1], [0.9, 0.5]]) {
  test(`solver lands on target (power ${power}, curve ${curve})`, () => {
    const target = { x: 2.5, y: 1.6 };
    const { velocity, spin } = solveShot(spot, target, power, curve, noErr);
    const hit = predictCrossing(spot, velocity, spin, 0);
    assert.ok(hit.reached);
    assert.ok(Math.abs(hit.x - target.x) < 0.05, `x ${hit.x}`);
    assert.ok(Math.abs(hit.y - target.y) < 0.05, `y ${hit.y}`);
  });
}

test('curve bends the path: positive curve starts left of a straight shot', () => {
  const t = { x: 0, y: 1 };
  const straight = solveShot(spot, t, 0.7, 0, noErr).velocity;
  const bent = solveShot(spot, t, 0.7, 1, noErr).velocity;
  assert.ok(bent.x < straight.x - 0.3, 'must aim left to bend back right');
});

test('overpower skies the ball over the bar', () => {
  const { velocity, spin } = solveShot(spot, { x: 0, y: 2.0 }, 1, 0, noErr);
  const hit = predictCrossing(spot, velocity, spin, 0);
  assert.ok(hit.y > GOAL.height, `y ${hit.y}`);
});

test('flight time is penalty-realistic (0.35-0.9 s)', () => {
  for (const p of [0, 1]) {
    const { velocity, spin } = solveShot(spot, { x: 3, y: 1 }, p, 0, noErr);
    const hit = predictCrossing(spot, velocity, spin, 0);
    assert.ok(hit.t > 0.35 && hit.t < 0.9, `t ${hit.t}`);
  }
});
