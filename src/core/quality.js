// Quality presets. Phase 4 adds post-processing toggles; the shape is here so later code just reads it.
const PRESETS = {
  // anisotropy: filtering of the stadium backdrop, which is also the pitch seen at a grazing angle. It keeps the
  // far grass sharp, but frame cost grows with it (measured roughly linear in software GL), so Low uses 2x.
  high: { maxDpr: 2, shadowMap: 2048, bloom: true, anisotropy: 8 },
  low: { maxDpr: 1, shadowMap: 1024, bloom: false, anisotropy: 2 },
};
const KEY = 'penalty-kings.quality';

export function getQuality() {
  let name = 'high';
  try { name = localStorage.getItem(KEY) || 'high'; } catch { /* storage can be blocked */ }
  return PRESETS[name] ? name : 'high';
}
export function setQuality(name) {
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
}
export const preset = (name = getQuality()) => ({ name, ...PRESETS[name] });
