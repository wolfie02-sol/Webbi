// Battle scene: plays the event list from systems/battle.js with sprites, HUD, commands and effects.
import { G, kithCanvas, kithIcon } from '../game.js';
import { Battle, WEATHER_NAMES } from '../systems/battle.js';
import { KITH } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { ITEMS } from '../data/items.js';
import { TYPES, effectiveness } from '../data/types.js';
import { MAPS } from '../data/maps.js';
import { createMon, statsOf, nameOf, expForLevel, evolutionTarget, evolve, replaceMove, STATUS_NAMES } from '../systems/monster.js';
import { clock, dailyTick } from '../systems/state.js';
import { sfx, music, currentTrack } from '../core/audio.js';
import { say, flash, choose, toast, panel, focusNav, hideDialog, el, $, sleep } from '../ui/ui.js';

const SW = 320, SH = 208;
const POS = [{ x: 22, y: 58 }, { x: 204, y: 6 }]; // player, foe (96px sprites)
let scene = null; // live battle scene state used by draw()

const SKY = {
  meadow: ['#8cd0f8', '#e8f8d8', '#7cc864'], forest: ['#5c9c88', '#c8e4b8', '#5ca858'], coast: ['#78c8f8', '#f8f0c8', '#f4e4a8'], volcanic: ['#e89868', '#f8d8a8', '#9c8478'],
  snow: ['#a8d0f0', '#f4f8ff', '#e8f0f8'], cave: ['#2c2440', '#4c4460', '#6c6478'], crystal: ['#1c1c48', '#484890', '#3c4470'], crypt: ['#1c1824', '#4c4050', '#7c7068'],
  factory: ['#24242c', '#50505c', '#6c7080'], interior: ['#c8a878', '#f0e4c8', '#d8b888'], gymgrass: ['#48844c', '#c8e8b0', '#a8d890'], gymwater: ['#3c68b0', '#c0e4fc', '#a8d4f0'], gymfire: ['#a84434', '#f0c4a4', '#e0b090'], gymice: ['#5084ac', '#f0f8ff', '#d8ecf8'],
};

export function drawBattle(ctx, t) {
  const sc = scene; if (!sc) return;
  const [s1, s2, gr] = SKY[sc.biome] || SKY.meadow;
  const g = ctx.createLinearGradient(0, 0, 0, SH);
  g.addColorStop(0, s1); g.addColorStop(0.62, s2); g.addColorStop(0.62, gr); g.addColorStop(1, gr);
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
  if (!sc.indoor) { ctx.fillStyle = '#ffffff30'; for (let i = 0; i < 5; i++) { const x = ((i * 83 + t * 6) % (SW + 80)) - 40; ctx.fillRect(x, 14 + (i * 23) % 60, 46, 5); ctx.fillRect(x + 8, 10 + (i * 23) % 60, 26, 5); } ctx.fillStyle = '#00000018'; ctx.beginPath(); ctx.moveTo(0, 129); for (let x = 0; x <= SW; x += 20) ctx.lineTo(x, 118 + Math.sin(x / 37 + 1) * 9); ctx.lineTo(SW, 129); ctx.fill(); }
  if (sc.night && !sc.indoor) { ctx.fillStyle = 'rgba(20,24,80,0.45)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % SW, (i * 53) % 110, 1, 1); }
  // platforms
  for (const [i, p] of POS.entries()) { ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.ellipse(p.x + 48, p.y + 90, i ? 50 : 58, i ? 11 : 13, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#ffffff22'; ctx.beginPath(); ctx.ellipse(p.x + 48, p.y + 88, i ? 44 : 52, i ? 8 : 10, 0, 0, 7); ctx.fill(); }
  // weather
  if (sc.weather === 'rain') { ctx.fillStyle = 'rgba(40,60,110,0.22)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = 'rgba(200,220,255,0.6)'; for (let i = 0; i < 60; i++) ctx.fillRect((i * 67 + t * -90) % SW + (((i * 67 + t * -90) % SW) < 0 ? SW : 0), (i * 41 + t * 420) % SH, 1, 5); }
  if (sc.weather === 'sun') { ctx.fillStyle = 'rgba(255,220,120,0.16)'; ctx.fillRect(0, 0, SW, SH); }
  if (sc.weather === 'sleet') { ctx.fillStyle = 'rgba(200,220,240,0.16)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = '#fff'; for (let i = 0; i < 50; i++) ctx.fillRect((i * 59 + Math.sin(t + i) * 12 + SW) % SW, (i * 37 + t * 100) % SH, 2, 2); }
  if (sc.weather === 'dust') { ctx.fillStyle = 'rgba(200,160,90,0.26)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = 'rgba(240,210,150,0.5)'; for (let i = 0; i < 40; i++) ctx.fillRect((i * 71 + t * 260) % SW, (i * 43) % SH, 5, 1); }
  // sprites (foe first)
  for (const side of [1, 0]) {
    const d = sc.disp[side]; if (!d.mon || d.gone) continue;
    const cv = kithCanvas(d.mon.id, d.mon.gleam);
    const p = POS[side];
    const age = t - d.born, enter = Math.min(1, age / 0.25);
    let ox = 0, oy = Math.sin(t * 2.2 + side * 2) * 1.5;
    if (d.lunge > t) ox += (side ? -1 : 1) * 14 * Math.sin(((d.lunge - t) / 0.25) * Math.PI);
    if (d.shake > t) ox += Math.sin(t * 70) * 4;
    if (d.faint) { const k = Math.min(1, (t - d.faint) / 0.5); oy += k * 50; ctx.globalAlpha = 1 - k; if (k >= 1) d.gone = true; }
    if (d.blink > t && Math.floor(t * 24) % 2) { ctx.globalAlpha = 0.25; }
    const sz = 96 * (d.shrink ? Math.max(0, 1 - (t - d.shrink) / 0.3) : enter);
    ctx.save(); ctx.translate(p.x + 48 + ox, p.y + 96 + oy);
    if (side === 0) ctx.scale(-1, 1);
    ctx.drawImage(cv, -sz / 2, -sz, sz, sz);
    if (d.glow > t) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(cv, -sz / 2, -sz, sz, sz); }
    ctx.restore(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (d.mon.gleam && Math.floor(t * 4 + side) % 3 === 0) { ctx.fillStyle = '#fff'; const sx = p.x + 20 + ((t * 53) % 56), sy = p.y + 20 + ((t * 31) % 50); ctx.fillRect(sx, sy - 2, 1, 5); ctx.fillRect(sx - 2, sy, 5, 1); }
  }
  // particles
  for (const q of sc.parts) { const k = (t - q.t0) / q.life; if (k < 0 || k > 1) continue; ctx.globalAlpha = 1 - k * k; ctx.fillStyle = q.c; const x = q.x + q.vx * k, y = q.y + q.vy * k + (q.g || 0) * k * k; const z = q.s * (1 - k * 0.5); ctx.fillRect(x - z / 2, y - z / 2, z, z); }
  ctx.globalAlpha = 1;
  sc.parts = sc.parts.filter((q) => t - q.t0 < q.life);
  // lantern
  if (sc.lantern) { const L = sc.lantern, k = Math.min(1, (t - L.t0) / 0.45); const x = 70 + (252 - 70) * k, y = 120 + (40 - 120) * k - Math.sin(k * Math.PI) * 50 + (L.wob > t ? Math.sin(t * 40) * 2 : 0); ctx.fillStyle = `rgba(255,220,120,${0.35 + Math.sin(t * 8) * 0.1})`; ctx.beginPath(); ctx.arc(x, y + 6, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#221a30'; ctx.fillRect(x - 6, y - 2, 12, 16); ctx.fillStyle = '#f4b840'; ctx.fillRect(x - 5, y - 1, 10, 14); ctx.fillStyle = '#fff4c0'; ctx.fillRect(x - 2, y + 3, 4, 6); ctx.fillStyle = '#221a30'; ctx.fillRect(x - 3, y - 5, 6, 3); }
  if (sc.white > t) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, (sc.white - t) * 3)})`; ctx.fillRect(0, 0, SW, SH); }
  if (sc.evo) { const e = sc.evo, k = (t - e.t0) / e.dur; const cvA = kithCanvas(e.from, e.gleam), cvB = kithCanvas(e.to, e.gleam); ctx.fillStyle = '#14122a'; ctx.fillRect(0, 0, SW, SH); for (let i = 0; i < 24; i++) { const a = i * 0.26 + t * 0.8, r = 40 + ((t * 60 + i * 30) % 120); ctx.fillStyle = `rgba(244,184,64,${0.5 - r / 320})`; ctx.fillRect(160 + Math.cos(a) * r, 84 + Math.sin(a) * r * 0.7, 3, 3); } const showB = k >= 1 || (k > 0.2 && Math.floor(k * k * 40) % 2 === 1); ctx.save(); if (k < 1) ctx.filter = 'brightness(0) invert(1)'; ctx.drawImage(showB ? cvB : cvA, 160 - 64, 20, 128, 128); ctx.restore(); }
}
const now = () => performance.now() / 1000;
function burst(side, color, n = 14, spread = 60) { const p = POS[side], t0 = now(); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r = 20 + Math.random() * spread; scene.parts.push({ x: p.x + 48, y: p.y + 52, vx: Math.cos(a) * r, vy: Math.sin(a) * r, t0, life: 0.5 + Math.random() * 0.3, c: color, s: 3 + Math.random() * 4, g: 30 }); } }
function beam(from, color, n = 18) { const a = POS[from], b = POS[1 - from], t0 = now(); for (let i = 0; i < n; i++) scene.parts.push({ x: a.x + 48 + (Math.random() - 0.5) * 20, y: a.y + 50 + (Math.random() - 0.5) * 20, vx: b.x - a.x + (Math.random() - 0.5) * 30, vy: b.y - a.y + (Math.random() - 0.5) * 30, t0: t0 + i * 0.012, life: 0.35, c: i % 3 ? color : '#fff', s: 4 + Math.random() * 4 }); }
function ring(side, color) { const p = POS[side], t0 = now(); for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; scene.parts.push({ x: p.x + 48 + Math.cos(a) * 40, y: p.y + 52 + Math.sin(a) * 34, vx: -Math.cos(a) * 34, vy: -Math.sin(a) * 30 - 10, t0, life: 0.6, c: color, s: 4 }); } }

// ── HUD
function hudBox(side) {
  return el('div', { class: `bh box ${side ? 'foe' : 'me'}` },
    el('div', { class: 'row' }, el('span', { class: 'nm' }), el('span', { class: 'lv' })),
    el('div', { class: 'bar hpbar' }, el('i')),
    el('div', { class: 'sub' }, el('span', { class: 'stwrap' }), side ? el('span', { class: 'dots' }) : el('span', { class: 'hpnum' })),
    side ? null : el('div', { class: 'bar exp' }, el('i')),
    el('div', { class: 'srow' }, side ? null : el('span', { class: 'dots' }), el('div', { class: 'bar surge', title: 'Surge' }, el('i'))));
}
function setHp(side, hp, max) {
  const box = scene.hud[side], i = box.querySelector('.hpbar i'), f = Math.max(0, hp / max);
  i.style.width = f * 100 + '%'; i.style.background = f > 0.5 ? 'var(--hp)' : f > 0.2 ? 'var(--hpmid)' : 'var(--hplow)';
  if (!side) box.querySelector('.hpnum').textContent = `${hp} / ${max}`;
}
function setStatus(side, st) { const w = scene.hud[side].querySelector('.stwrap'); w.innerHTML = ''; if (st) w.append(el('span', { class: 'st ' + st }, STATUS_NAMES[st].toUpperCase())); }
function setSurge(side, v) { const b = scene.hud[side].querySelector('.bar.surge'); b.firstChild.style.width = v + '%'; b.classList.toggle('full', v >= 100); }
function setExp(mon) { const a = expForLevel(mon.lvl), b = expForLevel(mon.lvl + 1); scene.hud[0].querySelector('.exp i').style.width = Math.min(100, ((mon.exp - a) / (b - a)) * 100) + '%'; }
function setMon(side, mon) {
  const box = scene.hud[side], b = scene.battle;
  box.querySelector('.nm').textContent = nameOf(mon) + (mon.gleam ? ' ✦' : '');
  box.querySelector('.lv').textContent = 'Lv ' + mon.lvl;
  setHp(side, mon.hp, statsOf(mon).hp); setStatus(side, mon.status);
  if (!side) setExp(mon);
  const dots = box.querySelector('.dots'); dots.innerHTML = '';
  if (!(side && b.wild)) for (const m of b.sides[side].party) dots.append(el('i', { class: m.hp > 0 ? '' : 'out' }));
}
function pop(side, text, cls = '') { const p = POS[side], u = 100 / SW; const n = el('div', { class: 'popnum ' + cls, style: { left: (p.x + 40) * u + '%', top: ((p.y + 20) / SH) * 100 + '%' } }, text); $('#battlehud').append(n); setTimeout(() => n.remove(), 900); }

// ── event playback
async function play(events) {
  const sc = scene, b = sc.battle;
  for (const e of events) {
    switch (e.t) {
      case 'msg': await flash(e.s, Math.min(1500, 520 + e.s.length * 16)); break;
      case 'send': { const mon = b.sides[e.side].party[e.idx]; sc.disp[e.side] = { mon, born: now() }; setMon(e.side, mon); if (e.side) G.s.seen[mon.id] = 1; sfx('select'); ring(e.side, '#fff4c0'); await sleep(300); break; }
      case 'anim': {
        const mv = MOVES[e.move], col = TYPES[mv.t].color, d = sc.disp[e.side];
        if (e.surge) { sfx('surge'); sc.white = now() + 0.25; ring(e.side, '#f4b840'); ring(e.side, '#fff'); await sleep(350); }
        if (e.self) { d.glow = now() + 0.4; ring(e.side, col); sfx('stat'); await sleep(380); }
        else if (mv.c === 'p') { d.lunge = now() + 0.25; await sleep(140); burst(1 - e.side, col, 12, 50); await sleep(120); }
        else { d.glow = now() + 0.3; beam(e.side, col); await sleep(360); if (mv.c === 's') burst(1 - e.side, col, 10, 44); }
        break;
      }
      case 'hp': {
        const d = sc.disp[e.side], prev = d.hpShown ?? e.max;
        setHp(e.side, e.hp, e.max);
        if (e.heal) { sfx('heal'); ring(e.side, '#8cf098'); pop(e.side, '+' + Math.max(0, e.hp - (d.lastHp ?? e.hp)), 'heal'); }
        else { d.shake = now() + 0.25; d.blink = now() + 0.35; const amt = (d.lastHp ?? e.max) - e.hp; sfx(e.eff > 1 ? 'superhit' : e.eff < 1 ? 'weak' : 'hit'); pop(e.side, '-' + Math.max(0, amt), e.crit ? 'crit' : e.eff > 1 ? 'se' : ''); }
        d.lastHp = e.hp; d.hpShown = prev;
        await sleep(420); break;
      }
      case 'status': setStatus(e.side, e.st); if (e.st) { sfx('status'); burst(e.side, { brn: '#f0803c', psn: '#a858b8', stn: '#f4cc30', slp: '#b8b4c8', fbt: '#7cd4e0' }[e.st], 10, 30); } await sleep(200); break;
      case 'stage': sfx(e.delta > 0 ? 'stat' : 'statdown'); ring(e.side, e.delta > 0 ? '#f4b840' : '#6878c8'); await sleep(260); break;
      case 'miss': sfx('miss'); await sleep(150); break;
      case 'surge': setSurge(e.side, e.v); break;
      case 'weather': sc.weather = e.w; $('#battlehud .wx')?.remove(); if (e.w) $('#battlehud').append(el('span', { class: 'chip wx' }, WEATHER_NAMES[e.w])); break;
      case 'faint': sc.disp[e.side].faint = now(); sfx('faint'); await sleep(550); setMon(e.side, sc.disp[e.side].mon); break;
      case 'exp': { const act = b.sides[0].party[b.sides[0].active]; if (b.sides[0].party[e.idx] === act) { setExp(act); await sleep(250); } break; }
      case 'level': { sfx('levelup'); const act = b.mon(0); if (b.sides[0].party[e.idx] === act) { setMon(0, act); sc.disp[0].lastHp = act.hp; ring(0, '#f4b840'); } break; }
      case 'learn': await learnMove(b.sides[0].party[e.idx], e.move); break;
      case 'catch': {
        sfx('throw'); sc.lantern = { t0: now() }; await sleep(480);
        sc.disp[1].shrink = now(); sc.white = now() + 0.15; await sleep(380);
        for (let i = 0; i < e.shakes; i++) { sc.lantern.wob = now() + 0.3; sfx('shake'); await sleep(620); }
        if (e.ok) { sfx('caught'); ring(1, '#f4b840'); ring(1, '#fff'); await sleep(700); }
        else { sc.disp[1].shrink = null; sc.disp[1].born = now(); sc.lantern = null; burst(1, '#f4b840'); sfx('weak'); await sleep(250); }
        break;
      }
    }
  }
  const d0 = scene.disp[0]; if (d0.mon) d0.lastHp = d0.mon.hp; const d1 = scene.disp[1]; if (d1.mon) d1.lastHp = d1.mon.hp;
}
export async function learnMove(mon, moveId) {
  const mv = MOVES[moveId], n = nameOf(mon);
  for (;;) {
    const opts = [...mon.moves.map((m) => `Forget ${MOVES[m.id].name}  (${TYPES[MOVES[m.id].t].name}, ${MOVES[m.id].pow || '—'} pow)`), `Don't learn ${mv.name}`];
    const i = await choose(`${n} wants to learn ${mv.name}!\n${TYPES[mv.t].name} · ${mv.c === 't' ? 'Status' : mv.c === 'p' ? 'Physical' : 'Special'} · Power ${mv.pow || '—'} · Accuracy ${mv.acc}\n${mv.desc}\nIt already knows four moves.`, opts);
    if (i >= 0 && i < mon.moves.length) { const old = MOVES[mon.moves[i].id].name; replaceMove(mon, i, moveId); sfx('levelup'); await say(`1, 2, and... ${n} forgot ${old} and learned ${mv.name}!`); return; }
    const sure = await choose(`Give up on ${mv.name}?`, ['Yes', 'No']);
    if (sure === 0) { await say(`${n} did not learn ${mv.name}.`); return; }
  }
}

// ── commands
function commands() {
  const sc = scene, b = sc.battle, dock = $('#commands');
  return new Promise((resolve) => {
    let surge = false, popNav = null;
    const done = (action) => { if (popNav) popNav(); dock.innerHTML = ''; resolve(action); };
    const btn = (label, fn, attrs = {}) => el('button', { onclick: () => { sfx('select'); fn(); }, ...attrs }, label);
    const main = () => {
      dock.innerHTML = '';
      dock.append(btn('⚔ Fight', fight), btn('🎒 Bag', bag), btn('◈ Kith', kith), btn('➜ Run', () => done({ type: 'run' }), { disabled: !b.wild }));
      dock.querySelector('button').focus();
    };
    const fight = () => {
      dock.innerHTML = '';
      const me = b.mon(0), foe = b.mon(1), known = G.s.caught[foe.id] || G.s.seen[foe.id] > 1;
      const usable = me.moves.some((m) => m.pp > 0);
      me.moves.forEach((m, i) => {
        const mv = MOVES[m.id];
        const eff = mv.c === 't' ? null : effectiveness(mv.t, KITH[foe.id].types);
        const tag = eff == null || !known ? null : eff === 0 ? ['no', 'No effect'] : eff > 1 ? ['se', 'Super'] : eff < 1 ? ['nve', 'Weak'] : null;
        dock.append(el('button', { class: 'mv', style: { borderLeftColor: TYPES[mv.t].color }, disabled: m.pp <= 0, onclick: () => { sfx('select'); done({ type: 'move', i, surge }); } },
          mv.name, tag ? el('span', { class: 'eff ' + tag[0] }, tag[1]) : null,
          el('small', {}, el('span', {}, `${TYPES[mv.t].name} · ${mv.c === 't' ? 'Status' : mv.c === 'p' ? 'Phys' : 'Spec'}${mv.pow ? ' ' + mv.pow : ''}`), el('span', {}, `PP ${m.pp}/${mv.pp}`))));
      });
      if (!usable) dock.append(btn('Flail (no PP left)', () => done({ type: 'move', i: -1 }), { class: 'wide full' }));
      const full = b.sides[0].surge >= 100;
      const sb = el('button', { class: 'wide surgebtn', disabled: !full, onclick: () => { surge = !surge; sfx(surge ? 'stat' : 'back'); sb.classList.toggle('on', surge); sb.textContent = surge ? '★ SURGE ARMED ×1.5' : '☆ Surge ready'; } }, full ? '☆ Surge ready' : `Surge ${b.sides[0].surge}%`);
      dock.append(sb, btn('← Back', main, { class: 'wide' }));
      (dock.querySelector('button:not(:disabled)') || sb).focus();
    };
    const bag = async () => {
      const act = await G.menus.bag({ battle: true, wild: b.wild });
      if (act) done(act); else main();
    };
    const kith = async () => {
      const i = await G.menus.party({ pick: true, exclude: b.sides[0].active, title: 'Switch to which Kith?' });
      if (i != null) done({ type: 'switch', i }); else main();
    };
    popNav = focusNav(dock, () => main());
    dock.hidden = false; main();
  });
}

async function run(opts) {
  const s = G.s, world = G.world, prevTrack = currentTrack();
  const map = MAPS[s.map], c = clock(s);
  G.scene = 'battle'; document.body.classList.add('inbattle');
  $('#hud').innerHTML = ''; sfx('encounter');
  world.fade = 0; for (let i = 0; i < 6; i++) { world.fade = i % 2 ? 0 : 0.85; await sleep(70); } world.fade = 0;
  music(opts.music || (opts.wild ? 'battle' : 'gym'));
  const battle = new Battle({ party: s.party, foeParty: opts.foeParty, wild: opts.wild, trainerName: opts.name, ai: opts.ai, weather: map.indoor || opts.weather === 'aurora' ? null : opts.weather, rng: G.rng, night: c.night, cave: !!map.cave, noCatch: opts.noCatch });
  const hudRoot = $('#battlehud'); hudRoot.innerHTML = '';
  scene = { battle, biome: map.biome, indoor: !!map.indoor, night: c.night, weather: null, disp: [{}, {}], parts: [], hud: [hudBox(0), hudBox(1)] };
  hudRoot.append(scene.hud[1], scene.hud[0]);
  scene.hud.forEach((h) => { h.style.opacity = 0; });
  $('#commands').hidden = false; $('#commands').innerHTML = '';
  const startEv = battle.start();
  setTimeout(() => scene && scene.hud.forEach((h) => { h.style.opacity = 1; }), 500);
  await play(startEv);
  while (!battle.over) {
    if (battle.needSwitch) {
      hideDialog();
      const i = await G.menus.party({ pick: true, forced: true, title: 'Send out which Kith?' });
      await play(battle.switchIn(i));
      continue;
    }
    hideDialog();
    const action = await commands();
    await play(battle.act(action));
  }
  hideDialog();
  const result = battle.over;
  const foe = battle.mon(1);
  if (result === 'win') {
    if (opts.wild) { s.beaten[foe.id] = (s.beaten[foe.id] || 0) + 1; if (dailyTick(s, 'wild')) world.dailyDone(); }
    else { music('town'); sfx('fanfare'); await say(`You defeated ${opts.name}!`); if (opts.reward) { s.coins += opts.reward; sfx('coin'); await say(`You received ${opts.reward} coins.`); } }
  } else if (result === 'lose') await say('All your Kith have fainted!');
  // leave battle
  $('#commands').hidden = true; $('#commands').innerHTML = ''; hudRoot.innerHTML = '';
  if (result !== 'lose') await evolutions();
  scene = null; G.scene = 'world'; document.body.classList.remove('inbattle');
  music(prevTrack || map.music);
  world.refreshHud();
  return result;
}
async function evolutions() {
  const s = G.s, night = clock(s).night;
  for (const mon of s.party) {
    if (mon.hp <= 0) continue;
    const to = evolutionTarget(mon, { night });
    if (to) await evolveScene(mon, to);
  }
}
export async function evolveScene(mon, to) {
  const from = mon.id, oldName = nameOf(mon), had = !!scene;
  if (!scene) scene = { disp: [{}, {}], parts: [], biome: 'cave', indoor: true };
  const prevScene = G.scene; G.scene = 'battle';
  await say(`What? ${oldName} is changing!`);
  scene.evo = { from, to, gleam: mon.gleam, t0: now(), dur: 3.2 };
  sfx('evolve'); await sleep(3300);
  const pending = evolve(mon, to);
  sfx('fanfare');
  await say(`${oldName} evolved into ${KITH[to].name}!`);
  scene.evo = null; if (!had) scene = null; G.scene = prevScene;
  G.world.g.register(mon);
  for (const mv of pending) await learnMove(mon, mv);
  await G.world.g.stars();
}

export const BattleScene = {
  async trainer(def) {
    const foeParty = def.party.map(([id, lvl]) => createMon(id, lvl, G.rng, { gleam: false }));
    return run({ wild: false, foeParty, name: def.name, ai: def.ai ?? 1, reward: def.reward, music: def.music });
  },
  async wild(mon, opts = {}) {
    const res = await run({ wild: true, foeParty: [mon], weather: opts.weather, music: opts.music, ai: opts.legend ? 2 : 0 });
    const g = G.world.g, s = G.s;
    if (res === 'caught') {
      mon.status = null;
      if (dailyTick(s, 'catch')) G.world.dailyDone();
      await g.giveMon(mon);
    } else if (res === 'win' && !opts.legend) {
      const f = G.fortune().total;
      if (G.rng.chance(0.06 * (1 + f))) { await say('Something glints in the grass where the wild Kith stood.'); await g.giveCrate('basic'); }
    }
    return res;
  },
};
export const battleActive = () => !!scene;
