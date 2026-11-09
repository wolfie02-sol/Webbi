// Deterministic PRNG (mulberry32) with a cryptographically seeded default.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.range = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.chance = (p) => next() < p;
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.weighted = (pairs) => {
    let total = 0;
    for (const [, w] of pairs) total += w;
    let r = next() * total;
    for (const [v, w] of pairs) { r -= w; if (r < 0) return v; }
    return pairs[pairs.length - 1][0];
  };
  return next;
}
export function secureSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const rng = makeRng(secureSeed());
