// DOM UI primitives: element helper, dialogue box, choices, toasts, full-screen panels, focus navigation.
import { onKey } from '../core/input.js';
import { sfx } from '../core/audio.js';

export const $ = (s, root = document) => root.querySelector(s);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── modal stack: the top handler receives logical key presses
const stack = [];
export const busy = () => stack.length > 0;
function push(handler) { stack.push(handler); return () => { const i = stack.indexOf(handler); if (i >= 0) stack.splice(i, 1); }; }
onKey((k, repeat) => { const h = stack[stack.length - 1]; if (h) h(k, repeat); });

// Arrow keys move focus between buttons inside `root`; A clicks; B calls onBack.
export function focusNav(root, onBack) {
  const items = () => [...root.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter((b) => b.offsetParent !== null);
  const handler = (k) => {
    const list = items(); if (!list.length) { if (k === 'b' && onBack) onBack(); return; }
    let i = list.indexOf(document.activeElement);
    if (k === 'b') { if (onBack) { sfx('back'); onBack(); } return; }
    if (k === 'a') { if (i >= 0) list[i].click(); else list[0].focus(); return; }
    if (i < 0) { list[0].focus(); return; }
    if (k === 'up' || k === 'down' || k === 'left' || k === 'right') {
      // spatial navigation: nearest button in that direction
      const r = list[i].getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bestD = Infinity;
      for (const b of list) {
        if (b === list[i]) continue;
        const q = b.getBoundingClientRect(), dx = q.left + q.width / 2 - cx, dy = q.top + q.height / 2 - cy;
        const ok = k === 'up' ? dy < -4 : k === 'down' ? dy > 4 : k === 'left' ? dx < -4 : dx > 4;
        if (!ok) continue;
        const d = (k === 'up' || k === 'down') ? Math.abs(dy) + Math.abs(dx) * 2.5 : Math.abs(dx) + Math.abs(dy) * 2.5;
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); sfx('blip'); }
    }
  };
  return push(handler);
}

// ── dialogue
const paginate = (text, max = 108) => {
  const pages = [];
  for (const para of String(text).split('\n\n')) {
    let cur = '';
    for (const sentence of para.match(/[^.!?…]+[.!?…]*["')\]]*\s*|\S+\s*/g) || [para]) {
      if ((cur + sentence).length > max && cur) { pages.push(cur.trim()); cur = ''; }
      cur += sentence;
      while (cur.length > max * 1.35) { const cut = cur.lastIndexOf(' ', max); pages.push(cur.slice(0, cut > 0 ? cut : max).trim()); cur = cur.slice(cut > 0 ? cut + 1 : max); }
    }
    if (cur.trim()) pages.push(cur.trim());
  }
  return pages;
};
export let textFast = false;
export const setTextFast = (v) => { textFast = v; };
export async function say(text, speaker = '') {
  const box = $('#dialog'), body = $('#dialogtext'), more = $('#more');
  $('#speaker').textContent = speaker || '';
  box.hidden = false;
  for (const page of paginate(text)) {
    body.textContent = ''; more.style.visibility = 'hidden';
    let done = false, advance = null;
    const pop = push((k) => { if (k === 'a' || k === 'b') advance(); });
    const click = () => advance();
    box.addEventListener('click', click);
    await new Promise((resolve) => {
      let i = 0;
      const iv = setInterval(() => { i += textFast ? 4 : 2; body.textContent = page.slice(0, i); if (i >= page.length) finish(); }, 16);
      const finish = () => { clearInterval(iv); body.textContent = page; done = true; more.style.visibility = 'visible'; };
      advance = () => { if (!done) finish(); else { sfx('blip'); resolve(); } };
    });
    box.removeEventListener('click', click); pop();
  }
  box.hidden = true;
}
// Message that auto-advances (battle log). Still skippable.
export async function flash(text, ms = 900) {
  const box = $('#dialog'), body = $('#dialogtext');
  $('#speaker').textContent = ''; $('#more').style.visibility = 'hidden';
  box.hidden = false; body.textContent = text;
  await new Promise((resolve) => {
    const t = setTimeout(done, textFast ? ms * 0.5 : ms);
    const pop = push((k) => { if (k === 'a' || k === 'b') done(); });
    box.addEventListener('click', done, { once: true });
    function done() { clearTimeout(t); pop(); box.removeEventListener('click', done); resolve(); }
  });
}
export const hideDialog = () => { $('#dialog').hidden = true; };

export function choose(prompt, options, { cancel = -1 } = {}) {
  const box = $('#choice');
  box.innerHTML = ''; box.className = 'box' + (prompt ? ' prompted' : ''); box.hidden = false;
  if (prompt) box.append(el('div', { class: 'prompt' }, prompt));
  return new Promise((resolve) => {
    const done = (i) => { pop(); box.hidden = true; box.innerHTML = ''; resolve(i); };
    options.forEach((o, i) => box.append(el('button', { onclick: () => { sfx('select'); done(i); } }, o)));
    const pop = focusNav(box, () => done(cancel));
    box.querySelector('button').focus();
  });
}
export function toast(text) {
  const t = el('div', { class: 'toast' }, text);
  $('#toasts').append(t); setTimeout(() => t.remove(), 3300);
}
export function banner(text) {
  const old = $('#banner'); if (old) old.remove();
  $('#overlay').append(el('div', { id: 'banner' }, text));
  setTimeout(() => { const b = $('#banner'); if (b && b.textContent === text) b.remove(); }, 2700);
}

// ── full-screen panels. build(body, api) fills the panel; api.close(value) resolves the promise.
export function panel(title, build, { closable = true } = {}) {
  return new Promise((resolve) => {
    const body = el('div', { class: 'body' });
    const close = (v) => { pop(); root.remove(); const prev = document.querySelector('#panels .panel:last-child'); if (prev && prev._refocus) prev._refocus(); resolve(v); };
    const root = el('section', { class: 'panel' },
      el('header', {}, el('h2', {}, title), closable ? el('button', { class: 'x', onclick: () => { sfx('back'); close(); } }, 'Close') : null), body);
    const api = { close, body, root, redraw: () => { const sc = body.scrollTop; body.innerHTML = ''; build(body, api); body.scrollTop = sc; focusFirst(); }, setTitle: (t) => { root.querySelector('h2').textContent = t; } };
    const focusFirst = () => { const want = api.focusSel && body.querySelector(api.focusSel); const b = want || body.querySelector('button:not(:disabled)') || root.querySelector('.x'); if (b) b.focus({ preventScroll: !!want }); };
    root._refocus = () => { if (!root.contains(document.activeElement)) focusFirst(); };
    $('#panels').append(root);
    const pop = focusNav(root, closable ? () => close() : null);
    build(body, api);
    focusFirst();
  });
}
export const pct = (v, d = 1) => (v * 100).toFixed(v > 0 && v < 0.001 ? 3 : v < 0.01 ? 2 : d) + '%';
