// Read-only treasury monitor over Solana JSON-RPC. No keys, no transactions.
import { isAddress } from './wallet.js';
export const LAMPORTS = 1_000_000_000;
export const DEFAULT_ALLOCATION = { cards: 60, events: 20, development: 10, reserve: 10 };
export const ALLOCATION_LABELS = { cards: 'CRYPT card rewards', events: 'Events and community', development: 'Development and upkeep', reserve: 'Ecosystem reserve' };

async function rpc(url, method, params) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
}
export function validateAllocation(a) {
  const keys = Object.keys(DEFAULT_ALLOCATION);
  const vals = keys.map((k) => +a[k]);
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return 'Each share must be zero or more.';
  if (Math.abs(vals.reduce((x, y) => x + y, 0) - 100) > 1e-9) return 'Shares must add up to 100%.';
  return null;
}
// Splits a real balance across buckets. Budget never exceeds what is actually there.
export function allocate(balanceLamports, allocation = DEFAULT_ALLOCATION) {
  const out = {}; let used = 0;
  const keys = Object.keys(DEFAULT_ALLOCATION);
  keys.forEach((k, i) => { const v = i === keys.length - 1 ? balanceLamports - used : Math.floor((balanceLamports * (+allocation[k] || 0)) / 100); out[k] = v; used += v; });
  return out;
}
// cfg: { rpcUrl, treasuryAddress, allocation }
export async function readTreasury(cfg) {
  if (!cfg || !cfg.treasuryAddress) return { status: 'unconfigured' };
  if (!isAddress(cfg.treasuryAddress)) return { status: 'error', error: 'The configured treasury address is not a valid Solana address.' };
  if (!cfg.rpcUrl) return { status: 'error', error: 'No RPC URL configured.' };
  try {
    const [bal, sigs] = await Promise.all([
      rpc(cfg.rpcUrl, 'getBalance', [cfg.treasuryAddress, { commitment: 'finalized' }]),
      rpc(cfg.rpcUrl, 'getSignaturesForAddress', [cfg.treasuryAddress, { limit: 10 }]),
    ]);
    const lamports = bal.value;
    return { status: 'ok', lamports, sol: lamports / LAMPORTS, slot: bal.context && bal.context.slot, budget: allocate(lamports, cfg.allocation || DEFAULT_ALLOCATION),
      recent: sigs.map((s) => ({ signature: s.signature, time: s.blockTime ? s.blockTime * 1000 : null, failed: !!s.err })), fetchedAt: Date.now() };
  } catch (e) { return { status: 'error', error: e.message }; }
}
