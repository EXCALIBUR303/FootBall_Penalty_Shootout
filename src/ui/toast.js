/** Small non-modal message (polite live region) shown at the bottom of the interface layer. */
let el = null;
let timer = 0;

export function toast(message, ms = 5000) {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.getElementById('ui').appendChild(el);
  }
  el.textContent = message;
  el.classList.add('is-shown');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-shown'), ms);
}
