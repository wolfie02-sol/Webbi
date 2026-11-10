# Development log

Status words used here: **Done** = built and covered by a test that passes. **Built, lightly tested** =
works in the end-to-end run but has no dedicated test. **Not built** = design only.

## Phase 1 — Design and architecture: Done

`GAME_DESIGN.md`, `SOLANA_ARCHITECTURE.md`, `LEGAL_AND_SECURITY.md`.

## Phase 2 — Playable RPG

| Feature | Status | Evidence |
|---|---|---|
| 17 elements and chart, 117 moves, 25 traits | Done | `battle.test.mjs` |
| 58 Kith with generated sprites, learnsets, evolutions (level, item, night) | Done | `battle.test.mjs` |
| Battle engine: statuses, stages, weather, traits, Surge, capture, exp, AI | Done | 1,500 simulated battles; capture-rate test |
| 19 maps (6 towns, 4 Sigil Halls, routes, 3 dungeons, 2 secret areas) | Done | Reachability test for every NPC, item and exit |
| Story start to finish, rival, antagonist, ending | Done | End-to-end browser run plays every beat |
| Postgame: Concord Trial, Echo Tower, 5 legends, rematches | Built, lightly tested | End-to-end run clears the Trial and one Tower floor; legends other than Mnemora are not individually exercised |
| Day/night, weather, Aurora, rare spawns | Done (logic) | `world.test.mjs`; visuals checked by eye |
| Echo Compass and daily buried caches | Done | End-to-end run digs one |
| Quests (9 + 3 daily), Codex, Lantern Box, shop, fast travel | Built, lightly tested | Panels open in the end-to-end run; individual side-quest scripts are not each run |
| Save: autosave, checksum, export/import | Done | `world.test.mjs` + end-to-end round-trip |
| Phone layout (portrait touch pad, docked battle commands) | Built, lightly tested | Screenshots on an emulated iPhone; not tried on a physical phone |
| Audio (synthesised music and effects) | Built, **not listened to** | Written blind in a headless environment; expect tuning |

## Phase 3 — CRYPT standard cards

| Feature | Status | Evidence |
|---|---|---|
| 93 cards: Kith, Artifact, Character, Seasonal, Mythic, Secret | Done | `crypt.test.mjs` |
| Six containers, published odds, Fortune, pity (per crate and global) | Done | Odds-sum, simulation-vs-table, pity-bound tests |
| Opening sequence, binder, card detail, History with seeds | Done | End-to-end run opens all six |
| Dust: refine and craft | Done | `crypt.test.mjs` |
| Constellations → Secret cards and world unlocks | Done | Unit test + end-to-end (Aurora opens Starfall Hollow) |
| First Codex record of a Kith grants its card | Done | End-to-end |

## Phase 4A — Solana, read-only: Done within stated limits

- Wallet discovery (Wallet Standard + common injected providers), connect, sign-message ownership proof
  with local Ed25519 verification. Tested against a **mock** Wallet Standard wallet with a real key.
  **Not tested** against Phantom, Solflare or Backpack themselves.
- Treasury monitor: `getBalance` + `getSignaturesForAddress`, allocation of the real balance. Tested with a
  mocked RPC. **Not tested** against a live RPC endpoint from this environment, and public endpoints
  rate-limit; use a dedicated RPC provider in production.
- Operator dashboard and `live-config.json` with client-side re-validation. Tested.

## Phase 4B — On-chain rewards: Not built

Fee routing, reward service, VRF, Core/Bubblegum minting, distribution ledger, suspicious-activity review.
Blocked on: (1) which launchpad the token uses, (2) legal review, (3) a server to run the reward service.

## Known issues and gaps

1. Balance is simulation-checked only. Level curve between Sigil Halls has not been human-playtested;
   expect to adjust wild levels and trainer rewards.
2. Four Sigil Halls, not eight. Sigils 5–8 and their regions are Phase 5.
3. Sprites for player-side Kith reuse the front view, mirrored.
4. No multiplayer, trading or leaderboards (need a server).
5. Landscape phones get an overlaid, semi-transparent pad; portrait is the intended layout.
6. The save lives in `localStorage`; clearing site data deletes it. Export exists; cloud save does not.
7. French localisation is not done. It is required before promoting any contest to Quebec players.
8. Names ("Cryptwild", "Kith", creature names) are not trademark-cleared.
9. Fonts load from Google Fonts; offline, the UI falls back to a system font.

## Next priorities

1. Human playtest from a fresh save to Sigil 2; tune levels, coins and encounter rates.
2. Listen to and tune the audio.
3. Decide the launch platform so the fee route can be verified on mainnet with a small test.
4. Legal consultation using `LEGAL_AND_SECURITY.md` as the brief.
5. Phase 5 content: Sigil Halls 5–8, 30+ Kith, more side quests, trainer rematches.
