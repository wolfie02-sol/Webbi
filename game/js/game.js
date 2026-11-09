// Shared game context. Scenes and UI modules attach themselves here to avoid import cycles.
import { rng } from './core/rng.js';
import { fortuneParts } from './systems/crypt.js';
import { saveGame, weatherFor } from './systems/state.js';
import { SPRITES } from './data/sprites.js';
import { toCanvas, shiftPalette } from './render/pixel.js';

export const G = {
  s: null, rng, scene: 'title', world: null, config: { events: [], announcements: [], crates: {}, rewards: { paused: true }, solana: {} },
  save() { if (this.s) saveGame(this.s); },
  eventBonus(now = Date.now()) {
    let b = 0;
    for (const e of this.config.events || []) if (e.fortune && now >= Date.parse(e.start) && now <= Date.parse(e.end)) b += +e.fortune || 0;
    return b;
  },
  activeEvents(now = Date.now()) { return (this.config.events || []).filter((e) => now >= Date.parse(e.start) && now <= Date.parse(e.end)); },
  fortune() {
    const s = this.s;
    const aurora = weatherFor(s, s.map) === 'aurora';
    return fortuneParts({ badges: s.badges, caught: Object.keys(s.caught).length, areas: Object.keys(s.visited).length, streak: s.daily.streak, stars: s.col.stars.length, clover: !!s.bag.luckcharm }, this.eventBonus(), aurora);
  },
};
export function kithCanvas(id, gleam = false, pal = null) {
  const spec = SPRITES[id];
  const p = pal || (gleam ? shiftPalette(spec.pal, 140) : null);
  return toCanvas(`kith:${id}:${gleam ? 'g' : ''}:${pal ? pal.join('') : ''}`, spec, 48, p ? { pal: p } : {});
}
// A fresh <canvas> element showing a Kith (for DOM lists).
export function kithIcon(id, gleam = false, size = 48) {
  const src = kithCanvas(id, gleam);
  const c = document.createElement('canvas'); c.width = 48; c.height = 48;
  c.getContext('2d').drawImage(src, 0, 0);
  c.style.width = c.style.height = size + 'px';
  return c;
}
