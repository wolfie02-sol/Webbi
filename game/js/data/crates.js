// Reward containers. `odds` are per-card base probabilities and must sum to 1. `last` (optional) is the
// table for the final card. `pity`: cards since the last Epic-or-better before one is guaranteed.
export const CRATES = {
  basic:  { name: 'Basic Crate', cards: 3, pity: 30, prism: 1 / 40, color: '#b08c64', price: { coins: 600 },
    odds: { common: 0.70, uncommon: 0.22, rare: 0.065, epic: 0.013, legendary: 0.002 },
    desc: 'Three cards. Found everywhere.' },
  silver: { name: 'Silver Crate', cards: 4, pity: 20, prism: 1 / 40, color: '#c8d0e0', price: { coins: 2000 },
    odds: { common: 0.50, uncommon: 0.32, rare: 0.14, epic: 0.035, legendary: 0.005 },
    last: { uncommon: 0.70, rare: 0.24, epic: 0.05, legendary: 0.01 },
    desc: 'Four cards. The last is Uncommon or better.' },
  golden: { name: 'Golden Crate', cards: 5, pity: 12, prism: 1 / 40, color: '#f4b840', price: { dust: 120 },
    odds: { common: 0.30, uncommon: 0.36, rare: 0.25, epic: 0.075, legendary: 0.014, mythic: 0.001 },
    last: { rare: 0.78, epic: 0.18, legendary: 0.037, mythic: 0.003 },
    desc: 'Five cards. The last is Rare or better.' },
  shadow: { name: 'Shadow Crate', cards: 4, pity: 12, prism: 1 / 15, color: '#7860b0', price: { dust: 150 },
    odds: { common: 0.30, uncommon: 0.36, rare: 0.25, epic: 0.075, legendary: 0.014, mythic: 0.001 },
    pool: { types: ['umbra', 'spirit', 'venom', 'mind'], cats: ['artifact', 'character'] },
    desc: 'Four cards from the dark half of the set. Prismatic cards are more than twice as likely.' },
  legendary: { name: 'Legendary Vault', cards: 3, pity: 6, prism: 1 / 20, color: '#f08030',
    odds: { rare: 0.55, epic: 0.33, legendary: 0.11, mythic: 0.01 },
    last: { epic: 0.60, legendary: 0.37, mythic: 0.03 },
    desc: 'Three cards, Rare or better. The last is Epic or better. Earned, never sold.' },
  mythic: { name: 'Mythic Vault', cards: 3, pity: 3, prism: 1 / 10, color: '#f06890',
    odds: { epic: 0.55, legendary: 0.38, mythic: 0.07 },
    last: { legendary: 0.80, mythic: 0.20 },
    desc: 'Three cards, Epic or better. The last is Legendary or Mythic. Earned, never sold.' },
};
for (const k in CRATES) CRATES[k].id = k;
export const CRATE_IDS = Object.keys(CRATES);
export const LEGEND_PITY = 400; // cards since the last Legendary-or-better before one is guaranteed
export const FORTUNE_CAP = 0.6;
