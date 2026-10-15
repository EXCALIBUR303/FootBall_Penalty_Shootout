import * as THREE from 'three';

/**
 * Records the local transform (position + quaternion) of every node under the given roots each frame,
 * then plays it back with interpolation. Because it captures the final skeleton pose, the replay shows
 * exactly the animation the player saw (dives, run-up, ball spin) without re-simulating anything,
 * and it is independent of how the animation system produced the pose.
 *
 * Memory: ~150 nodes × 7 floats × 4 B ≈ 4 KB per frame, so a 6 s clip at 60 fps is about 1.5 MB.
 */
export class Recorder {
  /** @param {THREE.Object3D[]} roots */
  constructor(roots, { maxSeconds = 8, fps = 60 } = {}) {
    this.nodes = [];
    for (const root of roots) root.traverse((n) => this.nodes.push(n));
    this.stride = this.nodes.length * 7;
    this.maxFrames = Math.ceil(maxSeconds * fps);
    this.data = new Float32Array(this.maxFrames * this.stride);
    this.times = new Float32Array(this.maxFrames);
    this.count = 0;
    this.marks = {};
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
  }

  get duration() { return this.count ? this.times[this.count - 1] : 0; }
  clear() { this.count = 0; this.marks = {}; }

  /** Name a moment (e.g. the strike) so playback can start just before it. */
  mark(name) { this.marks[name] = this.duration; }

  /** Store the current pose at time `t` (seconds since the clip started). */
  record(t) {
    if (this.count >= this.maxFrames) return; // clip full: keep what we have
    const o = this.count * this.stride;
    const d = this.data;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const j = o + i * 7;
      d[j] = n.position.x; d[j + 1] = n.position.y; d[j + 2] = n.position.z;
      d[j + 3] = n.quaternion.x; d[j + 4] = n.quaternion.y; d[j + 5] = n.quaternion.z; d[j + 6] = n.quaternion.w;
    }
    this.times[this.count++] = t;
  }

  /** Pose the scene at clip time `t` (clamped), blending the two nearest frames. */
  apply(t) {
    if (!this.count) return;
    t = Math.min(Math.max(t, 0), this.duration);
    // Binary search for the last frame at or before t.
    let lo = 0;
    let hi = this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.times[mid] <= t) lo = mid; else hi = mid - 1;
    }
    const a = lo;
    const b = Math.min(a + 1, this.count - 1);
    const span = this.times[b] - this.times[a];
    const f = span > 1e-6 ? (t - this.times[a]) / span : 0;
    const d = this.data;
    const oa = a * this.stride;
    const ob = b * this.stride;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const ja = oa + i * 7;
      const jb = ob + i * 7;
      n.position.set(
        d[ja] + (d[jb] - d[ja]) * f, d[ja + 1] + (d[jb + 1] - d[ja + 1]) * f, d[ja + 2] + (d[jb + 2] - d[ja + 2]) * f,
      );
      this._q.set(d[ja + 3], d[ja + 4], d[ja + 5], d[ja + 6]);
      this._q2.set(d[jb + 3], d[jb + 4], d[jb + 5], d[jb + 6]);
      n.quaternion.copy(this._q).slerp(this._q2, f);
    }
  }
}
