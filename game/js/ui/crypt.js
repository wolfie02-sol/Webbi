// CRYPT interface: binder, card detail, crates with published odds, opening sequence, Dust, Constellations.
import { G, kithCanvas } from '../game.js';
import { CARDS, RARITY, RARITIES, CONSTELLATIONS, ART } from '../data/cards.js';
import { CRATES, CRATE_IDS, LEGEND_PITY, FORTUNE_CAP, COLLECTOR } from '../data/crates.js';
import { TYPES } from '../data/types.js';
import { effectiveOdds, openCrate, openCollector, owned, refine, refineAll, craft, checkConstellations, collectionStats } from '../systems/crypt.js';
import { dailyTick } from '../systems/state.js';
import { secureSeed } from '../core/rng.js';
import { toCanvas } from '../render/pixel.js';
import { charPortrait } from '../render/chars.js';
import { sfx, music, currentTrack } from '../core/audio.js';
import { panel, el, toast, pct, sleep, focusNav, $ } from './ui.js';

function artCanvas(card) {
  const a = card.art; let src;
  if (a.k === 'kith') src = kithCanvas(a.id, false, a.pal || null);
  else if (a.k === 'char') src = charPortrait(a.id);
  else src = toCanvas(`art:${a.id}:${(a.pal || []).join('')}`, ART[a.id], 48, a.pal ? { pal: a.pal } : {});
  const c = document.createElement('canvas'); c.width = 48; c.height = 48; c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
const BG = { artifact: ['#6c5c3c', '#2a2218'], character: ['#4c5c8c', '#1c2238'], seasonal: ['#8c4c6c', '#2c1828'], mythic: ['#8c3c6c', '#1c1030'], secret: ['#0e1c2c', '#0a1420'] };
export function cardEl(id, { n, prism = false, missing = false, isNew = false, tag = 'div', onclick } = {}) {
  const c = CARDS[id], r = RARITY[c.rarity];
  let bg = BG[c.cat];
  if (c.types) { const t = TYPES[c.types[0]].color; bg = [t, '#1f1c3d']; }
  const node = el(tag, { class: `ccard r-${c.rarity}${prism ? ' prism' : ''}${missing ? ' missing' : ''}`, style: { '--rc': r.color }, onclick },
    el('div', { class: 'art', style: { '--bg1': bg[0], '--bg2': bg[1] } }, artCanvas(c)),
    el('div', { class: 'nm' }, missing && c.rarity === 'secret' ? '? ? ?' : c.name),
    el('div', { class: 'meta' }, el('span', {}, r.name), el('span', {}, c.cat === 'kith' ? '#' + String(c.no).padStart(2, '0') : c.cat)),
    n > 1 ? el('span', { class: 'cnt' }, '×' + n) : null, isNew ? el('span', { class: 'new' }, 'NEW') : null);
  return node;
}
const inSeason = (c) => c.cat !== 'seasonal' || c.months.includes(new Date().getMonth() + 1);

function oddsTable(crate, fortune) {
  const tb = el('table', { class: 'odds' }, el('tr', {}, el('th', {}, 'Rarity'), el('th', {}, 'Base'), el('th', {}, `With your Fortune`), crate.last ? el('th', {}, 'Last card') : null));
  const base = crate.odds, eff = effectiveOdds(base, fortune), last = crate.last ? effectiveOdds(crate.last, fortune) : null;
  for (const r of RARITIES) {
    if (!base[r] && !(crate.last && crate.last[r])) continue;
    tb.append(el('tr', {}, el('td', { style: { color: RARITY[r].color } }, RARITY[r].name), el('td', {}, base[r] ? pct(base[r]) : '—'), el('td', {}, eff[r] ? pct(eff[r]) : '—'), crate.last ? el('td', {}, last[r] ? pct(last[r]) : '—') : null));
  }
  return tb;
}

export const Crypt = {
  open() {
    const prev = currentTrack(); music('crypt');
    return panel('CRYPT', (body, api) => {
      const s = G.s, col = s.col, f = G.fortune(), st = collectionStats(col);
      const tab = api.tab || 'crates';
      const tabs = [['crates', 'Crates'], ['collector', 'Collector cards'], ['binder', 'Binder'], ['stars', 'Constellations'], ['fortune', 'Fortune & odds'], ['log', 'History']];
      body.append(el('div', { class: 'tabs' }, ...tabs.map(([id, label]) => el('button', { class: tab === id ? 'on' : '', 'data-tab': id, onclick: () => { api.tab = id; api.focusSel = `[data-tab="${id}"]`; sfx('blip'); api.redraw(); } }, label)),
        el('span', { class: 'chip' }, el('b', {}, `${st.have}/${st.total}`), ' cards'), el('span', { class: 'chip' }, el('b', {}, col.dust), ' Dust'), el('span', { class: 'chip' }, el('b', {}, col.shards || 0), ' Shards'), el('span', { class: 'chip' }, 'Fortune ', el('b', {}, '+' + pct(f.total, 0)))));
      if (tab === 'crates') Crypt.cratesTab(body, api, f);
      if (tab === 'collector') Crypt.collectorTab(body, api);
      if (tab === 'binder') Crypt.binderTab(body, api);
      if (tab === 'stars') Crypt.starsTab(body);
      if (tab === 'fortune') Crypt.fortuneTab(body, f);
      if (tab === 'log') Crypt.logTab(body);
    }).then(() => { music(prev); G.save(); });
  },

  cratesTab(body, api, f) {
    const s = G.s, col = s.col;
    if (!s.daily.crate && s.flags.starter) {
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Daily crate'), el('p', { class: 'note' }, 'One free Basic Crate every day, for everyone.'),
        el('button', { class: 'btn', onclick: () => { s.daily.crate = true; s.crates.basic = (s.crates.basic || 0) + 1; sfx('fanfare'); toast('Daily Basic Crate claimed.'); api.redraw(); } }, 'Claim today\'s crate')));
    }
    const k = G.config.collector || {}, cn = s.crates.collector || 0;
    body.append(el('div', { class: 'crate-row', style: { '--cc': COLLECTOR.color, borderColor: COLLECTOR.color } },
      el('div', { class: 'n' }, cn),
      el('div', { class: 'grow' }, el('b', {}, COLLECTOR.name + ' ✦'), el('small', {}, 'Boss reward. Always gives 1 to 5 Crypt Shards for the season raffle.'),
        el('small', {}, k.live ? `Real collector CRYPT card: ${pct(k.instantOdds)} per crate while this season's supply lasts.` : 'Real collector CRYPT card: very low odds, when a season is live. No season is live right now.')),
      el('div', { class: 'btnrow', style: { marginTop: 0, justifyContent: 'flex-end' } },
        el('button', { class: 'btn alt', onclick: () => { api.tab = 'collector'; api.focusSel = '[data-tab="collector"]'; api.redraw(); } }, 'How it works'),
        el('button', { class: 'btn', disabled: !cn, 'data-open': 'collector', onclick: async () => { api.focusSel = '[data-open="collector"]'; await Crypt.openingCollector(); api.redraw(); } }, 'Open'))));
    for (const id of CRATE_IDS) {
      const c = { ...CRATES[id], ...(G.config.crates[id] || {}) }, n = s.crates[id] || 0;
      const price = c.price ? (c.price.coins ? `${c.price.coins} coins` : `${c.price.dust} Dust`) : null;
      const can = c.price && (c.price.coins ? s.coins >= c.price.coins : col.dust >= c.price.dust);
      body.append(el('div', { class: 'crate-row', style: { '--cc': c.color } },
        el('div', { class: 'n' }, n),
        el('div', { class: 'grow' }, el('b', {}, c.name), el('small', {}, c.desc), el('small', {}, `Pity: Epic or better guaranteed within ${c.pity} cards (${col.pity[id] || 0} so far)`)),
        el('div', { class: 'btnrow', style: { marginTop: 0, justifyContent: 'flex-end' } },
          el('button', { class: 'btn alt', onclick: () => Crypt.oddsPanel(id) }, 'Odds'),
          price ? el('button', { class: 'btn alt', disabled: !can, 'data-buy': id, onclick: () => { if (c.price.coins) s.coins -= c.price.coins; else col.dust -= c.price.dust; s.crates[id] = n + 1; sfx('coin'); api.focusSel = `[data-buy="${id}"]`; api.redraw(); } }, 'Buy · ' + price) : null,
          el('button', { class: 'btn', disabled: !n, 'data-open': id, onclick: async () => { api.focusSel = `[data-open="${id}"]`; await Crypt.opening(id); api.redraw(); } }, 'Open'))));
    }
    body.append(el('p', { class: 'note' }, 'Crates are earned by playing: Sigils, bosses, quests, buried caches, Codex milestones, the Echo Tower and daily tasks. Basic and Silver can also be bought with coins, Golden and Shadow with Dust. Vaults are never sold. No crate can be bought with real money or tokens.'));
  },
  oddsPanel(id) {
    const c = { ...CRATES[id], ...(G.config.crates[id] || {}) }, f = G.fortune();
    return panel(`${c.name} — published odds`, (body) => {
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Per-card odds'), oddsTable(c, f.total),
        el('p', { class: 'note' }, `${c.cards} cards per crate. Your Fortune is +${pct(f.total, 0)} (cap +${pct(FORTUNE_CAP, 0)}); it multiplies the weight of every rarity above the lowest one in the table. Within a rarity every eligible card is equally likely.`),
        el('p', { class: 'note' }, `Pity: if ${c.pity - 1} cards in a row from this crate type are below Epic, the next is Epic. Across all crates, ${LEGEND_PITY - 1} cards without a Legendary guarantees one. Prismatic parallel: 1 in ${Math.round(1 / c.prism)} per card, any rarity.`),
        c.pool ? el('p', { class: 'note' }, `Pool: Kith of the ${c.pool.types.map((t) => TYPES[t].name).join(', ')} elements, plus Artifact and Character cards.`) : null,
        el('p', { class: 'note' }, 'Secret cards are never in crates; they come from Constellations. Seasonal cards are only in crates during their months and return every year. Any card except a Secret can be crafted with Dust.')));
    });
  },

  async opening(id) {
    const s = G.s, col = s.col;
    if (!s.crates[id]) return;
    const crate = { ...CRATES[id], ...(G.config.crates[id] || {}) };
    s.crates[id]--;
    const seed = secureSeed();
    const cards = openCrate(col, id, { fortune: G.fortune().total, seed, overrides: G.config.crates });
    const best = cards.reduce((a, c) => Math.max(a, RARITIES.indexOf(c.rarity)), 0);
    const bestCol = RARITY[RARITIES[best]].color;
    if (dailyTick(s, 'crate')) G.world.dailyDone();
    G.save();
    const root = el('div', { class: 'opening', style: { '--cc': crate.color, '--rayc': bestCol + '44' } }, el('div', { class: 'rays' }));
    const box = el('button', { class: 'crate3d' }, el('div', { class: 'glowc' }), el('div', { class: 'base' }), el('div', { class: 'lid' }));
    const hint = el('div', { class: 'hint' }, `${crate.name} — tap to open`);
    root.append(box, hint);
    $('#panels').append(root);
    const pop = focusNav(root, null);
    box.focus();
    await new Promise((r) => box.addEventListener('click', r, { once: true }));
    hint.textContent = '';
    for (let i = 0; i < 3; i++) { sfx('crateShake'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); await sleep(i === 2 && best >= 3 ? 900 : 520); }
    root.classList.add('lit'); box.classList.add('open'); sfx('crateOpen');
    if (best >= 4) root.append(el('div', { class: 'flash' }));
    await sleep(750);
    box.classList.add('gone'); await sleep(350); box.remove();
    const row = el('div', { class: 'reveal' });
    root.insertBefore(row, hint);
    let left = cards.length;
    const flips = cards.map((c, i) => {
      const rc = RARITY[c.rarity].color;
      const fl = el('button', { class: 'flip', style: { animationDelay: i * 0.09 + 's', '--hintc': RARITIES.indexOf(c.rarity) >= 2 ? rc : 'transparent' } },
        el('div', { class: 'in' }, el('div', { class: 'back' }, 'CRYPT'), el('div', { class: 'front' }, cardEl(c.id, { prism: c.prism, isNew: c.isNew }))));
      fl.addEventListener('click', () => {
        if (fl.classList.contains('shown')) return;
        const ri = RARITIES.indexOf(c.rarity);
        fl.classList.add('shown'); if (ri >= 3) fl.classList.add('big');
        sfx('flip'); setTimeout(() => sfx('r_' + c.rarity), 180);
        if (ri >= 3) { const rect = fl.getBoundingClientRect(), host = root.getBoundingClientRect(); for (let k = 0; k < (ri >= 4 ? 40 : 18); k++) { const a = Math.random() * 6.28, d = 60 + Math.random() * (ri >= 4 ? 220 : 120); root.append(el('i', { class: 'spark', style: { left: rect.left - host.left + rect.width / 2 + 'px', top: rect.top - host.top + rect.height / 2 + 'px', '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', '--sc': k % 3 ? rc : '#fff' } })); } setTimeout(() => root.querySelectorAll('.spark').forEach((x) => x.remove()), 1100); }
        if (ri >= 4) { root.append(el('div', { class: 'flash' })); root.style.setProperty('--rayc', rc + '66'); }
        if (--left === 0) { hint.textContent = ''; hint.append(el('button', { class: 'btn', onclick: () => finish() }, 'Continue')); hint.querySelector('button').focus(); }
      });
      return fl;
    });
    row.append(...flips);
    hint.textContent = 'Tap each card to reveal it';
    flips[0].focus();
    let finish;
    await new Promise((r) => { finish = r; });
    pop(); root.remove();
    for (const k of checkConstellations(col)) { sfx('r_secret'); toast(`✦ Constellation complete: ${k.name}. Secret card found: ${CARDS[k.reward].name}`); }
    G.save();
  },

  async openingCollector() {
    const s = G.s, col = s.col, k = G.config.collector || {};
    if (!s.crates.collector) return;
    s.crates.collector--;
    const res = openCollector(col, { seed: secureSeed() });
    if (dailyTick(s, 'crate')) G.world.dailyDone();
    G.save();
    const root = el('div', { class: 'opening', style: { '--cc': COLLECTOR.color, '--rayc': '#70e8f044' } }, el('div', { class: 'rays' }));
    const box = el('button', { class: 'crate3d' }, el('div', { class: 'glowc' }), el('div', { class: 'base' }), el('div', { class: 'lid' }));
    const hint = el('div', { class: 'hint' }, 'Collector Crate — tap to open');
    root.append(box, hint); $('#panels').append(root);
    const pop = focusNav(root, null); box.focus();
    await new Promise((r) => box.addEventListener('click', r, { once: true }));
    hint.textContent = '';
    for (let i = 0; i < 3; i++) { sfx('crateShake'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); await sleep(i === 2 ? 900 : 520); }
    root.classList.add('lit'); box.classList.add('open'); sfx('crateOpen'); await sleep(750);
    box.classList.add('gone'); await sleep(350); box.remove(); sfx('r_rare');
    const tile = el('div', { class: 'shardwin' }, el('div', { class: 'gem' }, '◆'), el('div', { class: 'amt' }, `+${res.shards} Crypt Shard${res.shards > 1 ? 's' : ''}`), el('div', { class: 'sub' }, `You hold ${col.shards}. Each shard is one raffle entry.`),
      el('div', { class: 'sub' }, k.live ? 'Collector card: not this time.' : 'Collector card drops are not live yet, so this crate held shards only.'));
    root.insertBefore(tile, hint);
    let finish; hint.append(el('button', { class: 'btn', onclick: () => finish() }, 'Continue')); hint.querySelector('button').focus();
    await new Promise((r) => { finish = r; });
    pop(); root.remove();
  },
  collectorTab(body) {
    const col = G.s.col, k = G.config.collector || {}, sup = k.supply || {};
    body.append(el('div', { class: 'card-box', style: { borderColor: COLLECTOR.color } }, el('h3', {}, 'Two kinds of card'),
      el('p', { class: 'note' }, el('b', {}, 'Binder cards'), ' are part of the game. Everyone collects them by playing, they are generous on purpose, and they have no monetary value.'),
      el('p', { class: 'note' }, el('b', {}, 'Collector CRYPT cards'), ' are real, numbered cards minted on Solana and paid for by the project treasury. They are rare by design: a fixed number exists each season, however many people play.')));
    body.append(el('div', { class: 'card-box' }, el('h3', {}, 'How you can win one'),
      el('p', { class: 'note' }, el('b', {}, '1. Collector Crates.'), ' Beat a boss (Sigil Wardens, Hollow Ledger leaders, the Concord Trial, every tenth Echo Tower floor) and you receive a Collector Crate. Every crate gives 1 to 5 Crypt Shards. When a season is live, each crate also has a very small chance of holding a collector card outright.'),
      el('p', { class: 'note' }, el('b', {}, '2. The season raffle.'), ' At the end of a season, remaining collector cards are drawn among shard holders. One shard is one entry. The more people play, the lower each entry\'s odds; the live numbers are shown here.'),
      el('p', { class: 'note' }, 'Collector Crates are never sold. Entry is free and earned only by playing.')));
    body.append(el('div', { class: 'card-box' }, el('h3', {}, k.live ? `Season: ${k.season || 'current'}` : 'No season is live'),
      el('dl', { class: 'kv' },
        el('dt', {}, 'Your Crypt Shards'), el('dd', {}, String(col.shards || 0)),
        el('dt', {}, 'Collector Crates opened'), el('dd', {}, String(col.collectorOpened || 0)),
        el('dt', {}, 'Instant-win chance per crate'), el('dd', {}, k.live ? pct(k.instantOdds) : 'Not active'),
        el('dt', {}, 'Cards this season'), el('dd', {}, k.live ? `${sup.legendary || 0} Legendary · ${sup.epic || 0} Epic · ${sup.rare || 0} Rare` : 'None funded'),
        el('dt', {}, 'Raffle date'), el('dd', {}, k.live && k.raffleDate ? new Date(k.raffleDate).toLocaleDateString() : 'Not scheduled')),
      el('p', { class: 'note' }, k.live ? 'Wins are decided by the reward service using on-chain verifiable randomness, never on your device, and are sent to your connected wallet.' : 'Collector cards are not being issued yet. The treasury, the randomness provider and a legal review all have to be in place first. Shards you earn now are recorded in this save on this device only; they are not a promise of a raffle and may not carry over when seasons begin.')));
  },

  binderTab(body, api) {
    const col = G.s.col, filter = api.filter || 'all';
    const cats = [['all', 'All'], ['kith', 'Kith'], ['artifact', 'Artifacts'], ['character', 'Characters'], ['seasonal', 'Seasonal'], ['mythic', 'Mythic'], ['secret', 'Secret'], ['owned', 'Owned'], ['dupes', 'Spare copies']];
    body.append(el('p', { class: 'note', style: { marginBottom: '10px' } }, 'These are binder cards: free, earned by playing. Real collector CRYPT cards are separate and can be won at very low odds from boss Collector Crates. See the Collector cards tab.'));
    body.append(el('div', { class: 'tabs' }, ...cats.map(([id, label]) => el('button', { class: filter === id ? 'on' : '', 'data-f': id, onclick: () => { api.filter = id; api.focusSel = `[data-f="${id}"]`; api.redraw(); } }, label))));
    const spare = Object.entries(col.cards).reduce((a, [id, e]) => a + (CARDS[id].rarity === 'secret' ? 0 : Math.max(0, e.n - 1) * RARITY[CARDS[id].rarity].dust), 0);
    body.append(el('div', { class: 'btnrow', style: { marginBottom: '12px' } }, el('button', { class: 'btn alt', disabled: !spare, onclick: () => { const g = refineAll(col); sfx('coin'); toast(`Refined spare copies into ${g} Dust.`); api.redraw(); } }, `Refine all spare copies (+${spare} Dust)`)));
    const grid = el('div', { class: 'binder' });
    const order = (c) => (c.cat === 'kith' ? c.no : 100 + RARITIES.indexOf(c.rarity));
    for (const c of Object.values(CARDS).sort((a, b) => order(a) - order(b))) {
      const e = col.cards[c.id], n = e ? e.n : 0;
      if (filter === 'owned' && !n) continue;
      if (filter === 'dupes' && n < 2) continue;
      if (!['all', 'owned', 'dupes'].includes(filter) && c.cat !== filter) continue;
      grid.append(cardEl(c.id, { n, prism: e && e.prism > 0, missing: !n, tag: 'button', onclick: async () => { sfx('select'); api.focusSel = null; await Crypt.detail(c.id); api.redraw(); } }));
    }
    if (!grid.children.length) body.append(el('p', { class: 'note' }, 'Nothing here yet.'));
    body.append(grid);
  },
  detail(id) {
    const c = CARDS[id];
    return panel(c.rarity === 'secret' && !owned(G.s.col, id) ? 'Secret card' : c.name, (body, api) => {
      const col = G.s.col, e = col.cards[id], n = e ? e.n : 0, r = RARITY[c.rarity];
      const big = cardEl(id, { prism: e && e.prism > 0, missing: !n });
      const wrap = el('div', { class: 'big' }, big);
      wrap.addEventListener('pointermove', (ev) => { const b = wrap.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width - 0.5, y = (ev.clientY - b.top) / b.height - 0.5; big.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 22}deg)`; big.style.setProperty('--fx', 50 + x * 120 + '%'); });
      wrap.addEventListener('pointerleave', () => { big.style.transform = ''; });
      const hidden = c.rarity === 'secret' && !n;
      const k = CONSTELLATIONS.find((x) => x.reward === id);
      body.append(el('div', { class: 'detail' }, wrap, el('div', { class: 'info' },
        el('div', { class: 'card-box' }, el('h3', { style: { color: r.color } }, `${r.name} · ${c.cat[0].toUpperCase() + c.cat.slice(1)}`),
          el('p', { style: { margin: '6px 0', lineHeight: 1.45 } }, hidden ? 'This card is found, not pulled.' : c.lore),
          el('dl', { class: 'kv' },
            el('dt', {}, 'Card ID'), el('dd', {}, 'CW1-' + id.toUpperCase()),
            el('dt', {}, 'Finish'), el('dd', {}, r.treat),
            el('dt', {}, 'You own'), el('dd', {}, `${n}${e && e.prism ? ` (${e.prism} Prismatic ✦)` : ''}`),
            c.types ? el('dt', {}, 'Elements') : null, c.types ? el('dd', {}, c.types.map((t) => TYPES[t].name).join(' / ')) : null,
            c.months ? el('dt', {}, 'Season') : null, c.months ? el('dd', {}, `Months ${c.months.join(', ')} each year${inSeason(c) ? ' (in season now)' : ''}`) : null,
            el('dt', {}, 'Tier'), el('dd', {}, 'Standard card: lives in your save, no monetary value, not tradeable'))),
        hidden && k ? el('div', { class: 'card-box' }, el('h3', {}, 'Constellation hint'), el('p', { class: 'note' }, k.hint)) : null,
        c.rarity !== 'secret' ? el('div', { class: 'btnrow' },
          el('button', { class: 'btn', disabled: col.dust < r.craft || !inSeason(c), onclick: () => { if (craft(col, id)) { sfx('r_' + c.rarity); toast(`Crafted ${c.name}.`); for (const kk of checkConstellations(col)) toast(`✦ Constellation complete: ${kk.name}`); api.redraw(); } } }, `Craft · ${r.craft} Dust`),
          el('button', { class: 'btn alt', disabled: n < 2, onclick: () => { const g = refine(col, id); sfx('coin'); toast(`+${g} Dust`); api.redraw(); } }, `Refine spares (+${Math.max(0, n - 1) * r.dust})`)) : null)));
    });
  },

  starsTab(body) {
    const col = G.s.col;
    body.append(el('p', { class: 'note' }, 'Certain cards belong together. Own every card in a Constellation and a Secret card appears. Some Constellations also open a place in the world.'));
    for (const k of CONSTELLATIONS) {
      const done = col.stars.includes(k.id);
      const row = el('div', { class: 'binder', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', marginTop: '8px' } });
      for (const id of k.need) row.append(done || owned(col, id) ? cardEl(id) : el('div', { class: 'ccard missing', style: { alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: '#fff8' } }, '?'));
      row.append(cardEl(k.reward, { missing: !done }));
      body.append(el('div', { class: 'card-box' }, el('h3', {}, done ? `✦ ${k.name}` : '✧ Unnamed constellation'), el('div', { class: 'note' }, done ? `Complete. ${k.unlock ? 'Something in the world has opened.' : ''}` : `Hint: ${k.hint}`), row));
    }
  },
  fortuneTab(body, f) {
    const col = G.s.col, st = collectionStats(col);
    body.append(el('div', { class: 'card-box' }, el('h3', {}, `Your Fortune: +${pct(f.total, 0)}${f.capped ? ' (capped)' : ''}`),
      el('dl', { class: 'kv' }, ...f.parts.flatMap((p) => [el('dt', {}, p.label), el('dd', {}, '+' + pct(p.value, 0))])),
      el('p', { class: 'note' }, `Fortune is earned only by playing. It never depends on money spent or tokens held, and it is capped at +${pct(FORTUNE_CAP, 0)}. It raises the weight of better rarities in every crate, the chance of rare wild Kith, Gleaming Kith and better buried caches.`)));
    const ev = G.activeEvents();
    if (ev.length) body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Events running now'), ...ev.map((e) => el('div', {}, el('b', {}, e.name), ` · Fortune +${pct(+e.fortune || 0, 0)} until ${new Date(e.end).toLocaleDateString()}`))));
    body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Collection'),
      el('div', { class: 'progress' }, el('i', { style: { width: (st.have / st.total) * 100 + '%' } })),
      el('dl', { class: 'kv', style: { marginTop: '8px' } }, ...[...RARITIES, 'secret'].flatMap((r) => (st.by[r] ? [el('dt', { style: { color: RARITY[r].color } }, RARITY[r].name), el('dd', {}, `${st.by[r].have} / ${st.by[r].total}`)] : [])),
        el('dt', {}, 'Prismatic'), el('dd', {}, String(st.prism)), el('dt', {}, 'Crates opened'), el('dd', {}, String(col.opened || 0)),
        el('dt', {}, 'Cards since Legendary'), el('dd', {}, `${col.pityLegend || 0} / ${LEGEND_PITY}`))));
    body.append(el('div', { class: 'card-box' }, el('h3', {}, 'How rolls work'),
      el('p', { class: 'note' }, 'Standard cards are rolled on your device from a random seed. They have no monetary value and cannot leave your save, so this is a game mechanic, not a draw for prizes. Every roll\'s seed is kept in History so it can be re-run. Chain-backed editions are not active; if they are ever enabled, their outcomes will come from on-chain verifiable randomness, not from this device.')));
  },
  logTab(body) {
    const log = G.s.col.log;
    if (!log.length) body.append(el('p', { class: 'note' }, 'No crates opened yet.'));
    for (const e of log) body.append(el('div', { class: 'card-box' }, el('h3', {}, `${(CRATES[e.crate] || COLLECTOR).name} · ${new Date(e.t).toLocaleString()}`),
      el('div', {}, e.crate === 'collector' ? `+${e.shards} Crypt Shards` : e.cards.map((c) => { const id = c.replace('*', ''); return CARDS[id].name + (c.endsWith('*') ? ' ✦' : ''); }).join(', ')),
      el('div', { class: 'note' }, `seed ${e.seed} · Fortune +${pct(e.fortune, 0)}`)));
  },
};
