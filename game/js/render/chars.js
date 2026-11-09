// Overworld characters: 16x20, four directions, two walk frames, generated from a small "look".
const LOOKS = {
  player:   { skin: '#f4c8a0', hair: '#5c3c28', top: '#e85040', bottom: '#3c4878', hat: '#f4b840' },
  juno:     { skin: '#c88c64', hair: '#2c2438', top: '#48a8a0', bottom: '#4c3c5c', long: 1 },
  maren:    { skin: '#e8c0a0', hair: '#c8c8d8', top: '#f0e8d8', bottom: '#5c5078', long: 1, glasses: 1 },
  mum:      { skin: '#f4c8a0', hair: '#7c4c30', top: '#e890a8', bottom: '#8c6ca8', long: 1 },
  villager: { skin: '#e8b890', hair: '#8c5c38', top: '#68a868', bottom: '#6c5840' },
  kid:      { skin: '#f4c8a0', hair: '#e8a838', top: '#f8d048', bottom: '#4878c8', small: 1 },
  sailor:   { skin: '#d8a078', hair: '#3c3c48', top: '#f0f0f8', bottom: '#3058a8', hat: '#f0f0f8' },
  ranger:   { skin: '#c89468', hair: '#4c3020', top: '#4c7c48', bottom: '#5c4830', hat: '#7c5c38' },
  smith:    { skin: '#b87c58', hair: '#2c2428', top: '#8c4c38', bottom: '#3c3440', apron: '#5c5460' },
  scribe:   { skin: '#e8e4f0', hair: '#2c2838', top: '#3c3450', bottom: '#2c2838', hood: 1, mask: 1 },
  bram:     { skin: '#c89468', hair: '#58a050', top: '#7cc868', bottom: '#7c5c38', hat: '#e8d8a0' },
  ines:     { skin: '#a87048', hair: '#2c3c68', top: '#4c90f0', bottom: '#f0f0f8', long: 1 },
  kiln:     { skin: '#b87c58', hair: '#e85830', top: '#3c3440', bottom: '#5c2c24', apron: '#f08030' },
  isolde:   { skin: '#f0d8d0', hair: '#d8f0f8', top: '#7cd4e0', bottom: '#4c6898', long: 1 },
  sable:    { skin: '#e0c8b8', hair: '#3c3450', top: '#5c5068', bottom: '#2c2838', long: 1, glasses: 1 },
  vane:     { skin: '#e8d8c8', hair: '#e8e4f0', top: '#2c2838', bottom: '#1c1828', apron: '#e04870', long: 1 },
};
const INK = '#221a30';
const DIRS = ['down', 'left', 'right', 'up'];
const cache = new Map();

function drawChar(ctx, ox, oy, L, dir, frame) {
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, w, h); };
  const s = L.small ? 2 : 0; // kids are shorter
  const y0 = s;
  // legs
  const lA = frame ? 3 : 4, lB = frame ? 4 : 3;
  if (dir === 'left' || dir === 'right') { R(L.bottom, 6, 15, 4, frame ? 3 : 4); R(INK, frame ? 5 : 6, 18, 5, 1); if (frame) R(L.bottom, dir === 'left' ? 9 : 5, 15, 2, 4); }
  else { R(L.bottom, 5, 15, 2, lA); R(L.bottom, 9, 15, 2, lB); R(INK, 5, 15 + lA, 2, 1); R(INK, 9, 15 + lB, 2, 1); }
  // body
  R(L.top, 4, 9 + y0, 8, 6 - y0);
  if (L.apron && dir !== 'up') R(L.apron, 6, 10 + y0, 4, 5 - y0);
  if (dir === 'down' || dir === 'up') { R(L.top, 3, 10 + y0, 1, 3); R(L.top, 12, 10 + y0, 1, 3); R(L.skin, 3, 13 + y0 - (frame ? 1 : 0), 1, 1); R(L.skin, 12, 13 + y0 - (frame ? 0 : 1), 1, 1); }
  else { R(L.top, 7, 10 + y0, 2, 3); R(L.skin, frame ? (dir === 'left' ? 6 : 9) : 7, 13 + y0, 2, 1); }
  // head
  const hy = 1 + y0;
  R(L.skin, 4, hy + 1, 8, 7); R(L.skin, 3, hy + 2, 10, 5);
  const hair = L.hood ? L.top : L.hair;
  if (dir === 'up') { R(hair, 3, hy, 10, 6); R(hair, 4, hy - 1, 8, 2); R(hair, 4, hy + 6, 8, L.long ? 3 : 1); }
  else {
    R(hair, 4, hy - 1, 8, 3); R(hair, 3, hy, 10, 3);
    if (dir === 'down') { R(hair, 3, hy + 2, 1, L.long ? 6 : 3); R(hair, 12, hy + 2, 1, L.long ? 6 : 3); if (L.mask) { R('#f0ecf8', 4, hy + 3, 8, 5); } R(INK, 5, hy + 4, 2, 2); R(INK, 9, hy + 4, 2, 2); if (!L.mask) { R('#fff', 5, hy + 4, 1, 1); R('#fff', 9, hy + 4, 1, 1); R('#d88878', 7, hy + 7, 2, 1); } if (L.glasses) { R('#fff8', 4, hy + 4, 3, 2); R('#fff8', 9, hy + 4, 3, 2); R(INK, 7, hy + 4, 2, 1); } }
    else { const f = dir === 'left'; R(hair, f ? 8 : 3, hy + 2, 5, L.long ? 6 : 4); if (L.mask) R('#f0ecf8', f ? 3 : 8, hy + 3, 5, 5); R(INK, f ? 4 : 10, hy + 4, 2, 2); }
  }
  if (L.hat) { R(L.hat, 3, hy - 1, 10, 2); R(L.hat, 4, hy - 2, 8, 2); if (dir === 'down') R(L.hat, 2, hy + 1, 12, 1); else if (dir === 'left') R(L.hat, 1, hy + 1, 6, 1); else if (dir === 'right') R(L.hat, 9, hy + 1, 6, 1); }
}
function outline(cv) {
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) { const i = (y * w + x) * 4; out[i] = 34; out[i + 1] = 26; out[i + 2] = 48; out[i + 3] = 255; }
  ctx.putImageData(new ImageData(out, w, h), 0, 0);
}
// Sheet: 4 directions (rows) x 2 frames (columns), each cell 18x22 (1px margin for the outline).
export const CW = 18, CH = 22;
export function charSheet(look) {
  if (cache.has(look)) return cache.get(look);
  const L = LOOKS[look] || LOOKS.villager;
  const cv = document.createElement('canvas'); cv.width = CW * 2; cv.height = CH * 4;
  const ctx = cv.getContext('2d');
  DIRS.forEach((dir, r) => { for (let f = 0; f < 2; f++) drawChar(ctx, f * CW + 1, r * CH + 2, L, dir, f); });
  outline(cv);
  cache.set(look, cv);
  return cv;
}
export function drawCharAt(ctx, look, dir, frame, x, y) {
  const sheet = charSheet(look);
  ctx.drawImage(sheet, frame * CW, DIRS.indexOf(dir) * CH, CW, CH, Math.round(x) - 1, Math.round(y) - 7, CW, CH);
}
// Portrait canvas (48x48) for character cards.
export function charPortrait(look) {
  const key = 'portrait:' + look;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(charSheet(look), 0, 0, CW, CH, 6, 2, CW * 2, CH * 2);
  cache.set(key, cv);
  return cv;
}
export const LOOK_IDS = Object.keys(LOOKS);
