// Fictional teams (cosmetic: name and kit colour). Colours are checked for ≥ 4.5:1 contrast on the
// UI panel colour so they can double as text accents.
export const TEAMS = [
  { id: 'lions', name: 'Blue Lions', short: 'LIO', color: '#5b9cff' },
  { id: 'foxes', name: 'Red Foxes', short: 'FOX', color: '#ff6b6b' },
  { id: 'hornets', name: 'Gold Hornets', short: 'HOR', color: '#ffc83d' },
  { id: 'sharks', name: 'Teal Sharks', short: 'SHA', color: '#2ee6a8' },
  { id: 'owls', name: 'Violet Owls', short: 'OWL', color: '#b794ff' },
  { id: 'comets', name: 'Orange Comets', short: 'COM', color: '#ff8a3d' },
];
export const team = (id) => TEAMS.find((t) => t.id === id) ?? TEAMS[0];

/** Keeper kit: lime, which no outfield kit above uses, so the keeper always stands out. */
export const KEEPER_KIT = '#c6f432';
