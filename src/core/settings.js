// Persistent user settings with change notifications. localStorage can be unavailable (private mode,
// blocked storage), so every access is guarded and the game falls back to defaults.
const KEY = 'penalty-kings.settings';

const DEFAULTS = {
  quality: 'high', // 'high' | 'low'
  masterVolume: 0.8,
  crowdVolume: 0.7,
  muted: false,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  hints: true,
  autoReplay: true, // replay goals, saves and woodwork after each kick
  onboarded: false, // first-match coach marks seen
  difficulty: 'normal',
  homeTeam: 'lions',
  awayTeam: 'foxes',
};

function read() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

const state = read();
const listeners = new Set();

export const settings = {
  get: (k) => state[k],
  all: () => ({ ...state }),
  set(k, v) {
    if (state[k] === v) return;
    state[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    listeners.forEach((fn) => fn(k, v));
  },
  /** @param {(key: string, value: any) => void} fn */
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
