// Operator dashboard. Reads and validates live-config.json, previews odds, monitors the treasury (read-only).
import { CRATES, CRATE_IDS, FORTUNE_CAP } from '../js/data/crates.js';
import { RARITIES, RARITY, CARDS } from '../js/data/cards.js';
import { effectiveOdds, rollCrate, cardPool } from '../js/systems/crypt.js';
import { makeRng } from '../js/core/rng.js';
import { sanitizeConfig } from '../js/config.js';
import { readTreasury, validateAllocation, DEFAULT_ALLOCATION, ALLOCATION_LABELS, LAMPORTS } from '../js/solana/treasury.js';
import { isAddress } from '../js/solana/wallet.js';
import { el, pct } from '../js/ui/ui.js';

let cfg = { version: 1, announcements: [], events: [], crates: {}, rewards: { paused: true, legalReviewRef: '' }, solana: { cluster: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com', treasuryAddress: '', tokenMint: '', feeSource: '', allocation: { ...DEFAULT_ALLOCATION } } };
let treasury = null, sim = null;
const app = document.getElementById('app'), statusEl = document.getElementById('status');
const input = (value, on, attrs = {}) => el('input', { value: value ?? '', oninput: (e) => { on(e.target.value); refreshStatus(); }, ...attrs });
const field = (label, node) => el('label', {}, label, node);

export function problems(c) {
  const out = [];
  const allocErr = validateAllocation(c.solana.allocation); if (allocErr) out.push('Treasury allocation: ' + allocErr);
  if (c.solana.treasuryAddress && !isAddress(c.solana.treasuryAddress)) out.push('Treasury address is not a valid Solana address.');
  if (c.solana.tokenMint && !isAddress(c.solana.tokenMint)) out.push('Token mint is not a valid Solana address.');
  if (c.solana.rpcUrl && !/^https:\/\//.test(c.solana.rpcUrl)) out.push('RPC URL must start with https://');
  if (c.rewards.paused === false && !c.rewards.legalReviewRef) out.push('Distributions cannot be un-paused without a legal review reference. The game will keep them paused.');
  if (c.rewards.paused === false && !c.solana.treasuryAddress) out.push('Distributions are un-paused but no treasury is configured.');
  c.events.forEach((e, i) => { if (!e.name) out.push(`Event ${i + 1} has no name.`); if (isNaN(Date.parse(e.start)) || isNaN(Date.parse(e.end))) out.push(`Event ${i + 1} has an invalid date.`); else if (Date.parse(e.end) <= Date.parse(e.start)) out.push(`Event ${i + 1} ends before it starts.`); if (+e.fortune > 0.2) out.push(`Event ${i + 1}: Fortune bonus is capped at 20% by the game.`); });
  for (const id in c.crates) for (const key of ['odds', 'last']) { const t = c.crates[id][key]; if (t && Math.abs(Object.values(t).reduce((a, b) => a + +b, 0) - 1) > 1e-6) out.push(`${CRATES[id].name}: ${key === 'last' ? 'last-card ' : ''}odds add up to ${pct(Object.values(t).reduce((a, b) => a + +b, 0))}, not 100%.`); }
  return out;
}
function refreshStatus() {
  const p = problems(cfg);
  statusEl.innerHTML = '';
  statusEl.append(p.length ? el('div', { class: 'bad' }, `${p.length} problem${p.length > 1 ? 's' : ''} to fix before publishing:`, el('ul', { style: { margin: '4px 0 0' } }, ...p.map((x) => el('li', {}, x)))) : el('div', { class: 'good' }, 'Configuration is valid.'));
  const pre = document.getElementById('json'); if (pre) pre.textContent = JSON.stringify(cfg, null, 2);
}
const sol = (l) => (l / LAMPORTS).toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' SOL';

function render() {
  app.innerHTML = '';
  // ── Treasury
  const s = cfg.solana;
  const tre = el('div', { class: 'card-box' }, el('h3', {}, 'Treasury and fee revenue'),
    el('div', { class: 'cols' },
      field('Treasury address (public)', input(s.treasuryAddress, (v) => { s.treasuryAddress = v.trim(); })),
      field('Project token mint (optional)', input(s.tokenMint, (v) => { s.tokenMint = v.trim(); })),
      field('RPC URL (https)', input(s.rpcUrl, (v) => { s.rpcUrl = v.trim(); })),
      field('Fee source label shown to players', input(s.feeSource, (v) => { s.feeSource = v; }, { placeholder: 'e.g. Launchpad creator fees, claimed weekly' }))),
    el('h3', { style: { marginTop: '14px' } }, 'Allocation of whatever the treasury holds'),
    el('div', { class: 'cols' }, ...Object.keys(ALLOCATION_LABELS).map((k) => field(ALLOCATION_LABELS[k] + ' %', input(s.allocation[k], (v) => { s.allocation[k] = +v; }, { type: 'number', min: 0, max: 100, step: 1 })))),
    el('div', { class: 'btnrow' }, el('button', { class: 'btn', onclick: async () => { treasury = { status: 'loading' }; render(); treasury = await readTreasury(s); render(); } }, 'Read treasury now')));
  if (treasury) {
    if (treasury.status === 'loading') tre.append(el('p', { class: 'note' }, 'Reading…'));
    else if (treasury.status === 'unconfigured') tre.append(el('p', { class: 'note' }, 'No treasury address set. The game tells players that no rewards are funded.'));
    else if (treasury.status === 'error') tre.append(el('p', { class: 'bad' }, 'Could not read: ' + treasury.error));
    else tre.append(el('dl', { class: 'kv', style: { marginTop: '10px' } }, el('dt', {}, 'Balance (finalized)'), el('dd', {}, sol(treasury.lamports)),
      ...Object.keys(ALLOCATION_LABELS).flatMap((k) => [el('dt', {}, ALLOCATION_LABELS[k]), el('dd', {}, sol(treasury.budget[k]))])),
      el('h3', { style: { marginTop: '10px' } }, 'Latest transactions on the address'),
      ...(treasury.recent.length ? treasury.recent.map((r) => el('div', { class: 'note', style: { wordBreak: 'break-all' } }, `${r.time ? new Date(r.time).toLocaleString() : 'pending'} · ${r.signature}${r.failed ? ' (failed)' : ''}`)) : [el('p', { class: 'note' }, 'None.')]));
  }
  tre.append(el('p', { class: 'note' }, 'Read-only: balance and signatures come straight from the RPC node. Classifying each transaction as fee income versus a payout needs the reward service ledger (Phase 4B), which does not exist yet.'));
  app.append(el('h2', {}, '1 · Treasury'), tre);

  // ── Rewards switch
  app.append(el('h2', {}, '2 · Distributions'), el('div', { class: 'card-box' },
    el('p', { class: 'note' }, 'On-chain distributions are not implemented in the game client. This switch is the emergency pause the client will honour once they are: paused is the default, and un-pausing requires a legal review reference.'),
    el('div', { class: 'cols' },
      field('Status', (() => { const sel = el('select', { onchange: (e) => { cfg.rewards.paused = e.target.value === 'paused'; refreshStatus(); } }, el('option', { value: 'paused' }, 'Paused'), el('option', { value: 'live' }, 'Live')); sel.value = cfg.rewards.paused === false ? 'live' : 'paused'; return sel; })()),
      field('Legal review reference (document, date, counsel)', input(cfg.rewards.legalReviewRef, (v) => { cfg.rewards.legalReviewRef = v; }))),
    el('p', { class: 'note' }, 'Distribution log and suspicious-activity queue: these need the reward service and its ledger. Until then there is nothing to review, because no assets are distributed.')));

  // ── Events
  const evBox = el('div', { class: 'card-box' }, el('p', { class: 'note' }, 'Scheduled events add Fortune for every player during their window (maximum 20% per event; total Fortune is capped at ' + pct(FORTUNE_CAP, 0) + ').'));
  cfg.events.forEach((e, i) => evBox.append(el('div', { class: 'cols', style: { alignItems: 'end', marginBottom: '8px' } },
    field('Name', input(e.name, (v) => { e.name = v; })), field('Starts', input((e.start || '').slice(0, 16), (v) => { e.start = v ? new Date(v).toISOString() : ''; }, { type: 'datetime-local' })),
    field('Ends', input((e.end || '').slice(0, 16), (v) => { e.end = v ? new Date(v).toISOString() : ''; }, { type: 'datetime-local' })),
    field('Fortune bonus (0–0.2)', input(e.fortune, (v) => { e.fortune = +v; }, { type: 'number', min: 0, max: 0.2, step: 0.01 })),
    el('button', { class: 'btn alt', onclick: () => { cfg.events.splice(i, 1); render(); } }, 'Remove'))));
  evBox.append(el('button', { class: 'btn', onclick: () => { const n = new Date(); const e = new Date(n.getTime() + 7 * 864e5); cfg.events.push({ name: 'Lantern Festival', start: n.toISOString(), end: e.toISOString(), fortune: 0.1 }); render(); } }, 'Add event'));
  app.append(el('h2', {}, '3 · Seasonal events'), evBox);

  // ── Announcements
  const anBox = el('div', { class: 'card-box' });
  cfg.announcements.forEach((a, i) => anBox.append(el('div', { style: { marginBottom: '10px' } }, field('Title', input(a.title, (v) => { a.title = v; })), field('Text', el('textarea', { rows: 2, value: a.body || '', oninput: (ev) => { a.body = ev.target.value; refreshStatus(); } })), el('button', { class: 'btn alt', style: { marginTop: '6px' }, onclick: () => { cfg.announcements.splice(i, 1); render(); } }, 'Remove'))));
  anBox.append(el('button', { class: 'btn', onclick: () => { cfg.announcements.push({ title: 'News', body: '' }); render(); } }, 'Add announcement'));
  app.append(el('h2', {}, '4 · Announcements (shown in the game menu)'), anBox);

  // ── Crates
  app.append(el('h2', {}, '5 · Reward pools and odds'), el('p', { class: 'note' }, 'Defaults come from the game code. Overrides here must add up to 100% or the game ignores them. Players always see the odds actually in force.'));
  for (const id of CRATE_IDS) {
    const base = CRATES[id], ov = cfg.crates[id] || {};
    const box = el('div', { class: 'card-box' }, el('h3', {}, base.name));
    for (const key of ['odds', 'last']) {
      if (!base[key]) continue;
      const cur = ov[key] || base[key];
      const tb = el('table', { class: 'odds' }, el('tr', {}, el('th', {}, key === 'last' ? 'Last card' : 'Each card'), ...RARITIES.filter((r) => base[key][r] != null).map((r) => el('th', { style: { color: RARITY[r].color } }, RARITY[r].name)), el('th', {}, 'Sum')));
      const sumCell = el('td');
      const upd = () => { const t = (cfg.crates[id] || {})[key] || base[key]; const sum = Object.values(t).reduce((a, b) => a + +b, 0); sumCell.textContent = pct(sum); sumCell.className = Math.abs(sum - 1) < 1e-6 ? 'good' : 'bad'; };
      tb.append(el('tr', {}, el('td', {}, ov[key] ? 'Override' : 'Default'), ...RARITIES.filter((r) => base[key][r] != null).map((r) => el('td', {}, input(cur[r], (v) => { const c = cfg.crates[id] || (cfg.crates[id] = {}); c[key] = c[key] || { ...base[key] }; c[key][r] = +v; upd(); }, { type: 'number', min: 0, max: 1, step: 0.001 }))), sumCell));
      upd(); box.append(tb);
    }
    box.append(el('div', { class: 'cols', style: { maxWidth: '520px' } }, field('Pity threshold (cards)', input(ov.pity ?? base.pity, (v) => { (cfg.crates[id] || (cfg.crates[id] = {})).pity = +v; }, { type: 'number', min: 2, max: 100 })),
      el('button', { class: 'btn alt', style: { alignSelf: 'end' }, onclick: () => { delete cfg.crates[id]; render(); } }, 'Reset to defaults'),
      el('button', { class: 'btn', style: { alignSelf: 'end' }, onclick: () => { sim = simulate(id); render(); } }, 'Simulate 20,000 opens')));
    if (sim && sim.id === id) box.append(el('p', { class: 'note' }, `Simulated ${sim.n.toLocaleString()} crates at 0% Fortune, pity on: ` + RARITIES.filter((r) => sim.count[r]).map((r) => `${RARITY[r].name} ${pct(sim.count[r] / sim.cards)}`).join(' · ') + ` · Prismatic ${pct(sim.prism / sim.cards)} · longest run without Epic+: ${sim.worst} cards.`));
    app.append(box);
  }
  // ── Card set
  const cats = {}; for (const c of Object.values(CARDS)) (cats[c.cat] = cats[c.cat] || []).push(c);
  app.append(el('h2', {}, '6 · Card set'), el('div', { class: 'card-box' }, el('p', { class: 'note' }, 'The card set is defined in js/data/cards.js so that it is versioned and reviewed with the code. Limited or seasonal cards are added there with their months; they then appear in crates only in season.'),
    el('dl', { class: 'kv' }, ...Object.entries(cats).flatMap(([k, list]) => [el('dt', {}, k), el('dd', {}, `${list.length} cards` + (k === 'seasonal' ? ': ' + list.map((c) => `${c.name} (months ${c.months.join(',')})`).join('; ') : ''))]),
      el('dt', {}, 'In crates this month'), el('dd', {}, `${cardPool(CRATES.basic).length} cards`))));

  // ── Publish
  app.append(el('h2', {}, '7 · Publish'), el('div', { class: 'card-box' },
    el('div', { class: 'btnrow' },
      el('button', { class: 'btn', onclick: () => { if (problems(cfg).length) return alert('Fix the listed problems first.'); const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(cfg, null, 2) + '\n'], { type: 'application/json' })), download: 'live-config.json' }); a.click(); } }, 'Download live-config.json'),
      el('button', { class: 'btn alt', onclick: () => { const inp = el('input', { type: 'file', accept: '.json', onchange: async () => { try { load(JSON.parse(await inp.files[0].text())); } catch (e) { alert('Not valid JSON: ' + e.message); } } }); inp.click(); } }, 'Load a file')),
    el('p', { class: 'note' }, 'Replace game/live-config.json with the downloaded file and publish the site. The game re-validates everything on load and falls back to safe defaults for anything invalid.'),
    el('pre', { id: 'json' }),
    el('h3', {}, 'Locking this page down'),
    el('p', { class: 'note' }, 'This dashboard cannot change anything by itself, but it should still not be public. On Apache hosting, put HTTP authentication on the /game/admin/ folder (see admin/.htaccess for a ready template), or simply do not upload the admin folder and open it locally. Never put a private key, seed phrase or API secret into any file in this project.')));
  refreshStatus();
}
function simulate(id) {
  const rng = makeRng(12345), n = 20000, count = {}; let pity = 0, pityLegend = 0, cards = 0, prism = 0, since = 0, worst = 0;
  for (let i = 0; i < n; i++) {
    const res = rollCrate(id, { fortune: 0, pity, pityLegend, overrides: sanitizeConfig(cfg).crates }, rng);
    pity = res.pity; pityLegend = res.pityLegend;
    for (const c of res.cards) { cards++; count[c.rarity] = (count[c.rarity] || 0) + 1; if (c.prism) prism++; since++; if (RARITIES.indexOf(c.rarity) >= 3) { worst = Math.max(worst, since); since = 0; } }
  }
  return { id, n, count, cards, prism, worst };
}
function load(raw) {
  const clean = sanitizeConfig(raw);
  cfg = { version: 1, announcements: clean.announcements, events: clean.events, crates: clean.crates, rewards: { paused: raw.rewards ? raw.rewards.paused !== false : true, legalReviewRef: clean.rewards.legalReviewRef }, solana: clean.solana };
  render();
  if (clean.problems.length) alert('Some values were dropped:\n' + clean.problems.join('\n'));
}
fetch('../live-config.json', { cache: 'no-store' }).then((r) => r.json()).then(load).catch(() => render());
