import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { CARDS, RARITIES, CONSTELLATIONS, ART } from '../js/data/cards.js';
import { CRATES, FORTUNE_CAP } from '../js/data/crates.js';
import { SPRITES } from '../js/data/sprites.js';
import { effectiveOdds, rollCrate, openCrate, newCollection, cardPool, refineAll, craft, checkConstellations, addCard, fortuneParts } from '../js/systems/crypt.js';

test('every odds table sums to 1 and every pool can serve every rarity', () => {
  for (const c of Object.values(CRATES)) {
    for (const t of [c.odds, c.last].filter(Boolean)) {
      assert.ok(Math.abs(Object.values(t).reduce((a, b) => a + b, 0) - 1) < 1e-9, c.id);
      for (const f of [0, 0.3, FORTUNE_CAP]) assert.ok(Math.abs(Object.values(effectiveOdds(t, f)).reduce((a, b) => a + b, 0) - 1) < 1e-9);
    }
    for (let m = 0; m < 12; m++) {
      const pool = cardPool(c, new Date(2026, m, 15));
      for (const r of Object.keys(c.odds)) assert.ok(pool.some((x) => x.rarity === r), `${c.id} has ${r} in month ${m + 1}`);
    }
  }
});
test('card art references exist', () => {
  for (const c of Object.values(CARDS)) {
    if (c.art.k === 'kith') assert.ok(SPRITES[c.art.id], c.id);
    if (c.art.k === 'art') assert.ok(ART[c.art.id], c.id);
  }
  for (const k of CONSTELLATIONS) { for (const id of k.need) assert.ok(CARDS[id], id); assert.equal(CARDS[k.reward].rarity, 'secret'); }
});
test('simulated pulls match the published odds (no pity)', () => {
  const rng = makeRng(99), N = 200000, count = {};
  const table = CRATES.basic.odds;
  for (let i = 0; i < N; i++) { const r = rng.weighted(Object.entries(effectiveOdds(table, 0))); count[r] = (count[r] || 0) + 1; }
  for (const r in table) assert.ok(Math.abs(count[r] / N - table[r]) < 0.004, `${r}: ${count[r] / N} vs ${table[r]}`);
});
test('Fortune never lowers the chance of anything above the base rarity', () => {
  for (const c of Object.values(CRATES)) {
    const a = effectiveOdds(c.odds, 0), b = effectiveOdds(c.odds, FORTUNE_CAP);
    const keys = RARITIES.filter((r) => c.odds[r]);
    keys.slice(1).forEach((r) => assert.ok(b[r] > a[r]));
    assert.ok(b[keys[0]] < a[keys[0]]);
    assert.deepEqual(effectiveOdds(c.odds, 5), b, 'clamped at cap');
  }
});
test('pity guarantees an Epic or better within the threshold', () => {
  const rng = makeRng(5);
  for (const id of Object.keys(CRATES)) {
    let pity = 0, pityLegend = 0, worst = 0, since = 0;
    for (let i = 0; i < 3000; i++) {
      const res = rollCrate(id, { fortune: 0, pity, pityLegend, date: new Date(2026, 5, 1) }, rng);
      for (const c of res.cards) { since++; if (RARITIES.indexOf(c.rarity) >= 3) { worst = Math.max(worst, since); since = 0; } }
      pity = res.pity; pityLegend = res.pityLegend;
    }
    assert.ok(worst <= CRATES[id].pity, `${id}: longest drought ${worst} > ${CRATES[id].pity}`);
  }
});
test('secret cards never come from crates; seasonal only in season', () => {
  const rng = makeRng(11);
  for (let i = 0; i < 4000; i++) {
    const res = rollCrate('mythic', { date: new Date(2026, 6, 1) }, rng);
    for (const c of res.cards) { assert.notEqual(CARDS[c.id].rarity, 'secret'); assert.ok(!['x-winter', 'x-spring', 'x-autumn'].includes(c.id)); }
  }
});
test('collection: open, refine, craft, constellations', () => {
  const col = newCollection();
  for (let i = 0; i < 200; i++) openCrate(col, 'basic', { seed: i + 1, date: new Date(2026, 5, 1) });
  assert.equal(col.opened, 200);
  assert.ok(col.log.length <= 60);
  const gained = refineAll(col);
  assert.ok(gained > 0 && col.dust === gained);
  for (const e of Object.values(col.cards)) assert.ok(e.n <= 1);
  col.dust = 8; assert.equal(craft(col, 'a-lantern'), true); assert.equal(col.dust, 0);
  assert.equal(craft(col, 's-opendoor'), false);
  for (const id of ['a-lantern', 'a-compass', 'c-maren']) addCard(col, id);
  const done = checkConstellations(col);
  assert.ok(done.some((k) => k.id === 'firstlantern'));
  assert.ok(col.cards['s-firstlantern'].n === 1);
  assert.equal(checkConstellations(col).length, 0);
});
test('Fortune is capped and ignores anything not earned by play', () => {
  const f = fortuneParts({ badges: 4, caught: 58, areas: 14, streak: 30, stars: 5, clover: true }, 5, true);
  assert.equal(f.total, FORTUNE_CAP);
  assert.equal(fortuneParts({}).total, 0);
});
