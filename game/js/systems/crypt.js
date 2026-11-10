// CRYPT engine: odds, Fortune, pity, rolling, Dust, constellations. Pure; randomness is injected so the
// same code can run from a verifiable seed on a server.
import { CARDS, RARITIES, RARITY, CONSTELLATIONS } from '../data/cards.js';
import { CRATES, LEGEND_PITY, FORTUNE_CAP, COLLECTOR } from '../data/crates.js';
import { makeRng } from '../core/rng.js';

const rank = (r) => RARITIES.indexOf(r);

// Odds after Fortune: every rarity above the lowest in the table is weighted by (1 + fortune).
export function effectiveOdds(table, fortune = 0) {
  const f = Math.max(0, Math.min(FORTUNE_CAP, fortune));
  const keys = RARITIES.filter((r) => table[r] > 0);
  const out = {}; let total = 0;
  keys.forEach((r, i) => { out[r] = table[r] * (i === 0 ? 1 : 1 + f); total += out[r]; });
  for (const r of keys) out[r] /= total;
  return out;
}
export function cardPool(crate, date = new Date()) {
  const month = date.getMonth() + 1;
  return Object.values(CARDS).filter((c) => {
    if (c.rarity === 'secret') return false;
    if (c.cat === 'seasonal' && !c.months.includes(month)) return false;
    if (crate.pool) {
      const okType = c.types && c.types.some((t) => crate.pool.types.includes(t));
      if (!okType && !crate.pool.cats.includes(c.cat)) return false;
    }
    return true;
  });
}
function pickCard(pool, rarity, rng) {
  for (let r = rank(rarity); r >= 0; r--) {
    const opts = pool.filter((c) => c.rarity === RARITIES[r]);
    if (opts.length) return rng.pick(opts);
  }
  for (let r = rank(rarity) + 1; r < RARITIES.length; r++) {
    const opts = pool.filter((c) => c.rarity === RARITIES[r]);
    if (opts.length) return rng.pick(opts);
  }
  throw new Error('empty card pool');
}
// ctx: { fortune, pity (cards since epic+ for this crate), pityLegend, date, overrides }
export function rollCrate(crateId, ctx, rng) {
  const crate = { ...CRATES[crateId], ...((ctx.overrides || {})[crateId] || {}) };
  const pool = cardPool(crate, ctx.date);
  let pity = ctx.pity || 0, pityLegend = ctx.pityLegend || 0;
  const cards = [];
  for (let i = 0; i < crate.cards; i++) {
    const table = i === crate.cards - 1 && crate.last ? crate.last : crate.odds;
    const odds = effectiveOdds(table, ctx.fortune);
    let rarity = rng.weighted(Object.entries(odds));
    let forced = null;
    if (pityLegend + 1 >= LEGEND_PITY && rank(rarity) < rank('legendary')) { rarity = 'legendary'; forced = 'legend'; }
    else if (pity + 1 >= crate.pity && rank(rarity) < rank('epic')) { rarity = 'epic'; forced = 'pity'; }
    const card = pickCard(pool, rarity, rng);
    const got = card.rarity;
    pity = rank(got) >= rank('epic') ? 0 : pity + 1;
    pityLegend = rank(got) >= rank('legendary') ? 0 : pityLegend + 1;
    cards.push({ id: card.id, rarity: got, prism: rng.chance(crate.prism), forced });
  }
  return { cards, pity, pityLegend };
}
// Opens a crate against a collection object { cards: {id:{n,prism}}, dust, pity:{}, pityLegend, log:[] }.
export function openCrate(col, crateId, { fortune = 0, seed, date = new Date(), overrides } = {}) {
  const rng = makeRng(seed);
  const res = rollCrate(crateId, { fortune, pity: col.pity[crateId] || 0, pityLegend: col.pityLegend || 0, date, overrides }, rng);
  col.pity[crateId] = res.pity; col.pityLegend = res.pityLegend;
  for (const c of res.cards) c.isNew = addCard(col, c.id, c.prism);
  col.opened = (col.opened || 0) + 1;
  col.log.unshift({ t: date.getTime(), crate: crateId, seed, fortune: +fortune.toFixed(4), cards: res.cards.map((c) => c.id + (c.prism ? '*' : '')) });
  col.log.length = Math.min(col.log.length, 60);
  return res.cards;
}
export function addCard(col, id, prism = false) {
  const e = col.cards[id] || (col.cards[id] = { n: 0, prism: 0 });
  const isNew = e.n === 0;
  e.n++; if (prism) e.prism++;
  return isNew;
}
export function newCollection() { return { cards: {}, dust: 0, shards: 0, collectorOpened: 0, pity: {}, pityLegend: 0, log: [], opened: 0, stars: [] }; }
export const owned = (col, id) => (col.cards[id] ? col.cards[id].n : 0);

export function refine(col, id, keep = 1) {
  const e = col.cards[id]; const c = CARDS[id];
  if (!e || e.n <= keep || c.rarity === 'secret') return 0;
  const extra = e.n - keep;
  e.n = keep; e.prism = Math.min(e.prism, keep);
  const gain = extra * RARITY[c.rarity].dust;
  col.dust += gain;
  return gain;
}
export function refineAll(col) { let g = 0; for (const id in col.cards) g += refine(col, id); return g; }
export function craft(col, id) {
  const c = CARDS[id], cost = RARITY[c.rarity].craft;
  if (!cost || col.dust < cost) return false;
  if (c.cat === 'seasonal' && !c.months.includes(new Date().getMonth() + 1)) return false;
  col.dust -= cost; addCard(col, id);
  return true;
}
// Returns newly completed constellations and grants their secret cards.
export function checkConstellations(col) {
  const done = [];
  for (const k of CONSTELLATIONS) {
    if (col.stars.includes(k.id)) continue;
    if (k.need.every((id) => owned(col, id) > 0)) { col.stars.push(k.id); addCard(col, k.reward); done.push(k); }
  }
  return done;
}
export function collectionStats(col) {
  const all = Object.values(CARDS);
  const have = all.filter((c) => owned(col, c.id) > 0);
  const by = {};
  for (const c of all) { const b = by[c.rarity] || (by[c.rarity] = { have: 0, total: 0 }); b.total++; if (owned(col, c.id)) b.have++; }
  return { have: have.length, total: all.length, by, prism: Object.values(col.cards).filter((e) => e.prism > 0).length };
}

// Fortune: a visible luck bonus earned by play. parts: [{label, value}]
export function fortuneParts(s, eventBonus = 0, aurora = false) {
  const parts = [
    { label: 'Sigils', value: 0.03 * (s.badges || 0) },
    { label: 'Codex', value: Math.min(0.12, 0.002 * (s.caught || 0)) },
    { label: 'Areas explored', value: Math.min(0.07, 0.005 * (s.areas || 0)) },
    { label: 'Daily streak', value: Math.min(0.07, 0.01 * (s.streak || 0)) },
    { label: 'Constellations', value: 0.02 * (s.stars || 0) },
    { label: 'Clover Knot', value: s.clover ? 0.03 : 0 },
    { label: 'Aurora', value: aurora ? 0.1 : 0 },
    { label: 'Event', value: Math.max(0, Math.min(0.2, eventBonus)) },
  ];
  const raw = parts.reduce((a, p) => a + p.value, 0);
  return { parts, total: Math.min(FORTUNE_CAP, raw), capped: raw > FORTUNE_CAP };
}

// Collector Crate, client side: shards only. A real collector card can only be awarded by the reward
// service (see docs/SOLANA_ARCHITECTURE.md), so this function can never return one.
export function openCollector(col, { seed, date = new Date() } = {}) {
  const rng = makeRng(seed);
  const shards = rng.weighted(COLLECTOR.shards);
  col.shards = (col.shards || 0) + shards;
  col.collectorOpened = (col.collectorOpened || 0) + 1;
  col.log.unshift({ t: date.getTime(), crate: 'collector', seed, fortune: 0, cards: [], shards });
  col.log.length = Math.min(col.log.length, 60);
  return { shards, card: null };
}
