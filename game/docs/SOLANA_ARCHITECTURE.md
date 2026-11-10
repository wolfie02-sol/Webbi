# Solana architecture — treasury, fee routing, randomness, on-chain cards

Status key: **BUILT** = in this repo and tested; **DESIGN** = specified here, not built;
**UNVERIFIED** = a claim taken from public sources in November 2026 that must be re-checked against the
platform's own documentation and tested on devnet/mainnet before anyone relies on it.

Nothing in this document is a promise of rewards. The reward budget is whatever the treasury actually
holds.

## 1. The hard fact about "trading fees"

Solana has no universal trading tax. A token only produces fee revenue through one of these mechanisms:

| Mechanism | How fees reach you | Caveats |
|---|---|---|
| **A. Launchpad creator fees** (pump.fun/PumpSwap, Meteora DBC-based launchpads such as Bags or Jupiter Studio, Raydium LaunchLab-based launchpads) | The platform splits each swap fee; the creator share accrues in a platform account and is **claimed** by the creator wallet (or by wallets set in a fee-sharing config). | Rates and rules are set by the platform and have changed several times. Fees only accrue on that platform's pools, not on every venue. **UNVERIFIED** details below. |
| **B. Token-2022 transfer-fee extension** | A percentage of every transfer (including swaps) is withheld in recipient token accounts; a *withdraw-withheld authority* harvests it. | Fees arrive in the project token, not SOL. Not every DEX/pool type supports transfer-fee mints, quotes can be off, and most launchpads do not mint Token-2022 transfer-fee tokens. Many traders avoid taxed tokens. |
| **C. Own the liquidity** | The project holds the LP position (e.g. a Meteora DAMM v2 or Raydium CLMM position) and claims LP fees. | Requires capital and active management; fees are in both pool tokens. |
| **D. Manual funding** | The team sends funds to the treasury. | Always works; relies on the team. |

What public sources said in November 2026 (**UNVERIFIED** — re-check before launch):

- pump.fun: PumpSwap introduced creator revenue sharing in May 2025 (reported as 0.05% of each trade, in
  SOL). In January 2026 pump.fun added creator **fee sharing**: the creator fee can be split across up to
  10 wallets, and in March 2026 it limited deployers to a single post-launch change of that split.
  Sources: The Block (2025-05-13, 2026-01-09), Cointelegraph. No official claim-flow documentation was
  found in search, so the claim instruction must be confirmed from pump.fun's own docs/IDL.
- Meteora Dynamic Bonding Curve: trading fees are configurable with protocol/partner/creator splits; the
  creator claims with `claim_creator_trading_fee`; after migration the creator can claim fees from locked
  LP on DAMM. Source: docs.meteora.ag.
- Token-2022 transfer fees: withheld amounts sit on recipient accounts and are harvested to the mint, then
  withdrawn by the withdraw authority. Raydium documents CPMM and CLMM support for transfer-fee mints; AMM
  v4 does not support Token-2022. Sources: solana-program.com Token-2022 docs, docs.raydium.io.

### Recommendation

1. Use **mechanism A** on whichever launchpad the token is launched on, with the **treasury address set as
   a fee-sharing recipient** (pump.fun) or as the creator/fee-claimer (DBC). This is the only approach that
   needs no custom on-chain program and no tax on holders.
2. If the launchpad cannot route to a second wallet, the creator wallet claims and forwards to the
   treasury on a schedule; every forward is public and shown in the game.
3. Do **not** use a Token-2022 transfer tax unless the launch is deliberately built around it.
4. The game never assumes which one is in use: `live-config.json → solana.feeSource` is a label plus an
   address list. The game only reads what actually arrived in the treasury.

**Decision needed from the project owner:** which launchpad. Until then `solana.treasuryAddress` is empty
and the game shows "No treasury configured — no rewards are funded."

## 2. Treasury

### 2.1 Phase 4A — BUILT

- `js/solana/treasury.js` reads a configured address over JSON-RPC: `getBalance` and
  `getSignaturesForAddress`. Read-only. No keys.
- The in-game Treasury panel and the admin dashboard show: live balance, recent transactions, and the
  **allocation of the real balance** across the configured buckets (default 60% card rewards, 20% events,
  10% development, 10% reserve). Percentages are configuration, not guarantees.
- If the RPC call fails or no address is set, the panel says so. It never shows a placeholder number.

### 2.2 Phase 4B — DESIGN

```
 fee source (A/B/C/D)
        │ claim / forward (creator wallet or fee-share config)
        ▼
 Treasury vault  ── Squads multisig (2-of-3 minimum), no single hot key
        │ periodic, capped transfers
        ▼
 Reward hot wallet (holds at most one epoch's budget)
        │ signs mints/transfers requested by
        ▼
 Reward service (server) ── append-only ledger ── public "distributions" feed
```

- **Vault**: a Squads multisig holds everything. Allocation percentages are applied when each epoch's
  budget is moved to the hot wallet; changing them is a multisig action plus a config change.
- **Budget rule**: epoch budget = min(configured cap, share of the balance actually present). Rewards are
  only scheduled against funds already in the hot wallet.
- **Pause**: `live-config.json → rewards.paused` stops the client from offering claims; the reward service
  has its own pause flag that the client cannot override; the multisig can stop funding.
- **Records**: every distribution is a ledger row (player, reason, asset, tx signature) published as JSON
  and cross-checkable on-chain.
- A custom on-chain treasury program is deliberately **not** proposed for v1: a multisig plus a small,
  capped hot wallet is easier to audit than a bespoke program.

## 3. Randomness

- **Standard cards (BUILT):** rolled on the client from a seed drawn from `crypto.getRandomValues`. This is
  not tamper-proof, and it does not need to be: standard cards have no monetary value and cannot leave the
  save file. The roll function (`js/systems/crypt.js → rollCrate`) is pure and takes its random source as
  an argument, so the identical code can run on a server from a verified seed.
- **Anything with monetary value (DESIGN):** the outcome must come from verifiable randomness requested
  on-chain, never from the client or from a server `Math.random()`.
  Candidates to evaluate on devnet (**UNVERIFIED** current status):
  - Switchboard On-Demand randomness (commit → reveal → consume, TEE oracles). Search results in
    November 2026 conflicted about Switchboard's operating status; confirm before choosing.
  - ORAO VRF (request/fulfil with on-chain verification).
  - MagicBlock VRF (queue + callback; RFC 9381-style proof).
  Selection criteria: live on mainnet, audited, cost per request, callback support, liveness guarantees.
  Flow: player action → service creates a pending distribution (commitment to the odds table hash) →
  VRF request → fulfilment → outcome derived by the same `rollCrate` code from the VRF bytes → mint.

### Collector Crate flow (DESIGN)

1. Client reports a boss win to the reward service with the player's signed session.
2. Service checks the win is plausible (progression order, rate limits, one award per boss per account),
   records the Collector Crate and its shards in the ledger. The client's own shard count is display only.
3. If a season is live and supply remains, the service requests VRF randomness for the instant-win roll at
   the configured odds; on a win it reserves a card from the season's fixed supply and mints it.
4. At season end the service snapshots shard balances, publishes the snapshot hash, requests VRF
   randomness and draws the remaining cards. Winners answer a skill-testing question before minting.

Verifying single-player boss wins server-side is the hard part: the client is untrusted, so the service
needs replayable battle logs (the battle engine is deterministic for this reason) or it must accept that
shards measure play time and rely on per-account caps and Sybil controls.

## 4. On-chain cards — DESIGN

- Standard: **Metaplex Core**. One account per asset, collection-level plugins (royalties, freeze,
  attributes). One Core collection for CRYPT; rarity, card id and parallel go in the Attributes plugin.
- Numbered limited editions: Core's Edition / Master Edition plugins exist for this, but exact behaviour
  must be verified in the Metaplex docs before use (**UNVERIFIED**; search did not confirm details).
- High-volume commemoratives: **Bubblegum v2** compressed NFTs inside the same Core collection. Trade-off:
  they cannot be decompressed and need a DAS-capable RPC to read.
- Metadata JSON and art on Arweave/Irys; art rendered by the same card renderer the game uses.
- Minting is done by the reward service to the player's address. The player never signs a mint; where a
  player signature is needed (e.g. a trade) it goes through the wallet's own approval window.

## 5. Wallet — BUILT (connect and prove ownership only)

- `js/solana/wallet.js` discovers wallets through the Wallet Standard events and falls back to common
  injected providers. It supports **connect**, **disconnect** and **sign a message** (to prove ownership,
  verified locally with Ed25519).
- The game never asks for a seed phrase or private key, never builds or sends a transaction, and plays
  identically with no wallet.
- Tested against a mock Wallet Standard wallet (see `tests/`). Not yet tested by hand against Phantom,
  Solflare or Backpack on a real device — do that before announcing wallet support.

## 6. What must happen before Phase 4B ships

1. Choose launchpad; confirm its fee-claim mechanics from primary docs; test a claim on mainnet with dust.
2. Legal review (see `LEGAL_AND_SECURITY.md`).
3. Stand up the reward service and ledger; write its threat model.
4. Pick and integrate a VRF on devnet; publish the odds-table hash scheme.
5. Create the Core collection on devnet; verify edition numbering.
6. External security review of the service and key handling.
