// Keyboard + touch pad input. Emits logical keys: up down left right a b menu.
const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', z: 'a', Enter: 'a', ' ': 'a', x: 'b', Escape: 'b', Backspace: 'b', m: 'menu', Tab: 'menu', c: 'menu', Shift: 'run' };
const held = new Set();
const order = [];
const listeners = new Set();
let anyKeyCb = null;

function press(k) {
  if (anyKeyCb) { const cb = anyKeyCb; anyKeyCb = null; cb(); }
  if (!held.has(k)) { held.add(k); if (['up', 'down', 'left', 'right'].includes(k)) order.push(k); for (const fn of [...listeners]) fn(k); }
}
function release(k) { held.delete(k); const i = order.indexOf(k); if (i >= 0) order.splice(i, 1); }

export function initInput() {
  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!k) return;
    e.preventDefault();
    if (!e.repeat) press(k); else if (['up', 'down', 'left', 'right'].includes(k)) for (const fn of [...listeners]) fn(k, true);
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (k) release(k); });
  addEventListener('blur', () => { held.clear(); order.length = 0; });
  for (const b of document.querySelectorAll('#pad [data-k]')) {
    const k = b.dataset.k;
    const down = (e) => { e.preventDefault(); b.classList.add('down'); press(k); };
    const up = (e) => { e.preventDefault(); b.classList.remove('down'); release(k); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // sliding a thumb across the d-pad switches direction
  const dpad = document.getElementById('dpad');
  if (dpad) dpad.addEventListener('pointermove', (e) => {
    if (!e.buttons && e.pointerType === 'mouse') return;
    const t = document.elementFromPoint(e.clientX, e.clientY);
    if (t && t.dataset && t.dataset.k && !held.has(t.dataset.k) && t.parentElement === dpad) { for (const d of ['up', 'down', 'left', 'right']) { release(d); dpad.querySelector(`[data-k=${d}]`).classList.remove('down'); } t.classList.add('down'); press(t.dataset.k); }
  });
}
export const isHeld = (k) => held.has(k);
export const heldDir = () => order[order.length - 1] || null;
export function onKey(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function onFirstInput(cb) { anyKeyCb = cb; addEventListener('pointerdown', () => { if (anyKeyCb) { const c = anyKeyCb; anyKeyCb = null; c(); } }, { once: true }); }
export function clearHeld() { held.clear(); order.length = 0; }
