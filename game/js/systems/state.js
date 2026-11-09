// Game state, save/load, clock, weather, daily systems. Pure except for the storage adapter.
import { newCollection } from './crypt.js';
import { hashStr, makeRng } from '../core/rng.js';
import { MAPS, WALKABLE } from '../data/maps.js';

export const SAVE_KEY = 'cryptwild.save.v1';
export const SAVE_VERSION = 1;

export function newState() {
  return {
    v: SAVE_VERSION, name: 'Warden', starter: null,
    map: 'lanternrest', x: 6, y: 5, dir: 'down',
    party: [], box: [], bag: {}, coins: 500,
    flags: {}, seen: {}, caught: {}, beaten: {}, visited: { lanternrest: 1 },
    badges: 0, badgesRematch: 0, dug: 0, steps: 0, playMs: 0,
    col: newCollection(), crates: {},
    daily: { date: '', quests: [], claimed: false, crate: false, streak: 0, dugToday: {} },
    tower: { best: 0 }, lastHeal: { map: 'lanternrest', x: 6, y: 5 },
    wallet: null, settings: { sfx: true, music: true, fast: false }, debug: {},
  };
}
const checksum = (s) => hashStr(s).toString(36);
export function serialize(state) {
  const body = JSON.stringify(state);
  return JSON.stringify({ c: checksum(body), body });
}
export function deserialize(text) {
  const wrap = JSON.parse(text);
  if (!wrap || typeof wrap.body !== 'string') throw new Error('Not a Cryptwild save.');
  if (wrap.c !== checksum(wrap.body)) throw new Error('Save file is damaged.');
  const s = JSON.parse(wrap.body);
  if (s.v !== SAVE_VERSION) throw new Error('Save is from a different version.');
  const base = newState();
  for (const k in base) if (!(k in s)) s[k] = base[k];
  if (!MAPS[s.map]) { s.map = s.lastHeal.map; s.x = s.lastHeal.x; s.y = s.lastHeal.y; }
  return s;
}
export function saveGame(state, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, serialize(state)); return true; } catch { return false; }
}
export function loadGame(storage = globalThis.localStorage) {
  try { const t = storage.getItem(SAVE_KEY); return t ? deserialize(t) : null; } catch { return null; }
}
export function hasSave(storage = globalThis.localStorage) { try { return !!storage.getItem(SAVE_KEY); } catch { return false; } }

// ── Clock: one in-game day is 24 real minutes.
export function clock(state, now = Date.now()) {
  const hour = state.debug.hour ?? ((now / 60000) % 24);
  const night = hour < 5.5 || hour >= 20;
  const dusk = !night && (hour < 7 || hour >= 18);
  return { hour, night, dusk, period: Math.floor(now / 360000) };
}
export function weatherFor(state, mapId, now = Date.now()) {
  if (state.debug.weather !== undefined) return state.debug.weather;
  const m = MAPS[mapId];
  if (m.indoor) return null;
  const c = clock(state, now);
  const r = makeRng(hashStr(mapId + ':' + c.period));
  if (m.aurora && c.night && r() < 0.15) return 'aurora';
  if (!m.weather) return null;
  return r.weighted(m.weather);
}

// ── Daily systems (real calendar days)
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAILY_POOL = [
  { type: 'wild', need: 5, text: 'Win 5 wild battles' },
  { type: 'catch', need: 2, text: 'Befriend 2 wild Kith' },
  { type: 'crate', need: 1, text: 'Open a crate' },
  { type: 'dig', need: 1, text: 'Dig up a buried cache' },
  { type: 'trainer', need: 2, text: 'Win 2 trainer battles' },
  { type: 'steps', need: 300, text: 'Walk 300 steps' },
  { type: 'tower', need: 2, text: 'Clear 2 Echo Tower floors' },
];
export function rollDaily(state, date = new Date()) {
  const key = dayKey(date), d = state.daily;
  if (d.date === key) return false;
  const y = new Date(date); y.setDate(y.getDate() - 1);
  d.streak = d.date === dayKey(y) ? d.streak + 1 : 1;
  d.date = key; d.claimed = false; d.crate = false; d.dugToday = {};
  const r = makeRng(hashStr('daily:' + key));
  const pool = DAILY_POOL.filter((q) => (q.type !== 'tower' || state.flags.story_done) && (q.type !== 'dig' || state.bag.compass));
  const picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(r.int(pool.length), 1)[0]);
  d.quests = picks.map((q) => ({ ...q, have: 0 }));
  return true;
}
export function dailyTick(state, type, n = 1) {
  let changed = false;
  for (const q of state.daily.quests) if (q.type === type && q.have < q.need) { q.have = Math.min(q.need, q.have + n); changed = true; }
  return changed && state.daily.quests.every((q) => q.have >= q.need);
}
// Two buried caches per outdoor wild map per day.
export function cachesFor(state, mapId) {
  const m = MAPS[mapId];
  if (m.indoor || m.town) return [];
  const r = makeRng(hashStr('cache:' + state.daily.date + ':' + mapId));
  const spots = [];
  m.grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '.') spots.push([x, y]); }));
  const out = [];
  for (let i = 0; i < 2 && spots.length; i++) {
    const [x, y] = spots.splice(r.int(spots.length), 1)[0];
    const id = `${mapId}:${i}`;
    if (!state.daily.dugToday[id]) out.push({ id, x, y });
  }
  return out;
}
export { WALKABLE };
