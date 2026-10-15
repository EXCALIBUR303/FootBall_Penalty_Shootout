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
import { KIT, setKit } from '../world/scene.js';

const SPOT = new THREE.Vector3(0, BALL.radius, 11);
const POWER_PERIOD = 1.1; // seconds for the power bar to go 0 → 100%
const CURVE_PERIOD = 1.0; // seconds for a full curve swing
const AIM = { minX: -4.6, maxX: 4.6, minY: 0.15, maxY: 3.2, keySpeed: 3.2 };

/**
 * Match controller: a small state machine around one penalty at a time.
 *
 * Home kicks (player shoots):  aim → power (hold) → curve (press) → runup → flight → result
 * Away kicks (player keeps):   keeper → runup → flight → result
 * …until the shootout has a winner → over.
 *
 * Emits nothing yet; Phase 3 wires the menus to `on(...)` and the state getters.
 */
export async function createMatch({ world, canvas, params }) {
  const { keeper, striker, ball, camera } = world;
  const level = DIFFICULTY[params.get('difficulty')] ? params.get('difficulty') : 'normal';
  const ai = DIFFICULTY[level];

  const physics = await createPhysics({ onEvent: onPhysicsEvent });
  physics.setKeeperLimbs(KEEPER_LIMBS);
  const director = new Director(camera);
  const hud = createHud();
  const input = createInput(canvas, camera);
  const rand = Math.random;

  let shootout = createShootout();
  const history = { left: 0, right: 0 }; // where the player tends to shoot (keeper "memory")
  let phase = 'idle';
  let phaseT = 0;
  const aim = { x: 0, y: 1.2 };
  const meter = { power: 0, curve: 0 };
  let kick = null; // current kick: { team, touchedKeeper, woodwork, held, outcome, ... }
  let pendingSave = null; // { at: seconds after strike, move }
  let playerMove = null; // human keeper's chosen move (queued before the strike or immediate after)
  let accumulator = 0;
  let forcedSave = null; // dev/test: overrides the AI's next decision
  const limbPos = new Map();
  const tmp = new THREE.Vector3();

  // ?debug draws every physics collider (goal frame, net, keeper limbs, ball) as lines.
  let debugLines = null;
  if (params.has('debug')) {
    debugLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff00ff, depthTest: false }));
    debugLines.renderOrder = 999;
    world.scene.add(debugLines);
  }
  function drawDebug() {
    const { vertices } = physics.world.debugRender();
    debugLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  }

  // --- Flow ---------------------------------------------------------------------------------
  function setPhase(p) { phase = p; phaseT = 0; }

  function startKick() {
    const team = nextKicker(shootout);
    physics.resetBall(SPOT.x, SPOT.z);
    syncBall();
    keeper.ready();
    striker.setUp(SPOT);
    setKit(striker.root, team === 'home' ? KIT.home : KIT.away);
    hud.result(null);
    hud.setScore(shootout, { round: currentRound(shootout), suddenDeath: isSuddenDeath(shootout) });
    kick = { team, touchedKeeper: false, woodwork: false, held: false, outcome: null, t: 0 };
    pendingSave = null;
    playerMove = null;

    if (team === 'home') {
      aim.x = 0; aim.y = 1.2;
      input.resetPointer();
      setPhase('aim');
      director.cut(SHOTS.aim(SPOT, aim), { cut: true });
      hud.prompt('Aim with the mouse or arrow keys · hold SPACE / click to charge power');
    } else {
      kick.ai = chooseShot(level, rand);
      setPhase('keeper');
      director.cut(SHOTS.keeperView(), { cut: true });
      hud.prompt('You are in goal · click where to dive, or ← → (low), Q E (high), ↓ (block), ↑ (jump)');
    }
  }

  function beginRunUp() {
    setPhase('runup');
    hud.meters(false);
    hud.reticle(null);
    hud.prompt('');
    director.cut(SHOTS.runUp(SPOT));
    striker.runUp(SPOT, strike, 0.95);
  }

  /** Boot meets ball. */
  function strike() {
    const shot = kick.team === 'home'
      ? { target: { ...aim }, power: meter.power, curve: meter.curve }
      : kick.ai;
    const { velocity, spin } = solveShot(SPOT, shot.target, shot.power, shot.curve, rand);
    physics.kick(velocity, spin);
    kick.shot = shot;
    kick.launch = { position: SPOT.clone(), velocity, spin };
    setPhase('flight');
    director.cut(SHOTS.follow(() => ball.position));

    if (kick.team === 'home') {
      // Player is shooting: AI keeper reads (or guesses) the shot.
      const decision = forcedSave ?? decideSave(kick.launch, level, history, rand);
      forcedSave = null;
      pendingSave = { at: decision.delay, move: decision.move };
      if (shot.target.x > 0.6) history.right++; else if (shot.target.x < -0.6) history.left++;
    } else if (playerMove) {
      keeper.dive(playerMove); // player committed before the strike
    }
  }

  function finishKick(outcome) {
    if (kick.outcome) return;
    kick.outcome = outcome;
    const scored = outcome === 'goal';
    recordKick(shootout, scored);
    hud.result(outcome, { goal: 'Goal!', saved: 'Saved!', post: 'Off the woodwork!', miss: 'Missed!' }[outcome]);
    hud.setScore(shootout, { round: currentRound(shootout), suddenDeath: isSuddenDeath(shootout) });
    director.cut(SHOTS.reaction(scored ? 'goal' : 'save', ball.position.clone()));
    striker.react(scored ? 'celebrate' : 'dejected');
    if (!scored && kick.touchedKeeper) keeper.react('celebrate');
    hud.prompt('');
    setPhase('result');
  }

  // --- Physics events -----------------------------------------------------------------------
  function onPhysicsEvent(e) {
    if (!kick || kick.outcome || phase !== 'flight') return;
    if (e.type === 'post' || e.type === 'bar') {
      kick.woodwork = true;
      director.addShake(0.06);
    } else if (e.type === 'keeper' && !kick.touchedKeeper) {
      kick.touchedKeeper = true;
      // Clean contact on a slower ball = catch and hold; otherwise the physics parries it.
      const catchBelow = kick.team === 'home' ? ai.catchBelow : DIFFICULTY.normal.catchBelow;
      if (e.speed < catchBelow) kick.held = true;
    }
  }

  // --- Per-frame ----------------------------------------------------------------------------
  function update(dt) {
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
      if (phase === 'flight') judge();
    }

    if (phase === 'result' && phaseT > 2.6) {
      if (shootout.winner) {
        setPhase('over');
        const won = shootout.winner === 'home';
        hud.result(won ? 'win' : 'lose', won ? 'You win!' : 'You lose');
        hud.prompt(`${score(shootout, 'home')} – ${score(shootout, 'away')} · press ENTER to play again`);
      } else {
        startKick();
      }
    }

    if (debugLines) {
      keeper.root.updateMatrixWorld(true);
      physics.driveKeeperLimbs(keeper.limbPositions(limbPos));
      drawDebug();
    }
    director.update(dt);
  }

  function handlePhaseInput(dt) {
    if (phase === 'aim' || phase === 'power' || phase === 'curve') {
      // Keyboard aiming
      const dx = (input.held('ArrowRight', 'KeyD') ? 1 : 0) - (input.held('ArrowLeft', 'KeyA') ? 1 : 0);
      const dy = (input.held('ArrowUp', 'KeyW') ? 1 : 0) - (input.held('ArrowDown', 'KeyS') ? 1 : 0);
      if (dx || dy) {
        aim.x += dx * AIM.keySpeed * dt;
        aim.y += dy * AIM.keySpeed * dt;
        input.resetPointer();
      } else if (phase === 'aim') {
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
    } else if (phase === 'keeper' && phaseT > 1.2 && !striker.run) {
      striker.runUp(SPOT, strike, 1.0);
      setPhase('runup');
    }
  }

  input.on('primarydown', ({ source }) => {
    if (phase === 'aim') {
      setPhase('power');
      hud.prompt('Release to set power — the red zone skies it');
    } else if (phase === 'curve') {
      beginRunUp();
    } else if (phase === 'over' && source === 'key') {
      restart();
    } else if (kick?.team === 'away' && (phase === 'keeper' || phase === 'runup' || phase === 'flight') && source === 'pointer') {
      const p = input.pointerOnGoalPlane(tmp);
      if (p) keeperChoice(p.x, p.y);
    }
  });
  input.on('primaryup', () => {
    if (phase === 'power') {
      setPhase('curve');
      hud.prompt('Press SPACE / click to lock the curve');
    }
  });
  input.on('key', (e) => {
    if (kick?.team !== 'away' || !['keeper', 'runup', 'flight'].includes(phase)) return;
    // From the keeper's-eye camera, screen right is −X.
    const map = {
      ArrowLeft: [2.6, 0.5], KeyA: [2.6, 0.5], ArrowRight: [-2.6, 0.5], KeyD: [-2.6, 0.5],
      KeyQ: [2.6, 1.9], KeyE: [-2.6, 1.9], ArrowDown: [0, 0.5], KeyS: [0, 0.5], ArrowUp: [0, 2], KeyW: [0, 2],
    };
    const m = map[e.code];
    if (m) keeperChoice(m[0], m[1]);
  });

  function keeperChoice(x, y) {
    if (playerMove || kick.outcome) return;
    playerMove = moveForPoint(x, y);
    hud.prompt('');
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

  function restart() {
    shootout = createShootout();
    startKick();
  }

  startKick();

  return {
    update,
    get phase() { return phase; },
    get shootout() { return shootout; },
    get kick() { return kick; },
    level,
    /** Test hook: take the current home penalty without the meters. */
    debugShoot(target, power = 0.7, curve = 0) {
      if (kick.team !== 'home' || !['aim', 'power', 'curve'].includes(phase)) return false;
      Object.assign(aim, target);
      meter.power = power;
      meter.curve = curve;
      beginRunUp();
      return true;
    },
    debugKeeper(x, y) { keeperChoice(x, y); },
    /** Test hook: make the AI keeper's next save attempt a given move after `delay` seconds. */
    debugForceSave(move, delay = 0.02) { forcedSave = { delay, move }; },
    dispose() {
      input.dispose();
      hud.dispose();
      physics.dispose();
    },
  };
}
