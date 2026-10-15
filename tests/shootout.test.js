import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShootout, recordKick, nextKicker, currentRound, score, isSuddenDeath, roundDots } from '../src/game/shootout.js';

const play = (seq) => seq.reduce((s, k) => recordKick(s, k), createShootout());

test('home kicks first and teams alternate', () => {
  const s = createShootout();
  assert.equal(nextKicker(s), 'home');
  recordKick(s, true);
  assert.equal(nextKicker(s), 'away');
  assert.equal(currentRound(s), 1);
  recordKick(s, false);
  assert.equal(currentRound(s), 2);
});

test('ends early when the trailing team cannot catch up', () => {
  // H scores 3, A misses 3: after H's 4th? H 3-0 with A having 2 left -> decided after A's 3rd miss.
  const s = play([true, false, true, false, true, false]);
  assert.equal(s.winner, 'home');
});

test('not decided while still catchable', () => {
  const s = play([true, false, true, false]);
  assert.equal(s.winner, null);
});

test('away can win before home takes its last kick', () => {
  // after 4.5 rounds: H 2/5? sequence H,A pairs: H miss A score x4, then H... A leads 4-0, H has 1 left -> decided
  const s = play([false, true, false, true, false, true]);
  // A 3-0, H has 2 left, A has 2 left: H max 2 < 3 -> away wins
  assert.equal(s.winner, 'away');
});

test('5-5 goes to sudden death and needs a full pair', () => {
  const s = play(Array(10).fill(true));
  assert.equal(s.winner, null);
  assert.ok(isSuddenDeath(s));
  recordKick(s, false); // H misses in round 6
  assert.equal(s.winner, null, 'away still has to kick');
  recordKick(s, true);
  assert.equal(s.winner, 'away');
  assert.equal(score(s, 'away'), 6);
});

test('sudden death continues while pairs are level', () => {
  const s = play([...Array(10).fill(true), true, true, false, false]);
  assert.equal(s.winner, null);
  recordKick(s, true);
  recordKick(s, false);
  assert.equal(s.winner, 'home');
});

test('round dots pad to five and grow in sudden death', () => {
  assert.deepEqual(roundDots(play([true, false]), 'home'), [true, null, null, null, null]);
  assert.equal(roundDots(play(Array(12).fill(true)), 'home').length, 6);
});

test('cannot kick after a winner', () => {
  const s = play([true, false, true, false, true, false]);
  assert.throws(() => recordKick(s, true));
});
