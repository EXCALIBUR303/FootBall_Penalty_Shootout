import '../styles/ui.css';
import { settings } from '../core/settings.js';
import { TEAMS, team } from '../game/teams.js';

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

  // Modal focus trap + Esc handling.
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

  // --- Menu --------------------------------------------------------------------------------
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
      const el = $(`[data-pick="${side}"]`);
      el.textContent = t.name;
      el.style.setProperty('--team', t.color);
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
    ['muted', 'check'], ['reducedMotion', 'check'], ['hints', 'check'],
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
        const out = input.parentElement.querySelector('output');
        const show = () => { out.textContent = `${input.value}%`; };
        show();
        input.addEventListener('input', () => { show(); settings.set(key, input.value / 100); });
      }
    }
  }
  const applyMotion = () => document.documentElement.classList.toggle('reduce-motion', settings.get('reducedMotion'));
  applyMotion();
  settings.subscribe((k, v) => {
    if (k === 'reducedMotion') applyMotion();
    handlers.onSettingChanged?.(k, v);
  });

  // --- Public API ----------------------------------------------------------------------------
  return {
    showMenu() { inMatch = false; closeAll(); showScreen('menu'); },
    /** Match finished: show the end dialog. */
    showEnd({ winner, home, away, score, mode: m }) {
      const w = winner === 'home' ? home : away;
      const human = m === '1p' ? (winner === 'home' ? 'You win!' : 'You lose') : `${winner === 'home' ? 'Player 1' : 'Player 2'} wins!`;
      $('[data-end-kicker]').textContent = human;
      const title = $('[data-end-title]');
      title.textContent = `${w.name} win`;
      title.style.setProperty('--team', w.color);
      $('[data-end-score]').textContent = `${score.home} – ${score.away}`;
      $('[data-end-teams]').textContent = `${home.name} v ${away.name}`;
      openDialog('end');
    },
    get mode() { return mode; },
    get dialogOpen() { return stack.length > 0; },
  };
}

const TEMPLATE = /* html */ `
<section class="screen screen--menu" data-screen="menu" hidden aria-labelledby="menu-title">
  <div class="menu">
    <p class="eyebrow">Penalty shootout</p>
    <h1 class="brand" id="menu-title">Penalty Kings</h1>
    <nav class="menu__nav" aria-label="Main menu">
      <button class="btn btn--primary btn--xl" data-action="play-1p" autofocus>Play vs CPU</button>
      <button class="btn btn--xl" data-action="play-2p">2 Players</button>
      <button class="btn btn--xl" data-action="help">How to play</button>
      <button class="btn btn--xl" data-action="settings">Settings</button>
    </nav>
    <p class="menu__foot">Keyboard: Tab / Enter · <kbd>?</kbd> help</p>
  </div>
</section>

<section class="screen screen--setup" data-screen="setup" hidden aria-labelledby="setup-title">
  <form class="setup panel">
    <header class="panel__head">
      <button type="button" class="btn btn--ghost btn--sm" data-action="back" aria-label="Back to menu">← Back</button>
      <h2 class="panel__title" id="setup-title" data-setup-title>Play vs CPU</h2>
    </header>
    <div class="field">
      <span class="field__label" data-home-label id="home-label">Your team</span>
      <div class="picker" role="group" aria-labelledby="home-label">
        <button type="button" class="btn btn--icon" data-action="pick" data-side="home" data-dir="-1" aria-label="Previous team">◀</button>
        <output class="picker__value" data-pick="home" aria-live="polite"></output>
        <button type="button" class="btn btn--icon" data-action="pick" data-side="home" data-dir="1" aria-label="Next team">▶</button>
      </div>
    </div>
    <div class="field">
      <span class="field__label" data-away-label id="away-label">Opponent</span>
      <div class="picker" role="group" aria-labelledby="away-label">
        <button type="button" class="btn btn--icon" data-action="pick" data-side="away" data-dir="-1" aria-label="Previous team">◀</button>
        <output class="picker__value" data-pick="away" aria-live="polite"></output>
        <button type="button" class="btn btn--icon" data-action="pick" data-side="away" data-dir="1" aria-label="Next team">▶</button>
      </div>
    </div>
    <fieldset class="field field--difficulty">
      <legend class="field__label">Keeper difficulty</legend>
      <div class="segmented">
        ${['easy', 'normal', 'hard', 'legend'].map((d) => `<label><input type="radio" name="difficulty" value="${d}"><span>${d[0].toUpperCase() + d.slice(1)}</span></label>`).join('')}
      </div>
    </fieldset>
    <button class="btn btn--primary btn--xl setup__go" type="submit">Kick off →</button>
  </form>
</section>

<div class="dialog" data-dialog="pause" hidden role="dialog" aria-modal="true" aria-labelledby="pause-title">
  <div class="dialog__card panel">
    <h2 class="panel__title" id="pause-title">Paused</h2>
    <div class="stack">
      <button class="btn btn--primary" data-action="resume" autofocus>Resume</button>
      <button class="btn" data-action="settings">Settings</button>
      <button class="btn" data-action="help">Controls</button>
      <button class="btn btn--ghost" data-action="quit">Quit to menu</button>
    </div>
  </div>
</div>

<div class="dialog" data-dialog="settings" hidden role="dialog" aria-modal="true" aria-labelledby="settings-title">
  <div class="dialog__card panel">
    <header class="panel__head">
      <h2 class="panel__title" id="settings-title">Settings</h2>
      <button class="btn btn--ghost btn--sm" data-action="close" aria-label="Close settings">✕</button>
    </header>
    <fieldset class="field">
      <legend class="field__label">Graphics quality</legend>
      <div class="segmented">
        <label><input type="radio" name="quality" value="low"><span>Low</span></label>
        <label><input type="radio" name="quality" value="high"><span>High</span></label>
      </div>
    </fieldset>
    <label class="field field--range"><span class="field__label">Master volume</span><input type="range" name="masterVolume" min="0" max="100"><output></output></label>
    <label class="field field--range"><span class="field__label">Crowd volume</span><input type="range" name="crowdVolume" min="0" max="100"><output></output></label>
    <label class="check"><input type="checkbox" name="muted"><span>Mute all sound</span></label>
    <label class="check"><input type="checkbox" name="reducedMotion"><span>Reduced motion <small>(cuts instead of camera moves, no shake)</small></span></label>
    <label class="check"><input type="checkbox" name="hints"><span>Show hints</span></label>
    <button class="btn btn--primary" data-action="close">Done</button>
  </div>
</div>

<div class="dialog" data-dialog="help" hidden role="dialog" aria-modal="true" aria-labelledby="help-title">
  <div class="dialog__card dialog__card--wide panel">
    <header class="panel__head">
      <h2 class="panel__title" id="help-title">How to play</h2>
      <button class="btn btn--ghost btn--sm" data-action="close" aria-label="Close help">✕</button>
    </header>
    <div class="help">
      <section>
        <h3>Taking a penalty</h3>
        <ol>
          <li><b>Aim</b> — move the mouse, drag on touch, or use <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd>.</li>
          <li><b>Power</b> — hold <kbd>Space</kbd> (or press and hold) and release. The red end skies it.</li>
          <li><b>Curve</b> — press again to stop the swinging marker. Curve bends the path, not where it ends up.</li>
        </ol>
      </section>
      <section>
        <h3>In goal</h3>
        <p>Click or tap where you want to dive — before the kick to guess, after it to react. Or use keys:</p>
        <table class="keys">
          <tr><td><kbd>←</kbd>/<kbd>A</kbd> <kbd>→</kbd>/<kbd>D</kbd></td><td>Low dive</td></tr>
          <tr><td><kbd>Q</kbd> <kbd>E</kbd></td><td>High dive</td></tr>
          <tr><td><kbd>↓</kbd>/<kbd>S</kbd></td><td>Block</td></tr>
          <tr><td><kbd>↑</kbd>/<kbd>W</kbd></td><td>Jump</td></tr>
        </table>
        <p class="muted">2 players: the shooter uses the mouse or arrows + <kbd>Space</kbd>; the keeper uses <kbd>A</kbd><kbd>D</kbd><kbd>Q</kbd><kbd>E</kbd><kbd>S</kbd><kbd>W</kbd>.</p>
      </section>
      <section>
        <h3>Rules &amp; keys</h3>
        <p>Five kicks each, then sudden death. <kbd>Esc</kbd>/<kbd>P</kbd> pause · <kbd>?</kbd> this help.</p>
      </section>
    </div>
    <button class="btn btn--primary" data-action="close">Got it</button>
  </div>
</div>

<div class="dialog dialog--end" data-dialog="end" hidden role="dialog" aria-modal="true" aria-labelledby="end-title">
  <div class="dialog__card panel end">
    <p class="eyebrow" data-end-kicker></p>
    <h2 class="end__title" id="end-title" data-end-title></h2>
    <p class="end__score" data-end-score></p>
    <p class="muted" data-end-teams></p>
    <div class="stack stack--row">
      <button class="btn btn--primary" data-action="rematch" autofocus>Rematch</button>
      <button class="btn" data-action="change-setup">Change setup</button>
      <button class="btn btn--ghost" data-action="menu">Main menu</button>
    </div>
  </div>
</div>`;
