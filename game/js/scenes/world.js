// Overworld: movement, camera, entities, encounters, weather, and the script API (`g`).
import { G, kithCanvas } from '../game.js';
import { MAPS, WALKABLE, TOWNS } from '../data/maps.js';
import { STORY } from '../data/story.js';
import { KITH } from '../data/creatures.js';
import { ITEMS } from '../data/items.js';
import { CARDS } from '../data/cards.js';
import { CRATES } from '../data/crates.js';
import { renderMap, T } from '../render/tiles.js';
import { drawCharAt } from '../render/chars.js';
import { createMon, healMon, nameOf } from '../systems/monster.js';
import { addCard, checkConstellations } from '../systems/crypt.js';
import { clock, weatherFor, cachesFor, dailyTick, rollDaily } from '../systems/state.js';
import { heldDir, isHeld, onKey, clearHeld } from '../core/input.js';
import { sfx, music } from '../core/audio.js';
import { say, choose, toast, banner, busy, $, el, sleep } from '../ui/ui.js';

const SW = 320, SH = 208;
const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const WX_LABEL = { rain: 'Rain', sun: 'Harsh sun', sleet: 'Sleet', dust: 'Dust', aurora: 'Aurora' };

export class World {
  constructor() {
    this.locked = false; this.move = null; this.frame = 0; this.t = 0; this.fade = 0; this.alert = null;
    this.g = this.makeApi();
    onKey((k) => { if (G.scene !== 'world' || busy() || this.locked) return; if (k === 'a') this.interact(); if (k === 'menu') this.run(() => G.menus.main()); });
  }
  get s() { return G.s; }

  // ── map loading
  load(mapId, announce = true) {
    const map = MAPS[mapId];
    this.map = map; this.tiles = renderMap(map);
    this.ents = [];
    map.grid.forEach((row, y) => [...row].forEach((ch, x) => { const def = map.ent[ch]; if (def) this.ents.push({ ch, x, y, def, dir: def.dir || 'down' }); }));
    this.s.map = mapId;
    if (!this.s.visited[mapId]) this.s.visited[mapId] = 1;
    this.caches = cachesFor(this.s, mapId);
    this.weather = weatherFor(this.s, mapId);
    this.particles = [];
    music(map.music || 'route');
    if (announce) banner(map.name);
    if (this.weather === 'aurora') toast('The aurora is out. Fortune +10% here, and something rare is about.');
    this.refreshHud();
  }
  marker(ch) { return this.ents.find((e) => e.ch === ch); }
  visible(e) {
    const d = e.def;
    if (d.hide && d.hide(this.g)) return false;
    if (d.legend && !d.show(this.g)) return false;
    if ((d.item || d.crate) && this.s.flags[`i:${this.map.id}:${e.ch}`]) return false;
    return true;
  }
  entAt(x, y) { return this.ents.find((e) => e.x === x && e.y === y && this.visible(e)); }
  solidEnt(e) { const d = e.def; return !!(d.npc || d.sign || d.post || d.item || d.crate || d.legend || d.starter); }
  passable(x, y) {
    const ch = this.map.grid[y]?.[x];
    if (ch === undefined) return false;
    const raw = this.ents.find((e) => e.x === x && e.y === y);
    if (raw) {
      if (!this.visible(raw)) return !(raw.def.door); // hidden doors are plain wall; hidden NPCs/items leave open ground
      return !this.solidEnt(raw);
    }
    return WALKABLE.has(ch);
  }
  placeAt(mapId, ch) {
    this.load(mapId);
    const e = this.marker(ch);
    let { x, y } = e; let dir = 'down';
    const H = this.map.grid.length, W = this.map.grid[0].length;
    if (e.def.door) { y += 1; dir = 'down'; if (this.map.indoor) { y -= 2; dir = 'up'; } }
    else if (e.def.post) { y += 1; }
    else if (y === 0) { y = 1; dir = 'down'; } else if (y === H - 1) { y = H - 2; dir = 'up'; }
    else if (x === 0) { x = 1; dir = 'right'; } else if (x === W - 1) { x = W - 2; dir = 'left'; }
    if (!this.passable(x, y)) { x = e.x; y = e.y; }
    Object.assign(this.s, { x, y, dir });
    this.move = null;
  }
  async warp(mapId, ch) {
    sfx('door');
    await this.fadeTo(1);
    this.placeAt(mapId, ch);
    await this.fadeTo(0);
    G.save();
  }
  async fadeTo(v) { const from = this.fade, t0 = performance.now(); while (true) { const k = Math.min(1, (performance.now() - t0) / 220); this.fade = from + (v - from) * k; if (k >= 1) break; await sleep(16); } }

  // ── scripts
  async run(fn) {
    if (this.locked) return;
    this.locked = true; clearHeld();
    try { await fn(this.g); } catch (e) { console.error(e); toast('Something went wrong: ' + e.message); }
    this.locked = false;
    this.refreshHud(); G.save();
  }

  // ── update
  update(dt) {
    this.t += dt;
    const s = this.s;
    if (this.move) {
      const m = this.move;
      m.k += dt * m.speed;
      if (m.k >= 1) { s.x = m.tx; s.y = m.ty; this.move = null; this.onStep(); }
    }
    if (!this.move && !this.locked && !busy() && G.scene === 'world') {
      const d = heldDir();
      if (d) this.tryMove(d);
    }
    this.updateParticles(dt);
  }
  tryMove(d) {
    const s = this.s, [dx, dy] = DV[d], tx = s.x + dx, ty = s.y + dy;
    if (s.dir !== d) { s.dir = d; }
    const e = this.entAt(tx, ty);
    if (e && e.def.door) return this.enterDoor(e);
    if (!this.passable(tx, ty)) { if (this.t - (this.lastBump || 0) > 0.35) { sfx('bump'); this.lastBump = this.t; } return; }
    this.move = { fx: s.x, fy: s.y, tx, ty, k: 0, speed: isHeld('b') || isHeld('run') ? 8.5 : 5.2 };
  }
  enterDoor(e) {
    const d = e.def;
    if (this.s.dir !== 'up' && !this.map.indoor) return;
    this.run(async (g) => {
      if (d.locked && d.locked(g)) { sfx('bump'); return say(d.lockedText); }
      if (d.warp) return this.warp(d.warp[0], d.warp[1]);
      sfx('door'); await d.on(g);
    });
  }
  onStep() {
    const s = this.s; s.steps++;
    this.frame ^= 1;
    if (dailyTick(s, 'steps')) this.dailyDone();
    const ch = this.map.grid[s.y][s.x];
    const e = this.entAt(s.x, s.y);
    if (e && e.def.warp && !e.def.door) { this.run(() => this.warp(e.def.warp[0], e.def.warp[1])); return; }
    if (s.steps % 40 === 0) { const w = weatherFor(s, s.map); if (w !== this.weather) { this.weather = w; if (w) toast(w === 'aurora' ? 'The sky lights up. An aurora!' : `Weather: ${WX_LABEL[w]}`); } }
    this.refreshHud();
    // trainers who see you
    for (const t of this.ents) {
      const d = t.def;
      if (!d.trainer || !d.sight || !this.visible(t) || s.flags[`t:${this.map.id}:${t.ch}`]) continue;
      const [dx, dy] = DV[t.dir];
      for (let i = 1; i <= d.sight; i++) {
        const x = t.x + dx * i, y = t.y + dy * i;
        if (x === s.x && y === s.y) { this.spotted(t); return; }
        if (!this.passable(x, y)) break;
      }
    }
    // wild encounters
    const enc = this.map.enc;
    if (enc && s.party.some((m) => m.hp > 0) && (ch === ',' || (enc.all && ch === '.')) && G.rng.chance(enc.rate)) this.run(() => this.wildEncounter());
  }
  spotted(t) {
    this.run(async () => {
      sfx('alert'); this.alert = { x: t.x, y: t.y, until: this.t + 0.7 };
      await sleep(600);
      await this.talkTrainer(t);
    });
  }
  async talkTrainer(t) {
    const d = t.def, tr = d.trainer, g = this.g, flag = `t:${this.map.id}:${t.ch}`;
    t.dir = OPP[this.s.dir] && this.faceTo(t);
    if (this.s.flags[flag]) return say(tr.after, d.name);
    await say(tr.before, d.name);
    const won = await g.battle({ name: d.name, look: d.npc, party: tr.party, reward: tr.reward, ai: tr.ai });
    if (!won) return;
    this.s.flags[flag] = 1;
    await say(tr.after, d.name);
    if (tr.onWin) await tr.onWin(g);
  }
  faceTo(t) { const s = this.s; const dx = s.x - t.x, dy = s.y - t.y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }

  async wildEncounter() {
    const enc = this.map.enc, s = this.s, c = clock(s), f = G.fortune().total;
    let pick;
    if (this.weather === 'aurora' && enc.aurora && G.rng.chance(0.25)) pick = enc.aurora;
    else if (enc.rare && G.rng.chance(0.02 * (1 + f))) pick = enc.rare;
    else { const table = c.night && enc.night ? enc.night : enc.day; pick = G.rng.weighted(table.map((r) => [r, r[3]])); }
    const [id, lo, hi] = pick;
    const mon = createMon(id, G.rng.range(lo, hi), G.rng, { gleamRate: (1 / 256) * (1 + f * 2) });
    await this.g.wildBattle(mon);
  }

  // ── interaction
  interact() {
    const s = this.s, [dx, dy] = DV[s.dir], x = s.x + dx, y = s.y + dy;
    const e = this.entAt(x, y);
    if (!e) { if (s.bag.compass && !this.map.indoor) this.run(() => this.dig()); return; }
    const d = e.def;
    this.run(async (g) => {
      sfx('blip');
      if (d.npc) {
        e.dir = this.faceTo(e);
        if (d.trainer) return this.talkTrainer(e);
        return d.talk(g, e);
      }
      if (d.sign) return say(d.sign);
      if (d.post) return d.on(g);
      if (d.starter) return STORY.chooseStarter(g, d.starter);
      if (d.item) { s.flags[`i:${this.map.id}:${e.ch}`] = 1; return g.give(d.item, d.n); }
      if (d.crate) { s.flags[`i:${this.map.id}:${e.ch}`] = 1; await say('A sealed crate, stamped with the mark of the Archivists.'); return g.giveCrate(d.crate); }
      if (d.legend) return this.legendEncounter(e);
      if (d.door) return this.enterDoor(e);
    });
  }
  async legendEncounter(e) {
    const d = e.def, g = this.g;
    await say(d.intro);
    const go = await choose(`${KITH[d.legend].name} is watching you.`, ['Hold up your lantern', 'Step back']);
    if (go !== 0) return;
    const mon = createMon(d.legend, d.lvl, G.rng, { gleam: false });
    const res = await g.wildBattle(mon, { legend: true, music: 'boss' });
    if (res === 'caught') { g.set('got_' + d.legend); if (d.legend === 'mnemora') await g.giveCard('m-remember'); }
    else if (res === 'win') await say(`${KITH[d.legend].name} withdraws into the light. It will be here again when you return.`);
  }
  async dig() {
    const s = this.s, g = this.g;
    const here = this.caches.find((c) => c.x === s.x && c.y === s.y);
    if (!here) {
      const d = this.cacheDistance();
      return say(d == null ? 'The Echo Compass is silent. Nothing is buried here today.' : d <= 2 ? 'The compass is ringing. You are almost on top of it.' : d <= 5 ? 'The compass hums. Close.' : 'A faint hum. Something is buried in this area.');
    }
    sfx('dig'); await sleep(350);
    s.daily.dugToday[here.id] = 1; s.dug = (s.dug || 0) + 1;
    this.caches = cachesFor(s, s.map);
    const f = G.fortune().total;
    const roll = G.rng.weighted([['coins', 30], ['items', 22], ['basic', 30], ['silver', 12 * (1 + f)], ['golden', 3 * (1 + f)], ['shard', 3 * (1 + f)]]);
    await say('You dig where the compass rings...');
    if (roll === 'coins') await g.coins(G.rng.range(150, 500));
    else if (roll === 'items') await g.give(G.rng.pick(['tonic', 'brightlantern', 'remedy', 'nugget', 'ppseed']), G.rng.range(1, 2));
    else if (roll === 'shard') await g.give(G.rng.pick(['dawnshard', 'duskshard']));
    else await g.giveCrate(roll);
    if (dailyTick(s, 'dig')) await this.dailyDone();
    if (s.dug >= 5 && !s.flags.q_dig_done) { s.flags.q_dig_done = 1; await say('Five caches found. The compass needle spins once, pleased.'); await g.giveCrate('golden'); }
  }
  cacheDistance() { const s = this.s; let best = null; for (const c of this.caches) { const d = Math.abs(c.x - s.x) + Math.abs(c.y - s.y); if (best == null || d < best) best = d; } return best; }
  async dailyDone() {
    const s = this.s; if (s.daily.claimed) return;
    s.daily.claimed = true; toast('Daily tasks complete! Reward added.');
    s.crates.silver = (s.crates.silver || 0) + 1; s.coins += 500; sfx('fanfare');
  }

  refreshHud() {
    const hud = $('#hud'); if (!hud || G.scene !== 'world') return;
    const c = clock(this.s), d = this.s.bag.compass && !this.map.indoor ? this.cacheDistance() : null;
    hud.innerHTML = '';
    const wx = this.weather ? ' · ' + WX_LABEL[this.weather] : '';
    hud.append(el('span', { class: 'chip' }, `${this.map.indoor ? '' : c.night ? '☾ ' : c.dusk ? '◐ ' : '☀ '}${this.map.name}${wx}`));
    if (d != null) { const lvl = d <= 2 ? 'ringing' : d <= 5 ? 'humming' : 'faint'; hud.append(el('span', { class: 'chip compass hot', style: { '--beat': d <= 2 ? '.35s' : d <= 5 ? '.8s' : '1.8s' } }, el('b', {}, '◈'), lvl)); }
  }

  // ── script API
  makeApi() {
    const w = this;
    const g = {
      get s() { return G.s; }, rng: G.rng, story: STORY,
      say: (a, b) => (b === undefined ? say(a) : say(b, a)),
      choose: (p, o) => choose(p, o),
      has: (k) => !!(G.s.flags[k] || G.s.bag[k]),
      set: (k, v = 1) => { G.s.flags[k] = v; },
      count: (item) => G.s.bag[item] || 0,
      take: (item, n = 1) => { G.s.bag[item] = Math.max(0, (G.s.bag[item] || 0) - n); if (!G.s.bag[item]) delete G.s.bag[item]; },
      hasSpecies: (id) => G.s.party.some((m) => m.id === id),
      caughtCount: () => Object.keys(G.s.caught).length,
      defeated: (id) => G.s.beaten[id] || 0,
      unlocked: (k) => G.s.col.stars.some((sid) => sid === k || (sid === 'pagezero' && k === 'nullith') || (sid === 'aurora' && k === 'starfall')),
      dailyTick: (type, n) => { if (dailyTick(G.s, type, n)) w.dailyDone(); },
      async give(item, n = 1) { G.s.bag[item] = (G.s.bag[item] || 0) + n; sfx('item'); await say(`You got ${n > 1 ? n + ' × ' : 'a '}${ITEMS[item].name}${n > 1 ? '' : ''}!`); },
      async coins(n) { G.s.coins += n; sfx('coin'); await say(`You got ${n} coins.`); },
      async giveCrate(id, n = 1) { G.s.crates[id] = (G.s.crates[id] || 0) + n; sfx('fanfare'); await say(`You received ${n > 1 ? n + ' × ' : 'a '}${CRATES[id].name}! Open it from the CRYPT menu.`); },
      async giveCard(id) {
        const isNew = addCard(G.s.col, id);
        sfx(isNew ? 'r_rare' : 'item');
        await say(`CRYPT card: ${CARDS[id].name}${isNew ? ' (new!)' : ''}`);
        await g.stars();
      },
      async stars() { for (const k of checkConstellations(G.s.col)) { sfx('r_secret'); await say(`✦ Constellation complete: ${k.name} ✦\nSecret card found: ${CARDS[k.reward].name}`); if (k.unlock === 'starfall') await say('Somewhere under Murkroot, a wall of crystal cracks from top to bottom.'); if (k.unlock === 'nullith') await say('In the Pressworks, a stack of abandoned cards begins to move.'); } },
      register(mon) {
        const first = !G.s.caught[mon.id];
        G.s.seen[mon.id] = 1; G.s.caught[mon.id] = 1;
        if (first) { const isNew = addCard(G.s.col, 'k-' + mon.id); if (isNew) toast(`Codex: ${KITH[mon.id].name} recorded. Card added to your binder.`); }
        return first;
      },
      async giveMon(id, lvl, opts = {}) {
        const mon = typeof id === 'string' ? createMon(id, lvl, G.rng, { ot: G.s.name, met: w.map.name }) : id;
        mon.ot = G.s.name; mon.met = mon.met || w.map.name;
        g.register(mon);
        if (G.s.party.length < 6) G.s.party.push(mon); else { healMon(mon); G.s.box.push(mon); }
        sfx('caught');
        await say(`${nameOf(mon)} joined you${G.s.party.includes(mon) ? '!' : ' and was sent to the Lantern Box.'}`);
        await g.stars();
      },
      async hearth(silent, quiet) {
        for (const m of G.s.party) healMon(m);
        if (!quiet) { G.s.lastHeal = { map: G.s.map, x: G.s.x, y: G.s.y }; sfx('heal'); }
        if (!silent) await say('You warm yourselves at the Hearth. Your Kith are fully rested.');
      },
      shop: () => G.menus.shop(),
      async travel() {
        const towns = TOWNS.filter((t) => G.s.visited[t] && t !== G.s.map);
        if (!towns.length) return say('A Lantern Post. Light one in another town and you can travel between them.');
        const i = await choose('The Lantern Post glows. Travel where?', [...towns.map((t) => MAPS[t].name), 'Stay here']);
        if (i < 0 || i >= towns.length) return;
        await w.warp(towns[i], '4');
      },
      async fanfare(text) { sfx('fanfare'); banner(text); await say(text); },
      async credits() { await say('CRYPTWILD\n\nThe Warden\'s Road is walked. Thank you for playing.'); await say('Postgame: the Concord Trial, the Echo Tower, five legends, and the Constellations are waiting.'); },
      async battle(def) {
        const res = await G.battle.trainer(def);
        if (res === 'win') { g.dailyTick(def.name.includes('Floor') ? 'none' : 'trainer'); return true; }
        if (def.noWhiteout) { for (const m of G.s.party) healMon(m); return false; }
        await w.whiteout();
        return false;
      },
      async wildBattle(mon, opts = {}) {
        const res = await G.battle.wild(mon, { weather: w.weather, night: clock(G.s).night, cave: !!w.map.cave, ...opts });
        if (res === 'lose') await w.whiteout();
        return res;
      },
    };
    return g;
  }
  async whiteout() {
    const s = this.s;
    const lost = Math.floor(s.coins * 0.1); s.coins -= lost;
    await say(`Your Kith can't go on. You hurry back to the last Hearth${lost ? `, dropping ${lost} coins on the way` : ''}.`);
    for (const m of s.party) healMon(m);
    await this.fadeTo(1);
    this.load(s.lastHeal.map); Object.assign(s, { x: s.lastHeal.x, y: s.lastHeal.y, dir: 'down' }); this.move = null;
    await this.fadeTo(0);
  }

  // ── rendering
  updateParticles(dt) {
    const w = this.weather, P = this.particles;
    const want = w === 'rain' ? 70 : w === 'sleet' ? 50 : w === 'dust' ? 40 : w === 'aurora' ? 14 : 0;
    while (P.length < want) P.push({ x: Math.random() * SW, y: Math.random() * SH, v: 0.6 + Math.random() * 0.8 });
    if (P.length > want) P.length = want;
    for (const p of P) {
      if (w === 'rain') { p.y += 420 * dt * p.v; p.x -= 90 * dt; }
      else if (w === 'sleet') { p.y += 110 * dt * p.v; p.x += Math.sin(this.t * 2 + p.v * 9) * 30 * dt; }
      else if (w === 'dust') { p.x += 260 * dt * p.v; p.y += 20 * dt; }
      else { p.y -= 10 * dt * p.v; }
      if (p.y > SH) { p.y = -4; p.x = Math.random() * (SW + 60); } if (p.x < -4) p.x = SW; if (p.x > SW + 4) p.x = 0; if (p.y < -6) p.y = SH;
    }
  }
  draw(ctx) {
    const s = this.s, tl = this.tiles;
    let px = s.x * T, py = s.y * T;
    if (this.move) { const m = this.move; px = (m.fx + (m.tx - m.fx) * m.k) * T; py = (m.fy + (m.ty - m.fy) * m.k) * T; }
    const mw = tl.W * T, mh = tl.H * T;
    const cx = mw <= SW ? (mw - SW) / 2 : Math.max(0, Math.min(mw - SW, px + 8 - SW / 2));
    const cy = mh <= SH ? (mh - SH) / 2 : Math.max(0, Math.min(mh - SH, py + 8 - SH / 2));
    ctx.fillStyle = this.map.indoor ? '#0c0a14' : '#1c5c38'; ctx.fillRect(0, 0, SW, SH);
    ctx.save(); ctx.translate(-Math.round(cx), -Math.round(cy));
    ctx.drawImage(tl.frames[Math.floor(this.t * 2) % 2], 0, 0);
    // entities + player, sorted by y
    const list = this.ents.filter((e) => this.visible(e) && this.solidEnt(e)).map((e) => ({ y: e.y * T, e }));
    list.push({ y: py + 1, player: true });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.player) {
        const walking = !!this.move;
        drawCharAt(ctx, 'player', s.dir, walking ? (this.move.k < 0.5 ? 1 : 0) : 0, px, py - 4);
        const ch = this.map.grid[Math.round(py / T)]?.[Math.round(px / T)];
        if (ch === ',') ctx.drawImage(tl.frames[0], Math.round(px / T) * T, Math.round(py / T) * T + 9, T, 7, Math.round(px / T) * T, Math.round(py / T) * T + 9, T, 7);
      } else this.drawEnt(ctx, it.e);
    }
    ctx.drawImage(tl.over, 0, 0);
    if (this.alert && this.t < this.alert.until) { ctx.fillStyle = '#fff'; ctx.fillRect(this.alert.x * T + 4, this.alert.y * T - 20, 8, 12); ctx.fillStyle = '#e04030'; ctx.fillRect(this.alert.x * T + 7, this.alert.y * T - 18, 2, 5); ctx.fillRect(this.alert.x * T + 7, this.alert.y * T - 12, 2, 2); }
    ctx.restore();
    this.drawAtmosphere(ctx, px - cx + 8, py - cy + 4);
    if (this.fade > 0) { ctx.fillStyle = `rgba(8,6,16,${this.fade})`; ctx.fillRect(0, 0, SW, SH); }
  }
  drawEnt(ctx, e) {
    const d = e.def, x = e.x * T, y = e.y * T, R = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
    if (d.npc) return drawCharAt(ctx, d.npc, e.dir, 0, x, y - 4);
    if (d.sign) { R('#5c3c20', 7, 8, 2, 8); R('#221a30', 1, 1, 14, 9); R('#c8a060', 2, 2, 12, 7); R('#8c6c3c', 4, 4, 8, 1); R('#8c6c3c', 4, 6, 6, 1); return; }
    if (d.post) { R('#221a30', 6, -8, 4, 24); R('#4a4580', 7, -7, 2, 22); const gl = 0.6 + Math.sin(this.t * 3) * 0.2; ctx.fillStyle = `rgba(244,184,64,${gl * 0.35})`; ctx.beginPath(); ctx.arc(x + 8, y - 10, 11, 0, 7); ctx.fill(); R('#221a30', 3, -16, 10, 10); R('#f4b840', 4, -15, 8, 8); R('#fff4c0', 6, -13, 4, 4); return; }
    if (d.item) { R('#221a30', 4, 5, 8, 9); R('#f4b840', 5, 6, 6, 7); R('#fff4c0', 6, 7, 2, 2); R('#221a30', 6, 3, 4, 2); return; }
    if (d.crate) { const c = CRATES[d.crate].color; R('#221a30', 1, 4, 14, 12); R(c, 2, 5, 12, 10); R('#0004', 2, 9, 12, 1); R('#fff4c0', 7, 8, 2, 3); R('#ffffff55', 3, 6, 4, 1); return; }
    if (d.starter || d.legend) {
      const id = d.starter || d.legend, cv = kithCanvas(id), bob = Math.round(Math.sin(this.t * 2 + e.x) * 1.5);
      if (d.legend) { const gl = 0.25 + Math.sin(this.t * 2) * 0.1; ctx.fillStyle = `rgba(255,240,180,${gl})`; ctx.beginPath(); ctx.arc(x + 8, y, 20, 0, 7); ctx.fill(); ctx.drawImage(cv, x - 12, y - 24 + bob, 40, 40); }
      else { R('#221a30', 1, 9, 14, 7); R('#a890e0', 2, 10, 12, 5); ctx.drawImage(cv, x - 4, y - 14 + bob, 24, 24); }
    }
  }
  drawAtmosphere(ctx, lx, ly) {
    const c = clock(this.s), w = this.weather, indoor = this.map.indoor;
    if (!indoor) {
      if (c.night) { ctx.fillStyle = 'rgba(20,24,80,0.42)'; ctx.fillRect(0, 0, SW, SH); }
      else if (c.dusk) { ctx.fillStyle = 'rgba(240,120,60,0.16)'; ctx.fillRect(0, 0, SW, SH); }
      if (w === 'sun') { ctx.fillStyle = 'rgba(255,220,120,0.12)'; ctx.fillRect(0, 0, SW, SH); }
      if (w === 'rain') { ctx.fillStyle = 'rgba(40,60,110,0.2)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = 'rgba(200,220,255,0.6)'; for (const p of this.particles) ctx.fillRect(p.x | 0, p.y | 0, 1, 5); }
      if (w === 'sleet') { ctx.fillStyle = 'rgba(200,220,240,0.14)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = '#fff'; for (const p of this.particles) ctx.fillRect(p.x | 0, p.y | 0, p.v > 1 ? 2 : 1, p.v > 1 ? 2 : 1); }
      if (w === 'dust') { ctx.fillStyle = 'rgba(200,160,90,0.22)'; ctx.fillRect(0, 0, SW, SH); ctx.fillStyle = 'rgba(240,210,150,0.5)'; for (const p of this.particles) ctx.fillRect(p.x | 0, p.y | 0, 4, 1); }
      if (w === 'aurora') { for (let i = 0; i < 3; i++) { const g = ctx.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, ['rgba(112,232,200,0.30)', 'rgba(240,168,224,0.24)', 'rgba(112,160,240,0.24)'][i]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); for (let x = 0; x <= SW; x += 16) ctx.lineTo(x, 50 + Math.sin(x / 40 + this.t * (0.4 + i * 0.2) + i * 2) * 22 + i * 14); ctx.lineTo(SW, 0); ctx.fill(); } ctx.fillStyle = '#fff'; for (const p of this.particles) ctx.fillRect(p.x | 0, p.y | 0, 1, 1); }
    } else if (this.map.cave) {
      const g = ctx.createRadialGradient(lx, ly, 30, lx, ly, 170);
      g.addColorStop(0, 'rgba(8,6,20,0)'); g.addColorStop(1, 'rgba(8,6,20,0.72)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, SW, SH);
    }
  }
}
export function startWorld() {
  rollDaily(G.s);
  if (!G.world) G.world = new World();
  G.scene = 'world';
  G.world.load(G.s.map, true);
}
