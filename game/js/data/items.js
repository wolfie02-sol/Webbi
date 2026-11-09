// Items. kind: heal | cure | revive | lantern | evo | key | boost | crate
const I = (name, kind, price, desc, x = {}) => ({ name, kind, price, desc, ...x });
export const ITEMS = {
  salve:       I('Salve', 'heal', 60, 'Restores 25 HP.', { hp: 25 }),
  tonic:       I('Tonic', 'heal', 180, 'Restores 60 HP.', { hp: 60 }),
  elixir:      I('Elixir', 'heal', 420, 'Restores 140 HP.', { hp: 140 }),
  fullrestore: I('Hearthdraught', 'heal', 900, 'Restores all HP and cures status.', { hp: 9999, cure: 1 }),
  remedy:      I('Remedy', 'cure', 90, 'Cures any status condition.', { cure: 1 }),
  rekindle:    I('Rekindle', 'revive', 500, 'Revives a fainted Kith with half HP.', { frac: 0.5 }),
  ppseed:      I('Memory Seed', 'pp', 300, 'Restores the PP of all moves.'),
  lantern:     I('Lantern', 'lantern', 80, 'A paper lantern for befriending wild Kith.', { mult: 1 }),
  brightlantern: I('Bright Lantern', 'lantern', 220, 'A stronger lantern.', { mult: 1.5 }),
  dusklantern: I('Dusk Lantern', 'lantern', 300, 'Three times as strong at night and in caves.', { mult: 1, dusk: 3 }),
  prismlantern: I('Prism Lantern', 'lantern', 0, 'Never fails. Extremely rare.', { mult: 255 }),
  dawnshard:   I('Dawn Shard', 'evo', 1500, 'A sliver of first light. Some Kith evolve when shown one.'),
  duskshard:   I('Dusk Shard', 'evo', 1500, 'A sliver of last light. Some Kith evolve when shown one.'),
  luckcharm:   I('Clover Knot', 'boost', 0, 'Key item. A knot of four-leaf clover. +3% Fortune while carried.', { key: 1 }),
  compass:     I('Echo Compass', 'key', 0, 'Key item. Hums near buried caches. Press the action button on plain ground to dig.', { key: 1 }),
  cryptkey:    I('Crypt Seal', 'key', 0, 'Key item. Opens the road to the Sunken Crypt.', { key: 1 }),
  presspass:   I('Pressworks Pass', 'key', 0, 'Key item. A Hollow Ledger door pass.', { key: 1 }),
  berry:       I('Glowberry', 'heal', 30, 'Restores 12 HP. Grows wild.', { hp: 12 }),
  nugget:      I('Lantern Glass', 'sell', 0, 'Old lantern glass. Sells for a good price.', { sell: 800 }),
};
for (const k in ITEMS) ITEMS[k].id = k;
