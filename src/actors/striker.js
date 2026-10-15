import * as THREE from 'three';
import { KICK_CONTACT } from './clips.js';

/**
 * Striker controller: stands behind the ball, jogs in on an angle and plays the authored kick.
 * `onContact` fires once, at the frame the boot meets the ball.
 */
export class Striker {
  constructor(holder, skinnedRoot, clips) {
    this.root = new THREE.Group();
    this.root.name = 'striker';
    this.root.add(holder);
    this.mixer = new THREE.AnimationMixer(skinnedRoot);
    this.actions = new Map([...clips].map(([name, clip]) => [name, this.mixer.clipAction(clip)]));
    this.current = null;
    this.run = null;
  }

  /** Stand at the start of the run-up, facing the ball. */
  setUp(ball) {
    this.run = null;
    const start = this.startPoint(ball);
    this.root.position.copy(start);
    this.face(ball);
    this.play('Idle_Loop', true);
  }

  // Right-footed: approach from the left at ~30°, plant the left foot beside the ball.
  startPoint(ball) { return new THREE.Vector3(ball.x - 1.5, 0, ball.z + 2.6); }
  plantPoint(ball) { return new THREE.Vector3(ball.x - 0.32, 0, ball.z + 0.42); }

  face(target) {
    this.root.rotation.y = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
  }

  /** @param {THREE.Vector3} ball  @param {() => void} onContact  @param {number} duration jog time (s) */
  runUp(ball, onContact, duration = 1.0) {
    const from = this.startPoint(ball);
    const to = this.plantPoint(ball);
    this.run = { from, to, ball: ball.clone(), t: 0, duration, kicking: false, contacted: false, onContact };
    this.root.position.copy(from);
    this.face(ball);
    this.play('Jog_Fwd_Loop', true, 0.15);
  }

  play(name, loop, fade = 0.2) {
    const next = this.actions.get(name);
    if (!next) return;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  update(dt) {
    this.mixer.update(dt);
    const r = this.run;
    if (!r) return;
    r.t += dt;
    if (!r.kicking) {
      const u = Math.min(r.t / r.duration, 1);
      this.root.position.lerpVectors(r.from, r.to, u);
      if (u >= 1) {
        r.kicking = true;
        r.kickT = 0;
        this.play('ST_Kick', false, 0.08);
      }
    } else {
      r.kickT += dt;
      if (!r.contacted && r.kickT >= KICK_CONTACT) {
        r.contacted = true;
        r.onContact?.();
      }
      // carry a little momentum through the strike
      if (r.kickT < 0.5) this.root.position.z -= dt * 1.2;
    }
  }

  react(kind) {
    // Authored football reactions (see clips.js); fall back to library clips if a rig lacks them.
    if (kind === 'celebrate') this.play(this.actions.has('ST_Celebrate') ? 'ST_Celebrate' : 'Dance_Loop', true, 0.3);
    else if (kind === 'dejected') this.play(this.actions.has('ST_Dejected') ? 'ST_Dejected' : 'Crouch_Idle_Loop', true, 0.5);
  }
}
