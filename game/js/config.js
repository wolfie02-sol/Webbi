// Loads and sanitises live-config.json (published by the admin dashboard). Bad values are dropped, not trusted.
import { CRATES } from './data/crates.js';
import { RARITIES } from './data/cards.js';
import { DEFAULT_ALLOCATION, validateAllocation } from './solana/treasury.js';

const sumsToOne = (t) => t && typeof t === 'object' && Object.keys(t).every((k) => RARITIES.includes(k) && t[k] >= 0) && Math.abs(Object.values(t).reduce((a, b) => a + +b, 0) - 1) < 1e-6;
export function sanitizeConfig(raw) {
  const out = { announcements: [], events: [], crates: {}, rewards: { paused: true, legalReviewRef: '' }, solana: { allocation: { ...DEFAULT_ALLOCATION } }, problems: [] };
  if (!raw || typeof raw !== 'object') return out;
  for (const a of raw.announcements || []) if (a && a.title) out.announcements.push({ title: String(a.title).slice(0, 80), body: String(a.body || '').slice(0, 600) });
  for (const e of raw.events || []) {
    if (!e || !e.name || isNaN(Date.parse(e.start)) || isNaN(Date.parse(e.end))) { out.problems.push('Skipped an event with a missing name or date.'); continue; }
    out.events.push({ name: String(e.name).slice(0, 60), start: e.start, end: e.end, fortune: Math.max(0, Math.min(0.2, +e.fortune || 0)), note: String(e.note || '').slice(0, 200) });
  }
  for (const id in raw.crates || {}) {
    const c = raw.crates[id];
    if (!CRATES[id]) { out.problems.push(`Unknown crate "${id}".`); continue; }
    const o = {};
    if (c.odds) { if (sumsToOne(c.odds)) o.odds = c.odds; else out.problems.push(`${id}: odds do not sum to 100%; using defaults.`); }
    if (c.last) { if (sumsToOne(c.last)) o.last = c.last; else out.problems.push(`${id}: last-card odds do not sum to 100%; using defaults.`); }
    if (c.pity) o.pity = Math.max(2, Math.min(100, Math.round(+c.pity)));
    if (Object.keys(o).length) out.crates[id] = o;
  }
  const r = raw.rewards || {};
  out.rewards = { paused: r.paused !== false || !r.legalReviewRef, legalReviewRef: String(r.legalReviewRef || '') };
  const s = raw.solana || {};
  out.solana = { cluster: s.cluster || 'mainnet-beta', rpcUrl: typeof s.rpcUrl === 'string' && /^https:\/\//.test(s.rpcUrl) ? s.rpcUrl : '', treasuryAddress: s.treasuryAddress || '', tokenMint: s.tokenMint || '', feeSource: String(s.feeSource || '').slice(0, 80), allocation: { ...DEFAULT_ALLOCATION } };
  if (s.allocation) { if (!validateAllocation(s.allocation)) out.solana.allocation = { ...s.allocation }; else out.problems.push('Treasury allocation is invalid; using defaults.'); }
  return out;
}
export async function loadConfig(url = 'live-config.json') {
  try { const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) throw new Error(res.status); return sanitizeConfig(await res.json()); }
  catch { return sanitizeConfig(null); }
}
