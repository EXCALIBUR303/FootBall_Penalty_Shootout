import * as THREE from 'three';

/**
 * Lightweight particle effects (these are effects, not scene models): a confetti burst on goals, sparks
 * on woodwork / saves, and a fading trail behind the ball. Everything lives in two pooled `Points`
 * objects, so there is no per-event allocation. `low` mode trims counts and drops the trail.
 */
export function createEffects(scene, { low = false } = {}) {
  let isLow = low;
  const confetti = new ParticleSystem(400, { size: 0.16, blending: THREE.NormalBlending, map: null });
  const sparks = new ParticleSystem(160, { size: 0.12, blending: THREE.AdditiveBlending, map: softDot() });
  // Ball trail: a ring buffer of recent positions that fade out.
  const TRAIL = 36;
  const trail = new ParticleSystem(TRAIL, { size: 0.09, blending: THREE.AdditiveBlending, map: softDot() });
  scene.add(confetti.points, sparks.points, trail.points);
  const tmp = new THREE.Color();

  const api = {
    set low(v) { isLow = v; },
    /** Goal: confetti fountain from the back of the net, in the scoring team's colours. */
    goal(color, x = 0) {
      const n = isLow ? 90 : 300;
      const palette = [new THREE.Color(color), new THREE.Color(0xffc93c), new THREE.Color(0xffffff), new THREE.Color(0x44d6a4)];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random();
        const c = palette[i % palette.length];
        confetti.emit({
          x: x * 0.6 + Math.cos(a) * 1.8 * r, y: 0.4 + Math.random() * 0.5, z: -1.4 + Math.sin(a) * 0.8 * r,
          vx: Math.cos(a) * (1.5 + Math.random() * 2.5), vy: 5 + Math.random() * 5, vz: 1.5 + Math.random() * 3.5,
          r: c.r, g: c.g, b: c.b, life: 2.2 + Math.random() * 1.2, gravity: 7, drag: 1.4,
        });
      }
    },
    /** Impact sparks (post, bar, glove). `strength` ~ ball speed in m/s. */
    hit(pos, strength = 10, color = 0xfff1c2) {
      tmp.set(color);
      const n = Math.round((isLow ? 6 : 16) * Math.min(1.5, 0.4 + strength / 20));
      for (let i = 0; i < n; i++) {
        const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.2).normalize();
        const s = 1.5 + Math.random() * 3.5;
        sparks.emit({
          x: pos.x, y: pos.y, z: pos.z, vx: dir.x * s, vy: dir.y * s, vz: dir.z * s + 0.8,
          r: tmp.r, g: tmp.g, b: tmp.b, life: 0.35 + Math.random() * 0.3, gravity: 3, drag: 2.5,
        });
      }
    },
    /** Call every frame while the ball is moving fast; `active` false lets the trail fade. */
    trail(pos, speed, active) {
      if (isLow) return;
      if (active && speed > 8) {
        const k = Math.min(1, (speed - 8) / 16);
        trail.emit({ x: pos.x, y: pos.y, z: pos.z, vx: 0, vy: 0, vz: 0, r: 0.9 * k + 0.1, g: 0.95 * k + 0.1, b: 1, life: 0.35, gravity: 0, drag: 0 });
      }
    },
    update(dt) { confetti.update(dt); sparks.update(dt); trail.update(dt); },
    clear() { confetti.clear(); sparks.clear(); trail.clear(); },
    dispose() {
      scene.remove(confetti.points, sparks.points, trail.points);
      for (const s of [confetti, sparks, trail]) s.dispose();
    },
  };
  return api;
}

class ParticleSystem {
  constructor(max, { size, blending, map }) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); // rgba; alpha carries the fade
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max); // remaining
    this.total = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.next = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, blending, map, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false; // positions change every frame; the initial bounds are empty
    this.points.renderOrder = 10;
    this.clear();
  }
  emit({ x, y, z, vx, vy, vz, r, g, b, life, gravity, drag }) {
    const i = this.next;
    this.next = (this.next + 1) % this.max; // oldest particle is recycled when the pool is full
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([r, g, b], i * 3);
    this.life[i] = this.total[i] = life;
    this.grav[i] = gravity;
    this.drag[i] = drag;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const j = i * 3;
      const damp = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= damp; this.vel[j + 2] *= damp;
      this.vel[j + 1] = this.vel[j + 1] * damp - this.grav[i] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.pos[j + 1] < 0.02 && this.grav[i] > 0) { this.pos[j + 1] = 0.02; this.vel[j + 1] = 0; this.vel[j] *= 0.5; this.vel[j + 2] *= 0.5; } // lands and stops
      const k = i * 4;
      this.col[k] = this.base[j]; this.col[k + 1] = this.base[j + 1]; this.col[k + 2] = this.base[j + 2];
      this.col[k + 3] = Math.max(0, Math.min(1, (this.life[i] / this.total[i]) * 1.6)); // fade over the last 60%
      if (this.life[i] <= 0) { this.col[k + 3] = 0; this.pos[j + 1] = -100; }
    }
    if (any || this.dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
    this.dirty = any; // one more upload after the last particle dies, so the buffers show it as gone
    this.points.visible = any;
  }
  clear() { this.life.fill(0); this.col.fill(0); for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -100; this.dirty = true; this.points.visible = false; }
  dispose() { this.geo.dispose(); this.mat.map?.dispose(); this.mat.dispose(); }
}

/** Soft round sprite so additive points read as glows rather than squares. */
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
