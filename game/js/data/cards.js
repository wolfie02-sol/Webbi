// CRYPT card set. Kith cards are generated from the bestiary; the rest are defined here.
import { KITH } from './creatures.js';
import { E, e, mE, me, P, p, mP, mp, L, l, mL, ml } from '../render/pixel.js';

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY = {
  common:    { name: 'Common',    color: '#b8b4a8', dust: 1,    craft: 8,    treat: 'Standard illustrated card' },
  uncommon:  { name: 'Uncommon',  color: '#6cc48c', dust: 3,    craft: 24,   treat: 'Enhanced border' },
  rare:      { name: 'Rare',      color: '#5c9cf0', dust: 10,   craft: 80,   treat: 'Foil' },
  epic:      { name: 'Epic',      color: '#b070f0', dust: 40,   craft: 320,  treat: 'Animated foil' },
  legendary: { name: 'Legendary', color: '#f4b840', dust: 200,  craft: 1600, treat: 'Premium animated gold' },
  mythic:    { name: 'Mythic',    color: '#f06890', dust: 1000, craft: 8000, treat: 'Prismatic full-art' },
  secret:    { name: 'Secret',    color: '#70e8f0', dust: 0,    craft: 0,    treat: 'Negative-ink, found not pulled' },
};

// Artifact art (48 grid)
export const ART = {
  lantern: { pal: ['#f4b840', '#fff4c0', '#8c5a30', '#f06830'], ops: [L(24, 4, 24, 10, 1, 3), P(3, 16, 10, 32, 10, 30, 14, 18, 14), P(1, 14, 14, 34, 14, 36, 34, 12, 34), p(2, 18, 17, 30, 17, 31, 31, 17, 31), p(4, 24, 19, 21, 27, 24, 30, 27, 27), P(3, 14, 34, 34, 34, 31, 40, 17, 40), ml(18, 14, 17, 34, .5, 3)] },
  compass: { pal: ['#c8a05c', '#f4ecd8', '#70e8f0', '#c84c3c'], ops: [E(24, 26, 16, 16, 1), e(24, 26, 12.5, 12.5, 2), p(4, 24, 15, 27, 26, 21, 26), p(3, 24, 37, 27, 26, 21, 26), e(24, 26, 1.6, 1.6, 8), E(24, 8, 3, 3, 1), e(24, 8, 1.2, 1.2, 2)] },
  sigil: { pal: ['#5cb85c', '#f4ecd8', '#2f7a40', '#f4d040'], ops: [P(1, 24, 4, 40, 12, 38, 32, 24, 44, 10, 32, 8, 12), p(2, 24, 9, 35, 15, 34, 30, 24, 39, 14, 30, 13, 15), p(3, 24, 14, 30, 24, 24, 34, 18, 24), p(4, 24, 19, 27, 24, 24, 29, 21, 24)] },
  shard: { pal: ['#f8e090', '#ffffff', '#f0a8d0', '#f4b840'], ops: [P(1, 24, 3, 33, 18, 28, 44, 20, 44, 15, 18), p(2, 24, 8, 28, 19, 24, 22, 19, 19), p(3, 24, 22, 28, 19, 26, 40, 24, 40), mL(8, 10, 11, 13, .7, 4), mL(6, 30, 9, 29, .7, 4)] },
  blankcard: { pal: ['#f0e8d8', '#c8bca0', '#5c5068', '#e04870'], ops: [P(3, 12, 6, 38, 8, 36, 44, 10, 42), P(1, 11, 4, 37, 6, 35, 42, 9, 40), p(2, 14, 9, 33, 10, 32, 28, 13, 27), l(15, 32, 30, 33, .7, 2), l(15, 36, 26, 37, .7, 2), e(23, 19, 4, 5, 1)] },
  stamp: { pal: ['#5c5068', '#8c80a0', '#e04870', '#2c2838'], ops: [E(24, 9, 7, 5, 1), P(1, 21, 12, 27, 12, 28, 28, 20, 28), P(4, 12, 28, 36, 28, 38, 38, 10, 38), p(3, 12, 38, 36, 38, 36, 42, 12, 42), e(22, 8, 2.5, 1.5, 2)] },
  key: { pal: ['#70e8f0', '#e8fcff', '#3c98b0', '#f4b840'], ops: [E(24, 12, 9, 9, 1), e(24, 12, 4.5, 4.5, 3), e(24, 12, 2, 2, 4), P(1, 22, 20, 26, 20, 26, 44, 22, 44), P(1, 26, 34, 33, 34, 33, 38, 26, 38), P(1, 26, 40, 31, 40, 31, 44, 26, 44)] },
  quill: { pal: ['#f4ecd8', '#a890e0', '#5c5068', '#2c2838'], ops: [P(1, 38, 3, 44, 10, 22, 36, 16, 34, 20, 24), p(2, 36, 8, 40, 11, 22, 32, 20, 30), L(18, 34, 8, 44, 1, 3), e(7, 45, 2.2, 1.2, 4), l(36, 8, 20, 30, .5, 3)] },
  mask: { pal: ['#e8e4f0', '#8c88a0', '#2c2838', '#e04870'], ops: [P(1, 10, 8, 38, 8, 40, 26, 24, 44, 8, 26), p(2, 24, 10, 26, 30, 24, 41, 22, 30), mp(3, 13, 18, 21, 17, 21, 23, 14, 22), mp(4, 15, 28, 19, 27, 18, 33), l(20, 36, 28, 36, .7, 3)] },
  bell: { pal: ['#f4b840', '#fff0b0', '#a87020', '#70e8f0'], ops: [E(24, 6, 3, 3, 3), P(1, 16, 14, 32, 14, 37, 36, 11, 36), E(24, 15, 8, 6, 1), p(2, 18, 16, 22, 14, 19, 32, 15, 33), P(3, 9, 36, 39, 36, 39, 40, 9, 40), e(24, 43, 3, 3, 4), mL(6, 20, 3, 24, .6, 4), mL(5, 28, 2, 30, .6, 4)] },
  clover: { pal: ['#5cb85c', '#a8e890', '#2f7a40', '#f4b840'], ops: [L(24, 26, 30, 44, 1.2, 3), mE(17, 17, 7, 7, 1), mE(17, 30, 7, 7, 1), me(15, 15, 3, 3, 2), me(15, 28, 3, 3, 2), e(24, 23.5, 3, 3, 4)] },
  starmap: { pal: ['#2c3460', '#f4ecd8', '#f4d040', '#70e8f0'], ops: [P(2, 6, 8, 42, 6, 44, 40, 8, 42), p(1, 9, 11, 39, 9, 41, 37, 11, 39), l(14, 30, 20, 18, .5, 4), l(20, 18, 30, 22, .5, 4), l(30, 22, 36, 14, .5, 4), e(14, 30, 1.6, 1.6, 3), e(20, 18, 2, 2, 3), e(30, 22, 1.6, 1.6, 3), e(36, 14, 2.2, 2.2, 3), e(26, 33, 1, 1, 2), e(16, 15, 1, 1, 2)] },
};

const C = (name, cat, rarity, art, lore, x = {}) => ({ name, cat, rarity, art, lore, ...x });
const SIGIL = (pal) => ({ k: 'art', id: 'sigil', pal });
export const CARDS = {};

// Kith cards
for (const k of Object.values(KITH)) {
  CARDS['k-' + k.id] = C(k.name, 'kith', k.rarity, { k: 'kith', id: k.id }, k.dex, { types: k.types, no: k.no });
}
Object.assign(CARDS, {
  // Artifacts
  'a-lantern':   C('Warden\'s Lantern', 'artifact', 'common', { k: 'art', id: 'lantern' }, 'Paper, wire and a stub of candle. Kith come to the light because someone is holding it.'),
  'a-compass':   C('Echo Compass', 'artifact', 'uncommon', { k: 'art', id: 'compass' }, 'It does not point north. It points at whatever was buried on purpose.'),
  'a-clover':    C('Clover Knot', 'artifact', 'uncommon', { k: 'art', id: 'clover' }, 'Tied by Thistlewick children. The luck is real; the knot is just where they keep it.'),
  'a-blankcard': C('Blank Card', 'artifact', 'common', { k: 'art', id: 'blankcard' }, 'A card with nothing pressed in it yet. The Hollow Ledger prints thousands.'),
  'a-stamp':     C('Press Stamp', 'artifact', 'rare', { k: 'art', id: 'stamp' }, 'One strike turns a living Kith into a record of one. The handle is worn smooth.'),
  'a-dawn':      C('Dawn Shard', 'artifact', 'rare', { k: 'art', id: 'shard' }, 'A sliver of the first morning, still warm.'),
  'a-dusk':      C('Dusk Shard', 'artifact', 'rare', { k: 'art', id: 'shard', pal: ['#6c5c84', '#c8b8e8', '#3c3050', '#e85888'] }, 'A sliver of the last evening. It is always a little later inside it.'),
  'a-quill':     C('Archivist\'s Quill', 'artifact', 'epic', { k: 'art', id: 'quill' }, 'It writes only true things. Maren keeps hers in a drawer and uses a pencil.'),
  'a-mask':      C('Scribe\'s Mask', 'artifact', 'uncommon', { k: 'art', id: 'mask' }, 'Hollow Ledger Scribes wear these so the Kith will not remember their faces.'),
  'a-bell':      C('Echo Bell', 'artifact', 'epic', { k: 'art', id: 'bell' }, 'Rung once at the top of the Echo Tower. You hear it the day before.'),
  'a-key':       C('Crypt Seal', 'artifact', 'epic', { k: 'art', id: 'key' }, 'It opens the Sunken Crypt. It was never meant to lock it.'),
  'a-starmap':   C('Starfall Map', 'artifact', 'legendary', { k: 'art', id: 'starmap' }, 'Charts a constellation that is not in the sky. Not yet.'),
  'a-sigil1':    C('Thistle Sigil', 'artifact', 'uncommon', SIGIL(['#5cb85c', '#f4ecd8', '#2f7a40', '#f4d040']), 'Awarded by Warden Bram of Thistlewick.'),
  'a-sigil2':    C('Brine Sigil', 'artifact', 'uncommon', SIGIL(['#4c90f0', '#f4ecd8', '#2458b0', '#f4d040']), 'Awarded by Warden Ines of Saltgate.'),
  'a-sigil3':    C('Kiln Sigil', 'artifact', 'rare', SIGIL(['#f0803c', '#f4ecd8', '#b83c20', '#f4d040']), 'Awarded by Warden Kiln of Ashenforge.'),
  'a-sigil4':    C('Rime Sigil', 'artifact', 'rare', SIGIL(['#7cd4e0', '#f4ecd8', '#3c88b0', '#f4d040']), 'Awarded by Warden Isolde of Glimmerhold.'),
  // Characters
  'c-maren':  C('Archivist Maren', 'character', 'rare', { k: 'char', id: 'maren' }, '"Write it down, then go and see if it is true."'),
  'c-juno':   C('Juno', 'character', 'rare', { k: 'char', id: 'juno' }, 'Your rival. Has never once waited for you and has never once left without you.'),
  'c-bram':   C('Warden Bram', 'character', 'uncommon', { k: 'char', id: 'bram' }, 'Keeper of the Thistle Sigil. Talks to his garden; it seems to help.'),
  'c-ines':   C('Warden Ines', 'character', 'uncommon', { k: 'char', id: 'ines' }, 'Keeper of the Brine Sigil. Has sailed past the edge of every map she owns.'),
  'c-kiln':   C('Warden Kiln', 'character', 'rare', { k: 'char', id: 'kiln' }, 'Keeper of the Kiln Sigil. Forged the Ashenforge bell and rings it too hard.'),
  'c-isolde': C('Warden Isolde', 'character', 'rare', { k: 'char', id: 'isolde' }, 'Keeper of the Rime Sigil and of the Crypt road.'),
  'c-sable':  C('Registrar Sable', 'character', 'epic', { k: 'char', id: 'sable' }, 'Runs the Pressworks. Keeps perfect records of things that no longer exist.'),
  'c-vane':   C('Curator Vane', 'character', 'legendary', { k: 'char', id: 'vane' }, '"A memory cannot leave you. That is the whole of my argument."'),
  // Seasonal (in crates only during their months; they return every year)
  'x-winter': C('Frostfair Shivver', 'seasonal', 'epic', { k: 'kith', id: 'shivver', pal: ['#f4f8ff', '#ffffff', '#e04860', '#2f7a40'] }, 'Glimmerhold\'s Frostfair mascot. It wears the scarf under protest.', { months: [12, 1, 2] }),
  'x-spring': C('Bloomtide Sproutle', 'seasonal', 'epic', { k: 'kith', id: 'sproutle', pal: ['#f8b8d8', '#fff0f8', '#e06898'] }, 'For one week each spring every Sproutle in Thistlewick flowers at once.', { months: [3, 4, 5] }),
  'x-summer': C('Highsun Kindlit', 'seasonal', 'epic', { k: 'kith', id: 'kindlit', pal: ['#f8e060', '#fffce0', '#70e8f0', '#f0803c'] }, 'On the longest day its flame burns blue-white. It is insufferable about it.', { months: [6, 7, 8] }),
  'x-autumn': C('Harvest Nibbin', 'seasonal', 'epic', { k: 'kith', id: 'nibbin', pal: ['#e08838', '#fff0d0', '#8c4820', '#c83c30'] }, 'It has eaten the harvest festival display again.', { months: [9, 10, 11] }),
  // Mythic
  'm-remember': C('Mnemora, Remembering', 'mythic', 'mythic', { k: 'kith', id: 'mnemora', pal: ['#fff8e8', '#f8d040', '#f0a8d8', '#70e8f0'], full: 1 }, 'The moment after the Crypt opened, when it knew everyone at once.'),
  'm-vael':     C('Vael, Lantern-lit', 'mythic', 'mythic', { k: 'art', id: 'lantern', pal: ['#70e8f0', '#ffffff', '#5c5068', '#f06890'], full: 1 }, 'Every lantern in the country, seen from above, on the one night they were all lit.'),
  // Secret (constellation rewards; never in crates, cannot be crafted)
  's-threeroads':   C('Three Roads', 'secret', 'secret', { k: 'kith', id: 'eldergrove', pal: ['#1c2838', '#70e8f0', '#e8fcff', '#3c98b0'] }, 'Three Wardens left Lanternrest the same morning by three roads. This is the fourth.'),
  's-firstlantern': C('The First Lantern', 'secret', 'secret', { k: 'art', id: 'lantern', pal: ['#1c2838', '#70e8f0', '#3c98b0', '#e8fcff'] }, 'Someone had to be the first to hold a light up and wait.'),
  's-pagezero':     C('Ledger, Page Zero', 'secret', 'secret', { k: 'art', id: 'blankcard', pal: ['#1c2838', '#3c98b0', '#70e8f0', '#e8fcff'] }, 'The page before the first entry. It has one word on it: "Sorry."'),
  's-aurora':       C('Aurora Unbroken', 'secret', 'secret', { k: 'kith', id: 'auroryx', pal: ['#1c2838', '#70e8f0', '#e8fcff', '#f0a8d8'] }, 'A night sky with nothing missing from it.'),
  's-opendoor':     C('The Open Door', 'secret', 'secret', { k: 'art', id: 'key', pal: ['#1c2838', '#e8fcff', '#3c98b0', '#70e8f0'] }, 'Four Sigils and a Seal. The door was never locked; you just had to arrive.'),
});
for (const id in CARDS) CARDS[id].id = id;
export const CARD_IDS = Object.keys(CARDS);

export const CONSTELLATIONS = [
  { id: 'threeroads', name: 'Three Roads', need: ['k-eldergrove', 'k-infernyx', 'k-tsunarch'], reward: 's-threeroads', hint: 'Three friends who started together, fully grown.' },
  { id: 'firstlantern', name: 'The First Lantern', need: ['a-lantern', 'a-compass', 'c-maren'], reward: 's-firstlantern', hint: 'A light, a direction, and someone who taught you both.' },
  { id: 'pagezero', name: 'Page Zero', need: ['c-vane', 'c-sable', 'a-blankcard', 'a-stamp'], reward: 's-pagezero', unlock: 'nullith', hint: 'The Ledger\'s people and the tools of their trade.' },
  { id: 'aurora', name: 'Aurora Unbroken', need: ['k-noctwing', 'k-auroryx', 'k-halocorn', 'a-starmap'], reward: 's-aurora', unlock: 'starfall', hint: 'Night wings, sky antlers, a halo, and a map of what is missing.' },
  { id: 'opendoor', name: 'The Open Door', need: ['a-sigil1', 'a-sigil2', 'a-sigil3', 'a-sigil4', 'a-key'], reward: 's-opendoor', hint: 'Everything a Warden earns on the way to the Crypt.' },
];
