// Wallet & Treasury panel. Everything here is optional and read-only.
import { G } from '../game.js';
import { discoverWallets, connectWallet, disconnectWallet, proveOwnership, ownershipStatement } from '../solana/wallet.js';
import { readTreasury, ALLOCATION_LABELS, DEFAULT_ALLOCATION, LAMPORTS } from '../solana/treasury.js';
import { panel, el, toast } from './ui.js';
import { sfx } from '../core/audio.js';

let conn = null, treasury = null;
const short = (a) => a.slice(0, 4) + '…' + a.slice(-4);
const sol = (l) => (l / LAMPORTS).toLocaleString(undefined, { maximumFractionDigits: 4 }) + ' SOL';

export const Chain = {
  open() {
    return panel('Wallet & Treasury', (body, api) => {
      const s = G.s, cfg = G.config.solana || {}, rewards = G.config.rewards || {};
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'You do not need a wallet'),
        el('p', { class: 'note' }, 'Cryptwild plays the same with or without one. Connecting only lets the game show your address and, if chain-backed card editions are ever switched on, know where to send ones you have earned. The game will never ask for a seed phrase or private key, and it never sends transactions.')));
      // wallet
      const wbox = el('div', { class: 'card-box' }, el('h3', {}, 'Wallet'));
      if (conn) {
        wbox.append(el('dl', { class: 'kv' }, el('dt', {}, 'Wallet'), el('dd', {}, conn.name), el('dt', {}, 'Address'), el('dd', { style: { wordBreak: 'break-all' } }, conn.address),
          el('dt', {}, 'Ownership'), el('dd', {}, s.wallet && s.wallet.address === conn.address && s.wallet.verified ? 'Proved by signature ✔' : 'Not yet proved')),
          el('div', { class: 'btnrow' },
            el('button', { class: 'btn', onclick: async () => {
              try {
                const nonce = crypto.getRandomValues(new Uint32Array(2)).join('');
                const res = await proveOwnership(conn, ownershipStatement(conn.address, nonce));
                if (res.verified === false) return toast('The signature did not verify.');
                s.wallet = { address: conn.address, name: conn.name, verified: res.verified === true, at: Date.now() };
                sfx('select'); toast(res.verified ? 'Signature verified.' : 'Signed. This browser cannot verify Ed25519 locally.'); G.save(); api.redraw();
              } catch (e) { toast(e.message || 'Signing was cancelled.'); }
            } }, 'Prove ownership (sign a message)'),
            el('button', { class: 'btn alt', onclick: async () => { await disconnectWallet(conn); conn = null; s.wallet = null; G.save(); api.redraw(); } }, 'Disconnect')));
      } else {
        const found = discoverWallets();
        if (s.wallet) wbox.append(el('p', { class: 'note' }, `Last connected: ${short(s.wallet.address)} (${s.wallet.name}). Reconnect to use it this session.`));
        if (!found.length) wbox.append(el('p', { class: 'note' }, 'No Solana wallet was detected in this browser. If you want one, install a wallet extension or open this page in a wallet app\'s browser, then reopen this panel.'));
        for (const w of found) wbox.append(el('button', { class: 'row-item', onclick: async () => { try { conn = await connectWallet(w); sfx('select'); api.redraw(); } catch (e) { toast(e.message || 'Connection was cancelled.'); } } }, el('div', { class: 'grow' }, `Connect ${w.name}`, el('small', {}, 'Your wallet will ask you to approve.'))));
      }
      body.append(wbox);
      // treasury
      const tbox = el('div', { class: 'card-box' }, el('h3', {}, 'Reward treasury'));
      const alloc = cfg.allocation || DEFAULT_ALLOCATION;
      if (!cfg.treasuryAddress) tbox.append(el('p', { class: 'note' }, el('b', {}, 'No treasury is configured. No rewards are funded.'), ' When the project token launches, a share of its trading fees is intended to flow to a public treasury address shown here, with its live balance. Until an address appears here, nothing is promised and nothing is owed.'));
      else if (!treasury) { tbox.append(el('p', { class: 'note' }, 'Reading the treasury from the Solana network…')); readTreasury(cfg).then((t) => { treasury = t; if (document.body.contains(tbox)) api.redraw(); }); }
      else if (treasury.status === 'error') tbox.append(el('p', { class: 'note' }, `Could not read the treasury: ${treasury.error}`), el('button', { class: 'btn alt', onclick: () => { treasury = null; api.redraw(); } }, 'Try again'));
      else if (treasury.status === 'ok') {
        tbox.append(el('dl', { class: 'kv' }, el('dt', {}, 'Address'), el('dd', { style: { wordBreak: 'break-all' } }, cfg.treasuryAddress), el('dt', {}, 'Balance'), el('dd', {}, el('b', {}, sol(treasury.lamports))), el('dt', {}, 'Fee source'), el('dd', {}, cfg.feeSource || 'not stated'), el('dt', {}, 'Read at'), el('dd', {}, new Date(treasury.fetchedAt).toLocaleTimeString())),
          el('h3', { style: { marginTop: '12px' } }, 'How the current balance is earmarked'),
          el('dl', { class: 'kv' }, ...Object.keys(ALLOCATION_LABELS).flatMap((k) => [el('dt', {}, `${ALLOCATION_LABELS[k]} (${alloc[k]}%)`), el('dd', {}, sol(treasury.budget[k]))])),
          el('h3', { style: { marginTop: '12px' } }, 'Recent transactions'),
          ...(treasury.recent.length ? treasury.recent.map((r) => el('div', { class: 'note', style: { wordBreak: 'break-all' } }, `${r.time ? new Date(r.time).toLocaleString() : 'pending'} · ${r.signature.slice(0, 20)}…${r.failed ? ' (failed)' : ''}`)) : [el('p', { class: 'note' }, 'None yet.')]),
          el('button', { class: 'btn alt', style: { marginTop: '10px' }, onclick: () => { treasury = null; api.redraw(); } }, 'Refresh'));
      }
      tbox.append(el('p', { class: 'note' }, 'Shares are configuration, not guarantees, and can change. Budgets are computed from the balance actually held: the game never promises a reward the treasury cannot pay. Token price and future fees are not rewards.'));
      body.append(tbox);
      body.append(el('div', { class: 'card-box' }, el('h3', {}, 'Chain-backed card editions'),
        el('p', { class: 'note' }, rewards.paused === false && rewards.legalReviewRef ? 'Distributions are enabled by the operator.' : el('b', {}, 'Not active.'), ' Standard cards stay in your save file. A separate tier of cards minted on Solana is designed but switched off until the fee route, the randomness provider and a legal review are in place. Nothing you do in the game today creates a claim to one.')));
    });
  },
};
