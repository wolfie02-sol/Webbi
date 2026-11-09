// Boot, scaling, main loop, title screen.
import { G, kithCanvas } from './game.js';
import { initInput, onFirstInput } from './core/input.js';
import { unlockAudio, music, sfx, setAudio } from './core/audio.js';
import { newState, loadGame, hasSave, deserialize, saveGame, SAVE_KEY } from './systems/state.js';
import { startWorld } from './scenes/world.js';
import { BattleScene, drawBattle, battleActive } from './scenes/battle.js';
import { Menus } from './ui/menus.js';
import { Crypt } from './ui/crypt.js';
import { Chain } from './ui/chain.js';
import { loadConfig } from './config.js';
import { el, $, say, focusNav, setTextFast, toast } from './ui/ui.js';

const canvas = $('#screen'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
G.menus = Menus; G.crypt = Crypt; G.chain = Chain; G.battle = BattleScene;

function resize() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const vw = innerWidth, vh = innerHeight, landscape = vw > vh;
  const floating = !coarse || landscape;
  document.body.classList.toggle('floatcmd', floating);
  document.body.classList.toggle('landscape-touch', coarse && landscape);
  const cmd = $('#commands');
  if (floating && cmd.parentElement.id !== 'overlay') $('#overlay').append(cmd);
  if (!floating && cmd.parentElement.id !== 'dock') $('#dock').append(cmd);
  const reserve = coarse && !landscape ? 204 : 0;
  const u = Math.max(0.6, Math.min(vw / 320, (vh - reserve) / 208, 5.6));
  document.documentElement.style.setProperty('--u', u + 'px');
}
addEventListener('resize', resize); addEventListener('orientationchange', resize);

// ── title screen
function drawTitle(t) {
  const g = ctx.createLinearGradient(0, 0, 0, 208);
  g.addColorStop(0, '#14122a'); g.addColorStop(0.55, '#3c2c68'); g.addColorStop(0.8, '#c8604c'); g.addColorStop(1, '#f4a850');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 208);
  for (let i = 0; i < 60; i++) { const tw = (Math.sin(t * 2 + i * 1.7) + 1) / 2; ctx.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`; ctx.fillRect((i * 97) % 320, (i * 53) % 120, 1, 1); }
  ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.arc(258, 40, 16, 0, 7); ctx.fill(); ctx.fillStyle = '#2c2456'; ctx.beginPath(); ctx.arc(251, 36, 14, 0, 7); ctx.fill();
  const hill = (y, amp, col, off) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 208); for (let x = 0; x <= 320; x += 8) ctx.lineTo(x, y + Math.sin(x / 50 + off) * amp + Math.sin(x / 19 + off) * 3); ctx.lineTo(320, 208); ctx.fill(); };
  hill(150, 14, '#2c2050', 1); hill(168, 10, '#1f3a3c', 3); hill(184, 6, '#143028', 5);
  // lanterns drifting up
  for (let i = 0; i < 9; i++) { const x = (i * 41 + 20) % 320 + Math.sin(t * 0.6 + i) * 6, y = 200 - ((t * (8 + i % 4 * 3) + i * 47) % 190); ctx.fillStyle = 'rgba(244,184,64,0.18)'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#f4b840'; ctx.fillRect(x - 2, y - 3, 4, 6); ctx.fillStyle = '#fff4c0'; ctx.fillRect(x - 1, y - 1, 2, 3); }
  const mons = ['sproutle', 'kindlit', 'bublet'];
  mons.forEach((id, i) => { const bob = Math.round(Math.sin(t * 2 + i * 2) * 2); ctx.drawImage(kithCanvas(id), 4 + i * 30, 150 + bob + (i === 1 ? -8 : 0), 48, 48); });
  ctx.drawImage(kithCanvas('mnemora'), 236, 104 + Math.round(Math.sin(t * 1.3) * 4), 72, 72);
}
function showTitle() {
  G.scene = 'title';
  const root = el('div', { id: 'title' }, el('h1', {}, 'CRYPTWILD'), el('div', { class: 'tag' }, 'A lantern, a friend, and a country full of buried light'));
  const start = (state) => { unlockAudio(); pop(); root.remove(); G.s = state; setAudio(state.settings); setTextFast(state.settings.fast); startWorld(); if (!state.flags.intro) intro(); };
  if (hasSave()) root.append(el('button', { onclick: () => { const s = loadGame(); if (!s) return toast('The save could not be read. Import a backup or start a new game.'); sfx('select'); start(s); } }, 'Continue'));
  root.append(el('button', { onclick: () => {
    if (hasSave() && !confirm('Start a new game? Your current save will be replaced. Export it first from Save & Options if you want to keep it.')) return;
    sfx('select'); const s = newState(); const n = prompt('What is your name, Warden?', 'Warden'); s.name = (n || 'Warden').trim().slice(0, 12) || 'Warden'; saveGame(s); start(s);
  } }, 'New game'));
  root.append(el('button', { onclick: () => { const inp = el('input', { type: 'file', accept: '.json,application/json', onchange: async () => { try { const s = deserialize(await inp.files[0].text()); saveGame(s); start(s); } catch (e) { toast(e.message); } } }); inp.click(); } }, 'Import save'));
  root.append(el('div', { class: 'fine' }, 'Free to play · no wallet needed · saves in this browser'));
  $('#overlay').append(root);
  const pop = focusNav(root, null);
  root.querySelector('button').focus();
  onFirstInput(() => { unlockAudio(); music('title'); });
}
async function intro() {
  await G.world.run(async () => {
    await say('Vael is a country lit by lanterns. Its creatures, the Kith, come to the light, and to the people who carry it.');
    await say(`Today you are sixteen, ${G.s.name}. Today you are a Warden.`);
    await say('Mum', 'Up at last! Maren wants you at the lab, the big building on the east side. Go on, your lantern\'s by the door.');
    G.s.flags.intro = 1;
  });
}

// ── main loop
let last = performance.now();
function frame(nowMs) {
  const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
  const t = nowMs / 1000;
  if (G.scene === 'title') drawTitle(t);
  else if (G.s && G.world) {
    G.s.playMs += dt * 1000;
    if (G.scene === 'world') G.world.update(dt);
    if (G.scene === 'battle' && battleActive()) drawBattle(ctx, t); else G.world.draw(ctx);
  }
  requestAnimationFrame(frame);
}
addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
addEventListener('pagehide', () => G.save());

(async function boot() {
  initInput(); resize();
  G.config = await loadConfig();
  showTitle();
  requestAnimationFrame(frame);
  globalThis.__cw = G; // console/testing handle
})();
