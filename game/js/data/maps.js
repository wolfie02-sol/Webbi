// World maps. Each grid row is a string; tile legend is in render/tiles.js. Any character listed in a
// map's `ent` is an entity standing on the map's default ground. Scripts receive the game API `g`.
//
//   . ground   , tall grass   # tree   ~ water   = path   o boulder   H building   F flowers   f fence
//   W wall     L lava         s sand   b bridge  * crystal  p pillar   _ floor     t table    m machine
const warp = (map, at) => ({ warp: [map, at] });
const door = (map, at, x = {}) => ({ warp: [map, at], door: 1, ...x });
const hearth = () => ({ door: 1, kind: 'hearth', on: (g) => g.hearth() });
const market = () => ({ door: 1, kind: 'market', on: (g) => g.shop() });
const post = () => ({ post: 1, on: (g) => g.travel() });
const sign = (text) => ({ sign: text });
const item = (id, n = 1) => ({ item: id, n });
const crate = (id) => ({ crate: id });
const npc = (look, name, talk, x = {}) => ({ npc: look, name, talk: typeof talk === 'string' ? (g) => g.say(name, talk) : talk, ...x });
const gate = (look, name, flag, text) => npc(look, name, text, { hide: (g) => g.has(flag) });
const trainer = (look, name, party, reward, before, after, x = {}) => ({ npc: look, name, trainer: { party, reward, before, after, ai: x.ai ?? 1, onWin: x.onWin }, dir: x.dir || 'down', sight: x.sight ?? 3, hide: x.hide });
const legend = (id, lvl, show, intro) => ({ legend: id, lvl, show, intro });

const SCRIBE = 'scribe';

export const MAPS = {
  lanternrest: {
    name: 'Lanternrest', biome: 'meadow', town: true, music: 'town',
    grid: [
      '############1###########',
      '####........9.....######',
      '###..HHHH...=..HHHHH.###',
      '###..HHHH...=..HHHHH.###',
      '###..H2HH...=..HH3HH.###',
      '##....=.....=....=...###',
      '##.F..=======4====.F.###',
      '##....=.....=........###',
      '##.6..=.....=..S.,,,.###',
      '##.HHH=.....=....,,,.###',
      '##.HHH=.....=.7..,,,.###',
      '##.H5H=....~~~~~.....###',
      '##..==.....~~~~~~..8.###',
      '##.........~~~~~~....###',
      '###....F...~~~~~~...####',
      '########################',
    ],
    ent: {
      1: warp('dewpath', 'S'),
      2: { door: 1, kind: 'home', on: async (g) => { await g.say('Mum', g.has('starter') ? 'Home already? Sit. Eat. Your Kith look tired.' : 'Maren was asking for you at the lab, love. Go on.'); await g.hearth(true); } },
      3: door('lab', '1'),
      4: post(),
      5: { door: 1, kind: 'house', on: async (g) => {
        if (g.has('q_glass_done')) return g.say('Old Tobin', 'The lantern burns clean again. Come by any evening.');
        if (g.count('nugget') > 0 && g.has('q_glass')) {
          await g.say('Old Tobin', 'That\'s it! That\'s my lantern glass. Forty years I carried that light.');
          g.take('nugget', 1); g.set('q_glass_done'); await g.giveCrate('basic', 2); await g.coins(400);
          return;
        }
        g.set('q_glass');
        await g.say('Old Tobin', 'I dropped my lantern glass somewhere on Dewpath. West side, near the long grass. My knees won\'t take me back for it.');
      } },
      6: npc('villager', 'Farmer Odile', 'Kith come to lantern light. Not because it\'s bright. Because somebody\'s holding it.'),
      7: npc('kid', 'Pip', async (g) => { await g.say('Pip', g.has('compass') ? 'Your compass is humming! Stand on plain ground and press the action button to dig!' : 'Sparkit sleep by the pond at night. I\'m NOT supposed to know that.'); }),
      8: npc('sailor', 'Angler Wen', 'Every day there\'s something new buried somewhere in Vael. The Archivists hid things on purpose, you know. For fun.'),
      9: npc('juno', 'Juno', async (g) => { await g.say('Juno', 'Not without a Kith you\'re not. Maren\'s waiting. Lab\'s the big roof, east side.'); }, { hide: (g) => g.has('starter') }),
      S: sign('LANTERNREST\n"Leave a light on."'),
    },
    enc: { rate: 0.12, day: [['nibbin', 2, 4, 5], ['fluttle', 2, 4, 4]], night: [['nibbin', 2, 4, 4], ['sparkit', 3, 5, 3], ['gloomoth', 3, 5, 2]] },
  },

  lab: {
    name: 'Maren\'s Lab', biome: 'interior', indoor: true, music: 'town',
    grid: [
      'WWWWWWWWWWW',
      'Wtt.....ttW',
      'W....2....W',
      'W.........W',
      'W..3.4.5..W',
      'W.........W',
      'W.........W',
      'W.........W',
      'WWWWW1WWWWW',
    ],
    ent: {
      1: warp('lanternrest', '3'),
      2: npc('maren', 'Archivist Maren', (g) => g.story.maren(g)),
      3: { starter: 'sproutle' }, 4: { starter: 'kindlit' }, 5: { starter: 'bublet' },
    },
  },

  dewpath: {
    name: 'Dewpath', biome: 'meadow', music: 'route',
    grid: [
      '###########N############',
      '########...=...,,,######',
      '######.....=...,,,,.####',
      '#####..,,,.=....,,,..###',
      '####..,,,,.=..........##',
      '####..,,,..==========.##',
      '###.........#####...=.##',
      '###..1.......###..4.=.##',
      '###.........,,,,....=.##',
      '##..####....,,,,,...=.##',
      '##..####..2.,,,,..===.##',
      '##........=========...##',
      '##.,,,....=...........##',
      '##.,,,,...=....####...##',
      '##.,,,,,..=....####.3.##',
      '##..,,,...=.....##....##',
      '###.......=..F.......###',
      '###..F....=......,,,.###',
      '####......=.....,,,,.###',
      '#####.....=.....,,,.####',
      '######....=.........####',
      '##########S#############',
    ],
    ent: {
      N: warp('thistlewick', 'S'), S: warp('lanternrest', '1'),
      1: item('nugget'), 3: item('salve', 2),
      2: trainer('kid', 'Lanternkid Ro', [['nibbin', 4]], 80, 'I caught mine yesterday! Yesterday!', 'Okay. You\'ve been at this since at least the day before yesterday.'),
      4: trainer('villager', 'Picker Anselm', [['fluttle', 4], ['mossmite', 5]], 120, 'Mind the long grass. Mind me, too.', 'The grass is kinder than you are.', { dir: 'right', sight: 2 }),
    },
    enc: { rate: 0.14, day: [['nibbin', 2, 5, 5], ['fluttle', 2, 5, 5], ['mossmite', 3, 5, 3]], night: [['nibbin', 3, 5, 3], ['mossmite', 3, 5, 3], ['gloomoth', 3, 6, 3], ['sparkit', 4, 6, 1]], rare: ['sparkit', 4, 6] },
    weather: [['rain', 2], [null, 8]],
  },

  thistlewick: {
    name: 'Thistlewick', biome: 'meadow', town: true, music: 'town',
    grid: [
      '########################',
      '###..HHHH....HHHHH..####',
      '###..HHHH....HHHHH..####',
      '###..H2HH....HH3HH...###',
      '##....=........=.....###',
      '##....==========.F....##',
      '##.F...=...4...=======6E',
      '##.....=.......=......##',
      '##..HHHHHH.....=...,,.##',
      '##..HHHHHH..5..=..,,,.##',
      '##..HHHHHH.....=..,,,.##',
      '##..HHGHHH.....=...7..##',
      '##....=........=......##',
      '###...==========....####',
      '######....=....#########',
      '##########S#############',
    ],
    ent: {
      S: warp('dewpath', 'N'), E: warp('murkroot', 'W'),
      2: hearth(), 3: market(), 4: post(), G: door('gym1', '0', { kind: 'gym' }),
      5: npc('kid', 'Tansy', async (g) => {
        if (g.has('q_clover_done')) return g.say('Tansy', 'My knot\'s working! Is it working? Tell me if it\'s working.');
        if (g.hasSpecies('mossmite') || g.hasSpecies('fungrove') || g.hasSpecies('thornox')) {
          await g.say('Tansy', 'You brought one! Look at the little thorns! Here, I tied this for you. Four leaves. I checked twice.');
          g.set('q_clover_done'); await g.give('luckcharm');
          await g.say('The Clover Knot adds 3% Fortune for as long as you carry it.');
          return;
        }
        g.set('q_clover');
        await g.say('Tansy', 'I collect thorns for luck. Could you show me a Mossmite? Or a Thornox? One with actual thorns?');
      }),
      6: gate('ranger', 'Ranger Hale', 'sigil1', 'Murkroot\'s not safe this week. Kith are going missing. Show me a Thistle Sigil and I\'ll believe you can look after yours.'),
      7: npc('villager', 'Gardener Lise', 'Bram waters the Sigil Hall every morning. The whole hall. He says the floor likes it.'),
    },
    enc: { rate: 0.12, day: [['mossmite', 5, 8, 5], ['fluttle', 5, 8, 4], ['sparkit', 6, 8, 1]], night: [['mossmite', 5, 8, 4], ['gloomoth', 6, 9, 4]] },
  },

  murkroot: {
    name: 'Murkroot Wood', biome: 'forest', music: 'forest',
    grid: [
      '##########################',
      '#####...,,,####....G######',
      '####..,,,,,.###..,,..#####',
      '###..,,,,....#..,,,,..####',
      '##...........#...,,....###',
      '##..##...2...##....6...###',
      'W=====...........###....##',
      '##...=....####...###....##',
      '##...=....####..........##',
      '###..=..,,.##....,,,....##',
      '###..=.,,,,......,,,,..###',
      '##...=..,,...3....,,...###',
      '##...==========........###',
      '##.7........##=....##...##',
      '##..,,,.....##=====##...##',
      '###.,,,,..........=..4.5.#',
      '###..,,,....###...=======E',
      '####.......####...,,,..###',
      '#####....#######..,,,.####',
      '##########################',
    ],
    ent: {
      W: warp('thistlewick', 'E'), E: warp('saltgate', 'W'),
      G: door('glowmoss', '1', { kind: 'cave', hide: (g) => !g.has('compass') }),
      2: trainer(SCRIBE, 'Scribe Ott', [['blotch', 9], ['nibbin', 9]], 220, 'This wood is being catalogued. Move along.', 'Catalogued! Not stolen! ...It is very similar, I admit.'),
      3: trainer(SCRIBE, 'Scribe Fenn', [['toxpole', 10], ['blotch', 10]], 240, 'A pressed Kith never gets sick. Never gets lost. You\'d thank us.', 'You\'d... not thank us. Noted.', { dir: 'left' }),
      4: { npc: SCRIBE, name: 'Scribe-Captain Rook', dir: 'left', sight: 0, hide: (g) => g.has('murk_done'), talk: (g) => g.story.rook(g) },
      5: npc('ranger', 'Ranger Hale', (g) => g.story.haleAfter(g), { hide: (g) => !g.has('murk_done') }),
      6: item('tonic'), 7: item('lantern', 3),
    },
    enc: { rate: 0.15, day: [['mossmite', 8, 12, 4], ['toxpole', 8, 12, 4], ['pebblit', 8, 12, 3], ['sparkit', 9, 12, 2], ['nibbin', 9, 12, 2]], night: [['gloomoth', 8, 12, 5], ['wispurr', 9, 13, 4], ['toxpole', 8, 12, 3]], rare: ['glimmet', 10, 12] },
    weather: [['rain', 3], [null, 6]],
  },

  glowmoss: {
    name: 'Glowmoss Hollow', biome: 'cave', indoor: true, cave: true, music: 'cave',
    grid: [
      'WWWWWWWWWWWWWWWWWW',
      'WWW....WWWW...2WWW',
      'WW......WW.....WWW',
      'W...*....o......WW',
      'W.......WW...*...W',
      'WW..3..WWWW......W',
      'WWW...WWWWWW..4..W',
      'WW.....WWWW.....WW',
      'W...*...........WW',
      'W......o...WW..WWW',
      'WW.1......WWWWWWWW',
      'WWWWWWWWWWWWWWWWWW',
    ],
    ent: {
      1: warp('murkroot', 'G'),
      2: { ...door('starfall', '1', { kind: 'cave' }), locked: (g) => !g.unlocked('starfall'), lockedText: 'A wall of crystal seals this passage. Stars are carved on it: wings, antlers, a halo, a map.\n(A card Constellation opens this door.)' },
      3: crate('silver'), 4: item('dusklantern', 2),
    },
    enc: { rate: 0.12, all: true, day: [['pebblit', 11, 14, 4], ['wispurr', 11, 14, 3], ['mindle', 11, 14, 3], ['blotch', 11, 14, 2]], rare: ['glimmet', 12, 14] },
  },

  starfall: {
    name: 'Starfall Hollow', biome: 'crystal', indoor: true, cave: true, music: 'cave',
    grid: [
      'WWWWWWWWWWWWWW',
      'WWW...**...WWW',
      'WW....2.....WW',
      'W..*......*..W',
      'W............W',
      'W...,,,,,,...W',
      'W..,,,,,,,,..W',
      'WW..,,,,,,..WW',
      'WWW...1....WWW',
      'WWWWWWWWWWWWWW',
    ],
    ent: {
      1: warp('glowmoss', '2'),
      2: legend('verdelune', 60, (g) => !g.has('got_verdelune'), 'Flowers open across the cave floor. Something steps out of the light.'),
    },
    enc: { rate: 0.12, day: [['glimmet', 40, 46, 4], ['halocorn', 44, 48, 1], ['cerebrix', 42, 46, 2], ['noctwing', 42, 46, 2]] },
  },

  saltgate: {
    name: 'Saltgate', biome: 'coast', town: true, music: 'town',
    grid: [
      '###########N############',
      '###........6........####',
      '##..HHHH...=...HHHHH..##',
      '##..HHHH...=...HHHHH..##',
      '##..H2HH...=...HH3HH..##',
      '##....=....=.....=....##',
      'W9=====4=========.....##',
      '##.........=..........##',
      '##..HHHHHH.=....F.....##',
      '##..HHHHHH.=..........##',
      '##..HHGHHH.=...5......##',
      '##....=....=..ssssssss##',
      '##....======.sssss,,,ss#',
      '##sssssss.=.ssss,,,,sss#',
      '~~~~~~~~~~b~~~~~~~~~~~~~',
      '~~~~~~~~~~b~~~~~~~~~~~~~',
      '~~~~~~~~bbbbb~~~~~~~~~~~',
      '~~~~~~~~b7.8b~~~~~~~~~~~',
    ],
    ent: {
      W: warp('murkroot', 'E'), N: warp('cindersteppe', 'S'),
      2: hearth(), 3: market(), 4: post(), G: door('gym2', '0', { kind: 'gym' }),
      5: npc('sailor', 'Dockhand Marl', async (g) => {
        if (g.has('q_gull_done')) return g.say('Dockhand Marl', 'I ate a whole sandwich today. Start to finish. I wept.');
        if (g.has('q_gull') && g.defeated('gullet') >= 3) { await g.say('Dockhand Marl', 'Three of them! The dock is ours again. Take this, off the last boat in.'); g.set('q_gull_done'); await g.giveCrate('silver'); return; }
        g.set('q_gull');
        await g.say('Dockhand Marl', `Gullets. They take lunches. Chase off three of them in the beach grass and I'll owe you.${g.defeated('gullet') ? ` (${g.defeated('gullet')}/3)` : ''}`);
      }),
      6: gate('sailor', 'Harbour Guard', 'sigil2', 'The steppe road is closed to anyone without a Brine Sigil. Warden Ines\'s orders. She\'s in the Hall.'),
      7: npc('villager', 'Old Brine', 'They leave the first catch of spring at the end of this pier. For the one whose breath is the tide. You\'ll meet it when you\'ve earned the right to stand here.', { hide: (g) => g.has('champion') }),
      8: legend('thalassyr', 60, (g) => g.has('champion') && !g.has('got_thalassyr'), 'The tide stops. The whole harbour holds its breath.'),
      9: npc('juno', 'Juno', (g) => g.story.juno2(g), { hide: (g) => g.has('juno2') }),
    },
    enc: { rate: 0.14, day: [['gullet', 14, 18, 5], ['shellusk', 14, 18, 4], ['toxpole', 14, 17, 2]], night: [['shellusk', 14, 18, 4], ['wispurr', 15, 18, 2], ['gullet', 14, 18, 3]], rare: ['corallure', 16, 18] },
    weather: [['rain', 3], [null, 5]],
  },

  cindersteppe: {
    name: 'Cinder Steppe', biome: 'volcanic', music: 'route',
    grid: [
      '###########N############',
      'ooooo......=......oooooo',
      'ooo...,,,..=..LL....oooo',
      'oo...,,,,..=..LLL....ooo',
      'oo....,,...=...LL..1..oo',
      'o..........=======....oo',
      'o...LL...........=.....o',
      'o..LLLL....ooo...=..,,.o',
      'o...LL.....ooo.2.=.,,,.o',
      'oo...............=..,,.o',
      'oo..3=============.....o',
      'oo...=....,,,.........oo',
      'o....=...,,,,,..LLL...oo',
      'o....=....,,,..LLLLL..oo',
      'o.4..=..........LLL....o',
      'o....=====.............o',
      'oo.......=...oooo..5.ooo',
      'oo..,,...=...oooo....ooo',
      'ooo.,,,..=.........ooooo',
      'oooo.....=.......ooooooo',
      'oooooo...=....oooooooooo',
      '#########S##############',
    ],
    ent: {
      S: warp('saltgate', 'N'), N: warp('ashenforge', 'S'),
      1: legend('pyraclast', 60, (g) => g.has('champion') && !g.has('got_pyraclast'), 'The ground is hot through your boots. Something under the steppe turns over.'),
      2: trainer('smith', 'Smelter Dag', [['magmite', 22], ['cogling', 23]], 520, 'Hot enough for you? It gets hotter.', 'I\'ve been tempered. That\'s the word for it.', { dir: 'right' }),
      3: trainer('villager', 'Drifter Yew', [['dustail', 23], ['scrapup', 23], ['galewing', 24]], 560, 'Nobody walks the steppe for fun.', 'You do, apparently.', { dir: 'right', sight: 1 }),
      4: item('elixir'), 5: crate('basic'),
    },
    enc: { rate: 0.14, day: [['magmite', 20, 25, 5], ['dustail', 20, 25, 5], ['scrapup', 21, 25, 3], ['cogling', 21, 25, 2]], night: [['magmite', 20, 25, 4], ['dustail', 20, 25, 3], ['blotch', 21, 25, 3]], rare: ['wyrmlet', 22, 25] },
    weather: [['sun', 4], ['dust', 2], [null, 4]],
  },

  ashenforge: {
    name: 'Ashenforge', biome: 'volcanic', town: true, music: 'town',
    grid: [
      'oooooooooooooooooooooooo',
      'ooo..HHHH....HHHHH..oooo',
      'oo...HHHH....HHHHH...ooo',
      'oo...H2HH....HH3HH...ooo',
      'o.....=........=......oo',
      'W6=====4========.......o',
      'o..........=...........o',
      'o..HHHHHH..=..HHHHHHH..o',
      'o..HHHHHH..=..HHHHHHH..o',
      'o..HHHHHH..=..HHHHHHH..o',
      'o..HHGHHH..=..HHHPHHH..o',
      'o....=.....=.....=..5..o',
      'oo...===========.=....oo',
      'ooo.......=......=...ooo',
      'oooo......=....7....oooo',
      '##########S#############',
    ],
    ent: {
      S: warp('cindersteppe', 'N'), W: warp('frostspire', 'E'),
      2: hearth(), 3: market(), 4: post(), G: door('gym3', '0', { kind: 'gym' }),
      P: { ...door('pressworks', '1', { kind: 'factory' }), locked: (g) => !g.has('presspass'), lockedText: 'A steel door with a card reader. From inside: the thump of a press, over and over.' },
      5: npc('smith', 'Forgehand Brix', async (g) => {
        if (g.has('q_fuel_done')) return g.say('Forgehand Brix', 'Hottest the forge has run in years. Your Magmite is welcome any time.');
        if (g.hasSpecies('magmite') || g.hasSpecies('calderon')) { await g.say('Forgehand Brix', 'Let it sit by the bellows a minute... there. Feel that? Take this, it came out of the slag this morning.'); g.set('q_fuel_done'); await g.give('dawnshard'); return; }
        g.set('q_fuel');
        await g.say('Forgehand Brix', 'The forge is running cold. Bring a Magmite by, let it warm the bellows, and I\'ll make it worth the walk.');
      }),
      6: gate('smith', 'Gatewright', 'press_done', 'Pass road\'s shut while the Pressworks is running. Half the town works there now. Nobody likes it.'),
      7: npc('villager', 'Ashwife Thea', 'My Sparkit went to the Pressworks "for registration". They gave me a card with her picture on it. It purrs if you hold it. It isn\'t her.'),
    },
    enc: { rate: 0.1, day: [['magmite', 24, 27, 4], ['cogling', 24, 27, 3]] },
    weather: [['sun', 3], [null, 5]],
  },

  pressworks: {
    name: 'The Pressworks', biome: 'factory', indoor: true, cave: true, music: 'hollow',
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'W....mm......mm..7.W',
      'W..5.mm..6...mm....W',
      'W........WW........W',
      'WWWW..WWWWWWWW..WWWW',
      'W......m....m......W',
      'W..4...m....m...8..W',
      'W..................W',
      'WWWWWWW..WW..WWWWWWW',
      'W.....m......m.....W',
      'W..2..m......m..3..W',
      'W..................W',
      'W.mm............mm.W',
      'W.mm.....1......mm.W',
      'WWWWWWWWW1WWWWWWWWWW',
    ],
    ent: {
      1: warp('ashenforge', 'P'),
      2: trainer(SCRIBE, 'Scribe Lund', [['cogling', 27], ['blotch', 27]], 640, 'Authorised staff only. You don\'t look authorised.', 'You look... very authorised. Carry on.', { dir: 'right' }),
      3: trainer(SCRIBE, 'Scribe Peri', [['mindle', 27], ['urnling', 28]], 660, 'Each card is one less thing to worry about.', 'I have several new things to worry about.', { dir: 'left' }),
      4: trainer(SCRIBE, 'Scribe Hask', [['toxpole', 28], ['miasmander', 29], ['blotch', 28]], 700, 'The press never sleeps. Neither do I. It\'s awful.', 'Maybe I\'ll sleep now.', { dir: 'right' }),
      5: crate('golden'),
      6: { npc: 'sable', name: 'Registrar Sable', dir: 'down', sight: 0, hide: (g) => g.has('press_done'), talk: (g) => g.story.sable(g) },
      7: legend('nullith', 70, (g) => g.unlocked('nullith') && !g.has('got_nullith'), 'A stack of pressed cards shivers, folds, and stands up.'),
      8: item('fullrestore'),
    },
    enc: { rate: 0.1, all: true, day: [['cogling', 26, 29, 4], ['blotch', 26, 29, 3], ['mindle', 26, 29, 2], ['urnling', 26, 29, 2]] },
  },

  frostspire: {
    name: 'Frostspire Pass', biome: 'snow', music: 'route',
    grid: [
      '##########################',
      '####....,,,,...#####...###',
      '###...,,,,,,....###..1..##',
      '##.....,,,,..........o..##',
      '##..~~~......###.........#',
      'W===~~~===...###....,,,..#',
      '##..~~~..=.........,,,,,.#',
      '##.......=..2.......,,,..#',
      '###......=...............#',
      '####..o..==========......#',
      '###......3........=......#',
      '##..,,,...........=..###.#',
      '##.,,,,,....~~~~..=..###.#',
      '##..,,,.....~~~~..=......#',
      '###.........~~~~..=====4=E',
      '####..5...........o...####',
      '##########################',
    ],
    ent: {
      E: warp('ashenforge', 'W'), W: warp('glimmerhold', 'E'),
      1: crate('silver'), 5: item('rekindle'),
      2: trainer('ranger', 'Skier Brit', [['shivver', 32], ['gullet', 32], ['shivver', 33]], 820, 'Fresh snow! Fresh opponent!', 'Fresh loss. Still a nice day.'),
      3: trainer('villager', 'Hermit Olwen', [['bouldrum', 33], ['cerebrix', 34]], 860, 'Shh. The aurora\'s coming. Or a battle. One of the two.', 'It was the battle. Come back when the sky is lit; there\'s a Kith here that only shows then.', { dir: 'right' }),
      4: trainer('ranger', 'Climber Joss', [['brawlord', 34], ['glaciore', 36]], 900, 'Top of the pass. One more push.', 'You pushed.', { dir: 'left', sight: 2 }),
    },
    enc: { rate: 0.14, day: [['shivver', 30, 35, 5], ['bouldrum', 30, 35, 3], ['mindle', 30, 34, 2], ['galewing', 31, 35, 2]], night: [['shivver', 30, 35, 4], ['hauntail', 31, 35, 2], ['noctwing', 31, 35, 2]], rare: ['wyrmlet', 30, 34], aurora: ['auroryx', 34, 38] },
    weather: [['sleet', 5], [null, 3]], aurora: true,
  },

  glimmerhold: {
    name: 'Glimmerhold', biome: 'snow', town: true, music: 'town',
    grid: [
      '###########N############',
      '###..**....6....**..####',
      '##..HHHH...=...HHHHH..##',
      '##..HHHH...=...HHHHH..##',
      '##..H2HH...=...HH3HH..##',
      '##....=....=.....=....##',
      'W7=====4===============E',
      '##.........=..........##',
      '##..HHHHHH.=....*.....##',
      '##..HHHHHH.=..5.......##',
      '##..HHHHHH.=......9...##',
      '##..HHGHHH.=....,,,,..##',
      '##....=....=...,,,,,..##',
      '##....======....,,,..###',
      '###................#####',
      '########################',
    ],
    ent: {
      E: warp('frostspire', 'W'), N: warp('sunkencrypt', 'S'), W: warp('concord', 'E'),
      2: hearth(), 3: market(), 4: post(), G: door('gym4', '0', { kind: 'gym' }),
      5: npc('villager', 'Dairywife Enna', async (g) => {
        if (g.has('q_cold_done')) return g.say('Dairywife Enna', 'Butter keeps till midsummer now. Bless that great cold lump.');
        if (g.hasSpecies('glaciore')) { await g.say('Dairywife Enna', 'Oh, it\'s a big one! Just let it stand in the cellar a moment... lovely. This is for you.'); g.set('q_cold_done'); await g.giveCrate('golden'); return; }
        g.set('q_cold');
        await g.say('Dairywife Enna', 'Cellar\'s gone warm. If you ever raise a Glaciore, bring it by? Shivver grow into them around level 36.');
      }),
      6: gate('ranger', 'Crypt Warden', 'cryptkey', 'This road goes down to the Sunken Crypt. Nobody passes without the Crypt Seal, and only Isolde gives those.'),
      7: gate('ranger', 'Plateau Guide', 'story_done', 'Concord Plateau is for Wardens who\'ve finished what they started. Come back when the Crypt is settled.'),
      9: npc('juno', 'Juno', (g) => g.story.juno3(g), { hide: (g) => g.has('juno3') }),
    },
    enc: { rate: 0.12, day: [['shivver', 33, 37, 4], ['glaciore', 36, 38, 1], ['cerebrix', 34, 37, 2]], aurora: ['auroryx', 36, 40] },
    weather: [['sleet', 4], [null, 4]], aurora: true,
  },

  sunkencrypt: {
    name: 'The Sunken Crypt', biome: 'crypt', indoor: true, cave: true, music: 'hollow',
    grid: [
      'WWWWWWWWWWWWWWWWWWWW',
      'WWWWWW...6....WWWWWW',
      'WWWW..p......p..WWWW',
      'WWW......5.......WWW',
      'WWW..p........p..WWW',
      'WWWW............WWWW',
      'WWWWWWWW....WWWWWWWW',
      'W......W....W......W',
      'W..3...W....W...4..W',
      'W..................W',
      'W..p....p..p....p..W',
      'W..................W',
      'WWWW...WWWWWW...WWWW',
      'W......W....W......W',
      'W.7....W....W....8.W',
      'W..................W',
      'W..p..2......1..p..W',
      'W..................W',
      'WWWWWWWWW.SWWWWWWWWW',
    ],
    ent: {
      S: warp('glimmerhold', 'N'),
      1: trainer(SCRIBE, 'Scribe Vell', [['hauntail', 40], ['umbrink', 41]], 1200, 'The Curator is at the altar. He asked not to be disturbed.', 'He will be disturbed.', { dir: 'left' }),
      2: trainer(SCRIBE, 'Scribe Noor', [['sarcophant', 41], ['cerebrix', 41], ['gearhulk', 42]], 1300, 'After tonight nothing will ever be lost again.', 'Something just was.', { dir: 'right' }),
      3: crate('golden'), 4: item('fullrestore', 2), 7: item('rekindle', 2), 8: item('duskshard'),
      5: { npc: 'vane', name: 'Curator Vane', dir: 'down', sight: 0, hide: (g) => g.has('story_done'), talk: (g) => g.story.vane(g) },
      6: legend('mnemora', 55, (g) => g.has('story_done') && !g.has('got_mnemora'), 'Mnemora turns to you. It already remembers this moment.'),
    },
    enc: { rate: 0.1, all: true, day: [['urnling', 38, 42, 4], ['hauntail', 38, 42, 3], ['blotch', 38, 42, 2], ['cerebrix', 39, 42, 2]], rare: ['sarcophant', 40, 43] },
  },

  concord: {
    name: 'Concord Plateau', biome: 'meadow', town: true, music: 'town',
    grid: [
      '######################',
      '###..HHHHH...HHHHH..##',
      '##...HHHHH...HHHHH...#',
      '##...HHTHH...HHXHH...#',
      '##.....=.......=.....#',
      '##..4..=========.....#',
      '##.........=.........E',
      '##..HHHH...=...HHHH..#',
      '##..H2HH...=...HH3H..#',
      '##....=....=....=....#',
      '##....===========....#',
      '##...................#',
      '##..,,,,,.....,,,,,..#',
      '##.,,,,,,,...,,,,,,,.#',
      '###.,,,,,.....,,,,,.##',
      '######################',
    ],
    ent: {
      E: warp('glimmerhold', 'W'),
      2: hearth(), 3: market(), 4: post(),
      T: { door: 1, kind: 'gym', on: (g) => g.story.trial(g) },
      X: { door: 1, kind: 'tower', on: (g) => g.story.tower(g) },
    },
    enc: { rate: 0.14, day: [['galewing', 44, 50, 4], ['voltigre', 44, 50, 3], ['quakodile', 44, 50, 3], ['brawlord', 44, 50, 3], ['fungrove', 44, 50, 2]], night: [['noctwing', 44, 50, 4], ['hauntail', 44, 50, 3], ['voltigre', 44, 50, 3]], rare: ['drakonid', 46, 50] },
    weather: [['rain', 2], ['sun', 2], [null, 5]], aurora: true,
  },
};

// Sigil Halls share one floor plan.
const GYM_GRID = [
  'WWWWWWWWWWWWW',
  'W.....3.....W',
  'W...........W',
  'W..p.....p..W',
  'W.......2...W',
  'W...........W',
  'W..p.....p..W',
  'W...1.......W',
  'W...........W',
  'W...........W',
  'WWWWWW0WWWWWW',
];
function gym(n, town, doorChar, biome, t1, t2) {
  MAPS['gym' + n] = {
    name: `${MAPS[town].name} Sigil Hall`, biome, indoor: true, music: 'gym', grid: GYM_GRID,
    ent: {
      0: warp(town, doorChar),
      1: trainer(t1[0], t1[1], t1[2], t1[3], t1[4], t1[5], { dir: 'right', sight: 4 }),
      2: trainer(t2[0], t2[1], t2[2], t2[3], t2[4], t2[5], { dir: 'left', sight: 4 }),
      3: { npc: 'villager', name: '', dir: 'down', sight: 0, talk: (g) => g.story.leader(g, n) },
    },
  };
}
gym(1, 'thistlewick', 'G', 'gymgrass',
  ['kid', 'Sprout Scout Emi', [['mossmite', 9], ['sproutle', 9]], 200, 'Bram says I\'m nearly ready! Nearly!', 'Nearly is a long word.'],
  ['villager', 'Gardener Roan', [['mossmite', 10], ['mossmite', 10]], 220, 'Wipe your boots. The floor likes clean boots.', 'The floor forgives you.']);
gym(2, 'saltgate', 'G', 'gymwater',
  ['sailor', 'Deckhand Suri', [['gullet', 17], ['toxpole', 17]], 400, 'Mind the wet floor! That\'s the whole challenge!', 'You minded it.'],
  ['sailor', 'Bosun Calder', [['shellusk', 18], ['rippler', 18]], 440, 'Ines sails at dawn. Beat me before she\'s back.', 'She\'s back. Good luck.']);
gym(3, 'ashenforge', 'G', 'gymfire',
  ['smith', 'Striker Ode', [['magmite', 25], ['scorchel', 25]], 620, 'Hammer first, questions never.', 'I have questions.'],
  ['smith', 'Bellows Anka', [['magmite', 26], ['calderon', 33]], 680, 'Kiln\'s in a mood. So am I.', 'Mood improved, oddly.']);
gym(4, 'glimmerhold', 'G', 'gymice',
  ['ranger', 'Lookout Finn', [['shivver', 34], ['glaciore', 36]], 900, 'Cold enough to think clearly. Are you?', 'Clear as ice.'],
  ['ranger', 'Sentinel Mara', [['drakonid', 35], ['glaciore', 36]], 960, 'Isolde guards the Crypt road. I guard Isolde.', 'She\'ll want to meet you.']);

export const LEADERS = {
  1: { look: 'bram', name: 'Warden Bram', party: [['mossmite', 11], ['sproutle', 12], ['thornox', 14]], sigil: 'Thistle Sigil', card: 'a-sigil1', own: 'c-bram', reward: 800,
    before: 'Ah! A new face. The hall\'s been telling me someone was coming. Let\'s see what\'s growing in you.', after: 'Well grown. The Thistle Sigil is yours. Ranger Hale will let you into Murkroot now. Be careful in there; the wood\'s gone quiet, and woods shouldn\'t.' },
  2: { look: 'ines', name: 'Warden Ines', party: [['gullet', 19], ['shellusk', 20], ['toxpole', 20], ['rippler', 22]], sigil: 'Brine Sigil', card: 'a-sigil2', own: 'c-ines', reward: 1400,
    before: 'You came through Murkroot? Then you\'ve met the Ledger. I\'ve been watching crates of blank cards go north for a month. Show me you can do something about it.', after: 'You can. Take the Brine Sigil. The cards are going to Ashenforge, to something called the Pressworks. Kiln will know more.' },
  3: { look: 'kiln', name: 'Warden Kiln', party: [['magmite', 27], ['scorchel', 28], ['cogling', 28], ['calderon', 33]], sigil: 'Kiln Sigil', card: 'a-sigil3', own: 'c-kiln', reward: 2000,
    before: 'THEY BUILT IT IN MY TOWN. A press. For Kith. I\'d have torn it down myself but they have half my forge hands on the payroll. Prove you\'re hotter than I am and I\'ll hand you the way in.', after: 'HA! Good. Kiln Sigil. And this: a Pressworks Pass, lifted off a Scribe who was rude to my Calderon. East building. Go and break something.' },
  4: { look: 'isolde', name: 'Warden Isolde', party: [['glaciore', 37], ['drakonid', 37], ['auroryx', 38], ['glaciore', 40]], sigil: 'Rime Sigil', card: 'a-sigil4', own: 'c-isolde', reward: 2800,
    before: 'Vane came through three days ago with forty Scribes. I could not stop forty. I can make sure whoever follows him is strong enough to matter.', after: 'You matter. The Rime Sigil, and the Crypt Seal. He means to press Mnemora. If he does, every memory in Vael belongs to him. Go north.' },
};
for (const n in LEADERS) MAPS['gym' + n].ent[3].npc = LEADERS[n].look, MAPS['gym' + n].ent[3].name = LEADERS[n].name;
for (const id in MAPS) MAPS[id].id = id;
export const TOWNS = ['lanternrest', 'thistlewick', 'saltgate', 'ashenforge', 'glimmerhold', 'concord'];
export const WALKABLE = new Set('.,=Fsb_'.split(''));
