// Penalty shootout rules (pure logic, no rendering — unit tested in tests/shootout.test.js).
//
// Teams alternate kicks, home first. Five kicks each; the shootout ends early as soon as one team
// cannot be caught. If level after five each, sudden death: kicks continue in pairs and the first pair
// where one scores and the other doesn't decides it.

export const ROUNDS = 5;

export function createShootout() {
  return {
    kicks: { home: [], away: [] }, // arrays of booleans (true = scored)
    winner: null, // 'home' | 'away' | null
  };
}

/** Team due to kick next. */
export function nextKicker(s) {
  return s.kicks.home.length === s.kicks.away.length ? 'home' : 'away';
}

/** Round number (1-based) of the next kick; > ROUNDS means sudden death. */
export function currentRound(s) {
  return Math.max(s.kicks.home.length, s.kicks.away.length) + (nextKicker(s) === 'home' ? 1 : 0);
}

export const score = (s, team) => s.kicks[team].filter(Boolean).length;
export const isSuddenDeath = (s) => currentRound(s) > ROUNDS;

/** Records a kick for the team due to kick and returns the updated state (mutates and returns `s`). */
export function recordKick(s, scored) {
  if (s.winner) throw new Error('Shootout already decided');
  s.kicks[nextKicker(s)].push(Boolean(scored));
  s.winner = decide(s);
  return s;
}

function decide(s) {
  const h = s.kicks.home.length;
  const a = s.kicks.away.length;
  const hs = score(s, 'home');
  const as = score(s, 'away');

  if (h <= ROUNDS && a <= ROUNDS) {
    // Regulation: can the trailing side still catch up with the kicks it has left?
    const hLeft = ROUNDS - h;
    const aLeft = ROUNDS - a;
    if (hs > as + aLeft) return 'home';
    if (as > hs + hLeft) return 'away';
    return null;
  }
  // Sudden death: only decided after a complete pair.
  if (h === a && hs !== as) return hs > as ? 'home' : 'away';
  return null;
}

/** Display helper: one entry per round so far, padded to ROUNDS: true / false / null (not taken). */
export function roundDots(s, team) {
  const taken = s.kicks[team];
  const n = Math.max(ROUNDS, s.kicks.home.length, s.kicks.away.length);
  return Array.from({ length: n }, (_, i) => (i < taken.length ? taken[i] : null));
}
