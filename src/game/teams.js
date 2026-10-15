// Fictional teams (cosmetic: name and kit colour). Colours are checked for ≥ 4.5:1 contrast on the
// UI panel colour so they can double as text accents.
// `color` is the UI accent; `kit` is what the players wear (deeper, cloth-like colours — the bright UI tints
// would glow on the pitch). Patterns: plain | stripes | hoops | sash (see src/world/kit.js).
export const TEAMS = [
  { id: 'lions', name: 'Blue Lions', short: 'LIO', color: '#5b9cff',
    kit: { shirt: '#1f58c9', trim: '#f4f5f7', shorts: '#f4f5f7', socks: '#1f58c9', pattern: 'plain' } },
  { id: 'foxes', name: 'Red Foxes', short: 'FOX', color: '#ff6b6b',
    kit: { shirt: '#c41f2c', shirt2: '#f4f4f4', trim: '#f4f4f4', shorts: '#16171b', socks: '#c41f2c', pattern: 'sash' } },
  { id: 'hornets', name: 'Gold Hornets', short: 'HOR', color: '#ffc83d',
    kit: { shirt: '#eeb21a', shirt2: '#17171b', trim: '#17171b', shorts: '#17171b', socks: '#eeb21a', pattern: 'hoops' } },
  { id: 'sharks', name: 'Teal Sharks', short: 'SHA', color: '#2ee6a8',
    kit: { shirt: '#0d9a86', trim: '#f2f5f4', shorts: '#0f2236', socks: '#0d9a86', pattern: 'plain' } },
  { id: 'owls', name: 'Violet Owls', short: 'OWL', color: '#b794ff',
    kit: { shirt: '#5f37b8', shirt2: '#cdbff2', trim: '#cdbff2', shorts: '#231640', socks: '#5f37b8', pattern: 'stripes' } },
  { id: 'comets', name: 'Orange Comets', short: 'COM', color: '#ff8a3d',
    kit: { shirt: '#ec6418', trim: '#1b2231', shorts: '#1b2231', socks: '#ec6418', pattern: 'plain' } },
];
export const team = (id) => TEAMS.find((t) => t.id === id) ?? TEAMS[0];

/** Keeper kit: volt with long sleeves and gloves — no outfield kit uses it, so the keeper always stands out. */
export const KEEPER_KIT = { shirt: '#c4dc2c', trim: '#1a1c21', shorts: '#1a1c21', socks: '#c4dc2c', gloves: '#f3f4f1', longSleeves: true, pattern: 'plain' };
