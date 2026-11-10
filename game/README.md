# Cryptwild

An original monster-collecting RPG with a collectible card system (CRYPT). Plain HTML, CSS and JavaScript
modules: no build step and no runtime dependencies, like the rest of this repository.

Play: open `/game/` on the published site, or locally:

```bash
python3 -m http.server 8000      # from the repository root
# then open http://localhost:8000/game/
```

(ES modules need a web server; opening `index.html` straight from disk will not work.)

## What is in here

| Path | What it is |
|---|---|
| `index.html`, `css/game.css` | Page shell and all UI styling |
| `js/data/` | Elements, moves, traits, 58 Kith and their sprite specs, items, maps, story, cards, crates |
| `js/systems/` | Rules with no DOM: Kith maths, battle engine, CRYPT engine, save/clock/daily |
| `js/render/` | Pixel rasteriser, tile renderer, character sprites (all art is generated in code) |
| `js/scenes/`, `js/ui/` | World, battle, menus, CRYPT binder and crate opening, wallet panel |
| `js/solana/` | Wallet connection (connect + sign a message only) and read-only treasury monitor |
| `live-config.json` | Operator-published settings: events, announcements, odds overrides, treasury address |
| `admin/` | Operator dashboard that edits `live-config.json` |
| `docs/` | Design document, Solana architecture, legal and security notes, development log |
| `tests/` | Unit tests and an end-to-end browser test |

## Tests

```bash
cd game
npm test          # 22 unit tests: data integrity, 1,500 simulated battles, odds, pity, map reachability, save, config
npm run smoke     # end-to-end in Chromium (needs Playwright): plays the whole story, opens every crate type
```

## Operating it

- **Announcements, events, odds, treasury address**: open `/game/admin/`, edit, download `live-config.json`,
  replace the file and publish. The game re-validates the file and ignores anything invalid.
- **The dashboard holds no keys** and cannot move funds. Keep it private anyway (`admin/.htaccess` has a
  ready template for HTTP authentication), or leave the `admin/` folder off the server and use it locally.
- **Do not upload** `tests/`, `docs/` or `package.json` if you do not want them public; the root `.htaccess`
  already returns 404 for them.

## Status in one paragraph

The RPG (story, four Sigil Halls, postgame) and the standard CRYPT collection are playable and tested.
Wallet connection and the read-only treasury monitor work. **No on-chain rewards, minting or real-money
features exist**: those are designed in `docs/SOLANA_ARCHITECTURE.md` and blocked on the choice of launch
platform, a randomness provider, a reward service and a legal review. See `docs/DEVLOG.md`.
