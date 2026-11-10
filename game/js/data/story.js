// Story scripts. Each receives the game API `g` (see scenes/world.js).
import { LEADERS } from './maps.js';
import { KITH } from './creatures.js';

const COUNTER = { sproutle: 'kindlit', kindlit: 'bublet', bublet: 'sproutle' };
const stage = (base, lvl) => { let k = KITH[base]; while (k.evo && k.evo.lvl && lvl >= k.evo.lvl) k = KITH[k.evo.to]; return k.id; };
const junoStarter = (g, lvl) => [stage(COUNTER[g.s.starter] || 'kindlit', lvl), lvl];

export const STORY = {
  async maren(g) {
    const M = 'Archivist Maren';
    if (!g.has('starter')) {
      await g.say(M, 'There you are. Sixteen today, and Vael says that makes you a Warden. I say a lantern and a friend make you a Warden.');
      await g.say(M, 'Three Kith came to my light this spring and stayed. Go and meet them. One of them is going to like you; you\'ll know which.');
      return;
    }
    const n = g.caughtCount();
    for (const [need, flag, crate, line] of [[5, 'codex5', 'silver', 'Five entries! The Codex is starting to look like a book.'], [15, 'codex15', 'golden', 'Fifteen. You\'re seeing things I only have drawings of.'], [30, 'codex30', 'legendary', 'Thirty. Half of Vael. I kept this vault for someone who\'d earn it.'], [50, 'codex50', 'mythic', 'Fifty. I have been an Archivist for forty years and I have not seen fifty. Take this. It has been waiting longer than I have.']]) {
      if (n >= need && !g.has(flag)) { g.set(flag); await g.say(M, line); await g.giveCrate(crate); return; }
    }
    if (g.has('story_done') && !g.has('maren_end')) {
      g.set('maren_end');
      await g.say(M, 'I felt it, you know. The moment the Crypt opened. Every card in my drawer went warm.');
      await g.say(M, 'Vane wasn\'t wrong that things get lost. He was wrong that you fix that by owning them. You remember things by going back to see them.');
      await g.giveCard('c-maren');
      return;
    }
    const next = [5, 15, 30, 50].find((x) => n < x);
    await g.say(M, next ? `Your Codex has ${n} Kith recorded. Bring it to ${next} and I'll have something for you.` : 'A full shelf. Go outside. That\'s where the rest of it is.');
  },

  async chooseStarter(g, id) {
    const k = KITH[id];
    if (g.has('starter')) return g.say(`${k.name} watches you go with the other one. It seems fine about it.`);
    const pick = await g.choose(`${k.name}, the ${k.types[0]} Kith. ${k.dex}`, [`Hold out your lantern to ${k.name}`, 'Look at the others']);
    if (pick !== 0) return;
    g.s.starter = id; g.set('starter');
    await g.giveMon(id, 5, { fanfare: true });
    await g.give('lantern', 5); await g.give('salve', 3);
    await g.say('Archivist Maren', 'I thought so. Take these lanterns: hold one up to a tired wild Kith and it may choose to stay. And take the Codex. Write down what you see, then go and see if it\'s true.');
    await g.say('Juno', `HA. Called it. Then I'm taking ${KITH[COUNTER[id]].name}. Outside? No. Here. Now. Maren, move the table.`);
    const won = await g.battle({ name: 'Juno', look: 'juno', party: [[COUNTER[id], 5]], reward: 150, noWhiteout: true });
    await g.say('Juno', won ? 'Okay. OKAY. That was one. I\'m heading for Thistlewick, and the next one\'s mine.' : 'One-nil. I\'m heading for Thistlewick. Try to keep up.');
    await g.hearth(true, true);
    await g.say('Archivist Maren', 'Bram keeps the Sigil Hall in Thistlewick, north along Dewpath. Four Sigils and Vael will open every road to you. Go on. Leave a light on.');
    await g.giveCrate('basic');
    await g.say('Maren hands you a small crate of CRYPT cards. Open it from the menu: CRYPT.');
  },

  async leader(g, n) {
    const L = LEADERS[n], flag = 'sigil' + n;
    if (g.has(flag)) {
      const again = await g.choose(`${L.name}: Back for a friendly bout? I've been training.`, ['Rematch', 'Not now']);
      if (again !== 0) return;
      const up = 46 + g.s.badgesRematch * 0;
      const party = L.party.map(([id]) => [stage(id, up + 4), g.has('champion') ? 58 : up]);
      const won = await g.battle({ name: L.name, look: L.look, party, reward: 3000, ai: 2, noWhiteout: true });
      if (won && !g.has('re' + flag)) { g.set('re' + flag); await g.giveCrate('golden'); }
      return;
    }
    await g.say(L.name, L.before);
    const won = await g.battle({ name: L.name, look: L.look, party: L.party, reward: L.reward, ai: 2, music: 'boss' });
    if (!won) return;
    g.set(flag); g.s.badges = Math.max(g.s.badges, n);
    await g.fanfare(`You received the ${L.sigil}!`);
    await g.say(L.name, L.after);
    await g.giveCard(L.card); await g.giveCard(L.own);
    await g.giveCrate('golden'); await g.giveCollector();
    if (n === 3) await g.give('presspass');
    if (n === 4) await g.give('cryptkey');
  },

  async rook(g) {
    const R = 'Scribe-Captain Rook';
    await g.say('A Sparkit is tangled in a net. A masked figure is holding a blank card over it and a heavy stamp.');
    await g.say(R, 'Stop there. This one is being registered. In a moment it will be perfect: it will never age, never run, never be lost. The Hollow Ledger remembers so that you don\'t have to.');
    await g.say(R, 'You object. They always object. Very well, object properly.');
    const won = await g.battle({ name: R, look: 'scribe', party: [['blotch', 12], ['toxpole', 12], ['wispurr', 13]], reward: 500, ai: 2, music: 'boss' });
    if (!won) return;
    g.set('murk_done');
    await g.say(R, 'Curator Vane will hear about this. Not from me. I\'m going to say I fell in a river.');
    await g.say('Rook drops the net, a mask and a blank card, and runs. The Sparkit shakes itself, sparks once at you in thanks, and vanishes into the wood.');
    await g.giveCard('a-mask'); await g.giveCard('a-blankcard'); await g.giveCollector();
  },
  async haleAfter(g) {
    const H = 'Ranger Hale';
    if (!g.has('compass')) {
      await g.say(H, 'I saw the end of that. So it\'s true: they\'re pressing Kith into cards. Saltgate\'s east of here. Warden Ines needs to hear this.');
      await g.say(H, 'Take my Echo Compass. The old Archivists buried caches all over Vael, and the caches move every day. Stand on open ground and press the action button to dig when it hums.');
      await g.give('compass'); await g.giveCard('a-compass'); await g.giveCrate('silver');
      await g.say(H, 'It\'ll also show you a grotto in the north of this wood that most people walk straight past.');
      return;
    }
    if (g.has('q_night_done')) return g.say(H, 'Wood\'s loud again at night. That\'s how it should be.');
    if (g.hasSpecies('gloomoth') || g.hasSpecies('noctwing')) { await g.say(H, 'A Gloomoth! So they\'re back. That\'s the best news I\'ve had all month. Here, these work best after dark.'); g.set('q_night_done'); await g.give('dusklantern', 3); return; }
    g.set('q_night');
    await g.say(H, 'One more thing. The Gloomoth stopped flying when the Scribes came. If you see one, after dusk, catch it and show me? I need to know they\'re back.');
  },

  async juno2(g) {
    await g.say('Juno', 'You took your time! I\'ve had a Sigil for DAYS. Day. One day. Come on, I\'ve been standing here practising my face.');
    const won = await g.battle({ name: 'Juno', look: 'juno', party: [['fluttle', 17], ['sparkit', 17], junoStarter(g, 19)], reward: 700, ai: 2, noWhiteout: true });
    g.set('juno2');
    await g.say('Juno', won ? 'Fine! FINE. Did you hear about Murkroot, though? People in masks. I\'m going to go and be angry at them.' : 'Yes! Write that down in your Codex. Did you hear about Murkroot? People in masks. I\'m going to go and be angry at them.');
    await g.giveCard('c-juno');
  },
  async juno3(g) {
    await g.say('Juno', 'I went to the Crypt road. Forty of them. I got through six and Isolde had to carry me back. Don\'t laugh.');
    await g.say('Juno', 'You\'re going in, aren\'t you. Then I need to know you can. Everything you\'ve got.');
    const won = await g.battle({ name: 'Juno', look: 'juno', party: [['galewing', 37], ['voltigre', 37], ['hauntail', 37], junoStarter(g, 39)], reward: 2200, ai: 2, noWhiteout: true });
    g.set('juno3');
    await g.say('Juno', won ? 'Yeah. Okay. You can. Take these, I was saving them. Go and get him.' : 'Still me. But you\'re the one with the Seal, so: take these, and don\'t you dare lose down there.');
    await g.give('fullrestore', 3); await g.give('rekindle', 2);
  },

  async sable(g) {
    const S = 'Registrar Sable';
    await g.say('Rows of cages. A press the size of a house. A woman with a ledger does not look up.');
    await g.say(S, 'Four hundred and twelve registered this week. No illness. No escapes. No grief. Do you know how much grief a town like this produces? I keep the numbers.');
    await g.say(S, 'You\'re the one from Murkroot. Entry: "interference". Let me correct the record.');
    const won = await g.battle({ name: S, look: 'sable', party: [['miasmander', 30], ['cogling', 31], ['hauntail', 31], ['umbrink', 32]], reward: 2400, ai: 2, music: 'boss' });
    if (!won) return;
    g.set('press_done');
    await g.say(S, '...Entry: "defeated". I do keep accurate records.');
    await g.say(S, 'It doesn\'t matter. This was the small press. The Curator has gone to the Sunken Crypt for Mnemora, the first Kith. Press that, and every memory it keeps is ours. He asked me to tell whoever beat me. He thinks you\'ll agree with him, in the end.');
    await g.say('You throw the lever. The cages open. Four hundred and twelve Kith pour out into Ashenforge, and one small Mindle stays behind, looking up at you.');
    await g.giveMon('mindle', 28);
    await g.giveCard('c-sable'); await g.giveCard('a-stamp'); await g.give('duskshard'); await g.giveCrate('golden'); await g.giveCollector();
  },

  async vane(g) {
    const V = 'Curator Vane';
    await g.say('The altar is a single lantern, as old as the country. Above it, asleep in its own light, floats Mnemora.');
    await g.say(V, 'Warden. I hoped it would be you. Sable\'s notes on you are very thorough.');
    await g.say(V, 'I had a Kith once. A Glimmet. She came to my lantern when I was six. When I was nineteen she didn\'t wake up one morning. That is all. That is the entire reason for any of this.');
    await g.say(V, 'A memory cannot leave you. That is the whole of my argument. If you have a better one, I would honestly like to hear it.');
    const won = await g.battle({ name: V, look: 'vane', party: [['umbrink', 43], ['gearhulk', 43], ['sarcophant', 44], ['cerebrix', 44], ['nullith', 46]], reward: 6000, ai: 2, music: 'boss' });
    if (!won) return;
    await g.say(V, 'Even the one I built. Even Nullith... it fought for me. I never pressed a single memory into it. It did that on its own.');
    await g.say('Mnemora opens its eyes.');
    await g.say('It looks at Vane for a long time. Then every card in the Crypt turns over at once, and for a moment the air is full of every Kith that anyone in Vael ever loved.');
    await g.say('A small Glimmet, made of light, lands on Vane\'s shoulder. He does not move.');
    await g.say(V, '...She remembers me.');
    await g.say('Mnemora turns to you. You understand, without words: the cards were never meant to hold Kith. They were meant to hold the door open.');
    g.set('story_done');
    await g.fanfare('The Crypts are open to everyone.');
    await g.giveCard('c-vane'); await g.giveCard('a-key'); await g.giveCrate('legendary'); await g.giveCollector(2);
    await g.credits();
    await g.say('Vane has gone. On the altar he has left a Dawn Shard and a note: "For the next Glimmet you meet."');
    await g.give('dawnshard');
    await g.say('Concord Plateau, west of Glimmerhold, is now open. And Mnemora is still here, waiting to see what you do next.');
  },

  async trial(g) {
    const first = !g.has('champion'), lv = first ? 0 : 8;
    const pick = await g.choose(first ? 'THE CONCORD TRIAL\nFour Concord Wardens, then the Champion. No rest between battles.' : 'THE CONCORD TRIAL\nThe Wardens have trained since your last visit.', ['Enter', 'Not yet']);
    if (pick !== 0) return;
    const foes = [
      ['Concord Warden Asha', 'ranger', [['fungrove', 46], ['galewing', 46], ['eldergrove', 48], ['voltigre', 48]]],
      ['Concord Warden Dunn', 'smith', [['calderon', 47], ['quakodile', 48], ['monolisk', 49], ['brawlord', 49]]],
      ['Concord Warden Sel', 'sailor', [['stormrel', 48], ['bastishell', 49], ['glaciore', 50], ['corallure', 50]]],
      ['Concord Warden Nyx', 'villager', [['noctwing', 49], ['hauntail', 50], ['sarcophant', 51], ['umbrink', 51], ['cerebrix', 51]]],
      ['Champion Juno', 'juno', [['galewing', 51], ['voltigre', 52], ['hauntail', 52], ['aetherwyrm', 53], ['halocorn', 53], junoStarter(g, 55)]],
    ];
    for (let i = 0; i < foes.length; i++) {
      const [name, look, party] = foes[i];
      if (i === 4) await g.say('Juno', first ? 'Surprise. I got here yesterday. One day ahead of you, same as always. This is the one that counts.' : 'Again? Good. I\'ve been bored.');
      const won = await g.battle({ name, look, party: party.map(([id, l]) => [id, l + lv]), reward: 3000 + i * 800, ai: 2, music: i === 4 ? 'boss' : 'gym' });
      if (!won) return;
      if (i < 4) await g.say(name, 'Go on through.');
    }
    await g.say('Juno', 'There it is. I wanted it to be you. I mean I wanted it to be ME, but after me, you.');
    if (first) {
      g.set('champion');
      await g.fanfare('You are the Champion of Vael!');
      await g.giveCrate('mythic'); await g.giveCollector(2);
      await g.say('Word is spreading. Something has surfaced at the end of Saltgate pier, and the ground on Cinder Steppe is warm in a new place.');
    } else { await g.giveCrate('legendary'); await g.giveCollector(); }
    await g.hearth(true, true);
  },

  async tower(g) {
    const best = g.s.tower.best || 0;
    const pick = await g.choose(`THE ECHO TOWER\nEvery floor is harder than the last. Your Kith are healed between floors.\nBest floor: ${best}`, ['Climb', 'Leave']);
    if (pick !== 0) return;
    let floor = 0;
    const pool = Object.values(KITH).filter((k) => !k.evo && !k.legend).map((k) => k.id);
    const titles = ['Echo of a Warden', 'Echo of a Scribe', 'Echo of a Rival', 'Echo of a Champion'];
    for (;;) {
      floor++;
      await g.hearth(true, true);
      const lvl = Math.min(100, 44 + floor * 2);
      const party = [0, 1, 2].map(() => [g.rng.pick(pool), lvl]);
      if (floor % 10 === 0) party.push([g.rng.pick(['pyraclast', 'thalassyr', 'verdelune', 'mnemora']), lvl]);
      const won = await g.battle({ name: `${g.rng.pick(titles)} (Floor ${floor})`, look: g.rng.pick(['scribe', 'ranger', 'smith', 'sailor', 'juno']), party, reward: 400 + floor * 120, ai: 2, noWhiteout: true, music: 'gym' });
      if (!won) { floor--; break; }
      g.dailyTick('tower');
      if (floor % 5 === 0) await g.giveCrate(floor % 25 === 0 ? 'legendary' : floor % 15 === 0 ? 'shadow' : floor % 10 === 0 ? 'golden' : 'silver');
      if (floor % 10 === 0) await g.giveCollector();
      if (floor === 10 && !g.has('bell')) { g.set('bell'); await g.giveCard('a-bell'); }
      const go = await g.choose(`Floor ${floor} cleared.`, ['Next floor', 'Leave the tower']);
      if (go !== 0) break;
    }
    if (floor > best) { g.s.tower.best = floor; await g.fanfare(`New best: floor ${floor}!`); }
    await g.hearth(true, true);
  },
};

// Quest log entries. state: 'hidden' | 'active' | 'done'
const q = (name, giver, state, text) => ({ name, giver, state, text });
const fl = (start, done) => (g) => (g.has(done) ? 'done' : g.has(start) ? 'active' : 'hidden');
export const QUESTS = [
  q('The Warden\'s Road', 'Story', (g) => (g.has('champion') ? 'done' : 'active'), (g) => {
    if (!g.has('starter')) return 'Visit Archivist Maren\'s lab in Lanternrest.';
    if (!g.has('sigil1')) return 'Travel north along Dewpath to Thistlewick and earn the Thistle Sigil.';
    if (!g.has('murk_done')) return 'Find out why Kith are vanishing in Murkroot Wood, east of Thistlewick.';
    if (!g.has('sigil2')) return 'Reach Saltgate and tell Warden Ines what you saw.';
    if (!g.has('sigil3')) return 'Follow the blank cards north across Cinder Steppe to Ashenforge.';
    if (!g.has('press_done')) return 'Use the Pressworks Pass on the east building in Ashenforge.';
    if (!g.has('sigil4')) return 'Cross Frostspire Pass, west of Ashenforge, to Glimmerhold.';
    if (!g.has('story_done')) return 'Take the Crypt Seal north from Glimmerhold into the Sunken Crypt.';
    return 'Enter the Concord Trial on Concord Plateau, west of Glimmerhold.';
  }),
  q('Tobin\'s Lantern Glass', 'Old Tobin, Lanternrest', fl('q_glass', 'q_glass_done'), () => 'Find the lantern glass on the west side of Dewpath.'),
  q('Thorns for Luck', 'Tansy, Thistlewick', fl('q_clover', 'q_clover_done'), () => 'Show Tansy a Mossmite, Fungrove or Thornox.'),
  q('Night Watch', 'Ranger Hale, Murkroot', fl('q_night', 'q_night_done'), () => 'Catch a Gloomoth after dusk and show it to Hale.'),
  q('Dock Thieves', 'Dockhand Marl, Saltgate', fl('q_gull', 'q_gull_done'), (g) => `Defeat wild Gullets near Saltgate (${Math.min(3, g.defeated('gullet'))}/3).`),
  q('Forge Fuel', 'Forgehand Brix, Ashenforge', fl('q_fuel', 'q_fuel_done'), () => 'Bring a Magmite to Brix.'),
  q('Cold Storage', 'Dairywife Enna, Glimmerhold', fl('q_cold', 'q_cold_done'), () => 'Show Enna a Glaciore.'),
  q('The Codex', 'Archivist Maren', (g) => (g.has('codex50') ? 'done' : g.has('starter') ? 'active' : 'hidden'), (g) => `Record Kith and report to Maren at 5, 15, 30 and 50 (${g.caughtCount()} so far).`),
  q('Buried Things', 'Echo Compass', (g) => (g.has('q_dig_done') ? 'done' : g.has('compass') ? 'active' : 'hidden'), (g) => `Dig up 5 buried caches (${Math.min(5, g.s.dug || 0)}/5).`),
  q('What Vael Remembers', 'Postgame', (g) => (!g.has('champion') ? 'hidden' : ['got_mnemora', 'got_pyraclast', 'got_thalassyr', 'got_verdelune', 'got_nullith'].every((f) => g.has(f)) ? 'done' : 'active'), (g) => `Befriend the five legends of Vael (${['got_mnemora', 'got_pyraclast', 'got_thalassyr', 'got_verdelune', 'got_nullith'].filter((f) => g.has(f)).length}/5). Two of them wait behind card Constellations.`),
];
