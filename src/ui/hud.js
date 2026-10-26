import '../styles/hud.css';
import { shirtIcon } from './kit-icon.js';

/**
 * In-match HUD (broadcast style): scoreboard with per-kick markers and whose turn it is, a turn banner,
 * contextual key hints, aim reticle, power/curve meters, a lower-third result caption, replay chrome and
 * first-match coach marks. Created per match, removed on quit.
 *
 * @param {{ home: {name, short, color, kit}, away: {name, short, color, kit} }} teams
 */
export function createHud({ home, away }, root = document.getElementById('ui')) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.style.setProperty('--home', home.color);
  el.style.setProperty('--away', away.color);
  const teamBlock = (side, t) => `
      <div class="sb__team sb__team--${side}" data-team-block="${side}">
        <span class="sb__badge">${shirtIcon(t.kit ?? { shirt: t.color }, { size: 26 })}</span>
        <span class="sb__name"><abbr title="${t.name}">${t.short}</abbr></span>
        <span class="sb__ball" aria-hidden="true"></span>
      </div>`;
  el.innerHTML = /* html */ `
    <header class="sb" aria-label="Scoreboard"><div class="sb__label"><span>PK / Night league</span><span>Penalty shootout</span></div>
      <div class="sb__main">
        ${teamBlock('home', home)}
        <div class="sb__score" aria-live="polite" aria-atomic="true">
          <span class="sr-only">${home.name}</span><span data-score="home">0</span><span class="sb__dash" aria-hidden="true">–</span><span class="sr-only">${away.name}</span><span data-score="away">0</span>
        </div>
        ${teamBlock('away', away)}
      </div>
      <div class="sb__strip">
        <span class="sb__dots" data-dots="home" aria-label="${home.name} kicks"></span>
        <span class="sb__round" data-round></span>
        <span class="sb__dots" data-dots="away" aria-label="${away.name} kicks"></span>
      </div>
    </header>
    <button class="hud__pause" data-action="pause" aria-label="Pause (Esc)"><span class="hud__pause-icon" aria-hidden="true"></span><span class="hud__pause-key" aria-hidden="true">Esc</span></button>
    <div class="turn" data-turn aria-live="polite"><span class="turn__number" data-turn-number>09</span><div class="turn__identity"><span class="turn__team" data-turn-team></span><span class="turn__text" data-turn-text></span><small data-turn-role></small></div></div>
    <div class="hud__reticle" hidden aria-hidden="true"><span></span></div>
    <div class="coach" hidden role="note"><span class="coach__step"></span><span class="coach__text"></span></div>
    <div class="meters" hidden>
      <div class="meter meter--power">
        <div class="meter__head"><span>01 / Power</span><b data-power>0%</b></div>
        <div class="meter__track" role="meter" aria-label="Shot power" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter__fill"></div><div class="meter__danger" aria-hidden="true"></div><span class="meter__sweet" aria-hidden="true"></span></div><small class="meter__note" data-meter-note>Release to lock · red zone risks a miss</small>
      </div>
      <div class="meter meter--curve">
        <div class="meter__head"><span>02 / Curve</span><b data-curve>Straight</b></div>
        <div class="meter__track meter__track--curve" role="meter" aria-label="Shot curve" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><div class="meter__centre"></div><div class="meter__mark"></div></div>
      </div>
    </div>
    <div class="lt" data-lt role="status" aria-live="assertive"><div class="lt__body"><span class="lt__title" data-lt-title></span><span class="lt__sub" data-lt-sub></span></div></div>
    <div class="hints" data-hints aria-live="polite"></div>
    <div class="hud__bars" aria-hidden="true"></div>
    <div class="hud__replay" hidden><span class="hud__rec" aria-hidden="true"></span>Replay</div>
    <div class="hud__flash" aria-hidden="true"></div>`;
  root.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const reticle = $('.hud__reticle');
  const meters = $('.meters');
  const powerFill = $('.meter--power .meter__fill');
  const curveMark = $('.meter__mark');
  const lt = $('[data-lt]');
  const coach = $('.coach');
  const turn = $('[data-turn]');
  const hints = $('[data-hints]');
  let coachStep = null;
  let turnTimer = 0;
  let ltTimer = 0;
  const lastScore = { home: 0, away: 0 };
  let lastHints = '';

  return {
    /** @param {{ round: number, suddenDeath: boolean, shooting?: 'home'|'away'|null }} info */
    setScore(shootout, { round, suddenDeath, shooting = null }) {
      const n = Math.max(5, shootout.kicks.home.length, shootout.kicks.away.length);
      for (const team of ['home', 'away']) {
        const goals = shootout.kicks[team].filter(Boolean).length;
        const node = $(`[data-score="${team}"]`);
        node.textContent = goals;
        if (goals !== lastScore[team]) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
        lastScore[team] = goals;
        $(`[data-dots="${team}"]`).innerHTML = kickDots(shootout.kicks[team], n, shooting === team);
        $(`[data-team-block="${team}"]`).classList.toggle('is-shooting', shooting === team);
      }
      const r = $('[data-round]');
      r.textContent = suddenDeath ? 'Sudden death' : `Round ${Math.min(round, 5)} of 5`;
      r.classList.toggle('is-sudden', suddenDeath);
    },
    /** Short banner at the start of each kick: team name + what you are doing. */
    turn(text, team, teamName = '', keeper = false) {
      $('[data-turn-number]').textContent=keeper?'01':'09';
      $('[data-turn-role]').textContent=text;
      $('[data-turn-team]').textContent = teamName;
      $('[data-turn-text]').textContent = keeper?'J. Rook':'A. Vale';
      turn.dataset.team = team;
      turn.classList.remove('is-shown'); void turn.offsetWidth; turn.classList.add('is-shown');
      clearTimeout(turnTimer);
      turnTimer = setTimeout(() => turn.classList.remove('is-shown'), 2600);
    },
    /**
     * Contextual controls for the current phase. items: [[keys, label], …] where keys is a string such as
     * 'Hold Space' or 'Mouse / ←→' (rendered as key caps). Pass [] to hide.
     */
    hints(items) {
      const html = items.map(([keys, label]) => `<span class="hint">${keys.split(' + ').map((k) => `<kbd>${k}</kbd>`).join('<span class="hint__plus">+</span>')}<span class="hint__label">${label}</span></span>`).join('');
      if (html === lastHints) return;
      lastHints = html;
      hints.innerHTML = html;
      hints.classList.toggle('is-empty', !items.length);
    },
    /** Aim reticle (shooter) or dive marker (keeper) at a screen position; null hides it. */
    reticle(screen, variant = 'shot') {
      reticle.hidden = !screen;
      reticle.dataset.variant = variant;
      if (screen) {
        reticle.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
        if (coachStep === 'aim') coach.style.transform = `translate(${screen.x + 34}px, ${screen.y - 22}px)`;
      }
    },
    meters(show, { power = 0, curve = 0, curveActive = false } = {}) {
      meters.hidden = !show;
      if (!show) return;
      powerFill.style.transform = `scaleX(${power})`;
      meters.classList.toggle('is-over', power > 0.92);
      curveMark.style.left = `${50 + curve * 50}%`;
      meters.classList.toggle('is-curve', curveActive);
      $('[data-meter-note]').textContent=curveActive?'Press to lock curve · centre = straight':power>0.92?'Too much power · release carefully':'Release to lock · red zone risks a miss';
      $('.meter--power [role="meter"]').setAttribute('aria-valuenow',Math.round(power*100));
      $('.meter--curve [role="meter"]').setAttribute('aria-valuenow',Math.round(curve*100));
      $('[data-power]').textContent = `${Math.round(power * 100)}%`;
      const c = Math.round(Math.abs(curve) * 100);
      $('[data-curve]').textContent = c < 5 ? 'Straight' : `${curve < 0 ? '← Left' : 'Right →'} ${c}`;
    },
    /** Onboarding coach mark: 'aim' | 'power' | 'curve' | null. */
    coach(step) {
      coachStep = step;
      coach.hidden = !step;
      coach.dataset.step = step ?? '';
      if (!step) return;
      const copy = {
        aim: ['1/3', 'Aim — move the mouse or use the arrow keys'],
        power: ['2/3', 'Hold Space, release to set power. The red end skies it.'],
        curve: ['3/3', 'Press Space again to lock the curve'],
      }[step];
      $('.coach__step').textContent = copy[0];
      $('.coach__text').textContent = copy[1];
      if (step !== 'aim') coach.style.transform = '';
    },
    /**
     * Lower-third result caption (kept clear of the goal mouth so the action stays visible).
     * kind: 'goal' | 'saved' | 'miss' | 'post' | null; team colours the accent bar.
     */
    result(kind, title, sub = '', team = null) {
      clearTimeout(ltTimer);
      if (!kind) { lt.classList.remove('is-shown'); return; }
      $('[data-lt-title]').textContent = title;
      $('[data-lt-sub]').textContent = sub;
      lt.dataset.kind = kind;
      lt.style.setProperty('--team', team === 'away' ? 'var(--away)' : 'var(--home)');
      lt.classList.remove('is-shown'); void lt.offsetWidth;
      // A beat after the moment itself, so the ball crossing the line / the save is seen first.
      ltTimer = setTimeout(() => lt.classList.add('is-shown'), 260);
    },
    /** Replay mode: letterbox bars and the REPLAY badge. */
    replay(on) {
      el.classList.toggle('is-replay', on);
      $('.hud__replay').hidden = !on;
    },
    /** Quick colour pulse at the screen edges on a goal or save (off with reduced motion). */
    flash(kind) {
      const f = $('.hud__flash');
      f.dataset.kind = kind;
      f.classList.remove('is-on'); void f.offsetWidth; f.classList.add('is-on');
    },
    dispose() { clearTimeout(turnTimer); clearTimeout(ltTimer); el.remove(); },
  };
}

/**
 * Per-kick markers. Scored = filled disc with a tick, missed = red ring with a cross, to come = dim ring,
 * next = ring in the team colour. Shape differs as well as colour (never colour alone).
 */
export function kickDots(taken, n, next = false) {
  return Array.from({ length: n }, (_, i) => {
    if (i < taken.length) return taken[i] ? '<i class="k k--goal" title="Scored"></i>' : '<i class="k k--miss" title="Missed"></i>';
    if (i === taken.length && next) return '<i class="k k--next" title="Next kick"></i>';
    return '<i class="k k--todo" title="To come"></i>';
  }).join('');
}
