// Battle engine. Pure and synchronous: every call returns a list of events for a UI (or a test, or a
// server) to play back. No DOM, no timers, all randomness from the injected rng.
import { KITH } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { TRAITS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { TYPES, effectiveness } from '../data/types.js';
import { statsOf, nameOf, gainExp, useItemOn, STAT_NAMES, STATUS_NAMES } from './monster.js';

const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const accMul = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const WEATHER_NAMES = { sun: 'Harsh sun', rain: 'Rain', sleet: 'Sleet', dust: 'Dust storm' };
const STATUS_START = { brn: 'was burned!', psn: 'was poisoned!', stn: 'is stunned! It may be unable to move.', slp: 'fell asleep!', fbt: 'got frostbite!' };
const freshVol = () => ({ stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }, daze: 0, flinch: false, ward: false, wardStreak: 0, leech: false });

export class Battle {
  // opts: { party, foeParty, wild, trainerName, ai (0 wild,1 trainer,2 boss), weather, rng, night, cave, canRun, expMult }
  constructor(opts) {
    this.o = opts;
    this.rng = opts.rng;
    this.wild = !!opts.wild;
    this.sides = [
      { party: opts.party, active: opts.party.findIndex((m) => m.hp > 0), surge: 0, vol: freshVol(), player: true },
      { party: opts.foeParty, active: 0, surge: 0, vol: freshVol(), player: false },
    ];
    this.weather = opts.weather || null;
    this.weatherTurns = opts.weather ? 8 : 0;
    this.turn = 0;
    this.over = null;        // 'win' | 'lose' | 'caught' | 'run'
    this.needSwitch = false; // player must pick a replacement
    this.participants = new Set([this.sides[0].active]);
    this.ev = [];
    this.runTries = 0;
  }
  mon(s) { const sd = this.sides[s]; return sd.party[sd.active]; }
  label(s) { const m = this.mon(s); return s === 0 ? nameOf(m) : (this.wild ? 'Wild ' : 'Foe ') + nameOf(m); }
  trait(s) { return TRAITS[KITH[this.mon(s).id].trait]; }
  types(s) { return KITH[this.mon(s).id].types; }
  msg(s) { this.ev.push({ t: 'msg', s }); }
  flush() { const e = this.ev; this.ev = []; return e; }

  start() {
    const f = this.mon(1);
    this.msg(this.wild ? `A wild ${nameOf(f)} appeared!` : `${this.o.trainerName} wants to battle!`);
    if (!this.wild) this.msg(`${this.o.trainerName} sent out ${nameOf(f)}!`);
    this.ev.push({ t: 'send', side: 1, idx: 0 });
    this.msg(`Go, ${nameOf(this.mon(0))}!`);
    this.ev.push({ t: 'send', side: 0, idx: this.sides[0].active });
    if (this.weather) this.ev.push({ t: 'weather', w: this.weather });
    this.onEntry(1); this.onEntry(0);
    return this.flush();
  }
  onEntry(s) {
    const tr = this.trait(s);
    if (tr.id === 'loom') { this.msg(`${this.label(s)} looms over its foe!`); this.changeStage(1 - s, 'atk', -1, s); }
    if (tr.entryWeather && this.weather !== tr.entryWeather) this.setWeather(tr.entryWeather, `${this.label(s)}'s ${tr.name}`);
  }
  setWeather(w, by) {
    this.weather = w; this.weatherTurns = 5;
    this.ev.push({ t: 'weather', w });
    this.msg(`${by ? by + ': ' : ''}${WEATHER_NAMES[w]} begins.`);
  }
  speed(s) {
    const m = this.mon(s);
    let v = statsOf(m).spe * stageMul(this.sides[s].vol.stages.spe);
    if (m.status === 'stn') v *= 0.5;
    const tr = this.trait(s);
    if (tr.wspeed && tr.wspeed === this.weather) v *= 2;
    return v;
  }
  changeStage(s, stat, delta, by) {
    const vol = this.sides[s].vol, tr = this.trait(s);
    if (delta < 0 && by !== s && stat === 'acc' && tr.id === 'keeneye') { this.msg(`${this.label(s)}'s Keen Eye keeps its accuracy sharp.`); return; }
    const before = vol.stages[stat];
    vol.stages[stat] = clamp(before + delta, -6, 6);
    if (vol.stages[stat] === before) { this.msg(`${this.label(s)}'s ${STAT_NAMES[stat]} won't go any ${delta > 0 ? 'higher' : 'lower'}.`); return; }
    this.ev.push({ t: 'stage', side: s, stat, delta });
    this.msg(`${this.label(s)}'s ${STAT_NAMES[stat]} ${delta > 0 ? (delta > 1 ? 'rose sharply' : 'rose') : (delta < -1 ? 'fell sharply' : 'fell')}!`);
    if (delta < 0 && by !== s && tr.id === 'scrappy' && stat !== 'atk') { this.msg(`${this.label(s)} gets scrappy!`); this.changeStage(s, 'atk', 1, s); }
  }
  inflict(s, st, quiet) {
    const m = this.mon(s), tr = this.trait(s), ty = this.types(s);
    const immune = m.status || m.hp <= 0 || tr.nostatus === st
      || (st === 'brn' && ty.includes('ember')) || (st === 'psn' && (ty.includes('venom') || ty.includes('alloy')))
      || (st === 'stn' && ty.includes('volt')) || (st === 'fbt' && ty.includes('frost'));
    if (immune) { if (!quiet) this.msg(`It doesn't affect ${this.label(s)}.`); return false; }
    m.status = st;
    if (st === 'slp') m.slp = this.rng.range(1, 3);
    this.ev.push({ t: 'status', side: s, st });
    this.msg(`${this.label(s)} ${STATUS_START[st]}`);
    return true;
  }
  addSurge(s, v) {
    const sd = this.sides[s];
    if (this.trait(s).id === 'resonant') v *= 1.5;
    const before = sd.surge;
    sd.surge = clamp(Math.round(sd.surge + v), 0, 100);
    if (sd.surge !== before) this.ev.push({ t: 'surge', side: s, v: sd.surge });
  }
  damage(s, amount, opts = {}) {
    const m = this.mon(s);
    amount = Math.max(1, Math.floor(amount));
    m.hp = Math.max(0, m.hp - amount);
    this.ev.push({ t: 'hp', side: s, hp: m.hp, max: statsOf(m).hp, ...opts });
    return amount;
  }
  heal(s, amount) {
    const m = this.mon(s), max = statsOf(m).hp;
    if (m.hp <= 0 || m.hp >= max) return 0;
    const before = m.hp;
    m.hp = Math.min(max, m.hp + Math.max(1, Math.floor(amount)));
    this.ev.push({ t: 'hp', side: s, hp: m.hp, max, heal: true });
    return m.hp - before;
  }

  // Expected / rolled damage. roll in [0.85,1].
  calc(s, move, { crit = false, roll = 1, surge = false } = {}) {
    const t = 1 - s, a = this.mon(s), d = this.mon(t);
    const as = statsOf(a), ds = statsOf(d), av = this.sides[s].vol.stages, dv = this.sides[t].vol.stages;
    const aTr = this.trait(s), dTr = this.trait(t);
    const phys = move.c === 'p';
    let aStage = phys ? av.atk : av.spa, dStage = phys ? dv.def : dv.spd;
    if (crit) { aStage = Math.max(0, aStage); dStage = Math.min(0, dStage); }
    if (aTr.id === 'hollow') dStage = 0;
    if (dTr.id === 'hollow') aStage = 0;
    let A = (phys ? as.atk : as.spa) * stageMul(aStage);
    let D = (phys ? ds.def : ds.spd) * stageMul(dStage);
    if (phys && a.status === 'brn') A *= 0.5;
    if (!phys && a.status === 'fbt') A *= 0.5;
    if (!phys && dTr.id === 'dustveil' && this.weather === 'dust') D *= 1.5;
    let eff = effectiveness(move.t, KITH[d.id].types);
    if (dTr.immune === move.t) eff = 0;
    if (eff === 0) return { dmg: 0, eff };
    let pow = move.pow;
    if (surge) pow *= 1.5;
    if (aTr.pinch === move.t && a.hp <= as.hp / 3) pow *= 1.5;
    let dmg = (((2 * a.lvl) / 5 + 2) * pow * A) / D / 50 + 2;
    if (KITH[a.id].types.includes(move.t)) dmg *= 1.5;
    dmg *= eff;
    if (this.weather === 'sun') dmg *= move.t === 'ember' ? 1.5 : move.t === 'tide' ? 0.5 : 1;
    if (this.weather === 'rain') dmg *= move.t === 'tide' ? 1.5 : move.t === 'ember' ? 0.5 : 1;
    if (crit) dmg *= 1.5;
    if (eff > 1 && dTr.id === 'archive') dmg *= 0.75;
    return { dmg: Math.max(1, Math.floor(dmg * roll)), eff };
  }

  // ── AI
  aiChoose() {
    const s = 1, m = this.mon(s), foe = this.mon(0), level = this.o.ai ?? (this.wild ? 0 : 1);
    const usable = m.moves.map((mv, i) => ({ mv, i })).filter((x) => x.mv.pp > 0);
    if (!usable.length) return { type: 'move', i: -1 };
    const foeMax = statsOf(foe).hp, myMax = statsOf(m).hp, vol = this.sides[s].vol;
    const scored = usable.map(({ mv, i }) => {
      const def = MOVES[mv.id], fx = def.fx;
      let score;
      if (def.c !== 't') {
        const { dmg } = this.calc(s, def, { roll: 0.92 });
        score = (Math.min(dmg, foe.hp) / foeMax) * 100 * (def.acc / 100);
        if (dmg >= foe.hp) score += 40 + (fx.pri ? 20 : 0);
        if (fx.drain && m.hp < myMax * 0.6) score += 10;
      } else {
        score = 12;
        if (fx.heal) score = m.hp < myMax * 0.45 ? 75 : 0;
        if (fx.st) score = foe.status ? 0 : (fx.st[0] === 'slp' ? 55 : 42) * (def.acc / 100);
        if (fx.sg) { const [who, ch] = fx.sg; const k = Object.keys(ch)[0]; const cur = (who === 's' ? vol : this.sides[0].vol).stages[k]; score = Math.abs(cur) >= 2 ? 3 : (m.hp > myMax * 0.5 ? 34 : 10); }
        if (fx.weather) score = this.weather === fx.weather ? 0 : 36;
        if (fx.leech) score = this.sides[0].vol.leech ? 0 : 40;
        if (fx.daze) score = this.sides[0].vol.daze ? 0 : 30;
        if (fx.ward) score = vol.wardStreak ? 0 : 14;
        if (fx.cure) score = m.status ? 60 : (m.hp < myMax * 0.5 ? 40 : 0);
      }
      return { i, score: Math.max(0.5, score) };
    });
    let pick;
    if (level === 0) pick = this.rng.weighted(scored.map((x) => [x, 10 + x.score]));
    else {
      scored.sort((a, b) => b.score - a.score);
      pick = level >= 2 || this.rng.chance(0.75) ? scored[0] : this.rng.pick(scored);
    }
    const def = MOVES[m.moves[pick.i].id];
    return { type: 'move', i: pick.i, surge: this.sides[s].surge >= 100 && (def.c !== 't' || level < 2) };
  }

  // ── Turn
  act(action) {
    if (this.over || this.needSwitch) return [];
    this.turn++;
    const foeAct = this.aiChoose();
    const acts = [{ s: 0, a: action }, { s: 1, a: foeAct }];
    const pri = (x) => {
      if (x.a.type !== 'move') return 10;
      const mv = x.a.i < 0 ? MOVES.struggle : MOVES[this.mon(x.s).moves[x.a.i].id];
      return (mv.fx.pri || 0) + (x.a.surge && mv.c === 't' ? 1 : 0);
    };
    acts.forEach((x) => { x.p = pri(x); x.sp = this.speed(x.s); x.tie = this.rng(); });
    acts.sort((a, b) => b.p - a.p || b.sp - a.sp || b.tie - a.tie);
    for (const sd of this.sides) { sd.vol.flinch = false; sd.vol.ward = false; }
    for (const x of acts) {
      if (this.over) break;
      if (this.mon(0).hp <= 0 || this.mon(1).hp <= 0) break;
      this.perform(x.s, x.a);
    }
    if (!this.over) this.endTurn();
    this.resolveFaints();
    return this.flush();
  }

  perform(s, a) {
    if (a.type === 'switch') return this.doSwitch(s, a.i);
    if (a.type === 'item') return this.doItem(a);
    if (a.type === 'catch') return this.doCatch(a.item);
    if (a.type === 'run') return this.doRun();
    return this.doMove(s, a);
  }
  doSwitch(s, i) {
    const sd = this.sides[s];
    this.msg(s === 0 ? `Come back, ${nameOf(this.mon(s))}!` : `${this.o.trainerName} recalled ${nameOf(this.mon(s))}.`);
    sd.active = i; sd.vol = freshVol();
    if (s === 0) this.participants.add(i);
    this.msg(s === 0 ? `Go, ${nameOf(this.mon(s))}!` : `${this.o.trainerName} sent out ${nameOf(this.mon(s))}!`);
    this.ev.push({ t: 'send', side: s, idx: i });
    this.onEntry(s);
  }
  doItem(a) {
    const mon = this.sides[0].party[a.target];
    const text = useItemOn(mon, a.item);
    this.msg(`You used ${ITEMS[a.item].name}.`);
    if (text) { this.msg(text); if (a.target === this.sides[0].active) { this.ev.push({ t: 'hp', side: 0, hp: mon.hp, max: statsOf(mon).hp, heal: true }); this.ev.push({ t: 'status', side: 0, st: mon.status }); } }
    else this.msg('It had no effect.');
  }
  doRun() {
    if (!this.wild || this.o.canRun === false) { this.msg("There's no running from this battle!"); return; }
    this.runTries++;
    const odds = (this.speed(0) * 128) / Math.max(1, this.speed(1)) + 30 * this.runTries;
    if (this.rng.int(256) < odds) { this.msg('Got away safely!'); this.over = 'run'; } else this.msg("Couldn't get away!");
  }
  doCatch(itemId) {
    const it = ITEMS[itemId], m = this.mon(1);
    this.msg(`You raised a ${it.name}!`);
    if (!this.wild || this.o.noCatch) { this.msg(this.o.noCatch || "You can't take someone else's Kith!"); return; }
    const max = statsOf(m).hp;
    let mult = it.mult;
    if (it.dusk && (this.o.night || this.o.cave)) mult = it.dusk;
    const bonus = m.status === 'slp' ? 2 : m.status ? 1.5 : 1;
    const a = (((3 * max - 2 * m.hp) * KITH[m.id].catchRate * mult) / (3 * max)) * bonus;
    let shakes = 0, ok = a >= 255;
    if (!ok) {
      const b = 65536 / Math.pow(255 / a, 0.1875);
      while (shakes < 4 && this.rng.int(65536) < b) shakes++;
      ok = shakes === 4;
    } else shakes = 4;
    this.ev.push({ t: 'catch', shakes: Math.min(3, shakes), ok });
    if (ok) { this.msg(`${nameOf(m)} stepped into the lantern light. It trusts you!`); this.over = 'caught'; }
    else this.msg(['The light went out!', 'It shied away!', 'So close!', 'It almost stayed!'][Math.min(3, shakes)]);
  }

  doMove(s, a) {
    const t = 1 - s, sd = this.sides[s], m = this.mon(s), vol = sd.vol, name = this.label(s);
    if (m.status === 'slp') {
      if (m.slp > 0) { m.slp--; this.msg(`${name} is fast asleep.`); return; }
      m.status = null; this.ev.push({ t: 'status', side: s, st: null }); this.msg(`${name} woke up!`);
    }
    if (vol.flinch) { this.msg(`${name} flinched!`); return; }
    if (m.status === 'stn' && this.rng.chance(0.25)) { this.msg(`${name} is stunned and can't move!`); return; }
    if (vol.daze > 0) {
      vol.daze--;
      if (vol.daze === 0) this.msg(`${name} shook off its daze.`);
      else {
        this.msg(`${name} is dazed.`);
        if (this.rng.chance(0.33)) {
          this.msg('It stumbled and hurt itself!');
          const st = statsOf(m);
          this.damage(s, (((2 * m.lvl) / 5 + 2) * 40 * st.atk) / st.def / 50 + 2);
          return;
        }
      }
    }
    const slot = a.i >= 0 ? m.moves[a.i] : null;
    const move = slot ? MOVES[slot.id] : MOVES.struggle;
    const fx = move.fx;
    if (slot) slot.pp = Math.max(0, slot.pp - 1);
    const surge = !!a.surge && sd.surge >= 100;
    if (surge) { sd.surge = 0; this.ev.push({ t: 'surge', side: s, v: 0, burst: true }); this.msg(`${name} SURGES!`); }
    this.msg(`${name} used ${move.name}!`);
    if (fx.ward) {
      if (vol.wardStreak > 0 && !this.rng.chance(1 / 3)) { vol.wardStreak = 0; this.msg('But it failed!'); return; }
      vol.ward = true; vol.wardStreak++;
      this.ev.push({ t: 'anim', side: s, move: move.id, self: true });
      this.msg(`${name} braced behind a ward.`);
      return;
    }
    vol.wardStreak = 0;
    const targetsFoe = move.c !== 't' || fx.st || fx.daze || fx.leech || (fx.sg && fx.sg[0] === 'f');
    if (targetsFoe) {
      if (this.sides[t].vol.ward) { this.msg(`${this.label(t)}'s ward held!`); return; }
      if (!surge) {
        let accS = vol.stages.acc, evaS = this.sides[t].vol.stages.eva;
        if (this.trait(s).id === 'hollow') evaS = 0;
        if (this.trait(t).id === 'hollow') accS = 0;
        let acc = (move.acc / 100) * accMul(accS) / accMul(evaS);
        if (this.trait(t).id === 'sleetcoat' && this.weather === 'sleet') acc *= 0.8;
        if (!this.rng.chance(acc)) { this.ev.push({ t: 'miss', side: t }); this.msg(`${name}'s attack missed!`); return; }
      }
    }
    this.ev.push({ t: 'anim', side: s, move: move.id, self: !targetsFoe, surge });

    if (move.c !== 't') {
      const hits = fx.hits ? this.rng.range(fx.hits[0], fx.hits[1]) : 1;
      let total = 0, lastEff = 1, landed = 0;
      for (let h = 0; h < hits && this.mon(t).hp > 0 && m.hp > 0; h++) {
        let critStage = (fx.crit ? 1 : 0) + (this.trait(s).id === 'nightcloak' ? 1 : 0);
        let crit = this.rng.chance([1 / 24, 1 / 8, 1 / 2][Math.min(2, critStage)]);
        if (this.trait(t).id === 'thickshell') crit = false;
        const { dmg, eff } = this.calc(s, move, { crit, roll: 0.85 + this.rng() * 0.15, surge });
        lastEff = eff;
        if (eff === 0) { this.msg(`It doesn't affect ${this.label(t)}...`); return; }
        total += this.damage(t, dmg, { hit: true, eff, crit, type: move.t });
        landed++;
        if (crit) this.msg('A critical hit!');
        this.addSurge(s, 15 + (eff > 1 ? 10 : 0) + (crit ? 10 : 0));
        this.addSurge(t, 10);
        const ctr = this.trait(t).contact;
        if (fx.contact && ctr && m.hp > 0 && !m.status && this.rng.chance(ctr[1])) { this.msg(`${this.label(t)}'s ${this.trait(t).name}!`); this.inflict(s, ctr[0], true); }
      }
      if (hits > 1) this.msg(`Hit ${landed} time${landed > 1 ? 's' : ''}!`);
      if (lastEff > 1) this.msg("It's super effective!"); else if (lastEff < 1) this.msg("It's not very effective...");
      if (fx.drain && total > 0) { if (this.heal(s, total * fx.drain)) this.msg(`${name} drained energy.`); }
      if (fx.recoil && total > 0 && m.hp > 0) { this.damage(s, total * fx.recoil); this.msg(`${name} is hurt by recoil!`); }
    }
    const foeAlive = this.mon(t).hp > 0;
    if (fx.st && foeAlive && this.rng.chance(fx.st[1])) this.inflict(t, fx.st[0], move.c !== 't');
    if (fx.daze && foeAlive && this.rng.chance(fx.daze)) {
      const tv = this.sides[t].vol;
      if (this.trait(t).id === 'ironwill') { if (move.c === 't') this.msg(`${this.label(t)}'s Iron Will keeps it steady.`); }
      else if (tv.daze) { if (move.c === 't') this.msg(`${this.label(t)} is already dazed.`); }
      else { tv.daze = this.rng.range(2, 4); this.msg(`${this.label(t)} is dazed!`); }
    }
    if (fx.flinch && foeAlive && this.trait(t).id !== 'ironwill' && this.rng.chance(fx.flinch)) this.sides[t].vol.flinch = true;
    if (fx.leech && foeAlive) {
      if (this.types(t).includes('verdant') || this.sides[t].vol.leech) this.msg(`It doesn't affect ${this.label(t)}.`);
      else { this.sides[t].vol.leech = true; this.msg(`${this.label(t)} was seeded!`); }
    }
    if (fx.sg && m.hp > 0) {
      const [who, changes, chance] = fx.sg;
      const target = who === 's' ? s : t;
      if ((who === 's' || foeAlive) && this.rng.chance(chance)) for (const k in changes) this.changeStage(target, k, changes[k] * (surge && move.c === 't' ? 1 : 1), s);
    }
    if (fx.heal && m.hp > 0) { if (this.heal(s, statsOf(m).hp * fx.heal)) this.msg(`${name} recovered health.`); else if (move.c === 't' && !fx.cure) this.msg("But its HP is already full."); }
    if (fx.cure && m.status) { m.status = null; this.ev.push({ t: 'status', side: s, st: null }); this.msg(`${name} was cleansed.`); }
    if (fx.weather) { if (this.weather === fx.weather) this.msg('But nothing changed.'); else this.setWeather(fx.weather); }
  }

  endTurn() {
    for (const s of this.order()) {
      const m = this.mon(s);
      if (m.hp <= 0) continue;
      const max = statsOf(m).hp, name = this.label(s), tr = this.trait(s), ty = this.types(s);
      if (this.weather === 'sleet' && !ty.includes('frost') && tr.id !== 'sleetcoat') { this.damage(s, max / 16); this.msg(`${name} is pelted by sleet.`); }
      if (this.weather === 'dust' && !['stone', 'terra', 'alloy'].some((x) => ty.includes(x)) && tr.id !== 'dustveil') { this.damage(s, max / 16); this.msg(`${name} is scoured by dust.`); }
      if (m.hp > 0 && m.status === 'brn') { this.damage(s, max / 16); this.msg(`${name} is hurt by its burn.`); }
      if (m.hp > 0 && m.status === 'fbt') { this.damage(s, max / 16); this.msg(`${name} is hurt by frostbite.`); }
      if (m.hp > 0 && m.status === 'psn') { this.damage(s, max / 8); this.msg(`${name} is hurt by poison.`); }
      if (m.hp > 0 && this.sides[s].vol.leech && this.mon(1 - s).hp > 0) { const d = this.damage(s, max / 8); this.heal(1 - s, d); this.msg(`${name}'s energy was sapped.`); }
      if (m.hp > 0 && tr.id === 'lanternlit' && m.hp < max) { this.heal(s, max / 16); this.msg(`${name} glows softly and recovers.`); }
    }
    if (this.weather && --this.weatherTurns <= 0) { this.msg(`The ${WEATHER_NAMES[this.weather].toLowerCase()} eased.`); this.weather = null; this.ev.push({ t: 'weather', w: null }); }
  }
  order() { return this.speed(0) >= this.speed(1) ? [0, 1] : [1, 0]; }

  resolveFaints() {
    if (this.over && this.over !== 'win' && this.over !== 'lose') return;
    const foe = this.sides[1], me = this.sides[0];
    if (this.mon(1).hp <= 0 && !foe.handled) {
      this.ev.push({ t: 'faint', side: 1 });
      this.msg(`${this.label(1)} fainted!`);
      this.awardExp();
      const next = foe.party.findIndex((m) => m.hp > 0);
      if (next < 0) { foe.handled = true; if (me.party.some((m) => m.hp > 0)) this.over = 'win'; }
      else foe.pending = next;
    }
    if (this.mon(0).hp <= 0) {
      this.ev.push({ t: 'faint', side: 0 });
      this.msg(`${this.label(0)} fainted!`);
      if (me.party.some((m) => m.hp > 0)) this.needSwitch = true; else this.over = 'lose';
    }
    if (this.over === 'lose') return;
    if (foe.pending != null && !this.needSwitch) this.foeSend();
  }
  foeSend() {
    const foe = this.sides[1];
    foe.active = foe.pending; foe.pending = null; foe.vol = freshVol();
    this.participants = new Set([this.sides[0].active]);
    this.msg(`${this.o.trainerName} sent out ${nameOf(this.mon(1))}!`);
    this.ev.push({ t: 'send', side: 1, idx: foe.active });
    this.onEntry(1);
  }
  // Player picks a replacement after a faint.
  switchIn(i) {
    if (!this.needSwitch) return [];
    const me = this.sides[0];
    me.active = i; me.vol = freshVol(); this.needSwitch = false;
    this.participants.add(i);
    this.msg(`Go, ${nameOf(this.mon(0))}!`);
    this.ev.push({ t: 'send', side: 0, idx: i });
    if (this.sides[1].pending != null) this.foeSend();
    this.onEntry(0);
    return this.flush();
  }
  awardExp() {
    const foe = this.mon(1), party = this.sides[0].party;
    const base = Math.floor((KITH[foe.id].expYield * foe.lvl) / 7 * (this.wild ? 1 : 1.5) * (this.o.expMult || 1));
    const active = [...this.participants].filter((i) => party[i].hp > 0);
    party.forEach((mon, i) => {
      if (mon.hp <= 0) return;
      const full = active.includes(i);
      const amt = Math.max(1, Math.floor(full ? base / Math.max(1, active.length) : base * 0.5));
      const before = mon.lvl;
      const ups = gainExp(mon, amt);
      this.ev.push({ t: 'exp', idx: i, amt, full });
      if (full) this.msg(`${nameOf(mon)} gained ${amt} exp.`);
      for (const up of ups) {
        this.ev.push({ t: 'level', idx: i, lvl: up.lvl, hp: mon.hp, max: statsOf(mon).hp });
        this.msg(`${nameOf(mon)} grew to level ${up.lvl}!`);
        for (const mv of up.learned) this.msg(`${nameOf(mon)} learned ${MOVES[mv].name}!`);
        for (const mv of up.pending) this.ev.push({ t: 'learn', idx: i, move: mv });
      }
      if (!full && mon.lvl > before && !ups.length) { /* no-op */ }
    });
    this.participants = new Set([this.sides[0].active]);
  }
}
export { TYPES };
