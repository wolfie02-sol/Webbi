import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WALKABLE, LEADERS, TOWNS } from '../js/data/maps.js';
import { KITH } from '../js/data/creatures.js';
import { ITEMS } from '../js/data/items.js';
import { CARDS } from '../js/data/cards.js';
import { CRATES } from '../js/data/crates.js';
import { newState, serialize, deserialize, rollDaily, dailyTick, cachesFor, weatherFor, clock } from '../js/systems/state.js';

const find = (m, ch) => { const out = []; m.grid.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); })); return out; };
const TILES = new Set('.,#~=oHFfWLsb*p_tmx'.split(''));

test('maps are rectangular and use known tiles/entities', () => {
  for (const m of Object.values(MAPS)) {
    const w = m.grid[0].length;
    m.grid.forEach((r, y) => { assert.equal(r.length, w, `${m.id} row ${y}`); for (const c of r) assert.ok(TILES.has(c) || m.ent[c], `${m.id}: unknown char "${c}" in row ${y}`); });
    for (const ch in m.ent) assert.ok(find(m, ch).length, `${m.id}: entity ${ch} not on the grid`);
  }
});
test('warps point at real markers and wild tables are valid', () => {
  for (const m of Object.values(MAPS)) {
    for (const [ch, e] of Object.entries(m.ent)) {
      if (e.warp) { const t = MAPS[e.warp[0]]; assert.ok(t, `${m.id}.${ch} -> ${e.warp[0]}`); assert.ok(find(t, e.warp[1]).length, `${m.id}.${ch} -> ${e.warp[0]}.${e.warp[1]}`); }
      if (e.item) assert.ok(ITEMS[e.item], e.item);
      if (e.crate) assert.ok(CRATES[e.crate]);
      if (e.legend) assert.ok(KITH[e.legend]);
      if (e.trainer) for (const [id, l] of e.trainer.party) assert.ok(KITH[id] && l > 0, `${m.id}.${ch} ${id}`);
    }
    if (m.enc) for (const k of ['day', 'night']) for (const [id, a, b, w] of m.enc[k] || []) assert.ok(KITH[id] && a <= b && w > 0, `${m.id} ${id}`);
    if (m.enc && m.enc.rare) assert.ok(KITH[m.enc.rare[0]]);
  }
  for (const L of Object.values(LEADERS)) { assert.ok(CARDS[L.card] && CARDS[L.own]); for (const [id] of L.party) assert.ok(KITH[id]); }
  for (const t of TOWNS) assert.ok(MAPS[t] && find(MAPS[t], '4').length, t + ' has a lantern post');
});
test('every entity and exit on every map is reachable on foot', () => {
  for (const m of Object.values(MAPS)) {
    const H = m.grid.length, W = m.grid[0].length;
    const solidEnt = (e) => e && !e.hide && (e.npc || e.sign || e.post || e.item || e.crate || e.legend || e.starter);
    const passable = (x, y) => { const c = m.grid[y]?.[x]; if (c === undefined) return false; const e = m.ent[c]; return e ? !solidEnt(e) : WALKABLE.has(c); };
    const start = Object.entries(m.ent).find(([, e]) => e.warp);
    const [sx, sy] = find(m, start[0])[0];
    const seen = new Set([sx + ',' + sy]); const queue = [[sx, sy]];
    while (queue.length) { const [x, y] = queue.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && passable(x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); } } }
    for (const [ch, e] of Object.entries(m.ent)) for (const [x, y] of find(m, ch)) {
      const ok = solidEnt(e) ? [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy))) : seen.has(x + ',' + y);
      assert.ok(ok, `${m.id}: cannot reach entity ${ch} at ${x},${y}`);
    }
    // doors must be entered from below
    for (const [ch, e] of Object.entries(m.ent)) if (e.door) for (const [x, y] of find(m, ch)) assert.ok(seen.has(x + ',' + (y + 1)), `${m.id}: door ${ch} has no approach`);
  }
});
test('save round-trip, tamper detection, daily and weather', () => {
  const s = newState(); s.coins = 1234; s.flags.starter = true;
  const back = deserialize(serialize(s));
  assert.equal(back.coins, 1234);
  const bad = serialize(s).replace('1234', '9999');
  assert.throws(() => deserialize(bad), /damaged/);
  assert.equal(rollDaily(s, new Date(2026, 10, 9)), true);
  assert.equal(s.daily.quests.length, 3); assert.equal(s.daily.streak, 1);
  assert.equal(rollDaily(s, new Date(2026, 10, 9)), false);
  rollDaily(s, new Date(2026, 10, 10)); assert.equal(s.daily.streak, 2);
  rollDaily(s, new Date(2026, 10, 14)); assert.equal(s.daily.streak, 1);
  const q = s.daily.quests[0]; assert.equal(dailyTick(s, q.type, q.need), false);
  const c = cachesFor(s, 'dewpath'); assert.equal(c.length, 2);
  assert.deepEqual(cachesFor(s, 'dewpath'), c);
  assert.equal(cachesFor(s, 'lanternrest').length, 0);
  assert.equal(weatherFor(s, 'lab'), null);
  s.debug.hour = 23; assert.equal(clock(s).night, true);
  let aur = 0; for (let i = 0; i < 400; i++) if (weatherFor(s, 'frostspire', i * 360000) === 'aurora') aur++;
  assert.ok(aur > 20 && aur < 120, 'aurora is rare but real: ' + aur);
});
test('economy: bank interest, selling, daily bazaar', async () => {
  const { bankAccrue, bankMove, sellItem, sellPrice, bazaarFor, buyOffer, netWorth, BANK } = await import('../js/systems/economy.js');
  const s = newState(); rollDaily(s, new Date(2026, 10, 9));
  s.coins = 50000; bankAccrue(s, new Date(2026, 10, 9));
  assert.equal(bankMove(s, 40000), 40000); assert.equal(bankMove(s, 999999), 10000, 'cannot deposit more than carried');
  assert.equal(s.coins, 0); assert.equal(netWorth(s), 50000);
  assert.equal(bankAccrue(s, new Date(2026, 10, 9)), 0, 'no interest the same day');
  assert.equal(bankAccrue(s, new Date(2026, 10, 10)), 500);
  assert.equal(bankAccrue(s, new Date(2026, 10, 10)), 0, 'cannot be claimed twice');
  s.bank.coins = 10_000_000; assert.equal(bankAccrue(s, new Date(2026, 10, 11)), BANK.dailyCap, 'daily cap');
  s.bank.coins = 1000; const far = bankAccrue(s, new Date(2028, 0, 1)); assert.ok(far <= 30 * BANK.dailyCap && far > 0, 'catch-up is bounded');
  assert.equal(bankAccrue(s, new Date(2026, 0, 1)), 0, 'setting the clock back earns nothing');
  const held = s.bank.coins; assert.equal(bankMove(s, -99999999), -held, 'cannot withdraw more than banked'); assert.equal(s.bank.coins, 0);
  s.bag = { salve: 3, compass: 1, luckcharm: 1, nugget: 1 };
  assert.equal(sellPrice('compass'), 0); assert.equal(sellPrice('luckcharm'), 0);
  const before = s.coins; assert.equal(sellItem(s, 'salve', 5), 90); assert.equal(sellItem(s, 'nugget'), 800); assert.equal(sellItem(s, 'compass'), 0);
  assert.equal(s.coins, before + 890); assert.equal(s.bag.salve, undefined); assert.equal(s.bag.compass, 1);
  const day = new Date(2026, 10, 9), offers = bazaarFor(s, day);
  assert.equal(offers.length, 5); assert.deepEqual(bazaarFor(newState(), day), offers, 'same for every player');
  assert.notDeepEqual(bazaarFor(s, new Date(2026, 10, 12)).map((o) => o.label), offers.map((o) => o.label));
  s.coins = 1_000_000;
  for (let i = 0; i < offers.length; i++) { for (let k = 0; k < offers[i].limit; k++) assert.equal(buyOffer(s, i, day), true); assert.equal(buyOffer(s, i, day), false, 'limit enforced'); }
  assert.ok(s.col.cards[offers[1].id].n === 1 && s.col.dust === 300 && s.crates.silver === 1);
  s.coins = 0; s.daily.bazaar = {}; assert.equal(buyOffer(s, 0, day), false, 'cannot buy without coins');
  for (const o of offers) assert.ok(!['collector'].includes(o.id) && o.kind !== 'shards', 'coins never buy raffle entries');
});
