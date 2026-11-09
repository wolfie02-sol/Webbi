// Kith instances: creation, stats, experience, evolution, item use. Pure (no DOM).
import { KITH } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { ITEMS } from '../data/items.js';

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const STAT_NAMES = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasion' };
export const STATUS_NAMES = { brn: 'Burn', psn: 'Poison', stn: 'Stun', slp: 'Sleep', fbt: 'Frostbite' };
export const MAX_LEVEL = 100;
let uidCounter = 1;

export const expForLevel = (l) => l * l * l;

export function movesAtLevel(species, lvl) {
  const ids = [];
  for (const [l, m] of KITH[species].learn) if (l <= lvl && !ids.includes(m)) ids.push(m);
  return ids.slice(-4);
}
export function createMon(species, lvl, rng, opts = {}) {
  const k = KITH[species];
  if (!k) throw new Error('Unknown Kith ' + species);
  const mon = {
    uid: Date.now().toString(36) + '-' + (uidCounter++).toString(36) + '-' + Math.floor(rng() * 1e6).toString(36),
    id: species, nick: null, lvl, exp: expForLevel(lvl),
    ivs: STAT_KEYS.map(() => rng.int(16)),
    gleam: opts.gleam ?? rng.chance(opts.gleamRate ?? 1 / 256),
    status: null, slp: 0,
    moves: (opts.moves || movesAtLevel(species, lvl)).map((id) => ({ id, pp: MOVES[id].pp })),
    ot: opts.ot || null, met: opts.met || null,
  };
  mon.hp = statsOf(mon).hp;
  return mon;
}
export function statsOf(mon) {
  const b = KITH[mon.id].base, L = mon.lvl, o = {};
  STAT_KEYS.forEach((k, i) => {
    const core = Math.floor(((2 * b[i] + 2 * mon.ivs[i]) * L) / 100);
    o[k] = k === 'hp' ? core + L + 10 : core + 5;
  });
  return o;
}
export const nameOf = (mon) => mon.nick || KITH[mon.id].name;
export const isFainted = (mon) => mon.hp <= 0;
export function healMon(mon) { mon.hp = statsOf(mon).hp; mon.status = null; mon.slp = 0; for (const m of mon.moves) m.pp = MOVES[m.id].pp; }

// Adds exp; returns [{ lvl, learned: [moveId], pending: [moveId] }] for every level gained.
export function gainExp(mon, amount) {
  const ups = [];
  if (mon.lvl >= MAX_LEVEL) return ups;
  mon.exp += amount;
  while (mon.lvl < MAX_LEVEL && mon.exp >= expForLevel(mon.lvl + 1)) {
    const before = statsOf(mon).hp;
    mon.lvl++;
    const after = statsOf(mon).hp;
    if (mon.hp > 0) mon.hp += after - before;
    const up = { lvl: mon.lvl, learned: [], pending: [] };
    for (const [l, m] of KITH[mon.id].learn) {
      if (l !== mon.lvl || mon.moves.some((x) => x.id === m)) continue;
      if (mon.moves.length < 4) { mon.moves.push({ id: m, pp: MOVES[m].pp }); up.learned.push(m); } else up.pending.push(m);
    }
    ups.push(up);
  }
  return ups;
}
export function replaceMove(mon, slot, moveId) { mon.moves[slot] = { id: moveId, pp: MOVES[moveId].pp }; }

// ctx: { night: bool, item: id|null }
export function evolutionTarget(mon, ctx = {}) {
  const evo = KITH[mon.id].evo;
  if (!evo) return null;
  if (evo.item) return ctx.item === evo.item ? evo.to : null;
  if (ctx.item) return null;
  if (evo.time === 'night' && !ctx.night) return null;
  return mon.lvl >= evo.lvl ? evo.to : null;
}
export function evolve(mon, to) {
  const before = statsOf(mon).hp;
  const from = mon.id;
  mon.id = to;
  const after = statsOf(mon).hp;
  if (mon.hp > 0) mon.hp += after - before;
  const news = [];
  for (const [l, m] of KITH[to].ownLearn) {
    if (l > mon.lvl || mon.moves.some((x) => x.id === m)) continue;
    if (KITH[from].learn.some((x) => x[1] === m && x[0] <= mon.lvl)) continue;
    if (mon.moves.length < 4) mon.moves.push({ id: m, pp: MOVES[m].pp }); else news.push(m);
  }
  return news; // moves waiting for a replace decision
}

// Returns a message if the item did something, or null.
export function useItemOn(mon, itemId) {
  const it = ITEMS[itemId], max = statsOf(mon).hp, n = nameOf(mon);
  if (it.kind === 'revive') {
    if (mon.hp > 0) return null;
    mon.hp = Math.max(1, Math.floor(max * it.frac)); mon.status = null;
    return `${n} is back on its feet!`;
  }
  if (mon.hp <= 0) return null;
  if (it.kind === 'heal') {
    const cures = it.cure && mon.status;
    if (mon.hp >= max && !cures) return null;
    const before = mon.hp;
    mon.hp = Math.min(max, mon.hp + it.hp);
    if (cures) mon.status = null;
    return `${n} recovered ${mon.hp - before} HP${cures ? ' and feels well again' : ''}.`;
  }
  if (it.kind === 'cure') { if (!mon.status) return null; mon.status = null; mon.slp = 0; return `${n} feels well again.`; }
  if (it.kind === 'pp') {
    if (mon.moves.every((m) => m.pp >= MOVES[m.id].pp)) return null;
    for (const m of mon.moves) m.pp = MOVES[m.id].pp;
    return `${n} remembered all its moves.`;
  }
  return null;
}
