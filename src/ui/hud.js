import '../styles/hud.css';

// Phase 2 HUD: just enough HTML to play (score, round dots, prompt, meters, reticle, result banner).
// Phase 3 replaces the look and adds the menus; the element hooks stay the same.
export function createHud(root = document.getElementById('ui')) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <header class="hud__score" aria-label="Score">
      <span class="hud__team hud__team--home">HOME</span>
      <span class="hud__dots" data-team="home"></span>
      <span class="hud__nums"><span data-score="home">0</span> – <span data-score="away">0</span></span>
      <span class="hud__dots" data-team="away"></span>
      <span class="hud__team hud__team--away">AWAY</span>
      <span class="hud__round"></span>
    </header>
    <div class="hud__reticle" hidden></div>
    <p class="hud__prompt" aria-live="polite"></p>
    <div class="hud__meters" hidden>
      <div class="meter meter--power"><span class="meter__label">POWER</span><div class="meter__track"><div class="meter__sweet"></div><div class="meter__fill"></div></div></div>
      <div class="meter meter--curve"><span class="meter__label">CURVE</span><div class="meter__track"><div class="meter__mark"></div></div></div>
    </div>
    <div class="hud__result" role="status" aria-live="assertive"></div>`;
  root.appendChild(el);

  const $ = (s) => el.querySelector(s);
  const reticle = $('.hud__reticle');
  const meters = $('.hud__meters');
  const powerFill = $('.meter--power .meter__fill');
  const curveMark = $('.meter--curve .meter__mark');
  const result = $('.hud__result');

  return {
    setScore(shootout, { round, suddenDeath }) {
      for (const team of ['home', 'away']) {
        $(`[data-score="${team}"]`).textContent = shootout.kicks[team].filter(Boolean).length;
        $(`[data-team="${team}"]`).innerHTML = dots(shootout, team);
      }
      $('.hud__round').textContent = suddenDeath ? `Sudden death` : `Round ${Math.min(round, 5)}`;
    },
    prompt(text) { $('.hud__prompt').textContent = text; },
    reticle(screen) {
      reticle.hidden = !screen;
      if (screen) reticle.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
    },
    meters(show, { power = 0, curve = 0, curveActive = false } = {}) {
      meters.hidden = !show;
      powerFill.style.width = `${power * 100}%`;
      curveMark.style.left = `${50 + curve * 50}%`;
      meters.classList.toggle('is-curve', curveActive);
    },
    result(kind, text) {
      result.textContent = text ?? '';
      result.dataset.kind = kind ?? '';
      result.classList.toggle('is-shown', Boolean(kind));
    },
    dispose() { el.remove(); },
  };
}

// ● scored ○ missed ◌ to come — shape differs as well as colour (not colour alone).
function dots(s, team) {
  const taken = s.kicks[team];
  const n = Math.max(5, s.kicks.home.length, s.kicks.away.length);
  return Array.from({ length: n }, (_, i) =>
    i >= taken.length ? '<i class="dot dot--todo" aria-label="to come">◌</i>'
    : taken[i] ? '<i class="dot dot--goal" aria-label="scored">●</i>'
    : '<i class="dot dot--miss" aria-label="missed">○</i>',
  ).join('');
}
