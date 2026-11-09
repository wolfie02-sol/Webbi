import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../js/core/rng.js';
import { KITH, KITH_IDS } from '../js/data/creatures.js';
import { MOVES } from '../js/data/moves.js';
import { TRAITS } from '../js/data/traits.js';
import { SPRITES } from '../js/data/sprites.js';
import { TYPE_IDS, CHART, effectiveness } from '../js/data/types.js';
import { createMon, statsOf, gainExp, expForLevel, evolutionTarget, evolve } from '../js/systems/monster.js';
import { Battle } from '../js/systems/battle.js';

test('type chart only references known elements', () => {
  for (const t of TYPE_IDS) for (const list of CHART[t]) for (const d of list) assert.ok(TYPE_IDS.includes(d), `${t}->${d}`);
  assert.equal(effectiveness('tide', ['ember', 'stone']), 4);
  assert.equal(effectiveness('volt', ['terra', 'tide']), 0);
  assert.equal(effectiveness('wyrm', ['radiant']), 0);
});
test('every Kith has valid data', () => {
  assert.equal(KITH_IDS.length, 58);
  for (const k of Object.values(KITH)) {
    assert.ok(SPRITES[k.id], 'sprite ' + k.id);
    assert.ok(TRAITS[k.trait], 'trait ' + k.id);
    for (const t of k.types) assert.ok(TYPE_IDS.includes(t));
    for (const [, m] of k.learn) assert.ok(MOVES[m], `${k.id} learns ${m}`);
    assert.ok(k.learn.some(([l, m]) => l <= 1 && MOVES[m].c !== 't'), `${k.id} has a level-1 attack`);
    if (k.evo) assert.ok(KITH[k.evo.to], `${k.id} evolves into ${k.evo.to}`);
  }
});
test('leveling and evolution', () => {
  const rng = makeRng(1);
  const m = createMon('sproutle', 5, rng);
  assert.ok(m.moves.length >= 2 && m.hp === statsOf(m).hp);
  gainExp(m, expForLevel(16) - m.exp);
  assert.equal(m.lvl, 16);
  assert.equal(evolutionTarget(m), 'thornox');
  evolve(m, 'thornox');
  assert.equal(m.id, 'thornox');
  const moth = createMon('gloomoth', 30, rng);
  assert.equal(evolutionTarget(moth, { night: false }), null);
  assert.equal(evolutionTarget(moth, { night: true }), 'noctwing');
  const g = createMon('glimmet', 10, rng);
  assert.equal(evolutionTarget(g, {}), null);
  assert.equal(evolutionTarget(g, { item: 'dawnshard' }), 'halocorn');
});
test('1500 random battles finish without errors', () => {
  const rng = makeRng(42);
  let wins = 0, turnsTotal = 0;
  for (let n = 0; n < 1500; n++) {
    const lvl = rng.range(3, 70);
    const party = [0, 1, 2].map(() => createMon(rng.pick(KITH_IDS), lvl, rng));
    const foeParty = [0, 1, 2].map(() => createMon(rng.pick(KITH_IDS), lvl, rng));
    const b = new Battle({ party, foeParty, wild: false, trainerName: 'Test', ai: rng.int(3), rng, weather: rng.pick([null, 'sun', 'rain', 'sleet', 'dust']) });
    b.start();
    let guard = 0;
    while (!b.over) {
      assert.ok(++guard < 600, 'battle did not terminate');
      if (b.needSwitch) { b.switchIn(party.findIndex((m) => m.hp > 0)); continue; }
      const me = b.mon(0);
      const usable = me.moves.map((m, i) => i).filter((i) => me.moves[i].pp > 0);
      const ev = b.act(usable.length ? { type: 'move', i: rng.pick(usable), surge: b.sides[0].surge >= 100 } : { type: 'move', i: -1 });
      for (const e of ev) if (e.t === 'hp') assert.ok(e.hp >= 0 && e.hp <= e.max, 'hp in range');
    }
    turnsTotal += b.turn;
    if (b.over === 'win') wins++;
    assert.ok(['win', 'lose'].includes(b.over));
  }
  const rate = wins / 1500;
  console.log(`   random-vs-AI player win rate ${(rate * 100).toFixed(1)}%, avg turns ${(turnsTotal / 1500).toFixed(1)}`);
  assert.ok(rate > 0.2 && rate < 0.7);
});
test('capture: weak sleeping common is easy, healthy legendary is hard', () => {
  const rng = makeRng(7);
  const rate = (species, hpFrac, status, item) => {
    let ok = 0;
    for (let i = 0; i < 400; i++) {
      const foe = createMon(species, 20, rng); foe.hp = Math.max(1, Math.floor(statsOf(foe).hp * hpFrac)); foe.status = status; foe.slp = 99;
      const b = new Battle({ party: [createMon('thornox', 50, rng)], foeParty: [foe], wild: true, rng });
      b.start(); b.act({ type: 'catch', item });
      if (b.over === 'caught') ok++;
    }
    return ok / 400;
  };
  assert.ok(rate('nibbin', 0.1, 'slp', 'lantern') > 0.9);
  assert.ok(rate('mnemora', 1, null, 'lantern') < 0.05);
  assert.equal(rate('mnemora', 1, null, 'prismlantern'), 1);
});
