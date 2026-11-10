// Coin economy: the Lantern Bank (savings with daily interest), selling, and the daily Bazaar. Pure.
// Coins are a game currency only: they cannot be bought, cashed out, or spent on Collector Crates or shards.
import { ITEMS } from '../data/items.js';
import { CARDS } from '../data/cards.js';
import { addCard } from './crypt.js';
import { makeRng, hashStr } from '../core/rng.js';
import { dayKey } from './state.js';

export const BANK = { rate: 0.01, dailyCap: 2500, maxDays: 30 };
const dayNumber = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5 + 0.5);

// Adds interest for each full real day since the last visit. Returns the amount added.
export function bankAccrue(state, date = new Date()) {
  const b = state.bank || (state.bank = { coins: 0, day: dayNumber(date), earned: 0 });
  const today = dayNumber(date), days = Math.max(0, Math.min(BANK.maxDays, today - b.day));
  b.day = today;
  let added = 0;
  for (let i = 0; i < days; i++) { const gain = Math.min(BANK.dailyCap, Math.floor(b.coins * BANK.rate)); b.coins += gain; added += gain; }
  b.earned = (b.earned || 0) + added;
  return added;
}
export function bankMove(state, amount) { // positive = deposit, negative = withdraw
  const b = state.bank || (state.bank = { coins: 0, day: dayNumber(new Date()), earned: 0 });
  amount = Math.trunc(amount);
  if (amount > 0) amount = Math.min(amount, state.coins); else amount = -Math.min(-amount, b.coins);
  state.coins -= amount; b.coins += amount;
  return amount;
}
export const netWorth = (state) => state.coins + ((state.bank && state.bank.coins) || 0);

export function sellPrice(id) { const it = ITEMS[id]; if (it.key || it.kind === 'key' || it.kind === 'boost') return 0; return it.sell || Math.floor((it.price || 0) / 2); }
export function sellItem(state, id, n = 1) {
  const price = sellPrice(id); n = Math.min(n, state.bag[id] || 0);
  if (!price || n <= 0) return 0;
  state.bag[id] -= n; if (!state.bag[id]) delete state.bag[id];
  state.coins += price * n;
  return price * n;
}

const CARD_PRICE = { common: 300, uncommon: 800, rare: 2500, epic: 9000 };
// Five offers that change every real day and are the same for every player.
export function bazaarFor(state, date = new Date()) {
  const r = makeRng(hashStr('bazaar:' + dayKey(date)));
  const month = date.getMonth() + 1;
  const bundle = r.pick(['brightlantern', 'tonic', 'rekindle', 'ppseed', 'dusklantern', 'remedy']);
  const pool = Object.values(CARDS).filter((c) => CARD_PRICE[c.rarity] && (c.cat !== 'seasonal' || c.months.includes(month)));
  const card = r.weighted(pool.map((c) => [c, { common: 8, uncommon: 6, rare: 3, epic: 1 }[c.rarity]]));
  const shard = r.pick(['dawnshard', 'duskshard']);
  return [
    { kind: 'item', id: bundle, n: 3, price: Math.round(ITEMS[bundle].price * 3 * 0.7 / 10) * 10, limit: 2, label: `${ITEMS[bundle].name} ×3`, note: '30% off today' },
    { kind: 'card', id: card.id, n: 1, price: CARD_PRICE[card.rarity], limit: 1, label: `Binder card: ${card.name}`, note: `${card.rarity[0].toUpperCase() + card.rarity.slice(1)} · today's featured card` },
    { kind: 'dust', n: 100, price: 1500, limit: 3, label: '100 Dust', note: 'For crafting binder cards' },
    { kind: 'crate', id: 'silver', n: 1, price: 1600, limit: 1, label: 'Silver Crate', note: '20% off today' },
    { kind: 'item', id: shard, n: 1, price: 1200, limit: 1, label: ITEMS[shard].name, note: 'Evolution shard' },
  ];
}
export function buyOffer(state, index, date = new Date()) {
  const offer = bazaarFor(state, date)[index];
  const bought = state.daily.bazaar || (state.daily.bazaar = {});
  if (!offer || (bought[index] || 0) >= offer.limit || state.coins < offer.price) return false;
  state.coins -= offer.price; bought[index] = (bought[index] || 0) + 1;
  if (offer.kind === 'item') state.bag[offer.id] = (state.bag[offer.id] || 0) + offer.n;
  else if (offer.kind === 'card') addCard(state.col, offer.id);
  else if (offer.kind === 'dust') state.col.dust += offer.n;
  else if (offer.kind === 'crate') state.crates[offer.id] = (state.crates[offer.id] || 0) + offer.n;
  return true;
}
