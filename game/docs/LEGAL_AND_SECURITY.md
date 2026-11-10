# Legal and security considerations

This is an engineering summary to brief a lawyer and a security reviewer. It is not legal advice.

## Legal (Canada / Quebec)

**Chance + prize + payment is the danger zone.** Under the federal Criminal Code (s. 206), disposing of
property by a game of chance, or of mixed chance and skill, where the participant pays money or other
valuable consideration is an illegal lottery unless run by a province. Promotions avoid this by offering a
genuine *no purchase necessary* route and, by long-standing practice, a skill-testing question so the
prize is not awarded by chance alone.

What this means for CRYPT:

| Feature | Position |
|---|---|
| Free crates with standard cards (no monetary value, not transferable) | Ordinary game mechanic. Implemented. |
| Buying crates with real money or tokens where contents have monetary value | **Do not build without counsel.** Likely a lottery/gaming product. |
| Requiring token ownership to enter draws | Token purchase may count as consideration. Avoid; entry must be free. |
| Boss Collector Crates: free instant-win chance + shard raffle for valuable cards | A promotional contest by chance. Entry is free (earned by play), which avoids the consideration problem, but it still needs published rules, prize counts and odds disclosure, a skill-testing question before a prize is awarded, and counsel sign-off. Coins must never buy entries. |
| An in-game currency (coins, bank interest) | Fine while it stays closed: not purchasable, not redeemable, not transferable. Linking coins to the token or to cash in either direction changes the analysis (payments, securities, gaming) and needs advice first. |
| Free, achievement-based on-chain rewards | Lowest risk form of valuable reward; skill-based criteria are preferable to random draws. |
| Random draws for valuable prizes among free entrants | A promotional contest: needs published rules, odds, no purchase necessary, skill-testing question. |

- **Quebec**: the Régie's publicity-contest rules (registration, duties, security) were repealed on
  27 October 2023, so Quebec residents no longer need separate treatment for *promotional contests*.
  Lottery schemes (paid tickets/draws) are still regulated, federal law still applies, and the Charter of
  the French Language requires French contest materials and UI for Quebec consumers.
- **Competition Act (s. 74.06)**: contests must disclose number and approximate value of prizes, regional
  allocation, and any fact materially affecting the chances of winning; no undue delay in awarding.
- **Consumer protection (Quebec CPA)**: no misleading representations about value or odds; clear terms.
- **Securities (AMF / CSA)**: a token marketed with an expectation of profit from the team's efforts —
  including "fees fund rewards for holders" messaging — may be an investment contract. Keep rewards tied
  to *gameplay*, never to holding the token, and never advertise returns. Get advice before token launch.
- **Privacy (Quebec Law 25)**: wallet addresses linked to gameplay are personal information once
  associated with a person. The standard game stores nothing off the device.
- **Minors**: a monster-collecting game attracts young players; anything chance-based with value needs
  age gating.
- **Tax**: valuable prizes may have tax consequences for recipients; say so in the rules.

Design decisions already taken because of the above: no real-money purchases exist in the game; Fortune
ignores token balance; odds are always displayed; standard cards cannot be transferred or sold; on-chain
reward features are switched off in code until a review is recorded in `live-config.json`
(`rewards.legalReviewRef`).

## Security

Threats and the control for each:

| Threat | Control |
|---|---|
| Client edits its save or odds | Standard tier: accepted, nothing of value. Valuable tier: server recomputes everything; client claims are ignored. |
| Reward duplication / replay | Each distribution has a unique id; ledger enforces one payout per (player, reason, season); requests carry a nonce and expiry. |
| Fake transaction confirmations | Service confirms signatures itself over its own RPC at `finalized` commitment; never trusts a signature string from the client. |
| Bots and Sybils | Rewards keyed to achievements that cost play time; per-wallet and per-device rate limits; wallet-age/activity heuristics; manual review queue; optional proof-of-personhood for large prizes. |
| Predictable randomness | On-chain VRF for anything valuable; odds-table hash committed before the request. |
| Treasury theft | Multisig vault; hot wallet capped to one epoch; keys in a KMS/HSM, never in the repo or the frontend. |
| Malicious admin config | Config is a reviewed commit; the client clamps values (odds must sum to 1, Fortune cap, allocations sum to 100). |
| Phishing through the game UI | The game never asks for a seed phrase and never sends transactions; this is stated in the wallet panel. |
| Supply chain | No runtime dependencies in the client. |

Audit log: the reward service ledger is append-only and exported publicly. The client keeps a local
history of every crate opened (seed, odds version, results) so a player can re-run a roll.

A security review of the reward service, key handling and the VRF integration is required before any
asset with real value is distributed.
