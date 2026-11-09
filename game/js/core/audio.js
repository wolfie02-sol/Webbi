// WebAudio chiptune: synthesised effects and looping two-voice music. No audio files.
let ac = null, master = null, musicGain = null, sfxGain = null;
let current = null, timer = null, settings = { sfx: true, music: true };
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freq = (n) => { if (n === '-' || !n) return 0; const m = /^([A-G])(#?)(\d)$/.exec(n); return 440 * Math.pow(2, (NOTE[m[1]] + (m[2] ? 1 : 0) + (m[3] - 4) * 12 - 9) / 12); };

function ensure() {
  if (ac) return true;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return false;
  ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
  sfxGain = ac.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
  return true;
}
export function unlockAudio() { if (ensure() && ac.state === 'suspended') ac.resume(); }
export function setAudio(s) { settings = { ...settings, ...s }; if (!settings.music) stopMusic(); else if (current) { const c = current; current = null; music(c); } }

function tone(f, t, dur, type = 'square', vol = 0.3, dest = sfxGain, slide = 0) {
  if (!f) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, vol = 0.25, hp = 800) {
  const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = buf; s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t);
}
const arp = (notes, step, type = 'square', vol = 0.25, len = step * 1.6) => (t) => notes.forEach((n, i) => tone(freq(n), t + i * step, len, type, vol));
const SFX = {
  blip: (t) => tone(880, t, 0.04, 'square', 0.12),
  select: (t) => { tone(660, t, 0.05, 'square', 0.16); tone(990, t + 0.05, 0.07, 'square', 0.16); },
  back: (t) => tone(330, t, 0.08, 'square', 0.14, sfxGain, 0.6),
  bump: (t) => tone(110, t, 0.08, 'triangle', 0.3, sfxGain, 0.7),
  step: (t) => noise(t, 0.03, 0.05, 2000),
  hit: (t) => { noise(t, 0.12, 0.35, 400); tone(160, t, 0.12, 'square', 0.2, sfxGain, 0.4); },
  superhit: (t) => { noise(t, 0.2, 0.45, 300); tone(220, t, 0.2, 'sawtooth', 0.25, sfxGain, 0.3); tone(440, t + 0.05, 0.15, 'square', 0.15, sfxGain, 0.5); },
  weak: (t) => { noise(t, 0.08, 0.2, 1200); tone(120, t, 0.1, 'triangle', 0.2); },
  miss: (t) => tone(500, t, 0.18, 'sine', 0.15, sfxGain, 0.4),
  faint: (t) => tone(440, t, 0.6, 'square', 0.2, sfxGain, 0.15),
  heal: arp(['C5', 'E5', 'G5', 'C6'], 0.07, 'sine', 0.22),
  stat: (t) => { tone(300, t, 0.25, 'triangle', 0.2, sfxGain, 2); },
  statdown: (t) => { tone(600, t, 0.25, 'triangle', 0.2, sfxGain, 0.5); },
  status: (t) => { tone(200, t, 0.12, 'sawtooth', 0.14); tone(180, t + 0.12, 0.2, 'sawtooth', 0.14); },
  surge: (t) => { for (let i = 0; i < 8; i++) tone(300 + i * 120, t + i * 0.035, 0.1, 'sawtooth', 0.16); noise(t + 0.25, 0.3, 0.3, 200); },
  throw: (t) => tone(300, t, 0.3, 'sine', 0.2, sfxGain, 3),
  shake: (t) => { tone(200, t, 0.05, 'square', 0.15); tone(160, t + 0.08, 0.05, 'square', 0.15); },
  caught: arp(['G4', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'], 0.09, 'square', 0.2, 0.2),
  levelup: arp(['C5', 'E5', 'G5', 'C6', 'G5', 'C6'], 0.08, 'square', 0.2, 0.18),
  evolve: (t) => { for (let i = 0; i < 16; i++) tone(260 * Math.pow(2, i / 12), t + i * 0.09, 0.12, 'triangle', 0.2); },
  fanfare: arp(['C5', 'C5', 'C5', 'E5', 'G5', 'E5', 'G5', 'C6'], 0.11, 'square', 0.22, 0.24),
  item: arp(['E5', 'A5', 'E6'], 0.07, 'square', 0.18),
  coin: (t) => { tone(988, t, 0.06, 'square', 0.16); tone(1319, t + 0.06, 0.2, 'square', 0.16); },
  dig: (t) => { noise(t, 0.1, 0.3, 300); noise(t + 0.15, 0.1, 0.3, 300); },
  door: (t) => { tone(220, t, 0.1, 'triangle', 0.2); tone(165, t + 0.08, 0.14, 'triangle', 0.2); },
  encounter: (t) => { for (let i = 0; i < 6; i++) tone(i % 2 ? 660 : 440, t + i * 0.07, 0.07, 'square', 0.2); },
  alert: (t) => { tone(880, t, 0.08, 'square', 0.22); tone(1175, t + 0.1, 0.18, 'square', 0.22); },
  crateShake: (t) => { noise(t, 0.08, 0.25, 500); tone(90, t, 0.12, 'triangle', 0.35); },
  crateOpen: (t) => { noise(t, 0.4, 0.35, 150); tone(110, t, 0.5, 'sawtooth', 0.2, sfxGain, 4); },
  flip: (t) => noise(t, 0.05, 0.18, 3000),
  r_common: (t) => tone(523, t, 0.12, 'triangle', 0.2),
  r_uncommon: arp(['E5', 'G5'], 0.08, 'triangle', 0.22),
  r_rare: arp(['E5', 'G5', 'B5'], 0.08, 'square', 0.2),
  r_epic: arp(['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.08, 'square', 0.22, 0.2),
  r_legendary: (t) => { arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.09, 'square', 0.22, 0.3)(t); arp(['C3', 'G3', 'C4'], 0.2, 'triangle', 0.3, 0.6)(t); noise(t + 0.6, 0.5, 0.15, 4000); },
  r_mythic: (t) => { arp(['C5', 'D#5', 'G5', 'A#5', 'C6', 'D#6', 'G6', 'A#6', 'C7', 'G7'], 0.1, 'sawtooth', 0.18, 0.4)(t); arp(['C2', 'C3', 'G3', 'C4'], 0.25, 'triangle', 0.35, 1)(t); noise(t, 1.2, 0.12, 5000); },
  r_secret: arp(['A5', 'E6', 'A6', 'E7'], 0.12, 'sine', 0.25, 0.5),
};
export function sfx(name) {
  if (!settings.sfx || !ensure() || ac.state !== 'running') return;
  const fn = SFX[name]; if (fn) fn(ac.currentTime + 0.005);
}

// Music: [tempo, melody, bass] — whitespace-separated notes, one per 8th note, '-' = rest/hold.
const TRACKS = {
  title:  [100, 'E4 - G4 A4 B4 - A4 G4 E4 - D4 E4 G4 - - - A4 - B4 D5 E5 - D5 B4 A4 - G4 A4 B4 - - -', 'E2 - - - E2 - - - C2 - - - C2 - - - A2 - - - A2 - - - D2 - - - B1 - - -'],
  town:   [116, 'C5 E5 G5 E5 C5 E5 G5 - A4 C5 F5 C5 A4 C5 F5 - B4 D5 G5 D5 B4 D5 G5 - C5 - E5 - G5 - - -', 'C3 - G3 - C3 - G3 - F2 - C3 - F2 - C3 - G2 - D3 - G2 - D3 - C3 - G3 - C3 - - -'],
  route:  [132, 'G4 - C5 D5 E5 - D5 C5 G4 - C5 D5 E5 - G5 - A5 - G5 E5 D5 - C5 D5 E5 - D5 C5 D5 - - -', 'C3 C3 G3 C3 C3 C3 G3 C3 E3 E3 G3 E3 E3 E3 G3 E3 F3 F3 C4 F3 F3 F3 C4 F3 G3 G3 D4 G3 G3 G3 B3 G3'],
  forest: [104, 'A4 - C5 - E5 - D5 C5 B4 - - - G4 - - - A4 - C5 - E5 - G5 E5 D5 - - - E5 - - -', 'A2 - E3 - A2 - E3 - G2 - D3 - G2 - D3 - F2 - C3 - F2 - C3 - E2 - B2 - E2 - - -'],
  cave:   [84,  'E4 - - G4 - - B4 - A4 - - F#4 - - - - E4 - - G4 - - B4 - D5 - - B4 - - - -', 'E2 - - - - - - - D2 - - - - - - - C2 - - - - - - - B1 - - - - - - -'],
  hollow: [112, 'D4 D4 F4 D4 A4 D4 G#4 D4 D4 D4 F4 D4 C5 D4 A4 D4 C4 C4 D#4 C4 G4 C4 F#4 C4 D4 - A4 - D5 - - -', 'D2 - D2 - D2 - D2 - D2 - D2 - D2 - D2 - C2 - C2 - C2 - C2 - D2 - A2 - D2 - - -'],
  battle: [152, 'E5 E5 - E5 G5 E5 - D5 E5 E5 - E5 B5 A5 G5 - D5 D5 - D5 F#5 D5 - C5 D5 - E5 - G5 - B5 -', 'E3 E3 B3 E3 E3 E3 B3 E3 E3 E3 B3 E3 E3 E3 B3 E3 D3 D3 A3 D3 D3 D3 A3 D3 D3 D3 A3 D3 B2 B2 F#3 B2'],
  gym:    [144, 'A4 - E5 - A5 - G5 E5 F5 - C5 - F5 - E5 C5 G4 - D5 - G5 - F5 D5 E5 - G#5 - B5 - - -', 'A2 A2 E3 A2 A2 A2 E3 A2 F2 F2 C3 F2 F2 F2 C3 F2 G2 G2 D3 G2 G2 G2 D3 G2 E2 E2 B2 E2 E2 E2 G#2 E2'],
  boss:   [164, 'D5 - D5 F5 - D5 A5 - G#5 - F5 - D5 - - - C5 - C5 D#5 - C5 G5 - F#5 - D#5 - C5 - D5 -', 'D3 D3 D3 D3 D3 D3 A2 D3 D3 D3 D3 D3 D3 D3 A2 D3 C3 C3 C3 C3 C3 C3 G2 C3 C3 C3 C3 C3 A2 A2 A2 A2'],
  crypt:  [96,  'G4 - D5 - G5 - F#5 D5 E5 - B4 - E5 - - - C5 - G5 - C6 - B5 G5 A5 - F#5 - D5 - - -', 'G2 - - D3 - - G3 - E2 - - B2 - - E3 - C3 - - G3 - - C3 - D3 - - A2 - - D3 -'],
};
export function music(name) {
  if (name === current) return;
  stopMusic(); current = name;
  if (!settings.music || !name || !TRACKS[name] || !ensure()) return;
  const [tempo, mel, bass] = TRACKS[name];
  const m = mel.split(/\s+/), b = bass.split(/\s+/), step = 30 / tempo;
  let i = 0, next = ac.currentTime + 0.08;
  const tick = () => {
    if (ac.state !== 'running') return;
    while (next < ac.currentTime + 0.25) {
      const hold = (arr) => { let n = 1; while (arr[(i + n) % arr.length] === '-' && n < 4) n++; return n; };
      if (m[i % m.length] !== '-') tone(freq(m[i % m.length]), next, step * hold(m) * 0.95, 'square', 0.16, musicGain);
      if (b[i % b.length] !== '-') tone(freq(b[i % b.length]), next, step * hold(b) * 0.95, 'triangle', 0.3, musicGain);
      i++; next += step;
    }
  };
  timer = setInterval(tick, 80); tick();
}
export function stopMusic() { if (timer) clearInterval(timer); timer = null; current = null; }
export const currentTrack = () => current;
