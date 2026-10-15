import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Director, SHOTS } from '../src/camera/director.js';

const spot = new THREE.Vector3(0, 0.11, 11);

test('camera springs stay bounded and settle even with very long frames', () => {
  for (const dt of [1 / 60, 0.1, 0.2, 0.4]) {
    const cam = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 500);
    const d = new Director(cam);
    d.cut(SHOTS.aim(spot), { cut: true });
    d.cut(SHOTS.follow(() => new THREE.Vector3(3, 2, 0.5))); // stiff shot, big move
    let maxDist = 0;
    for (let i = 0; i < 120; i++) { d.update(dt); maxDist = Math.max(maxDist, cam.position.length()); }
    assert.ok(maxDist < 40, `camera left the stadium at dt=${dt} (|pos| reached ${maxDist.toFixed(1)})`);
    const want = SHOTS.follow(() => new THREE.Vector3(3, 2, 0.5))(0).pos;
    assert.ok(cam.position.distanceTo(want) < 0.05, `camera did not settle at dt=${dt}`);
  }
});

test('the keeper view sits inside the goal mouth, in front of the net', () => {
  const { pos } = SHOTS.keeperView()(0);
  assert.ok(pos.z < 0 && pos.z > -1.5, 'between the goal line and the back of the net');
  assert.ok(Math.abs(pos.x) < 3.66 && pos.y < 2.44, 'inside the posts and under the bar');
});

test('replay and goal-reaction cameras never sit behind the goal line', () => {
  const ball = () => new THREE.Vector3(2.8, 1.6, -0.6);
  for (const angle of ['side', 'goalline', 'striker']) {
    for (const side of [1, -1]) assert.ok(SHOTS.replay(angle, side, ball)(0).pos.z > 0, `${angle} replay`);
  }
  assert.ok(SHOTS.reaction('goal', ball())(0).pos.z > 0);
  assert.ok(SHOTS.reaction('save', ball())(0).pos.z > 0);
});
