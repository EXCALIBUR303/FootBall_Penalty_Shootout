import * as THREE from 'three';
import { createPhysics, STEP } from '../physics/world.js';
import { BALL } from '../physics/aero.js';
import { solveShot, GOAL } from './shot.js';
import { createShootout, recordKick, nextKicker, currentRound, isSuddenDeath, score } from './shootout.js';
import { decideSave, moveForPoint, chooseShot, DIFFICULTY } from './keeper-ai.js';
import { createInput } from './input.js';
import { Director, SHOTS } from '../camera/director.js';
import { createHud } from '../ui/hud.js';
import { KEEPER_LIMBS } from '../actors/keeper.js';
import { KEEPER_KIT, TEAMS } from './teams.js';
import { createEffects } from '../fx/effects.js';
import { Recorder } from './replay.js';

const SPOT = new THREE.Vector3(0, BALL.radius, 11);
const POWER_PERIOD = 1.1; // seconds for the power bar to go 0 → 100%
const CURVE_PERIOD = 1.0; // seconds for a full curve swing
const AIM = { minX: -4.6, maxX: 4.6, minY: 0.15, maxY: 3.2, keySpeed: 3.2 };
const RESULT_HOLD = 2.6; // seconds the result is shown before the next kick
const RESULT_HOLD_BEFORE_REPLAY = 1.7; // shorter when a replay follows
const REPLAY_RATE = 0.6; // playback speed of the replay
const REPLAY_LEAD = 0.7; // seconds of run-up shown before the strike


/**
 * Match controller: a small state machine around one penalty at a time.
 *
 *   Human shooter:  aim → power (hold) → curve (press) → runup → flight → result
 *   AI shooter:     keeper (human picks a dive) → runup → flight → result
 *   …until the shootout has a winner → over.
 *
 * 1P: the player shoots for home and keeps goal for away. 2P: both shooters and both keepers are human
 * (shooter: mouse / arrows + Space; keeper: A D Q E S W).
 *
 * @param {{ world, canvas, params: URLSearchParams,
 *   options: { mode: '1p'|'2p', difficulty: string, home: object, away: object },
 *   settings: { get(k), subscribe(fn) }, onEvent?: (type: string, data: object) => void }} args
 */
export async function createMatch({ world, canvas, params, options = {}, settings, onEvent = () => {} }) {
  const { keeper, striker, ball, camera } = world;
  const mode = options.mode ?? '1p';
  const level = DIFFICULTY[options.difficulty] ? options.difficulty : DIFFICULTY[params.get('difficulty')] ? params.get('difficulty') : 'normal';
  const ai = DIFFICULTY[level];
  const teams = { home: options.home ?? TEAMS[0], away: options.away ?? TEAMS[1] };
  const get = (k, fallback) => settings?.get(k) ?? fallback;

  const physics = await createPhysics({ onEvent: onPhysicsEvent });
  physics.setKeeperLimbs(KEEPER_LIMBS);
  const director = new Director(camera);
  director.reducedMotion = get('reducedMotion', director.reducedMotion);
  const hud = createHud(teams);
  const input = createInput(canvas, camera);
  const fx = createEffects(world.scene, { low: get('quality', 'high') === 'low' });
  fx.reducedMotion=get('reducedMotion',false);
  const recorder = new Recorder([keeper.root, striker.root, ball]);
  let recording = false;
  let recT = 0;
  let replay = null; // { t, end, rate, goalAt, goalFired } while a replay plays
  let replays = 0; // alternates the camera angle
  let slow = null; // { left, total, from } — brief slow-motion after a goal or save
  const rand = Math.random;
  world.kits.keeper?.set(KEEPER_KIT);

  const unsubscribe = settings?.subscribe((k, v) => {
    if (k === 'reducedMotion') { director.reducedMotion = v;fx.reducedMotion=v; }
    if (k === 'hints') refreshPrompt();
    if (k === 'quality') fx.low = v === 'low';
  });

  let shootout = createShootout();
  const history = { left: 0, right: 0 }; // where the player tends to shoot (keeper "memory")
  let phase = 'idle';
  let phaseT = 0;
  let paused = false;
  const aim = { x: 0, y: 1.2 };
  const meter = { power: 0, curve: 0 };
  let kick = null; // current kick: { team, shooterHuman, keeperHuman, touchedKeeper, woodwork, held, outcome, … }
  let pendingSave = null; // { at: seconds after strike, move }
  let playerMove = null; // human keeper's chosen move (queued before the strike or immediate after)
  let accumulator = 0;
  let forcedSave = null; // dev/test: overrides the AI's next decision
  let coaching = !get('onboarded', false) && mode === '1p'; // first-time coach marks
  const limbPos = new Map();
  const tmp = new THREE.Vector3();

  // ?debug draws every physics collider (goal frame, net, keeper limbs, ball) as lines.
  let debugLines = null;
  if (params.has('debug')) {
    debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false }));
    debugLines.renderOrder = 999;
    world.scene.add(debugLines);
  }

  // --- Flow ---------------------------------------------------------------------------------
  function setPhase(p) { phase = p; phaseT = 0; refreshPrompt(); refreshCoach(); }

  function startKick() {
    const team = nextKicker(shootout);
    const shooterHuman = mode === '2p' || team === 'home';
    const keeperHuman = mode === '2p' || team === 'away';
    physics.resetBall(SPOT.x, SPOT.z);
    syncBall();
    keeper.ready();
    striker.setUp(SPOT);
    world.kits.striker?.set(teams[team].kit ?? TEAMS[0].kit);
    hud.result(null);
    hud.meters(false);
    hud.setScore(shootout, { round: currentRound(shootout), suddenDeath: isSuddenDeath(shootout), shooting: team });
    kick = { team, shooterHuman, keeperHuman, touchedKeeper: false, woodwork: false, held: false, outcome: null, t: 0 };
    pendingSave = null;
    playerMove = null;
    accumulator = 0;
    recorder.clear();
    recording = false;
    slow = null;
    fx.clear();
    world.net.reset();

    const who = mode === '1p'
      ? (team === 'home' ? 'Your kick' : "You're in goal")
      : `${team === 'home' ? 'Player 1' : 'Player 2'} to shoot`;
    hud.turn(who, team, teams[team].name, !shooterHuman);

    if (shooterHuman) {
      aim.x = 0; aim.y = 1.2;
      input.resetPointer();
      setPhase('aim');
      director.cut(SHOTS.aim(SPOT), { cut: true });
    } else {
      kick.ai = chooseShot(level, rand);
      setPhase('keeper');
      director.cut(SHOTS.keeperView(), { cut: true });
    }
    onEvent('kick', { team, shooterHuman, keeperHuman, round: currentRound(shootout) });
  }

  function startRecording() { recorder.clear(); recT = 0; recording = true; recorder.record(0); }

  function beginRunUp() {
    startRecording();
    setPhase('runup');
    hud.meters(false);
    hud.reticle(null);
    director.cut(SHOTS.runUp(SPOT));
    striker.runUp(SPOT, strike, 0.95);
    onEvent('whistle', {});
  }

  /** Boot meets ball. */
  function strike() {
    const shot = kick.shooterHuman ? { target: { ...aim }, power: meter.power, curve: meter.curve } : kick.ai;
    const { velocity, spin } = solveShot(SPOT, shot.target, shot.power, shot.curve, rand);
    physics.kick(velocity, spin);
    kick.shot = shot;
    kick.launch = { position: SPOT.clone(), velocity, spin };
    recorder.mark('strike');
    fx.divot(SPOT);
    onEvent('strike', { power: shot.power, x: shot.target.x });
    setPhase('flight');
    director.cut(SHOTS.follow(() => ball.position));

    if (coaching && kick.shooterHuman) { coaching = false; settings?.set?.('onboarded', true); refreshCoach(); }

    if (!kick.keeperHuman) {
      // AI keeper reads (or guesses) the shot.
      const decision = forcedSave ?? decideSave(kick.launch, level, history, rand);
      forcedSave = null;
      pendingSave = { at: decision.delay, move: decision.move };
    } else if (playerMove) {
      keeper.dive(playerMove); // human keeper committed before the strike
    }
    if (kick.shooterHuman) { if (shot.target.x > 0.6) history.right++; else if (shot.target.x < -0.6) history.left++; }
  }

  function finishKick(outcome) {
    if (kick.outcome) return;
    kick.outcome = outcome;
    const scored = outcome === 'goal';
    recordKick(shootout, scored);
    // Caption accent: the scoring team for a goal, the keeper's team for a save, the shooter's otherwise.
    const defending = kick.team === 'home' ? 'away' : 'home';
    hud.result(outcome, resultTitle(outcome), resultSub(outcome), outcome === 'saved' ? defending : kick.team);
    hud.setScore(shootout, { round: currentRound(shootout), suddenDeath: isSuddenDeath(shootout), shooting: null });
    director.cut(SHOTS.reaction(scored ? 'goal' : 'save', ball.position.clone(), keeper.root.position.x));
    striker.react(scored ? 'celebrate' : 'dejected');
    if (!scored && kick.touchedKeeper) keeper.react('celebrate');
    recorder.mark('result');
    if (scored) { fx.goal(teams[kick.team].color, ball.position.x); director.addShake(0.1); hud.flash('goal'); }
    else if (kick.touchedKeeper) hud.flash('save');
    if (!get('reducedMotion', false) && (scored || kick.touchedKeeper)) slow = { left: scored ? 1.1 : 0.7, total: scored ? 1.1 : 0.7, from: scored ? 0.3 : 0.45 };
    setPhase('result');
    onEvent('result', { team: kick.team, outcome, score: { home: score(shootout, 'home'), away: score(shootout, 'away') } });
  }

  /** Caption title: what happened, as specifically as the physics knows it. */
  function resultTitle(outcome) {
    if (outcome === 'goal') return 'Goal';
    if (outcome === 'saved') return 'Saved';
    if (outcome === 'post') return 'Missed';
    return 'Missed';
  }
  /** Caption sub-line: a detail for saves, then the score. */
  function resultSub(outcome) {
    const detail = outcome === 'saved' ? (kick.held ? 'Held · ' : 'Pushed away · ') : '';
    return detail + scoreLine();
  }
  /** The shootout score from the leader's point of view. */
  function scoreLine() {
    const h = score(shootout, 'home'), a = score(shootout, 'away');
    if (shootout.winner) return `${teams[shootout.winner].name} win ${Math.max(h, a)}–${Math.min(h, a)}`;
    if (h === a) return `Level at ${h}–${a}`;
    const lead = h > a ? 'home' : 'away';
    return `${teams[lead].name} lead ${Math.max(h, a)}–${Math.min(h, a)}`;
  }

  /** After a kick (and its replay): the next kick, or the end of the shootout. */
  function advance() {
    if (shootout.winner) {
      setPhase('over');
      hud.result(null);
      onEvent('over', {
        winner: shootout.winner, mode, home: teams.home, away: teams.away, kicks: { home: [...shootout.kicks.home], away: [...shootout.kicks.away] },
        score: { home: score(shootout, 'home'), away: score(shootout, 'away') },
      });
    } else {
      startKick();
    }
  }

  // --- Replay ---------------------------------------------------------------------------------
  const shouldReplay = () => get('autoReplay', true) && ['goal', 'saved', 'post'].includes(kick.outcome)
    && recorder.count > 12 && recorder.marks.strike != null;

  function startReplay() {
    replay = {
      t: Math.max(0, recorder.marks.strike - REPLAY_LEAD),
      end: recorder.duration - 0.25,
      goalAt: kick.outcome === 'goal' ? recorder.marks.result : null,
      goalFired: false,
      prev: ball.position.clone(),
    };
    replays++;
    fx.clear();
    hud.result(null);
    hud.meters(false);
    hud.reticle(null);
    hud.coach(null);
    hud.replay(true);
    setPhase('replay');
    recorder.apply(replay.t); // pose the scene first: the camera's first frame tracks the replayed ball, not the live one
    const side = (kick.shot?.target.x ?? 0) >= 0 ? 1 : -1;
    // Goals alternate the goal-line and behind-the-striker angles; saves and woodwork are clearest side-on.
    const angle = kick.outcome === 'goal' ? (replays % 2 ? 'goalline' : 'striker') : (replays % 2 ? 'side' : 'striker');
    director.cut(SHOTS.replay(angle, side, () => ball.position), { cut: true });
  }

  function updateReplay(rawDt) {
    const dt = rawDt * REPLAY_RATE;
    replay.t += dt;
    recorder.apply(replay.t);
    if (replay.goalAt != null && !replay.goalFired && replay.t >= replay.goalAt) {
      replay.goalFired = true;
      fx.goal(teams[kick.team].color, ball.position.x);
    }
    const speed = ball.position.distanceTo(replay.prev) / Math.max(dt, 1e-4);
    replay.prev.copy(ball.position);
    fx.trail(ball.position, speed, true);
    fx.update(dt);
    if (replay.t >= replay.end) endReplay();
  }

  function endReplay() {
    if (phase !== 'replay') return;
    replay = null;
    hud.replay(false);
    fx.clear();
    advance();
  }

  // --- Prompts / onboarding -------------------------------------------------------------------
  /** Contextual controls for the current phase (key caps + verb), instead of instruction sentences. */
  function refreshPrompt() {
    if (phase === 'replay') return hud.hints([['Space', 'Skip replay']]); // always shown: it is the only control
    if (!get('hints', true)) return hud.hints([]);
    const keeper2p = [['A / D', 'Low dive'], ['Q / E', 'High dive'], ['S', 'Block'], ['W', 'Jump']];
    const items = {
      aim: [[mode === '2p' ? '← → ↑ ↓' : 'Mouse / ←→↑↓', 'Aim'], ['Hold Space', 'Power'], ...(mode === '2p' ? keeper2p : [])],
      power: [['Release', 'Lock power']],
      curve: [['Space', 'Lock curve']],
      keeper: [['Click', 'Dive there'], ['← / →', 'Low dive'], ['Q / E', 'High dive'], ['↓', 'Block'], ['↑', 'Jump']],
    }[phase] ?? [];
    hud.hints(items);
  }
  function refreshCoach() {
    hud.coach(coaching && kick?.shooterHuman && ['aim', 'power', 'curve'].includes(phase) ? phase : null);
  }

  // --- Physics events -----------------------------------------------------------------------
  function onPhysicsEvent(e) {
    // The whole ball scores before it reaches the net collider; net impacts still matter in result.
    if(e.type==='net' && kick && ['flight','result'].includes(phase)){world.net.hit(ball.position);onEvent('net',{speed:e.speed});return;}
    if (!kick || kick.outcome || phase !== 'flight') return;
    if (e.type === 'post' || e.type === 'bar') {
      kick.woodwork = true;
      kick.woodworkType ??= e.type;
      director.addShake(0.06);
      fx.hit(ball.position, e.speed);
      onEvent('woodwork', { type: e.type, speed: e.speed, x: ball.position.x });
    } else if (e.type === 'keeper' && !kick.touchedKeeper) {
      kick.touchedKeeper = true;
      fx.hit(ball.position, e.speed, 0xfff2cf); // glove contact: warm white
      // Clean contact on a slower ball = catch and hold; otherwise the physics parries it.
      const catchBelow = kick.keeperHuman ? DIFFICULTY.normal.catchBelow : ai.catchBelow;
      if (e.speed < catchBelow) kick.held = true;
      onEvent('keeper-touch', { held: kick.held, speed: e.speed, x: ball.position.x });
    }
  }

  // --- Per-frame ----------------------------------------------------------------------------
  function update(rawDt) {
    if (paused) return;
    if (phase === 'replay') { updateReplay(rawDt); director.update(rawDt); return; }
    // Brief slow-motion after a goal or save: time eases from `from` back to 1 (quadratic ease-out).
    let dt = rawDt;
    if (slow) {
      slow.left -= rawDt;
      if (slow.left <= 0) slow = null;
      else { const u = 1 - slow.left / slow.total; dt = rawDt * (slow.from + (1 - slow.from) * u * u); }
    }
    phaseT += dt;
    handlePhaseInput(dt);

    keeper.update(dt);
    striker.update(dt);

    if (phase === 'flight' || phase === 'result') {
      if (phase === 'flight') kick.t += dt;
      if (pendingSave && kick.t >= pendingSave.at) {
        keeper.dive(pendingSave.move);
        pendingSave = null;
      }
      // Drive keeper limb colliders from the animated skeleton, then step physics at a fixed rate.
      keeper.root.updateMatrixWorld(true);
      physics.driveKeeperLimbs(keeper.limbPositions(limbPos));
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 64) { // cap protects against a long stall
        if (kick.held) holdBall();
        physics.step();
        accumulator -= STEP;
        steps++;
      }
      syncBall();
      const v = physics.ball.linvel();
      fx.trail(ball.position, Math.hypot(v.x, v.y, v.z), phase === 'flight');
      if (phase === 'flight') judge();
    }
    fx.update(dt);
    if (recording) { recT += dt; recorder.record(recT); }

    if (phase === 'result') {
      const willReplay = shouldReplay();
      if (phaseT > (willReplay ? RESULT_HOLD_BEFORE_REPLAY : RESULT_HOLD)) {
        recording = false;
        if (willReplay) startReplay(); else advance();
      }
    }

    if (debugLines) {
      keeper.root.updateMatrixWorld(true);
      physics.driveKeeperLimbs(keeper.limbPositions(limbPos));
      const { vertices } = physics.world.debugRender();
      debugLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    }
    director.update(dt);
  }

  function handlePhaseInput(dt) {
    // 1P in goal: a dive marker follows the pointer until a dive is chosen.
    if (kick && !kick.shooterHuman && mode === '1p') {
      const n = !playerMove && keeperWindow() ? input.pointerNdc() : null;
      const r = canvas.getBoundingClientRect();
      hud.reticle(n ? { x: (n.x * 0.5 + 0.5) * r.width, y: (-n.y * 0.5 + 0.5) * r.height } : null, 'keeper');
    }
    if (phase === 'aim' || phase === 'power' || phase === 'curve') {
      // Keyboard aiming. In 2P the keeper owns WASD, so the shooter aims with the arrows only.
      const R = mode === '2p' ? ['ArrowRight'] : ['ArrowRight', 'KeyD'];
      const L = mode === '2p' ? ['ArrowLeft'] : ['ArrowLeft', 'KeyA'];
      const U = mode === '2p' ? ['ArrowUp'] : ['ArrowUp', 'KeyW'];
      const D = mode === '2p' ? ['ArrowDown'] : ['ArrowDown', 'KeyS'];
      const dx = (input.held(...R) ? 1 : 0) - (input.held(...L) ? 1 : 0);
      const dy = (input.held(...U) ? 1 : 0) - (input.held(...D) ? 1 : 0);
      if (dx || dy) {
        aim.x += dx * AIM.keySpeed * dt;
        aim.y += dy * AIM.keySpeed * dt;
        input.resetPointer();
      } else {
        // Pointer aims in all three phases, so on touch you can press where you want and drag to adjust.
        const p = input.pointerOnGoalPlane(tmp);
        if (p) { aim.x = p.x; aim.y = p.y; }
      }
      aim.x = THREE.MathUtils.clamp(aim.x, AIM.minX, AIM.maxX);
      aim.y = THREE.MathUtils.clamp(aim.y, AIM.minY, AIM.maxY);
      hud.reticle(toScreen(tmp.set(aim.x, aim.y, 0)));
    }
    if (phase === 'power') {
      // Ping-pong 0 → 1 → 0 while held.
      const u = (phaseT / POWER_PERIOD) % 2;
      meter.power = u <= 1 ? u : 2 - u;
      hud.meters(true, { power: meter.power, curve: 0 });
    } else if (phase === 'curve') {
      meter.curve = Math.sin((phaseT / CURVE_PERIOD) * Math.PI * 2);
      hud.meters(true, { power: meter.power, curve: meter.curve, curveActive: true });
    } else if (phase === 'keeper' && phaseT > 1.4 && !striker.run) {
      startRecording();
      striker.runUp(SPOT, strike, 1.0);
      setPhase('runup');
      onEvent('whistle', {});
    }
  }

  const keeperWindow = () => kick?.keeperHuman && !kick.outcome && ['aim', 'power', 'curve', 'keeper', 'runup', 'flight'].includes(phase);

  input.on('primarydown', ({ source }) => {
    if (paused) return;
    if (phase === 'aim') setPhase('power');
    else if (phase === 'curve') beginRunUp();
    else if (phase === 'replay') endReplay();
    else if (!kick?.shooterHuman && keeperWindow() && source === 'pointer') {
      // 1P in goal: click where to dive.
      const p = keeperPointerTarget();
      if (p) keeperChoice(p.x, p.y);
    }
  });
  input.on('primaryup', () => {
    if (!paused && phase === 'power') setPhase('curve');
  });
  input.on('key', (e) => {
    if (paused || !keeperWindow()) return;
    // Keys are screen-relative. From the keeper's-eye camera (1P in goal) screen-left is +X;
    // from the shooter's camera (2P) it is −X.
    const left = kick.shooterHuman ? -2.6 : 2.6;
    const map = mode === '2p'
      ? { KeyA: [left, 0.5], KeyD: [-left, 0.5], KeyQ: [left, 1.9], KeyE: [-left, 1.9], KeyS: [0, 0.5], KeyW: [0, 2] }
      : {
        ArrowLeft: [left, 0.5], KeyA: [left, 0.5], ArrowRight: [-left, 0.5], KeyD: [-left, 0.5],
        KeyQ: [left, 1.9], KeyE: [-left, 1.9], ArrowDown: [0, 0.5], KeyS: [0, 0.5], ArrowUp: [0, 2], KeyW: [0, 2],
      };
    const m = map[e.code];
    if (m) keeperChoice(m[0], m[1]);
  });

  /**
   * From the keeper's camera (inside the goal mouth) the goal frame itself is off-screen, so a ray onto the
   * goal plane would only reach a metre or so either side. Map the screen to the goal instead: the screen's
   * width spans the goal mouth (screen-left is +X when facing out) and its height spans ground to bar.
   */
  function keeperPointerTarget() {
    const n = input.pointerNdc();
    if (!n) return null;
    return {
      x: THREE.MathUtils.clamp(-n.x * GOAL.halfWidth * 1.15, -GOAL.halfWidth, GOAL.halfWidth),
      y: THREE.MathUtils.clamp(((n.y + 0.85) / 1.45) * GOAL.height, 0.1, GOAL.height),
    };
  }

  function keeperChoice(x, y) {
    if (playerMove || kick.outcome) return;
    playerMove = moveForPoint(x, y);
    if (!kick.shooterHuman) { hud.hints([]); hud.reticle(null); }
    if (phase === 'flight') keeper.dive(playerMove); // after the strike: go now
  }

  // --- Ball handling ------------------------------------------------------------------------
  function holdBall() {
    keeper.handsCentre(tmp);
    physics.ball.setTranslation({ x: tmp.x, y: Math.max(BALL.radius, tmp.y), z: tmp.z + 0.12 }, true);
    physics.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    physics.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  function syncBall() {
    const p = physics.ball.translation();
    const q = physics.ball.rotation();
    ball.position.set(p.x, p.y, p.z);
    ball.quaternion.set(q.x, q.y, q.z, q.w);
  }

  /** Decide the outcome of the kick in flight. */
  function judge() {
    const p = physics.ball.translation();
    const v = physics.ball.linvel();
    // Whole ball over the whole line, between the posts and under the bar.
    if (p.z < -(GOAL.postRadius + BALL.radius) && Math.abs(p.x) < GOAL.halfWidth && p.y < GOAL.height) {
      return finishKick('goal');
    }
    const speed = Math.hypot(v.x, v.y, v.z);
    const dead = kick.held && kick.t > 0.5;
    const stopped = kick.t > 0.8 && speed < 0.6;
    const gone = p.z > 16 || p.z < -4 || Math.abs(p.x) > 12 || kick.t > 3.5;
    const wentPast = p.z < -0.3 && !(Math.abs(p.x) < GOAL.halfWidth && p.y < GOAL.height); // wide or over
    if (dead || stopped || gone || (wentPast && kick.t > 0.3)) {
      finishKick(kick.touchedKeeper ? 'saved' : kick.woodwork ? 'post' : 'miss');
    }
  }

  const _s = new THREE.Vector3();
  function toScreen(p) {
    _s.copy(p).project(camera);
    if (_s.z > 1) return null;
    const r = canvas.getBoundingClientRect();
    return { x: (_s.x * 0.5 + 0.5) * r.width, y: (-_s.y * 0.5 + 0.5) * r.height };
  }

  startKick();

  return {
    update,
    get phase() { return phase; },
    get shootout() { return shootout; },
    get kick() { return kick; },
    get paused() { return paused; },
    level,
    mode,
    setPaused(p) {
      paused = p;
      if (p && phase === 'power') setPhase('aim'); // a held charge is cancelled, not fired, on pause
    },
    restart() {
      replay = null;
      hud.replay(false);
      shootout = createShootout();
      startKick();
    },
    /** Test hook: take the current human penalty without the meters. */
    debugShoot(target, power = 0.7, curve = 0) {
      if (!kick.shooterHuman || !['aim', 'power', 'curve'].includes(phase)) return false;
      Object.assign(aim, target);
      meter.power = power;
      meter.curve = curve;
      beginRunUp();
      return true;
    },
    debugKeeper(x, y) { keeperChoice(x, y); },
    get debugInput() { return input; },
    /** Test hook: make the AI keeper's next save attempt a given move after `delay` seconds. */
    debugForceSave(move, delay = 0.02) { forcedSave = { delay, move }; },
    dispose() {
      unsubscribe?.();
      fx.dispose();
      input.dispose();
      hud.dispose();
      physics.dispose();
      if (debugLines) { world.scene.remove(debugLines); debugLines.geometry.dispose(); debugLines.material.dispose(); }
    },
  };
}
