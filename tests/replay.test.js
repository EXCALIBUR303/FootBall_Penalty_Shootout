import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Recorder } from '../src/game/replay.js';

function rig() {
  const root = new THREE.Group();
  const child = new THREE.Object3D();
  root.add(child);
  return { root, child };
}

test('apply() interpolates position and rotation between frames', () => {
  const { root, child } = rig();
  const rec = new Recorder([root], { maxSeconds: 2, fps: 10 });
  root.position.set(0, 0, 0); child.quaternion.identity(); rec.record(0);
  root.position.set(10, 0, 0); child.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); rec.record(1);
  rec.apply(0.5);
  assert.ok(Math.abs(root.position.x - 5) < 1e-5);
  const half = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
  assert.ok(child.quaternion.angleTo(half) < 1e-3);
});

test('apply() clamps to the clip and survives an empty recorder', () => {
  const { root } = rig();
  const rec = new Recorder([root]);
  rec.apply(1); // nothing recorded: must not throw
  root.position.x = 1; rec.record(0);
  root.position.x = 2; rec.record(0.5);
  rec.apply(-3); assert.equal(root.position.x, 1);
  rec.apply(99); assert.equal(root.position.x, 2);
});

test('marks remember when they were set, clear() resets', () => {
  const { root } = rig();
  const rec = new Recorder([root]);
  rec.record(0); rec.record(0.4);
  rec.mark('strike');
  assert.ok(Math.abs(rec.marks.strike - 0.4) < 1e-6); // times are stored as float32
  rec.clear();
  assert.equal(rec.count, 0);
  assert.equal(rec.marks.strike, undefined);
});

test('a full clip stops recording instead of overflowing', () => {
  const { root } = rig();
  const rec = new Recorder([root], { maxSeconds: 1, fps: 4 }); // 4 frames
  for (let i = 0; i < 10; i++) rec.record(i * 0.1);
  assert.equal(rec.count, 4);
});
