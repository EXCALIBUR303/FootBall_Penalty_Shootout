import '../styles/hud.css';

/**
 * In-match HUD: scoreboard with round dots, turn banner, prompts, onboarding coach marks, meters,
 * aim reticle and the per-kick result banner. Created per match, removed on quit.
 *
 * @param {{ home: {name, short, color}, away: {name, short, color} }} teams
 */
export function createHud({ home, away }, root = document.getElementById('ui')) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.style.setProperty('--home', home.color);
  el.style.setProperty('--away', away.color);
  el.innerHTML = /* html */ `
    <header class="scoreboard" aria-label="Score">
      <div class="scoreboard__team scoreboard__team--home">
        <span class="scoreboard__swatch"></span>
        <span class="scoreboard__name" title="${home.name}">${home.short}</span>
        <span class="scoreboard__dots" data-team="home" aria-label="${home.name} kicks"></span>
      </div>
      <div class="scoreboard__score" aria-live="polite">
        <span data-score="home">0</span><span class="scoreboard__sep">–</span><span data-score="away">0</span>
      </div>
      <div class="scoreboard__team scoreboard__team--away">
        <span class="scoreboard__dots" data-team="away" aria-label="${away.name} kicks"></span>
        <span class="scoreboard__name" title="${away.name}">${away.short}</span>
        <span class="scoreboard__swatch"></span>
      </div>
      <div class="scoreboard__round" data-round></div>
    </header>
    <button class="btn btn--icon hud__pause" data-action="pause" aria-label="Pause (Esc)">❚❚</button>
    <div class="turn" data-turn aria-live="polite"></div>
    <div class="hud__reticle" hidden></div>
    <div class="coach" hidden role="note"><span class="coach__step"></span><span class="coach__text"></span></div>
    <p class="hud__prompt" aria-live="polite"></p>
    <div class="hud__meters" hidden>
      <div class="meter meter--power">
        <span class="meter__label">Power <b data-power>0%</b></span>
        <div class="meter__track"><div class="meter__sweet"></div><div class="meter__fill"></div></div>
      </div>
      <div class="meter meter--curve">
        <span class="meter__label">Curve <b data-curve>0</b></span>
        <div class="meter__track"><div class="meter__centre"></div><div class="meter__mark"></div></div>
      </div>
    </div>
    <div class="hud__result" role="status" aria-live="assertive"></div>`;
  root.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const reticle = $('.hud__reticle');
  const meters = $('.hud__meters');
  const powerFill = $('.meter--power .meter__fill');
  const curveMark = $('.meter--curve .meter__mark');
  const result = $('.hud__result');
  const coach = $('.coach');
  const turn = $('[data-turn]');
  let coachStep = null;
  let turnTimer = 0;
  let lastScore = { home: 0, away: 0 };

  return {
    setScore(shootout, { round, suddenDeath }) {
      for (const team of ['home', 'away']) {
        const n = shootout.kicks[team].filter(Boolean).length;
        const node = $(`[data-score="${team}"]`);
        node.textContent = n;
        if (n !== lastScore[team]) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }
        lastScore[team] = n;
        $(`[data-team="${team}"]`).innerHTML = dots(shootout, team);
      }
      $('[data-round]').textContent = suddenDeath ? 'Sudden death' : `Round ${Math.min(round, 5)} of 5`;
    },
    /** Big "whose turn" banner shown briefly at the start of each kick. */
    turn(text, team) {
      turn.textContent = text;
      turn.dataset.team = team;
      turn.classList.remove('is-shown'); void turn.offsetWidth; turn.classList.add('is-shown');
      clearTimeout(turnTimer);
      turnTimer = setTimeout(() => turn.classList.remove('is-shown'), 1400);
    },
    prompt(text) { $('.hud__prompt').textContent = text; },
    reticle(screen) {
      reticle.hidden = !screen;
      if (screen) {
        reticle.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
        if (coachStep === 'aim') coach.style.transform = `translate(${screen.x + 28}px, ${screen.y - 18}px)`;
      }
    },
    meters(show, { power = 0, curve = 0, curveActive = false } = {}) {
      meters.hidden = !show;
      powerFill.style.width = `${power * 100}%`;
      meters.classList.toggle('is-over', power > 0.92);
      curveMark.style.left = `${50 + curve * 50}%`;
      meters.classList.toggle('is-curve', curveActive);
      $('[data-power]').textContent = `${Math.round(power * 100)}%`;
      $('[data-curve]').textContent = curve > 0.05 ? `→ ${Math.round(curve * 100)}` : curve < -0.05 ? `← ${Math.round(-curve * 100)}` : '0';
    },
    /** Onboarding coach mark: 'aim' | 'power' | 'curve' | null. */
    coach(step) {
      coachStep = step;
      coach.hidden = !step;
      coach.dataset.step = step ?? '';
      if (!step) return;
      const copy = {
        aim: ['1/3', 'Aim: move the mouse or use the arrow keys'],
        power: ['2/3', 'Hold SPACE or press and hold, then release to set power'],
        curve: ['3/3', 'Press again to lock the curve — it bends the flight'],
      }[step];
      $('.coach__step').textContent = copy[0];
      $('.coach__text').textContent = copy[1];
      if (step !== 'aim') coach.style.transform = '';
    },
    result(kind, text) {
      result.textContent = text ?? '';
      result.dataset.kind = kind ?? '';
      result.classList.toggle('is-shown', Boolean(kind));
    },
    dispose() { clearTimeout(turnTimer); el.remove(); },
  };
}

// ● scored ○ missed ◌ to come — shape differs as well as colour (never colour alone).
function dots(s, team) {
  const taken = s.kicks[team];
  const n = Math.max(5, s.kicks.home.length, s.kicks.away.length);
  return Array.from({ length: n }, (_, i) =>
    i >= taken.length ? '<i class="dot dot--todo" title="to come"></i>'
    : taken[i] ? '<i class="dot dot--goal" title="scored"></i>'
    : '<i class="dot dot--miss" title="missed"></i>',
  ).join('');
}
