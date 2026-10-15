import { predictCrossing } from '../physics/aero.js';

/**
 * Difficulty table for the AI goalkeeper.
 *  reaction  seconds after the strike before he can move (unless guessing)
 *  readError metres of error (std-dev) in reading where the ball will cross the line
 *  guess     chance he commits to a side at the moment of the strike instead of reading the shot
 *  reach     multiplier on how far the hips travel in a dive
 *  speed     multiplier on dive speed
 *  catchBelow ball speed (m/s) under which a clean glove contact is held rather than parried
 *  memory    weight given to the player's favourite side when guessing (0 = none)
 */
export const DIFFICULTY = {
  easy: { reaction: 0.36, readError: 0.9, guess: 0.35, reach: 0.85, speed: 0.85, catchBelow: 13, memory: 0 },
  normal: { reaction: 0.22, readError: 0.5, guess: 0.55, reach: 1.05, speed: 1.05, catchBelow: 17, memory: 0.4 },
  hard: { reaction: 0.16, readError: 0.32, guess: 0.6, reach: 1.1, speed: 1.12, catchBelow: 20, memory: 0.6 },
  legend: { reaction: 0.12, readError: 0.22, guess: 0.6, reach: 1.15, speed: 1.2, catchBelow: 23, memory: 0.8 },
};

/** Gaussian sample (Box–Muller). */
const gauss = (rand) => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());

/**
 * Turns a point on the goal plane (where the keeper thinks the ball will arrive) into a move.
 * Shared by the AI and by the human keeper (who clicks or presses a key for a point).
 */
export function moveForPoint(x, y, { reach = 1, speed = 1 } = {}) {
  const ax = Math.abs(x);
  if (ax < 0.55) return { kind: y > 1.55 ? 'jump' : 'block', side: x >= 0 ? 1 : -1, reach: ax, speed, height: y };
  // Hips travel so the outstretched gloves end at the ball (measured: gloves ≈ 1.05 m beyond the hips).
  const hips = Math.min(Math.max(ax - 1.05, 0.25), 1.9 * reach);
  return { kind: y > 1.3 ? 'high' : 'low', side: x > 0 ? 1 : -1, reach: hips, speed, height: y };
}

/**
 * Decides the AI keeper's reaction to a strike.
 * @param {{ position, velocity, spin }} kick ball state at the moment of the strike
 * @param {keyof DIFFICULTY} level
 * @param {{ left: number, right: number }} history how often the player has shot to each side
 * @returns {{ delay: number, move: object, read: {x,y} }}
 */
export function decideSave(kick, level = 'normal', history = { left: 0, right: 0 }, rand = Math.random) {
  const d = DIFFICULTY[level] ?? DIFFICULTY.normal;
  const truth = predictCrossing(kick.position, kick.velocity, kick.spin, 0);

  if (rand() < d.guess) {
    // Commit to a side on the strike (as real keepers mostly do), leaning towards where this player
    // usually shoots. Height and distance are still read from the ball, so a correct guess is a real
    // chance to save and a wrong one is a goal.
    const total = history.left + history.right;
    const pRight = total ? 0.5 + d.memory * (history.right / total - 0.5) : 0.5;
    const side = rand() < pRight ? 1 : -1;
    const sameSide = Math.sign(truth.x) === side;
    const read = {
      x: side * (sameSide ? Math.max(1.2, Math.abs(truth.x) + gauss(rand) * d.readError * 0.5) : 2.2),
      y: Math.max(0.1, truth.y + gauss(rand) * d.readError * 0.6),
    };
    return { delay: 0.02, move: moveForPoint(read.x, read.y, d), read, guessed: true };
  }

  const read = { x: truth.x + gauss(rand) * d.readError, y: Math.max(0.1, truth.y + gauss(rand) * d.readError * 0.6) };
  return { delay: d.reaction, move: moveForPoint(read.x, read.y, d), read, guessed: false };
}

/** AI striker (when the player is in goal): picks a target, power and curve. Better levels aim tighter. */
export function chooseShot(level = 'normal', rand = Math.random) {
  const skill = { easy: 0.45, normal: 0.6, hard: 0.75, legend: 0.88 }[level] ?? 0.6;
  const side = rand() < 0.5 ? -1 : 1;
  const centre = rand() < 0.12; // the occasional Panenka-ish down-the-middle
  const x = centre ? (rand() - 0.5) * 0.8 : side * (1.8 + rand() * 1.7 * skill);
  const y = 0.3 + rand() * (centre ? 1.4 : 1.8);
  return {
    target: { x, y },
    power: 0.55 + rand() * 0.3 + (rand() < 0.1 * (1 - skill) ? 0.15 : 0), // weaker players sometimes over-hit
    curve: (rand() - 0.5) * 0.8 * skill,
  };
}
