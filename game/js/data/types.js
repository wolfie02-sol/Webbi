// Elements and the effectiveness chart. Relationships follow the classic chart; names are ours.
export const TYPES = {
  plain:   { name: 'Plain',   color: '#a8a48c' },
  ember:   { name: 'Ember',   color: '#f0803c' },
  tide:    { name: 'Tide',    color: '#4c90f0' },
  verdant: { name: 'Verdant', color: '#5cb85c' },
  volt:    { name: 'Volt',    color: '#f4cc30' },
  frost:   { name: 'Frost',   color: '#7cd4e0' },
  brawl:   { name: 'Brawl',   color: '#c8503c' },
  venom:   { name: 'Venom',   color: '#a858b8' },
  terra:   { name: 'Terra',   color: '#c8a05c' },
  gale:    { name: 'Gale',    color: '#98a8f0' },
  mind:    { name: 'Mind',    color: '#f06890' },
  stone:   { name: 'Stone',   color: '#a08c58' },
  spirit:  { name: 'Spirit',  color: '#7860b0' },
  wyrm:    { name: 'Wyrm',    color: '#6850e0' },
  umbra:   { name: 'Umbra',   color: '#5c5068' },
  alloy:   { name: 'Alloy',   color: '#a0a8c0' },
  radiant: { name: 'Radiant', color: '#f0a8d8' },
};
// attacker -> [strong against], [weak against], [no effect on]
const C = {
  plain:   [[], ['stone', 'alloy'], ['spirit']],
  ember:   [['verdant', 'frost', 'alloy'], ['ember', 'tide', 'stone', 'wyrm'], []],
  tide:    [['ember', 'terra', 'stone'], ['tide', 'verdant', 'wyrm'], []],
  verdant: [['tide', 'terra', 'stone'], ['ember', 'verdant', 'venom', 'gale', 'wyrm', 'alloy'], []],
  volt:    [['tide', 'gale'], ['volt', 'verdant', 'wyrm'], ['terra']],
  frost:   [['verdant', 'terra', 'gale', 'wyrm'], ['ember', 'tide', 'frost', 'alloy'], []],
  brawl:   [['plain', 'frost', 'stone', 'umbra', 'alloy'], ['venom', 'gale', 'mind', 'radiant'], ['spirit']],
  venom:   [['verdant', 'radiant'], ['venom', 'terra', 'stone', 'spirit'], ['alloy']],
  terra:   [['ember', 'volt', 'venom', 'stone', 'alloy'], ['verdant'], ['gale']],
  gale:    [['verdant', 'brawl'], ['volt', 'stone', 'alloy'], []],
  mind:    [['brawl', 'venom'], ['mind', 'alloy'], ['umbra']],
  stone:   [['ember', 'frost', 'gale'], ['brawl', 'terra', 'alloy'], []],
  spirit:  [['mind', 'spirit'], ['umbra'], ['plain']],
  wyrm:    [['wyrm'], ['alloy'], ['radiant']],
  umbra:   [['mind', 'spirit'], ['brawl', 'umbra', 'radiant'], []],
  alloy:   [['frost', 'stone', 'radiant'], ['ember', 'tide', 'volt', 'alloy'], []],
  radiant: [['brawl', 'wyrm', 'umbra'], ['ember', 'venom', 'alloy'], []],
};
export const TYPE_IDS = Object.keys(TYPES);
export function effectiveness(atk, defTypes) {
  let m = 1;
  const [s, w, n] = C[atk];
  for (const d of defTypes) {
    if (n.includes(d)) return 0;
    if (s.includes(d)) m *= 2; else if (w.includes(d)) m *= 0.5;
  }
  return m;
}
export const CHART = C;
