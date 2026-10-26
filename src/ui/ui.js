import '../styles/ui.css';
import { settings } from '../core/settings.js';
import { TEAMS, team } from '../game/teams.js';
import { shirtIcon } from './kit-icon.js';
import { kickDots } from './hud.js';

/**
 * All menus and dialogs, as real HTML over the canvas.
 *
 * Full screens (one at a time): menu, setup — or none while a match is on.
 * Dialogs (stacked, modal, focus-trapped): pause, settings, help, end.
 *
 * The UI never touches the game directly; it calls the handlers it was given and the app calls back
 * into it (showMenu, showEnd, …).
 *
 * @param {{ onKickOff: (opts) => void, onPause: (paused: boolean) => void, onQuit: () => void,
 *           onRematch: () => void, onSettingChanged?: (k, v) => void }} handlers
 */
export function createUI(handlers, root = document.getElementById('ui')) {
  root.insertAdjacentHTML('beforeend', TEMPLATE);
  const $ = (s, el = root) => el.querySelector(s);
  const $$ = (s, el = root) => [...el.querySelectorAll(s)];

  const screens = Object.fromEntries($$('[data-screen]').map((el) => [el.dataset.screen, el]));
  const dialogs = Object.fromEntries($$('[data-dialog]').map((el) => [el.dataset.dialog, el]));
  const stack = []; // open dialogs, top last
  let mode = '1p';
  let inMatch = false;
  const returnFocus = [];

  // --- Screens -----------------------------------------------------------------------------
  function showScreen(name) {
    for (const [n, el] of Object.entries(screens)) {
      const on = n === name;
      el.hidden = !on;
      el.classList.toggle('is-active', on);
    }
    if (name) focusFirst(screens[name]);
  }

  function openDialog(name) {
    const el = dialogs[name];
    if (stack.includes(name)) return;
    returnFocus.push(document.activeElement);
    stack.push(name);
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('is-open'));
    focusFirst(el);
  }

  function closeDialog() {
    const name = stack.pop();
    if (!name) return;
    const el = dialogs[name];
    el.classList.remove('is-open');
    el.hidden = true;
    const back = returnFocus.pop();
    if (back?.isConnected) back.focus();
    if (name === 'pause' && inMatch) handlers.onPause(false);
  }

  function closeAll() { while (stack.length) closeDialog(); }

  function focusFirst(container) {
    const target = container.querySelector('[autofocus]') ?? focusables(container)[0];
    target?.focus({ preventScroll: true });
  }
  const focusables = (el) =>
    $$('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', el).filter((n) => !n.closest('[hidden]'));

  // Modal focus trap, Esc handling, and arrow keys in the main menu.
  document.addEventListener('keydown', (e) => {
    const top = stack.at(-1);
    if (e.key === 'Escape') {
      if (top) { e.preventDefault(); closeDialog(); return; }
      if (inMatch) { e.preventDefault(); pause(); return; }
      if (!screens.setup.hidden) { e.preventDefault(); showScreen('menu'); return; }
    }
    if ((e.key === 'p' || e.key === 'P') && inMatch && !top) { pause(); return; }
    if ((e.key === '?' || e.key === 'h' || e.key === 'H') && !e.target.closest?.('input')) {
      if (top === 'help') closeDialog(); else if (!top || top === 'pause') openDialog('help');
      return;
    }
    if (!top && !screens.menu.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = $$('.menu__nav button');
      const i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      return;
    }
    if (e.key !== 'Tab' || !top) return;
    const items = focusables(dialogs[top]);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function pause() {
    if (!inMatch || stack.length) return;
    handlers.onPause(true);
    openDialog('pause');
  }

  // --- Actions -----------------------------------------------------------------------------
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'play-1p' || a === 'play-2p') { mode = a === 'play-1p' ? '1p' : '2p'; openSetup(); }
    else if (a === 'help') openDialog('help');
    else if (a === 'settings') openDialog('settings');
    else if (a === 'back') showScreen('menu');
    else if (a === 'close') closeDialog();
    else if (a === 'resume') closeDialog();
    else if (a === 'pause') pause();
    else if (a === 'quit') { closeAll(); inMatch = false; handlers.onQuit(); }
    else if (a === 'rematch') { closeAll(); handlers.onRematch(); }
    else if (a === 'change-setup') { closeAll(); inMatch = false; handlers.onQuit(); openSetup(); }
    else if (a === 'menu') { closeAll(); inMatch = false; handlers.onQuit(); }
    else if (a === 'pick') stepTeam(btn.dataset.side, Number(btn.dataset.dir));
  });

  // --- Setup -------------------------------------------------------------------------------
  const picks = { home: settings.get('homeTeam'), away: settings.get('awayTeam') };
  function openSetup() {
    $('[data-setup-title]').textContent = mode === '1p' ? 'Play vs CPU' : '2 Players';
    $('[data-away-label]').textContent = mode === '1p' ? 'Opponent' : 'Player 2';
    $('[data-home-label]').textContent = mode === '1p' ? 'Your team' : 'Player 1';
    $('.field--difficulty').hidden = mode !== '1p';
    $('[data-setup-note]').textContent = mode === '1p'
      ? 'You take your team’s penalties and keep goal for theirs.'
      : 'Players alternate: one shoots, the other keeps goal.';
    renderPicks();
    showScreen('setup');
  }
  function stepTeam(side, dir) {
    const other = picks[side === 'home' ? 'away' : 'home'];
    let i = TEAMS.findIndex((t) => t.id === picks[side]);
    do { i = (i + dir + TEAMS.length) % TEAMS.length; } while (TEAMS[i].id === other); // no mirror match
    picks[side] = TEAMS[i].id;
    settings.set(side === 'home' ? 'homeTeam' : 'awayTeam', picks[side]);
    renderPicks();
  }
  function renderPicks() {
    for (const side of ['home', 'away']) {
      const t = team(picks[side]);
      $(`[data-pick="${side}"]`).textContent = t.name;
      $(`[data-badge="${side}"]`).innerHTML = shirtIcon(t.kit, { size: 120 });
      $(`.team-card[data-side="${side}"]`).style.setProperty('--team', t.color);
    }
  }
  const diffRadios = $$('input[name="difficulty"]');
  diffRadios.forEach((r) => {
    r.checked = r.value === settings.get('difficulty');
    r.addEventListener('change', () => settings.set('difficulty', r.value));
  });
  $('form.setup').addEventListener('submit', (e) => {
    e.preventDefault();
    showScreen(null);
    inMatch = true;
    handlers.onKickOff({ mode, difficulty: settings.get('difficulty'), home: team(picks.home), away: team(picks.away) });
  });

  // --- Settings ----------------------------------------------------------------------------
  const bindings = [
    ['quality', 'radio'], ['masterVolume', 'range'], ['crowdVolume', 'range'],
    ['muted', 'check'], ['reducedMotion', 'check'], ['hints', 'check'], ['autoReplay', 'check'],
  ];
  for (const [key, kind] of bindings) {
    if (kind === 'radio') {
      $$(`input[name="${key}"]`).forEach((r) => {
        r.checked = r.value === settings.get(key);
        r.addEventListener('change', () => r.checked && settings.set(key, r.value));
      });
    } else {
      const input = $(`[name="${key}"]`);
      if (kind === 'check') {
        input.checked = settings.get(key);
        input.addEventListener('change', () => settings.set(key, input.checked));
      } else {
        input.value = Math.round(settings.get(key) * 100);
        const out = input.closest('.field').querySelector('output');
        const show = () => { out.textContent = `${input.value}%`; input.style.setProperty('--fill', `${input.value}%`); };
        show();
        input.addEventListener('input', () => { show(); settings.set(key, input.value / 100); });
      }
    }
  }
  const applyMotion = () => document.documentElement.classList.toggle('reduce-motion', settings.get('reducedMotion'));
  applyMotion();
  settings.subscribe((k, v) => {
    if (k === 'reducedMotion') applyMotion();
    if (k === 'quality') $$('input[name="quality"]').forEach((r) => { r.checked = r.value === v; }); // e.g. the automatic downgrade
    handlers.onSettingChanged?.(k, v);
  });

  // --- Public API ----------------------------------------------------------------------------
  return {
    showMenu() { inMatch = false; closeAll(); showScreen('menu'); },
    /** A match started without the setup screen (dev ?play): hide screens and enable pause. */
    enterMatch() { closeAll(); showScreen(null); inMatch = true; },
    /** Match finished: show the end dialog. */
    showEnd({ winner, home, away, score, mode: m, kicks }) {
      const w = winner === 'home' ? home : away;
      const youWon = m === '1p' ? winner === 'home' : null;
      $('[data-end-kicker]').textContent = m === '1p' ? (youWon ? 'Full time · You win' : 'Full time · You lose') : `Full time · ${winner === 'home' ? 'Player 1' : 'Player 2'} wins`;
      dialogs.end.dataset.result = youWon === false ? 'loss' : 'win';
      const title = $('[data-end-title]');
      title.textContent = `${w.name} win`;
      title.style.setProperty('--team', w.color);
      $('[data-end-badge]').innerHTML = shirtIcon(w.kit, { size: 80 });
      $('[data-end-score]').innerHTML = `<span>${score.home}</span><span class="end__dash">–</span><span>${score.away}</span>`;
      for (const side of ['home', 'away']) {
        const t = side === 'home' ? home : away;
        const row = $(`[data-end-row="${side}"]`);
        row.style.setProperty('--team', t.color);
        row.querySelector('.end__name').textContent = t.name;
        row.querySelector('.end__dots').innerHTML = kicks ? kickDots(kicks[side], Math.max(5, kicks.home.length, kicks.away.length)) : '';
        row.classList.toggle('is-winner', side === winner);
      }
      openDialog('end');
    },
    get mode() { return mode; },
    get dialogOpen() { return stack.length > 0; },
  };
}

const DIFFICULTIES = [
  ['easy', 'Easy', 'Slow to react and often guesses'],
  ['normal', 'Normal', 'A fair test of your penalties'],
  ['hard', 'Hard', 'Reads your shot, quick off the line'],
  ['legend', 'Legend', 'Sharp reflexes, huge reach'],
];

const TEMPLATE = /* html */ `
<section class="screen screen--menu" data-screen="menu" hidden aria-labelledby="menu-title">
  <div class="arena-id" aria-label="Meridian Arena, night league"><span class="live-chip">Live from</span><strong>Meridian Arena</strong><small>Night league / Penalty shootout</small></div>
  <div class="menu">
    <h1 class="wordmark" id="menu-title" aria-label="Penalty Kings"><span class="wordmark__top">Penalty</span><span class="wordmark__main">Kings</span></h1>
    <p class="menu__tag">Under the lights. For the crown.</p>
    <nav class="menu__nav" aria-label="Main menu">
      <button class="btn btn--primary btn--hero" data-action="play-1p" autofocus>
        <span class="btn__title">Play vs CPU</span><span class="btn__sub">Shoot, then save — against the computer</span>
      </button>
      <button class="menu__item" data-action="play-2p"><span class="menu__label">2 Players</span><span class="menu__hint">Shooter vs keeper on one keyboard</span></button>
      <button class="menu__item" data-action="help"><span class="menu__label">How to play</span><span class="menu__hint">Controls and rules</span></button>
      <button class="menu__item" data-action="settings"><span class="menu__label">Settings</span><span class="menu__hint">Graphics, sound, motion</span></button>
    </nav>
  </div>
  <p class="screen__keys" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> Move</span><span><kbd>Enter</kbd> Select</span><span><kbd>?</kbd> Help</span></p>
</section>

<section class="screen screen--setup" data-screen="setup" hidden aria-labelledby="setup-title">
  <form class="setup">
    <header class="setup__head">
      <button type="button" class="btn btn--ghost btn--back" data-action="back" aria-label="Back to menu">‹ Back</button>
      <div class="setup__heading">
        <p class="eyebrow">Night league / Match setup</p>
        <h2 class="setup__title" id="setup-title" data-setup-title>Play vs CPU</h2>
      </div>
    </header>

    <div class="matchup">
      ${['home', 'away'].map((side) => `
      <div class="team-card" data-side="${side}">
        <span class="team-card__label" id="${side}-label" data-${side}-label>${side === 'home' ? 'Your team' : 'Opponent'}</span>
        <div class="team-card__badge" data-badge="${side}"></div><span class="team-card__kit-label">Match kit / No. 09</span>
        <div class="team-card__picker" role="group" aria-labelledby="${side}-label">
          <button type="button" class="btn btn--icon" data-action="pick" data-side="${side}" data-dir="-1" aria-label="Previous team">‹</button>
          <output class="team-card__name" data-pick="${side}" aria-live="polite"></output>
          <button type="button" class="btn btn--icon" data-action="pick" data-side="${side}" data-dir="1" aria-label="Next team">›</button>
        </div>
      </div>${side === 'home' ? '<div class="matchup__vs" aria-hidden="true">vs</div>' : ''}`).join('')}
    </div>

    <fieldset class="difficulty field--difficulty">
      <legend class="section-label">Keeper difficulty</legend>
      <div class="difficulty__options">
        ${DIFFICULTIES.map(([v, name, desc], i) => `
        <label class="diff">
          <input type="radio" name="difficulty" value="${v}">
          <span class="diff__card">
            <span class="diff__pips" aria-hidden="true">${[0, 1, 2, 3].map((p) => `<i class="${p <= i ? 'on' : ''}"></i>`).join('')}</span>
            <span class="diff__name">${name}</span>
            <span class="diff__desc">${desc}</span>
          </span>
        </label>`).join('')}
      </div>
    </fieldset>

    <footer class="setup__foot">
      <p class="setup__note" data-setup-note></p>
      <button class="btn btn--primary btn--xl setup__go" type="submit" autofocus>Kick off <span aria-hidden="true">›</span></button>
    </footer>
  </form>
</section>

<div class="dialog" data-dialog="pause" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title">
  <div class="dialog__card dialog__card--narrow">
    <p class="eyebrow">Match paused</p>
    <h2 class="dialog__title" id="pause-title">Paused</h2>
    <div class="stack">
      <button class="btn btn--primary btn--lg" data-action="resume" autofocus>Resume</button>
      <button class="btn btn--lg" data-action="settings">Settings</button>
      <button class="btn btn--lg" data-action="help">Controls</button>
      <button class="btn btn--ghost btn--lg btn--danger-text" data-action="quit">Quit to menu</button>
    </div>
  </div>
</div>

<div class="dialog" data-dialog="settings" hidden role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <div class="dialog__card dialog__card--settings">
    <header class="dialog__head">
      <h2 class="dialog__title" id="settings-title">Settings</h2>
      <button class="btn btn--ghost btn--icon" data-action="close" aria-label="Close settings">✕</button>
    </header>
    <div class="settings">
      <fieldset class="settings__group">
        <legend class="section-label">Graphics</legend>
        <div class="field">
          <span class="field__label" id="quality-label">Quality</span>
          <div class="segmented" role="radiogroup" aria-labelledby="quality-label">
            <label><input type="radio" name="quality" value="low"><span>Low<small>Faster</small></span></label>
            <label><input type="radio" name="quality" value="high"><span>High<small>Bloom, sharper</small></span></label>
          </div>
        </div>
      </fieldset>
      <fieldset class="settings__group">
        <legend class="section-label">Sound</legend>
        <label class="field field--range"><span class="field__label">Master volume</span><output></output><input type="range" name="masterVolume" min="0" max="100"></label>
        <label class="field field--range"><span class="field__label">Crowd volume</span><output></output><input type="range" name="crowdVolume" min="0" max="100"></label>
        <label class="check"><input type="checkbox" name="muted"><span class="check__box" aria-hidden="true"></span><span>Mute all sound</span></label>
      </fieldset>
      <fieldset class="settings__group">
        <legend class="section-label">Gameplay &amp; accessibility</legend>
        <label class="check"><input type="checkbox" name="hints"><span class="check__box" aria-hidden="true"></span><span>Show control hints</span></label>
        <label class="check"><input type="checkbox" name="autoReplay"><span class="check__box" aria-hidden="true"></span><span>Auto replay<small>Goals, saves and woodwork</small></span></label>
        <label class="check"><input type="checkbox" name="reducedMotion"><span class="check__box" aria-hidden="true"></span><span>Reduced motion<small>Camera cuts instead of moves, no shake or flashes</small></span></label>
      </fieldset>
    </div>
    <button class="btn btn--primary btn--lg dialog__done" data-action="close">Done</button>
  </div>
</div>

<div class="dialog" data-dialog="help" hidden role="dialog" aria-modal="true" aria-labelledby="help-title">
  <div class="dialog__card dialog__card--wide">
    <header class="dialog__head">
      <h2 class="dialog__title" id="help-title">How to play</h2>
      <button class="btn btn--ghost btn--icon" data-action="close" aria-label="Close help">✕</button>
    </header>
    <div class="help">
      <section>
        <h3 class="section-label">Taking a penalty</h3>
        <ol class="steps">
          <li><b>Aim</b><span>Move the mouse, drag on touch, or use <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></span></li>
          <li><b>Power</b><span>Hold <kbd>Space</kbd> (or press and hold) and release. The striped red end skies it.</span></li>
          <li><b>Curve</b><span>Press again to stop the swinging marker. Curve bends the flight, not where it ends up.</span></li>
        </ol>
      </section>
      <section>
        <h3 class="section-label">In goal</h3>
        <p class="help__p">Click or tap where to dive — before the kick to guess, after it to react.</p>
        <dl class="keys">
          <dt><kbd>←</kbd><kbd>→</kbd> <span class="or">or</span> <kbd>A</kbd><kbd>D</kbd></dt><dd>Low dive</dd>
          <dt><kbd>Q</kbd><kbd>E</kbd></dt><dd>High dive</dd>
          <dt><kbd>↓</kbd> <span class="or">or</span> <kbd>S</kbd></dt><dd>Block</dd>
          <dt><kbd>↑</kbd> <span class="or">or</span> <kbd>W</kbd></dt><dd>Jump</dd>
        </dl>
      </section>
      <section>
        <h3 class="section-label">Rules &amp; keys</h3>
        <p class="help__p">Five kicks each; it ends early once one side can’t catch up, then sudden death in pairs.</p>
        <p class="help__p">2 players: the shooter uses the mouse or arrows + <kbd>Space</kbd>; the keeper uses <kbd>A</kbd><kbd>D</kbd><kbd>Q</kbd><kbd>E</kbd><kbd>S</kbd><kbd>W</kbd>.</p>
        <dl class="keys">
          <dt><kbd>Esc</kbd> <span class="or">or</span> <kbd>P</kbd></dt><dd>Pause</dd>
          <dt><kbd>?</kbd></dt><dd>This help</dd>
          <dt><kbd>Space</kbd></dt><dd>Skip a replay</dd>
        </dl>
      </section>
    </div>
    <button class="btn btn--primary btn--lg dialog__done" data-action="close">Got it</button>
  </div>
</div>

<div class="dialog dialog--end" data-dialog="end" hidden role="dialog" aria-modal="true" aria-labelledby="end-title">
  <div class="dialog__card end">
    <p class="eyebrow end__kicker" data-end-kicker></p>
    <div class="end__winner">
      <span class="end__badge" data-end-badge></span>
      <h2 class="end__title" id="end-title" data-end-title></h2>
    </div>
    <div class="end__board">
      <div class="end__row" data-end-row="home"><span class="end__name"></span><span class="end__dots"></span></div>
      <div class="end__score" data-end-score></div>
      <div class="end__row end__row--away" data-end-row="away"><span class="end__dots"></span><span class="end__name"></span></div>
    </div>
    <div class="end__actions">
      <button class="btn btn--primary btn--lg" data-action="rematch" autofocus>Rematch</button>
      <button class="btn btn--lg" data-action="change-setup">Change setup</button>
      <button class="btn btn--ghost btn--lg" data-action="menu">Main menu</button>
    </div>
  </div>
</div>`;
