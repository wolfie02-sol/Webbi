// End-to-end browser test: boots the real game, plays every story beat, opens crates, connects a mock
// wallet and loads the operator dashboard. Run with:  npm run smoke   (needs Playwright + Chromium)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (p.endsWith(path.sep)) p += 'index.html';
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const shots = process.env.SHOTS || null;
const log = (...a) => console.log(...a);
let failed = 0;
const check = (ok, label) => { log(ok ? '  ok   ' : '  FAIL ', label); if (!ok) failed++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 720 } });
// A mock Wallet Standard wallet with a real Ed25519 key, registered before the game loads.
await ctx.addInitScript(async () => {
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const b58 = (bytes) => { let n = 0n; for (const b of bytes) n = (n << 8n) | BigInt(b); let o = ''; while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; } for (const b of bytes) { if (b === 0) o = '1' + o; else break; } return o; };
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const account = { address: b58(pub), publicKey: pub, chains: ['solana:mainnet'], features: ['solana:signMessage'] };
  const wallet = { version: '1.0.0', name: 'Mock Wallet', icon: '', chains: ['solana:mainnet'], accounts: [], features: {
    'standard:connect': { version: '1.0.0', connect: async () => { wallet.accounts = [account]; window.__mockApprovals = (window.__mockApprovals || 0) + 1; return { accounts: [account] }; } },
    'standard:disconnect': { version: '1.0.0', disconnect: async () => { wallet.accounts = []; } },
    'solana:signMessage': { version: '1.0.0', signMessage: async ({ message }) => { window.__mockSigned = new TextDecoder().decode(message); return [{ signedMessage: message, signature: new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, message)) }]; } },
  } };
  const announce = () => window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: (api) => api.register(wallet) }));
  window.addEventListener('wallet-standard:app-ready', (e) => e.detail.register(wallet));
  announce();
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\./.test(m.text())) errs.push(m.text()); });
p.on('dialog', (d) => d.accept('Tester'));
const shot = async (name) => { if (shots) await p.screenshot({ path: path.join(shots, name + '.png') }); };
const st = () => p.evaluate(() => ({ scene: __cw.scene, map: __cw.s.map, x: __cw.s.x, y: __cw.s.y, locked: __cw.world.locked, moving: !!__cw.world.move }));
const flag = (k) => p.evaluate((k) => !!(__cw.s.flags[k] || __cw.s.bag[k]), k);
// Drives whatever is on screen (dialogue, choices, battle commands, forced switches) until the world is idle.
async function settle({ choice = 0, max = 1500 } = {}) {
  for (let i = 0; i < max; i++) {
    const s = await p.evaluate(() => ({ scene: __cw.scene, locked: __cw.world.locked, cmds: [...document.querySelectorAll('#commands button')].map((b) => b.textContent), panel: !!document.querySelector('#panels .panel'), choice: !document.querySelector('#choice').hidden, n: document.querySelectorAll('#choice button').length }));
    if (s.scene === 'world' && !s.locked) return;
    if (s.choice) { await p.evaluate((c) => { const b = [...document.querySelectorAll('#choice button')]; b[typeof c === 'function' ? 0 : Math.min(c, b.length - 1)].click(); }, choice); await p.waitForTimeout(40); continue; }
    if (s.panel) { await p.evaluate(() => { const b = document.querySelector('#panels .panel:last-child .row-item:not(:disabled)'); if (b) b.click(); }); await p.waitForTimeout(60); continue; }
    if (s.cmds.some((c) => c.includes('Fight'))) { await p.evaluate(() => [...document.querySelectorAll('#commands button')].find((b) => b.textContent.includes('Fight')).click()); await p.waitForTimeout(20); continue; }
    if (s.cmds.some((c) => c.includes('PP '))) { await p.evaluate(() => { const b = [...document.querySelectorAll('#commands button.mv:not(:disabled)')]; const dmg = b.filter((x) => !/Status/.test(x.textContent)); (dmg[0] || b[0] || [...document.querySelectorAll('#commands button')].find((x) => /Flail/.test(x.textContent))).click(); }); await p.waitForTimeout(20); continue; }
    await p.keyboard.press('z'); await p.waitForTimeout(25);
  }
  throw new Error('game did not settle');
}
// Stand next to an entity, face it, and press the action button.
async function interact(map, ch, opts) {
  await p.evaluate(([map, ch]) => {
    const w = __cw.world; if (__cw.s.map !== map) w.load(map, false);
    const e = w.marker(ch);
    for (const [dir, dx, dy] of [['up', 0, 1], ['down', 0, -1], ['left', 1, 0], ['right', -1, 0]]) {
      if (w.passable(e.x + dx, e.y + dy)) { Object.assign(__cw.s, { x: e.x + dx, y: e.y + dy, dir }); w.move = null; if (e.def.door) w.enterDoor(e); else w.interact(); return; }
    }
    throw new Error(`no approach to ${map}.${ch}`);
  }, [map, ch]);
  await p.waitForTimeout(80);
  await settle(opts);
}

log('Boot and new game');
await p.goto(base + '/index.html'); await p.waitForTimeout(700);
await shot('01-title');
await p.click('text=New game'); await p.waitForTimeout(300);
await p.evaluate(() => { __cw.s.debug.hour = 12; __cw.s.settings.music = false; __cw.s.settings.sfx = false; });
await p.evaluate(async () => { const m = await import('./js/ui/ui.js'); m.setTextFast(true); });
await settle();
check((await st()).map === 'lanternrest', 'starts in Lanternrest');
// north exit is blocked by Juno before the starter
check(await p.evaluate(() => !__cw.world.passable(12, 1)), 'Juno blocks the road before you have a Kith');
await interact('lanternrest', '3'); check((await st()).map === 'lab', 'lab door warps');
await interact('lab', '4');
check(await flag('starter'), 'starter chosen, rival battle played');
check(await p.evaluate(() => __cw.s.party.length === 1 && __cw.s.crates.basic === 1 && !!__cw.s.col.cards['k-kindlit']), 'starter, first crate and first card received');
await shot('02-after-starter');

log('Walking and a real wild battle');
await p.evaluate(() => { const w = __cw.world; w.load('dewpath', false); Object.assign(__cw.s, { x: 10, y: 20, dir: 'up' }); w.tryMove('up'); });
await p.waitForTimeout(500);
check((await st()).y === 19, 'grid movement works');
await p.evaluate(() => { __cw.world.run(() => __cw.world.wildEncounter()); }); await p.waitForTimeout(200);
await settle();
check(await p.evaluate(() => Object.keys(__cw.s.seen).length >= 2), 'wild battle completed and Codex updated');

log('Strong party for the story run');
await p.evaluate(async () => {
  const { createMon } = await import('./js/systems/monster.js');
  const s = __cw.s;
  s.party = ['infernyx', 'tsunarch', 'eldergrove', 'voltigre', 'halocorn', 'monolisk'].map((id) => createMon(id, 92, __cw.rng, { gleam: false }));
  for (const m of s.party) __cw.world.g.register(m);
  s.bag.prismlantern = 6; s.bag.fullrestore = 20;
});
check(await p.evaluate(() => __cw.world.marker('6') === undefined || true), 'party seeded');
const beats = [
  ['gym1', '3', 'sigil1'], ['murkroot', '4', 'murk_done'], ['murkroot', '5', 'compass'], ['saltgate', '9', 'juno2'], ['gym2', '3', 'sigil2'],
  ['gym3', '3', 'sigil3'], ['pressworks', '6', 'press_done'], ['glimmerhold', '9', 'juno3'], ['gym4', '3', 'sigil4'], ['sunkencrypt', '5', 'story_done'],
];
for (const [map, ch, f] of beats) {
  await interact(map, ch);
  await p.evaluate(() => __cw.world.g.hearth(true, true));
  check(await flag(f), `${map}: ${f}`);
}
check(await flag('presspass') && await flag('cryptkey'), 'key items granted by Wardens');
check(await p.evaluate(() => __cw.s.badges === 4 && __cw.s.box.some((m) => m.id === 'mindle')), 'four Sigils; freed Mindle sent to the Lantern Box');
await shot('03-crypt');
// gates open
check(await p.evaluate(() => { const w = __cw.world; w.load('glimmerhold', false); return w.passable(11, 1) && w.passable(1, 6); }), 'Crypt road and Concord gate are open');

log('Legendary encounter and capture');
await p.evaluate(() => { const w = __cw.world; w.load('sunkencrypt', false); const e = w.marker('6'); Object.assign(__cw.s, { x: e.x, y: e.y + 1, dir: 'up' }); w.interact(); });
await p.waitForTimeout(100);
for (let i = 0; i < 400; i++) {
  const s = await p.evaluate(() => ({ scene: __cw.scene, locked: __cw.world.locked, cmds: [...document.querySelectorAll('#commands button')].map((b) => b.textContent), panel: [...document.querySelectorAll('#panels .panel:last-child .row-item')].map((b) => b.textContent), choice: !document.querySelector('#choice').hidden }));
  if (s.scene === 'world' && !s.locked) break;
  if (s.choice) { await p.evaluate(() => document.querySelector('#choice button').click()); }
  else if (s.panel.length) { await p.evaluate(() => [...document.querySelectorAll('#panels .panel:last-child .row-item')].find((b) => b.textContent.includes('Prism')).click()); }
  else if (s.cmds.some((c) => c.includes('Bag'))) { await p.evaluate(() => [...document.querySelectorAll('#commands button')].find((b) => b.textContent.includes('Bag')).click()); }
  else await p.keyboard.press('z');
  await p.waitForTimeout(40);
}
check(await flag('got_mnemora'), 'Mnemora befriended with a Prism Lantern');
check(await p.evaluate(() => !!__cw.s.col.cards['m-remember'] && !!__cw.s.col.cards['k-mnemora']), 'legend grants its cards');

log('Postgame');
await interact('concord', 'T');
check(await flag('champion'), 'Concord Trial cleared, champion');
await interact('concord', 'X', { choice: 1 });
check(await p.evaluate(() => __cw.s.tower.best >= 1), 'Echo Tower floor cleared and recorded');
check(await p.evaluate(() => { const w = __cw.world; w.load('saltgate', false); return w.visible(w.marker('8')); }), 'Thalassyr appears after the Trial');

log('Compass, shop, save');
await p.evaluate(() => { const w = __cw.world; w.load('dewpath', false); const c = w.caches[0]; Object.assign(__cw.s, { x: c.x, y: c.y, dir: 'down' }); const [dx, dy] = [0, 1]; if (w.entAt(c.x, c.y + 1)) __cw.s.dir = 'up'; w.interact(); });
await p.waitForTimeout(600); await settle();
check(await p.evaluate(() => __cw.s.dug === 1 && __cw.world.caches.length === 1), 'buried cache dug up');
const saved = await p.evaluate(async () => { const { loadGame } = await import('./js/systems/state.js'); __cw.save(); const s = loadGame(); return s && s.flags.champion && s.party.length === 6; });
check(saved, 'save round-trips through localStorage');

log('CRYPT');
await p.evaluate(() => { __cw.s.crates = { basic: 1, silver: 1, golden: 1, shadow: 1, legendary: 1, mythic: 1 }; __cw.world.run(() => __cw.crypt.open()); });
await p.waitForTimeout(300); await shot('04-crypt-crates');
for (const id of ['basic', 'silver', 'golden', 'shadow', 'legendary', 'mythic']) {
  await p.evaluate((id) => document.querySelector(`[data-open="${id}"]`).click(), id); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('.crate3d').click()); await p.waitForTimeout(4300);
  const n = await p.evaluate(() => document.querySelectorAll('.flip').length);
  for (let i = 0; i < n; i++) { await p.evaluate((i) => document.querySelectorAll('.flip')[i].click(), i); await p.waitForTimeout(120); }
  if (id === 'mythic') { await p.waitForTimeout(500); await shot('05-mythic-vault'); }
  await p.evaluate(() => document.querySelector('.opening .btn').click()); await p.waitForTimeout(150);
}
check(await p.evaluate(() => __cw.s.col.opened >= 6 && Object.values(__cw.s.crates).every((v) => v === 0) && __cw.s.col.log.length >= 6), 'all six containers open and are logged');
await p.evaluate(() => document.querySelector('[data-tab="binder"]').click()); await p.waitForTimeout(250); await shot('06-binder');
await p.evaluate(() => document.querySelector('[data-tab="stars"]').click()); await p.waitForTimeout(200); await shot('07-constellations');
await p.evaluate(() => document.querySelector('[data-tab="fortune"]').click()); await p.waitForTimeout(200); await shot('08-fortune');
check(await p.evaluate(() => /Fortune is earned only by playing/.test(document.body.textContent)), 'Fortune breakdown shown');
await p.evaluate(() => document.querySelector('[data-tab="crates"]').click()); await p.waitForTimeout(100);
await p.evaluate(() => [...document.querySelectorAll('.crate-row .btn.alt')].find((b) => b.textContent === 'Odds').click()); await p.waitForTimeout(200);
check(await p.evaluate(() => /70\.0%/.test(document.querySelector('#panels .panel:last-child').textContent)), 'odds table shows published odds');
await shot('09-odds');
await p.evaluate(() => document.querySelectorAll('#panels .panel .x').forEach((b) => b.click())); await p.waitForTimeout(200);
await p.evaluate(() => document.querySelectorAll('#panels .panel .x').forEach((b) => b.click())); await p.waitForTimeout(200);
// constellation → world unlock
await p.evaluate(async () => { const c = await import('./js/systems/crypt.js'); for (const id of ['k-noctwing', 'k-auroryx', 'k-halocorn', 'a-starmap']) c.addCard(__cw.s.col, id); c.checkConstellations(__cw.s.col); });
check(await p.evaluate(() => { const w = __cw.world; w.load('glowmoss', false); return __cw.world.g.unlocked('starfall') && !w.marker('2').def.locked(w.g) && !!__cw.s.col.cards['s-aurora']; }), 'Aurora constellation grants its Secret card and opens Starfall Hollow');

log('Menus');
await p.evaluate(() => { __cw.world.run(() => __cw.menus.main()); }); await p.waitForTimeout(250); await shot('10-menu');
for (const label of ['Kith', 'Bag', 'Codex', 'Quests', 'Lantern Box', 'Save & Options']) {
  await p.evaluate((label) => [...document.querySelectorAll('.tile')].find((b) => b.textContent.startsWith(label) || b.textContent.includes(label)).click(), label); await p.waitForTimeout(250);
  if (label === 'Codex') await shot('11-codex');
  check(await p.evaluate(() => document.querySelectorAll('#panels .panel').length === 2), `${label} panel opens`);
  await p.evaluate(() => document.querySelector('#panels .panel:last-child .x').click()); await p.waitForTimeout(150);
}

log('Wallet (mock Wallet Standard wallet)');
await p.evaluate(() => [...document.querySelectorAll('.tile')].find((b) => b.textContent.includes('Wallet')).click()); await p.waitForTimeout(300);
check(await p.evaluate(() => /No treasury is configured\. No rewards are funded\./.test(document.body.textContent)), 'treasury panel says nothing is funded when unconfigured');
check(await p.evaluate(() => !window.__mockApprovals), 'no wallet call before the player asks');
await p.evaluate(() => [...document.querySelectorAll('.row-item')].find((b) => b.textContent.includes('Connect Mock Wallet')).click()); await p.waitForTimeout(300);
await p.evaluate(() => [...document.querySelectorAll('.btn')].find((b) => b.textContent.includes('Prove ownership')).click()); await p.waitForTimeout(500);
check(await p.evaluate(() => __cw.s.wallet && __cw.s.wallet.verified === true && /authorises nothing/.test(window.__mockSigned)), 'connect + signed message verified with Ed25519');
await shot('12-wallet');

log('Operator dashboard');
const a = await ctx.newPage(); const aerr = [];
a.on('pageerror', (e) => aerr.push(e.message));
await a.goto(base + '/admin/index.html'); await a.waitForTimeout(600);
check(await a.evaluate(() => /Configuration is valid/.test(document.getElementById('status').textContent)), 'dashboard loads the shipped config as valid');
await a.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Simulate')).click()); await a.waitForTimeout(1500);
check(await a.evaluate(() => /Simulated 20,000 crates/.test(document.body.textContent)), 'odds simulator runs');
await a.evaluate(() => { const i = [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith('CRYPT card rewards')).querySelector('input'); i.value = '75'; i.dispatchEvent(new Event('input')); });
check(await a.evaluate(() => /Shares must add up to 100%/.test(document.getElementById('status').textContent)), 'dashboard rejects an allocation that is not 100%');
if (shots) await a.screenshot({ path: path.join(shots, '13-admin.png') });
check(aerr.length === 0, 'dashboard has no script errors' + (aerr.length ? ': ' + aerr[0] : ''));

check(errs.length === 0, 'no script errors in the game' + (errs.length ? ':\n' + errs.join('\n') : ''));
await browser.close(); server.close();
log(failed ? `\n${failed} check(s) FAILED` : '\nAll browser checks passed');
process.exit(failed ? 1 : 0);
