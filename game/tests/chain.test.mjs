import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import { sanitizeConfig } from '../js/config.js';
import { allocate, validateAllocation, readTreasury, DEFAULT_ALLOCATION } from '../js/solana/treasury.js';
import { base58, base58decode, isAddress, verifyEd25519, ownershipStatement } from '../js/solana/wallet.js';

test('shipped live-config.json is valid and keeps distributions paused', () => {
  const raw = JSON.parse(fs.readFileSync(new URL('../live-config.json', import.meta.url)));
  const c = sanitizeConfig(raw);
  assert.deepEqual(c.problems, []);
  assert.equal(c.rewards.paused, true);
  assert.equal(c.solana.treasuryAddress, '');
});
test('config sanitiser drops unsafe values', () => {
  const c = sanitizeConfig({
    events: [{ name: 'Big', start: '2026-01-01', end: '2026-02-01', fortune: 9 }, { name: 'bad', start: 'x', end: 'y' }],
    crates: { basic: { odds: { common: 0.5, mythic: 0.6 }, pity: 1 }, nope: {}, silver: { odds: { common: 0.4, uncommon: 0.3, rare: 0.2, epic: 0.09, legendary: 0.01 } } },
    rewards: { paused: false },
    solana: { rpcUrl: 'http://insecure', allocation: { cards: 90, events: 20, development: 10, reserve: 10 } },
  });
  assert.equal(c.events.length, 1); assert.equal(c.events[0].fortune, 0.2);
  assert.equal(c.crates.basic.odds, undefined); assert.equal(c.crates.basic.pity, 2);
  assert.ok(c.crates.silver.odds);
  assert.equal(c.rewards.paused, true, 'cannot un-pause without a legal review reference');
  assert.equal(c.solana.rpcUrl, '');
  assert.deepEqual(c.solana.allocation, DEFAULT_ALLOCATION);
  assert.ok(c.problems.length >= 4);
  assert.equal(sanitizeConfig({ rewards: { paused: false, legalReviewRef: 'Memo 2027-01' } }).rewards.paused, false);
});
test('allocation never budgets more than the balance', () => {
  for (const bal of [0, 1, 7, 999_999_999, 123_456_789_012]) {
    const b = allocate(bal, { cards: 60, events: 20, development: 10, reserve: 10 });
    assert.equal(Object.values(b).reduce((a, c) => a + c, 0), bal);
    for (const v of Object.values(b)) assert.ok(v >= 0);
  }
  assert.equal(validateAllocation({ cards: 60, events: 20, development: 10, reserve: 10 }), null);
  assert.ok(validateAllocation({ cards: 60, events: 20, development: 10, reserve: 20 }));
  assert.ok(validateAllocation({ cards: -10, events: 90, development: 10, reserve: 10 }));
});
test('treasury reader: unconfigured, invalid, RPC success and RPC failure', async () => {
  assert.equal((await readTreasury({})).status, 'unconfigured');
  assert.equal((await readTreasury({ treasuryAddress: 'not-an-address', rpcUrl: 'https://x' })).status, 'error');
  const addr = base58(new Uint8Array(32).fill(7));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const result = body.method === 'getBalance' ? { context: { slot: 5 }, value: 2_500_000_000 } : [{ signature: 'sig1', blockTime: 1700000000, err: null }];
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
  };
  const ok = await readTreasury({ treasuryAddress: addr, rpcUrl: 'https://rpc.example' });
  assert.equal(ok.status, 'ok'); assert.equal(ok.sol, 2.5); assert.equal(ok.budget.cards, 1_500_000_000); assert.equal(ok.recent.length, 1);
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  const bad = await readTreasury({ treasuryAddress: addr, rpcUrl: 'https://rpc.example' });
  assert.equal(bad.status, 'error');
  globalThis.fetch = realFetch;
});
test('base58 and Ed25519 ownership proof', async () => {
  const bytes = webcrypto.getRandomValues(new Uint8Array(32));
  assert.deepEqual(base58decode(base58(bytes)), bytes);
  assert.equal(base58decode('11111111111111111111111111111111').length, 32);
  assert.ok(isAddress('11111111111111111111111111111111'));
  assert.ok(!isAddress('0OIl')); assert.ok(!isAddress('abc'));
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await webcrypto.subtle.exportKey('raw', kp.publicKey));
  const msg = new TextEncoder().encode(ownershipStatement(base58(pub), '42'));
  const sig = new Uint8Array(await webcrypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, msg));
  assert.equal(await verifyEd25519(pub, msg, sig), true);
  sig[0] ^= 1;
  assert.equal(await verifyEd25519(pub, msg, sig), false);
});
