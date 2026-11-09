// Wallet connection. Discovers wallets through the Wallet Standard and common injected providers.
// Scope is deliberately narrow: connect, disconnect, sign a message to prove ownership.
// This module never builds, signs or sends a transaction and never asks for a seed phrase.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes) {
  let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = ''; while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}
export function base58decode(str) {
  let n = 0n; for (const ch of str) { const i = B58.indexOf(ch); if (i < 0) throw new Error('Invalid base58'); n = n * 58n + BigInt(i); }
  const bytes = []; while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of str) { if (ch === '1') bytes.unshift(0); else break; }
  return new Uint8Array(bytes);
}
export const isAddress = (s) => { try { return typeof s === 'string' && base58decode(s).length === 32; } catch { return false; } };

const standard = [];
let listening = false;
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const register = (...wallets) => { for (const w of wallets) if (!standard.includes(w)) standard.push(w); return () => {}; };
  const api = Object.freeze({ register });
  window.addEventListener('wallet-standard:register-wallet', (ev) => { try { ev.detail(api); } catch (e) { console.warn('wallet register failed', e); } });
  try { window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })); } catch { /* old browsers */ }
}
// Returns [{ name, icon, kind, handle }]
export function discoverWallets() {
  listen();
  const out = [];
  for (const w of standard) {
    const f = w.features || {};
    if (f['standard:connect'] && (w.chains || []).some((c) => c.startsWith('solana:'))) out.push({ name: w.name, icon: w.icon, kind: 'standard', handle: w });
  }
  const legacy = [['Phantom', window.phantom && window.phantom.solana], ['Solflare', window.solflare], ['Backpack', window.backpack]];
  for (const [name, p] of legacy) if (p && typeof p.connect === 'function' && !out.some((o) => o.name === name)) out.push({ name, kind: 'legacy', handle: p });
  return out;
}
export async function connectWallet(w) {
  if (w.kind === 'standard') {
    const res = await w.handle.features['standard:connect'].connect();
    const acct = (res.accounts || w.handle.accounts || [])[0];
    if (!acct) throw new Error('The wallet returned no account.');
    return { name: w.name, kind: w.kind, address: acct.address, account: acct, handle: w.handle };
  }
  const res = await w.handle.connect();
  const pk = (res && res.publicKey) || w.handle.publicKey;
  return { name: w.name, kind: w.kind, address: pk.toString(), handle: w.handle };
}
export async function disconnectWallet(conn) {
  try {
    if (conn.kind === 'standard') { const d = conn.handle.features['standard:disconnect']; if (d) await d.disconnect(); }
    else if (conn.handle.disconnect) await conn.handle.disconnect();
  } catch { /* ignore */ }
}
// Asks the wallet to sign a human-readable message and verifies the Ed25519 signature locally.
export async function proveOwnership(conn, statement) {
  const message = new TextEncoder().encode(statement);
  let signature;
  if (conn.kind === 'standard') {
    const f = conn.handle.features['solana:signMessage'];
    if (!f) throw new Error('This wallet cannot sign messages.');
    const [res] = await f.signMessage({ account: conn.account, message });
    signature = res.signature;
  } else {
    const res = await conn.handle.signMessage(message, 'utf8');
    signature = res.signature || res;
  }
  const verified = await verifyEd25519(base58decode(conn.address), message, signature);
  return { signature: base58(signature), verified };
}
export async function verifyEd25519(pubkey, message, signature) {
  try {
    const key = await crypto.subtle.importKey('raw', pubkey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, message);
  } catch { return null; } // null = this browser cannot verify Ed25519
}
export function ownershipStatement(address, nonce) {
  return `Cryptwild: I confirm I control this wallet.\nAddress: ${address}\nNonce: ${nonce}\nThis signature authorises nothing and moves no funds.`;
}
