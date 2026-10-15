// Game audio. Short one-shots are CC0 Kenney samples (public/assets/audio); the crowd, the whistle and
// the cheers/groans are synthesised with Web Audio (filtered noise + oscillators) because no CC0 crowd
// recording was available without a login. Nothing here is a visual, so synthesis is fine.
//
// Browsers only let an AudioContext start after a user gesture, so everything is created lazily by
// `unlock()` (called on the first pointer/key press). Before that every call is a harmless no-op.

const BASE = import.meta.env.BASE_URL;
const SAMPLES = {
  kick: ['kick', 'kick2'], post: ['post'], bar: ['bar'], glove: ['glove'], catch: ['catch'], net: ['net'],
  click: ['ui-click'], select: ['ui-select'], confirm: ['ui-confirm'], back: ['ui-back'], tick: ['ui-tick'],
};

export function createAudio(settings) {
  /** @type {AudioContext | null} */
  let ctx = null;
  let master, sfx, crowdBus, crowdLevel, compressor;
  const buffers = new Map(); // name -> AudioBuffer[]
  const raw = new Map(); // name -> ArrayBuffer[] (fetched before the context exists)
  let noise = null; // shared 4 s noise loop
  let unlocking = false;
  let crowdBase = 0.35; // 0..1 intensity of the ambient bed
  let crowdTarget = 0.35;
  let lastNet = -1;
  let bedTimer = 0;

  // Fetch the sample files straight away (no context needed); decode them once audio is unlocked.
  const fetching = Promise.all(Object.entries(SAMPLES).map(async ([name, files]) => {
    const list = [];
    for (const f of files) {
      try {
        const res = await fetch(`${BASE}assets/audio/${f}.ogg`);
        const data = await res.arrayBuffer();
        // Vite answers a missing file with index.html; make sure this really is Ogg before decoding.
        if (String.fromCharCode(...new Uint8Array(data.slice(0, 4))) === 'OggS') list.push(data);
        else console.warn(`audio: ${f}.ogg is missing`);
      } catch (err) { console.warn(`audio: could not load ${f}.ogg`, err); }
    }
    raw.set(name, list);
  }));

  const volume = () => (settings.get('muted') ? 0 : settings.get('masterVolume'));
  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(volume(), t, 0.05);
    crowdBus.gain.setTargetAtTime(settings.get('crowdVolume'), t, 0.1);
  }
  settings.subscribe((k) => { if (k === 'masterVolume' || k === 'muted' || k === 'crowdVolume') applyVolumes(); });

  async function unlock() {
    if (ctx || unlocking) { ctx?.state === 'suspended' && ctx.resume(); return; }
    unlocking = true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor({ latencyHint: 'interactive' });
    compressor = ctx.createDynamicsCompressor(); // keeps cheers + effects from clipping (the default settings squash everything)
    Object.entries({ threshold: -8, knee: 10, ratio: 4, attack: 0.003, release: 0.25 }).forEach(([k, v]) => { compressor[k].value = v; });
    compressor.connect(ctx.destination);
    master = ctx.createGain(); master.connect(compressor);
    sfx = ctx.createGain(); sfx.connect(master);
    crowdBus = ctx.createGain(); crowdBus.connect(master);
    crowdLevel = ctx.createGain(); crowdLevel.gain.value = 0; crowdLevel.connect(crowdBus);
    applyVolumes();
    noise = makeNoise(ctx);
    startBed();
    await fetching;
    await Promise.all([...raw].map(async ([name, list]) => {
      buffers.set(name, (await Promise.all(list.map((d) => ctx.decodeAudioData(d.slice(0)).catch(() => null)))).filter(Boolean));
    }));
  }
  // First gesture of any kind unlocks audio.
  const onGesture = () => { unlock(); };
  for (const type of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, onGesture, { once: true, capture: true });
  const onVisibility = () => { if (ctx) (document.hidden ? ctx.suspend() : ctx.resume()); };
  document.addEventListener('visibilitychange', onVisibility);

  /** One-shot sample. opts: gain, rate (pitch), pan (-1..1), variation (random pitch spread). */
  function play(name, { gain = 1, rate = 1, pan = 0, variation = 0.04, bus } = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const list = buffers.get(name);
    if (!list?.length) return;
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * variation * 2);
    const g = ctx.createGain(); g.gain.value = gain;
    let node = src.connect(g);
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node = node.connect(p); }
    node.connect(bus ?? sfx);
    src.start();
  }

  // --- Synthesised crowd ------------------------------------------------------------------------
  function startBed() {
    // Murmur: noise → low-pass/band-pass → slowly wobbling gain.
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.4;
    const bed = ctx.createGain(); bed.gain.value = 0.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(bed.gain);
    src.connect(lp).connect(bp).connect(bed).connect(crowdLevel);
    src.start(); lfo.start();
    crowdLevel.gain.value = crowdBase * 0.35;
    // Ease the bed towards its target every 100 ms (cheap; avoids per-frame work in the game loop).
    bedTimer = setInterval(() => {
      if (!ctx) return;
      crowdBase += (crowdTarget - crowdBase) * 0.15;
      crowdLevel.gain.setTargetAtTime(crowdBase * 0.35, ctx.currentTime, 0.2);
    }, 100);
  }

  /** Swell of voices: noise through two vowel-like band-passes. kind: 'cheer' | 'groan' | 'gasp'. */
  function voices(kind, strength = 1) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const P = {
      cheer: { f1: [650, 900], f2: [1500, 2100], attack: 0.35, hold: 0.9, release: 2.4, gain: 1.0 },
      groan: { f1: [520, 300], f2: [1000, 650], attack: 0.18, hold: 0.3, release: 1.3, gain: 0.7 },
      gasp: { f1: [500, 1100], f2: [1200, 2400], attack: 0.5, hold: 0.0, release: 0.4, gain: 0.4 },
    }[kind];
    const dur = P.attack + P.hold + P.release;
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const out = ctx.createGain(); out.gain.value = 0;
    for (const [f, q, mix] of [[P.f1, 1.2, 1], [P.f2, 2.0, 0.55]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f[0], t);
      bp.frequency.linearRampToValueAtTime(f[1], t + P.attack + P.hold);
      const g = ctx.createGain(); g.gain.value = mix;
      src.connect(bp).connect(g).connect(out);
    }
    const peak = 1.1 * P.gain * strength;
    out.gain.linearRampToValueAtTime(peak, t + P.attack);
    out.gain.setValueAtTime(peak, t + P.attack + P.hold);
    out.gain.exponentialRampToValueAtTime(0.001, t + dur);
    out.connect(crowdBus);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.1);
  }

  /** Referee's pea whistle: two close sines, trilled by a fast square LFO, with a short envelope. */
  function whistle() {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.03);
    env.gain.setValueAtTime(0.16, t + 0.5);
    env.gain.linearRampToValueAtTime(0, t + 0.6);
    env.connect(sfx);
    const trill = ctx.createGain(); trill.gain.value = 0.65; trill.connect(env);
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 38;
    const depth = ctx.createGain(); depth.gain.value = 0.35;
    lfo.connect(depth).connect(trill.gain); // gain wobbles between 0.3 and 1.0
    for (const f of [2860, 3010]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      o.connect(trill); o.start(t); o.stop(t + 0.62);
    }
    lfo.start(t); lfo.stop(t + 0.62);
  }

  const api = {
    unlock,
    play,
    ui(name) { play(name, { gain: 0.5, variation: 0.02 }); },
    whistle,
    /** Match-level crowd intensity 0..1 (menu is quiet, a kick builds tension). */
    crowd(level) { crowdTarget = level; },
    /** Reaction to a result: cheer on a goal, groan on a miss, oooh on the woodwork. */
    reaction(kind) {
      if (kind === 'goal') { voices('cheer', 1); crowdBase = 0.9; }
      else if (kind === 'post') { voices('gasp', 1); setTimeout(() => voices('groan', 0.8), 450); }
      else voices('groan', kind === 'saved' ? 0.9 : 0.6);
    },
    gasp() { voices('gasp', 0.6); },
    /** Match events from the game controller. */
    onMatchEvent(type, data) {
      if (type === 'strike') { play('kick', { gain: 0.5 + 0.7 * (data.power ?? 0.7), pan: (data.x ?? 0) * 0.08 }); api.crowd(0.7); }
      else if (type === 'whistle') whistle();
      else if (type === 'woodwork') play(data.type === 'bar' ? 'bar' : 'post', { gain: Math.min(1, 0.3 + (data.speed ?? 10) / 25), pan: (data.x ?? 0) * 0.1 });
      else if (type === 'keeper-touch') play(data.held ? 'catch' : 'glove', { gain: Math.min(1, 0.5 + (data.speed ?? 10) / 30), pan: (data.x ?? 0) * 0.1 });
      else if (type === 'net') {
        if (ctx && ctx.currentTime - lastNet > 0.25) { lastNet = ctx.currentTime; play('net', { gain: Math.min(0.9, 0.3 + (data.speed ?? 8) / 20), rate: 0.85 }); }
      } else if (type === 'result') api.reaction(data.outcome);
      else if (type === 'kick') api.crowd(0.45);
      else if (type === 'over') { whistle(); setTimeout(() => voices('cheer', 0.8), 350); }
    },
    /** Paused: the crowd drops to a murmur (the context stays live so menu clicks still sound). */
    setPaused(p) { crowdTarget = p ? 0.12 : 0.45; },
    /** Dev/test: context state and how many samples decoded. */
    stats: () => ({ state: ctx?.state ?? 'locked', samples: Object.fromEntries([...buffers].map(([k, v]) => [k, v.length])), crowd: crowdBase }),
    /** Dev/test: tap the master output to measure its peak level over `ms`. */
    async measure(ms = 400) {
      if (!ctx) return 0;
      // ScriptProcessor runs on the audio thread's cadence, so short one-shots can't slip between polls.
      const sp = ctx.createScriptProcessor(512, 1, 1);
      let peak = 0;
      sp.onaudioprocess = (e) => { for (const x of e.inputBuffer.getChannelData(0)) peak = Math.max(peak, Math.abs(x)); };
      const mute = ctx.createGain(); mute.gain.value = 0;
      compressor.connect(sp); sp.connect(mute).connect(ctx.destination);
      await new Promise((r) => setTimeout(r, ms));
      compressor.disconnect(sp); sp.disconnect();
      return peak;
    },    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      ctx?.close();
      clearInterval(bedTimer);
      ctx = null;
    },
  };
  return api;
}

/** 4 s of white noise shaded towards pink (simple one-pole smoothing), looped by every voice. */
function makeNoise(ctx) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.82 + (Math.random() * 2 - 1) * 0.18;
    d[i] = last * 3.2;
  }
  return buf;
}
