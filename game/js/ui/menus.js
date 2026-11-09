// In-game menus: main menu, party, bag, Codex, quests, Lantern Box, shop, options.
import { G, kithIcon } from '../game.js';
import { KITH, KITH_IDS, familyOf } from '../data/creatures.js';
import { MOVES } from '../data/moves.js';
import { TRAITS } from '../data/traits.js';
import { ITEMS } from '../data/items.js';
import { TYPES, TYPE_IDS, effectiveness } from '../data/types.js';
import { QUESTS } from '../data/story.js';
import { MAPS } from '../data/maps.js';
import { statsOf, nameOf, expForLevel, useItemOn, evolutionTarget, STAT_KEYS, STAT_NAMES, STATUS_NAMES, healMon } from '../systems/monster.js';
import { serialize, deserialize, saveGame, clock } from '../systems/state.js';
import { sfx, setAudio } from '../core/audio.js';
import { panel, el, say, choose, toast, pct, setTextFast } from './ui.js';
import { evolveScene } from '../scenes/battle.js';

export const typePill = (t) => el('span', { class: 'pill', style: { background: TYPES[t].color } }, TYPES[t].name);
const hpBar = (mon) => { const max = statsOf(mon).hp, f = mon.hp / max; return el('div', { class: 'bar' }, el('i', { style: { width: f * 100 + '%', background: f > 0.5 ? 'var(--hp)' : f > 0.2 ? 'var(--hpmid)' : 'var(--hplow)' } })); };
const monRow = (mon, onclick, extra = {}) => el('button', { class: 'row-item', onclick, ...extra },
  kithIcon(mon.id, mon.gleam, 56),
  el('div', { class: 'grow' }, el('div', {}, `${nameOf(mon)}${mon.gleam ? ' ✦' : ''}  `, el('small', { style: { display: 'inline' } }, `Lv ${mon.lvl}`), mon.status ? el('span', { class: 'st ' + mon.status, style: { marginLeft: '8px', fontSize: '11px' } }, STATUS_NAMES[mon.status]) : null),
    hpBar(mon), el('small', {}, mon.hp > 0 ? `${mon.hp} / ${statsOf(mon).hp} HP` : 'Fainted')));
const playtime = (ms) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };

export const Menus = {
  main() {
    return panel('Menu', (body, api) => {
      const s = G.s, f = G.fortune();
      body.append(el('div', { class: 'tabs', style: { justifyContent: 'center' } },
        el('span', { class: 'chip' }, el('b', {}, s.coins), ' coins'), el('span', { class: 'chip' }, el('b', {}, s.badges), ' / 4 Sigils'),
        el('span', { class: 'chip' }, 'Fortune ', el('b', {}, '+' + pct(f.total, 0))), el('span', { class: 'chip' }, playtime(s.playMs))));
      const tile = (ic, label, sub, fn, cls = '') => el('button', { class: 'tile ' + cls, onclick: async () => { sfx('select'); await fn(); api.redraw(); } }, el('span', { class: 'ic' }, ic), label, el('small', {}, sub));
      const crates = Object.values(s.crates).reduce((a, b) => a + b, 0);
      const grid = el('div', { class: 'menu-grid' },
        tile('◈', 'Kith', `${s.party.length} with you`, () => Menus.party()),
        tile('🎒', 'Bag', `${Object.keys(s.bag).length} kinds`, () => Menus.bag()),
        tile('✦', 'CRYPT', crates ? `${crates} to open!` : `${Object.keys(s.col.cards).length} cards`, () => G.crypt.open(), 'crypt'),
        tile('📖', 'Codex', `${Object.keys(s.caught).length} / ${KITH_IDS.length}`, () => Menus.codex()),
        tile('❖', 'Quests', `${s.daily.quests.filter((q) => q.have >= q.need).length}/3 daily`, () => Menus.quests()),
        tile('▣', 'Lantern Box', `${s.box.length} resting`, () => Menus.box()),
        tile('◎', 'Wallet', s.wallet ? 'Connected' : 'Optional', () => G.chain.open()),
        tile('⚙', 'Save & Options', 'Autosaves', () => Menus.options()));
      body.append(grid);
      for (const a of (G.config.announcements || []).slice(0, 2)) body.append(el('div', { class: 'card-box', style: { maxWidth: '760px', margin: '14px auto 0' } }, el('h3', {}, a.title), el('div', { class: 'note' }, a.body)));
    });
  },

  // opts: { pick, exclude, forced, title, filter }
  party(opts = {}) {
    return panel(opts.title || 'Your Kith', (body, api) => {
      const s = G.s;
      s.party.forEach((mon, i) => {
        const disabled = opts.pick && (i === opts.exclude || (mon.hp <= 0 && !opts.allowFainted) || (opts.filter && !opts.filter(mon)));
        body.append(monRow(mon, async () => { sfx('select'); if (opts.pick) return api.close(i); await Menus.summary(mon); api.redraw(); }, { disabled }));
      });
      if (!s.party.length) body.append(el('p', { class: 'note' }, 'You have no Kith yet. Visit Archivist Maren.'));
      if (!opts.pick) body.append(el('p', { class: 'note' }, 'Tap a Kith for its summary. The first Kith leads in battle.'));
    }, { closable: !opts.forced });
  },
  summary(mon) {
    return panel(nameOf(mon), (body, api) => {
      const k = KITH[mon.id], st = statsOf(mon), s = G.s, idx = s.party.indexOf(mon);
      const a = expForLevel(mon.lvl), b = expForLevel(mon.lvl + 1);
      body.append(el('div', { class: 'detail' },
        el('div', { style: { textAlign: 'center', flex: 'none', margin: '0 auto' } }, kithIcon(mon.id, mon.gleam, 192), el('div', {}, ...k.types.map(typePill)), mon.gleam ? el('div', { class: 'note' }, el('b', {}, '✦ Gleaming')) : null),
        el('div', { class: 'info' },
          el('div', { class: 'card-box' }, el('h3', {}, `${k.name} · Lv ${mon.lvl}`),
            el('dl', { class: 'kv' }, ...STAT_KEYS.flatMap((key) => [el('dt', {}, STAT_NAMES[key]), el('dd', {}, key === 'hp' ? `${mon.hp} / ${st.hp}` : String(st[key]))]),
              el('dt', {}, 'To next level'), el('dd', {}, mon.lvl >= 100 ? '—' : `${b - mon.exp} exp`),
              el('dt', {}, 'Trait'), el('dd', {}, `${TRAITS[k.trait].name}: ${TRAITS[k.trait].desc}`),
              el('dt', {}, 'Met'), el('dd', {}, mon.met || 'Unknown'),
              el('dt', {}, 'Evolves'), el('dd', {}, k.evo ? (k.evo.item ? `with a ${ITEMS[k.evo.item].name}` : `at level ${k.evo.lvl}${k.evo.time ? ', at night' : ''}`) : 'Fully grown'))),
          el('div', { class: 'card-box' }, el('h3', {}, 'Moves'), ...mon.moves.map((m) => { const mv = MOVES[m.id]; return el('div', { style: { marginBottom: '6px' } }, typePill(mv.t), el('b', {}, mv.name), ` · ${mv.c === 't' ? 'Status' : (mv.c === 'p' ? 'Physical ' : 'Special ') + mv.pow} · PP ${m.pp}/${mv.pp}`, el('div', { class: 'note' }, mv.desc)); })),
          el('div', { class: 'btnrow' },
            idx > 0 ? el('button', { class: 'btn', onclick: () => { s.party.splice(idx, 1); s.party.unshift(mon); sfx('select'); toast(`${nameOf(mon)} now leads.`); api.close(); } }, 'Make leader') : null,
            el('button', { class: 'btn alt', onclick: () => { const n = prompt('Nickname (leave empty to clear)', mon.nick || ''); if (n !== null) { mon.nick = n.trim().slice(0, 12) || null; api.setTitle(nameOf(mon)); api.redraw(); } } }, 'Nickname')))));
    });
  },

  // opts.battle: returns an action for the battle scene instead of applying items directly
  bag(opts = {}) {
    return panel('Bag', (body, api) => {
      const s = G.s;
      const ids = Object.keys(s.bag).filter((id) => s.bag[id] > 0);
      const groups = [['Lanterns', (i) => i.kind === 'lantern'], ['Medicine', (i) => ['heal', 'cure', 'revive', 'pp'].includes(i.kind)], ['Shards & valuables', (i) => ['evo', 'sell'].includes(i.kind)], ['Key items', (i) => i.key || i.kind === 'key']];
      if (!ids.length) body.append(el('p', { class: 'note' }, 'Your bag is empty.'));
      for (const [label, test] of groups) {
        const list = ids.filter((id) => test(ITEMS[id]));
        if (!list.length) continue;
        body.append(el('h3', { style: { color: 'var(--gold2)', margin: '10px 0 6px' } }, label));
        for (const id of list) {
          const it = ITEMS[id];
          const usable = opts.battle ? (it.kind === 'lantern' ? opts.wild : ['heal', 'cure', 'revive', 'pp'].includes(it.kind)) : ['heal', 'cure', 'revive', 'pp', 'evo'].includes(it.kind);
          body.append(el('button', { class: 'row-item', disabled: !usable, onclick: async () => {
            sfx('select');
            if (opts.battle && it.kind === 'lantern') { s.bag[id]--; return api.close({ type: 'catch', item: id }); }
            const pickOpts = { pick: true, allowFainted: true, title: `Use ${it.name} on…`, filter: it.kind === 'evo' ? (m) => !!evolutionTarget(m, { item: id }) : it.kind === 'revive' ? (m) => m.hp <= 0 : (m) => m.hp > 0 };
            const i = await Menus.party(pickOpts);
            if (i == null) return;
            const mon = s.party[i];
            if (it.kind === 'evo') { s.bag[id]--; api.root.style.visibility = 'hidden'; await evolveScene(mon, evolutionTarget(mon, { item: id })); api.root.style.visibility = ''; return api.redraw(); }
            if (opts.battle) { const probe = structuredClone(mon); if (!useItemOn(probe, id)) return toast('It would have no effect.'); s.bag[id]--; return api.close({ type: 'item', item: id, target: i }); }
            const msg = useItemOn(mon, id);
            if (msg) { s.bag[id]--; sfx('heal'); toast(msg); } else toast('It would have no effect.');
            api.redraw();
          } }, el('div', { class: 'grow' }, `${it.name}  ×${s.bag[id]}`, el('small', {}, it.desc))));
        }
      }
    });
  },

  codex() {
    return panel('Codex', (body, api) => {
      const s = G.s; let tab = api.tab || 'kith';
      const tabs = el('div', { class: 'tabs' }, ...[['kith', 'Kith'], ['chart', 'Elements']].map(([id, label]) => el('button', { class: tab === id ? 'on' : '', onclick: () => { api.tab = id; api.redraw(); } }, label)));
      body.append(tabs);
      if (tab === 'chart') {
        body.append(el('p', { class: 'note' }, 'Rows attack, columns defend. Green = double damage, red = half, black = no effect.'));
        const tb = el('table', { class: 'chart' });
        tb.append(el('tr', {}, el('th'), ...TYPE_IDS.map((t) => el('th', { style: { background: TYPES[t].color, color: '#000' }, title: TYPES[t].name }, TYPES[t].name.slice(0, 2)))));
        for (const a of TYPE_IDS) tb.append(el('tr', {}, el('th', { style: { background: TYPES[a].color, color: '#000', width: 'auto', padding: '0 6px' } }, TYPES[a].name), ...TYPE_IDS.map((d) => { const e = effectiveness(a, [d]); return el('td', { class: e === 2 ? 's2' : e === 0.5 ? 's5' : e === 0 ? 's0' : '' }, e === 2 ? '2' : e === 0.5 ? '½' : e === 0 ? '0' : ''); })));
        body.append(el('div', { style: { overflowX: 'auto' } }, tb));
        return;
      }
      body.append(el('p', { class: 'note' }, `Recorded ${Object.keys(s.caught).length} of ${KITH_IDS.length}. Seen ${Object.keys(s.seen).length}. Each first record adds that Kith's card to your CRYPT binder.`));
      const grid = el('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' } });
      for (const id of KITH_IDS) {
        const k = KITH[id], state = s.caught[id] ? 'caught' : s.seen[id] ? 'seen' : 'unknown';
        grid.append(el('button', { class: 'dex-cell ' + state, disabled: state === 'unknown', onclick: () => { sfx('select'); Menus.dexEntry(id); } }, kithIcon(id, false, 72), el('div', {}, `#${String(k.no).padStart(2, '0')} ${state === 'unknown' ? '???' : k.name}`)));
      }
      body.append(grid);
    });
  },
  dexEntry(id) {
    const k = KITH[id], caught = !!G.s.caught[id];
    return panel(`#${String(k.no).padStart(2, '0')} ${k.name}`, (body) => {
      const where = Object.values(MAPS).filter((m) => m.enc && [...(m.enc.day || []), ...(m.enc.night || []), m.enc.rare || [], m.enc.aurora || []].some((r) => r[0] === id)).map((m) => m.name);
      body.append(el('div', { class: 'detail' },
        el('div', { style: { textAlign: 'center', margin: '0 auto' } }, kithIcon(id, false, 192), el('div', {}, ...k.types.map(typePill))),
        el('div', { class: 'info' },
          el('div', { class: 'card-box' }, el('h3', {}, caught ? 'Codex entry' : 'Seen, not yet recorded'), el('p', { class: 'note', style: { color: 'var(--parch)' } }, caught ? k.dex : 'Befriend this Kith to record its entry.')),
          caught ? el('div', { class: 'card-box' }, el('h3', {}, 'Details'), el('dl', { class: 'kv' },
            el('dt', {}, 'Rarity'), el('dd', {}, k.rarity[0].toUpperCase() + k.rarity.slice(1)),
            el('dt', {}, 'Trait'), el('dd', {}, `${TRAITS[k.trait].name}: ${TRAITS[k.trait].desc}`),
            el('dt', {}, 'Base stats'), el('dd', {}, k.base.join(' / ')),
            el('dt', {}, 'Family'), el('dd', {}, familyOf(id).map((f) => (G.s.seen[f] ? KITH[f].name : '???')).join(' → ')),
            el('dt', {}, 'Found'), el('dd', {}, where.length ? where.join(', ') : k.legend ? 'A legend. Listen for rumours.' : 'By evolution'))) : null)));
    });
  },

  quests() {
    return panel('Quests', (body) => {
      const s = G.s, g = G.world.g;
      body.append(el('div', { class: 'card-box' }, el('h3', {}, `Today's tasks · day streak ${s.daily.streak}`),
        ...s.daily.quests.map((q) => el('div', { style: { margin: '6px 0' } }, `${q.have >= q.need ? '✔' : '○'} ${q.text} (${q.have}/${q.need})`)),
        el('p', { class: 'note' }, s.daily.claimed ? 'All done. A Silver Crate and 500 coins were added.' : 'Finish all three for a Silver Crate and 500 coins. Each day in a row adds 1% Fortune, up to 7%.')));
      const active = QUESTS.filter((q) => q.state(g) === 'active'), done = QUESTS.filter((q) => q.state(g) === 'done');
      for (const q of active) body.append(el('div', { class: 'card-box' }, el('h3', {}, q.name), el('div', {}, q.text(g)), el('div', { class: 'note' }, q.giver)));
      if (done.length) body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Completed'), ...done.map((q) => el('div', { class: 'note' }, '✔ ' + q.name))));
    });
  },

  box() {
    return panel('Lantern Box', (body, api) => {
      const s = G.s;
      body.append(el('p', { class: 'note' }, 'Kith beyond your six rest here, fully healed. Tap one to bring it along, or tap a party Kith to let it rest.'));
      body.append(el('h3', { style: { color: 'var(--gold2)' } }, `With you (${s.party.length}/6)`));
      s.party.forEach((mon, i) => body.append(monRow(mon, () => { if (s.party.length <= 1) return toast('You need at least one Kith with you.'); s.party.splice(i, 1); healMon(mon); s.box.push(mon); sfx('select'); api.redraw(); })));
      body.append(el('h3', { style: { color: 'var(--gold2)' } }, `Resting (${s.box.length})`));
      s.box.forEach((mon, i) => body.append(monRow(mon, () => { if (s.party.length >= 6) return toast('Your party is full.'); s.box.splice(i, 1); s.party.push(mon); sfx('select'); api.redraw(); })));
      if (!s.box.length) body.append(el('p', { class: 'note' }, 'Nobody is resting.'));
    });
  },

  shop() {
    return panel('Market', (body, api) => {
      const s = G.s;
      const stock = ['salve', 'lantern', 'remedy', ...(s.badges >= 1 ? ['tonic', 'brightlantern'] : []), ...(s.badges >= 2 ? ['rekindle', 'dusklantern', 'ppseed'] : []), ...(s.badges >= 3 ? ['elixir'] : []), ...(s.badges >= 4 ? ['fullrestore', 'dawnshard', 'duskshard'] : [])];
      body.append(el('div', { class: 'tabs' }, el('span', { class: 'chip' }, el('b', {}, s.coins), ' coins')));
      for (const id of stock) {
        const it = ITEMS[id];
        const buy = (n) => el('button', { class: 'btn' + (n > 1 ? ' alt' : ''), disabled: s.coins < it.price * n, onclick: () => { s.coins -= it.price * n; s.bag[id] = (s.bag[id] || 0) + n; sfx('coin'); api.focusSel = `[data-buy="${id}-${n}"]`; api.redraw(); }, 'data-buy': `${id}-${n}` }, n > 1 ? `×${n}` : `${it.price}`);
        body.append(el('div', { class: 'row-item' }, el('div', { class: 'grow' }, `${it.name}${s.bag[id] ? `  (have ${s.bag[id]})` : ''}`, el('small', {}, it.desc)), buy(1), buy(5)));
      }
      const sell = Object.keys(s.bag).filter((id) => ITEMS[id].sell && s.bag[id] > 0);
      for (const id of sell) body.append(el('div', { class: 'row-item' }, el('div', { class: 'grow' }, `${ITEMS[id].name} ×${s.bag[id]}`, el('small', {}, 'The shopkeeper will buy this.')), el('button', { class: 'btn', onclick: () => { s.bag[id]--; if (!s.bag[id]) delete s.bag[id]; s.coins += ITEMS[id].sell; sfx('coin'); api.redraw(); } }, `Sell +${ITEMS[id].sell}`)));
      body.append(el('p', { class: 'note' }, 'More goods arrive as you earn Sigils. Everything here costs coins earned in play; nothing in Cryptwild is sold for real money.'));
    });
  },

  options() {
    return panel('Save & Options', (body, api) => {
      const s = G.s, c = clock(s);
      const toggle = (label, key, after) => el('button', { class: 'row-item', onclick: () => { s.settings[key] = !s.settings[key]; after && after(); sfx('select'); api.focusSel = `[data-k="${key}"]`; api.redraw(); }, 'data-k': key }, el('div', { class: 'grow' }, label), el('b', {}, s.settings[key] ? 'On' : 'Off'));
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Save'),
        el('p', { class: 'note' }, `The game saves automatically to this browser after every battle, conversation and area change. Play time ${playtime(s.playMs)}. In-game hour ${Math.floor(c.hour)}:00 (${c.night ? 'night' : 'day'}).`),
        el('div', { class: 'btnrow' },
          el('button', { class: 'btn', onclick: () => { saveGame(s); sfx('select'); toast('Saved.'); } }, 'Save now'),
          el('button', { class: 'btn alt', onclick: () => { const blob = new Blob([serialize(s)], { type: 'application/json' }); const a = el('a', { href: URL.createObjectURL(blob), download: `cryptwild-${s.daily.date || 'save'}.json` }); a.click(); toast('Save exported.'); } }, 'Export save file'),
          el('button', { class: 'btn alt', onclick: () => { const inp = el('input', { type: 'file', accept: '.json,application/json', onchange: async () => { try { const loaded = deserialize(await inp.files[0].text()); G.s = loaded; saveGame(loaded); location.reload(); } catch (e) { toast(e.message); } } }); inp.click(); } }, 'Import save file'))));
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Options'),
        toggle('Music', 'music', () => setAudio(s.settings)), toggle('Sound effects', 'sfx', () => setAudio(s.settings)), toggle('Fast text', 'fast', () => setTextFast(s.settings.fast))));
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Controls'),
        el('p', { class: 'note' }, 'Move: arrow keys or WASD. Action: Z, Enter or Space. Back / run (hold): X or Shift. Menu: M or Tab. On a phone, use the pad below the screen; hold B to run.')));
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'About'),
        el('p', { class: 'note' }, 'Cryptwild is free to play. Standard CRYPT cards live in your save file, have no monetary value and cannot be traded. A wallet is never required. No real-money rewards are active.')));
    });
  },
};
