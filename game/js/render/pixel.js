// Pixel rasteriser. Shapes are plotted on a small grid, then outlined and rim-shaded automatically so
// every sprite in the game shares one look. Pure: returns { w, h, px: Uint8ClampedArray (RGBA) }.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const INK = [22, 16, 34];
const WHITE = [255, 255, 255];

// op builders: upper-case = contoured part, lower-case = flat detail, m-prefix = mirrored pair
export const E = (cx, cy, rx, ry, c) => ['E', 0, cx, cy, rx, ry, c];
export const e = (cx, cy, rx, ry, c) => ['e', 0, cx, cy, rx, ry, c];
export const mE = (cx, cy, rx, ry, c) => ['E', 1, cx, cy, rx, ry, c];
export const me = (cx, cy, rx, ry, c) => ['e', 1, cx, cy, rx, ry, c];
export const P = (c, ...pts) => ['P', 0, c, pts];
export const p = (c, ...pts) => ['p', 0, c, pts];
export const mP = (c, ...pts) => ['P', 1, c, pts];
export const mp = (c, ...pts) => ['p', 1, c, pts];
export const L = (x1, y1, x2, y2, w, c) => ['L', 0, x1, y1, x2, y2, w, c];
export const l = (x1, y1, x2, y2, w, c) => ['l', 0, x1, y1, x2, y2, w, c];
export const mL = (x1, y1, x2, y2, w, c) => ['L', 1, x1, y1, x2, y2, w, c];
export const ml = (x1, y1, x2, y2, w, c) => ['l', 1, x1, y1, x2, y2, w, c];
export const Y = (dx, y, r, style = 1) => ['Y', 0, dx, y, r, style];

function inPoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distSeg(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  let t = len ? ((x - x1) * dx + (y - y1) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

export function raster(spec, S = 48, opts = {}) {
  const col = new Uint8Array(S * S);
  const part = new Uint16Array(S * S);
  let partId = 0;
  const plot = (test, c, contoured) => {
    const id = contoured ? ++partId : 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (test(x + 0.5, y + 0.5)) {
        const i = y * S + x;
        col[i] = c;
        if (contoured) part[i] = id;
      }
    }
  };
  const shape = (kind, a, mirror) => {
    const k = kind.toLowerCase();
    const cont = kind !== k;
    const mx = (x) => (mirror ? S - x : x);
    if (k === 'e') { const [cx, cy, rx, ry, c] = a; plot((x, y) => ((x - mx(cx)) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c, cont); }
    else if (k === 'p') { const [c, pts] = a; const q = pts.map((v, i) => (i % 2 ? v : mx(v))); plot((x, y) => inPoly(q, x, y), c, cont); }
    else if (k === 'l') { const [x1, y1, x2, y2, w, c] = a; plot((x, y) => distSeg(x, y, mx(x1), y1, mx(x2), y2) <= w, c, cont); }
  };
  const eyes = [];
  for (const op of spec.ops) {
    const [kind, m, ...a] = op;
    if (kind === 'Y') { eyes.push(a); continue; }
    shape(kind, a, false);
    if (m) shape(kind, a, true);
  }
  for (const [dx, y, r, style] of eyes) {
    for (const sx of [-1, 1]) {
      const cx = S / 2 + sx * dx;
      if (style === 2 || style === 3) {
        plot((x, yy) => (x - cx) ** 2 + (yy - y) ** 2 <= r * r, 9, false);
        plot((x, yy) => (x - cx - sx * -0.4) ** 2 + (yy - y - 0.3) ** 2 <= (r * 0.6) ** 2, 8, false);
        if (style === 3) plot((x, yy) => distSeg(x, yy, cx - sx * (r + 0.8), y - r - 1.4, cx + sx * (r + 0.4), y - r + 0.6) <= 0.75, 8, false);
      } else if (style === 4) {
        plot((x, yy) => (x - cx) ** 2 + (yy - y) ** 2 <= r * r, 3, false);
        plot((x, yy) => (x - cx) ** 2 + (yy - y) ** 2 <= (r * 0.45) ** 2, 9, false);
      } else if (style === 5) {
        plot((x, yy) => distSeg(x, yy, cx - r, y, cx + r, y) <= 0.7, 8, false);
      } else {
        plot((x, yy) => (x - cx) ** 2 + (yy - y) ** 2 <= r * r, 8, false);
        plot((x, yy) => Math.abs(x - (cx - r * 0.35)) < 0.75 && Math.abs(yy - (y - r * 0.4)) < 0.75, 9, false);
      }
    }
  }
  // palette
  const pal = (opts.pal || spec.pal).map(hex);
  const base = (c) => (c === 8 ? INK : c === 9 ? WHITE : pal[c - 1] || pal[0]);
  const outline = mix(pal[0], INK, 0.78);
  const px = new Uint8ClampedArray(S * S * 4);
  const at = (x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : col[y * S + x]);
  const set = (i, rgb) => { px[i * 4] = rgb[0]; px[i * 4 + 1] = rgb[1]; px[i * 4 + 2] = rgb[2]; px[i * 4 + 3] = 255; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, c = col[i];
    if (!c) {
      if (opts.outline !== false && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) set(i, outline);
      continue;
    }
    let rgb = base(c);
    if (c < 8) {
      const pid = part[i];
      const edge = (dx, dy) => { const xx = x + dx, yy = y + dy; return !at(xx, yy); };
      const seam = (dx, dy) => { const xx = x + dx, yy = y + dy; const q = at(xx, yy) ? part[yy * S + xx] : pid; return q !== pid && q > pid; };
      if (seam(1, 0) || seam(0, 1) || seam(-1, 0) || seam(0, -1)) rgb = mix(rgb, INK, 0.42);
      else if (edge(1, 1) || edge(2, 2) || edge(0, 2) || edge(2, 0) || edge(1, 2)) rgb = mix(rgb, INK, 0.24);
      else if (edge(-1, -1) || edge(-2, -2) || edge(0, -2) || edge(-2, 0)) rgb = mix(rgb, WHITE, 0.26);
    }
    set(i, rgb);
  }
  return { w: S, h: S, px };
}

// rotate hue of a hex palette (Gleaming variants)
export function shiftPalette(pal, deg) {
  return pal.map((h) => {
    let [r, g, b] = hex(h).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hh = 0; const ll = (max + min) / 2; const s = d ? d / (1 - Math.abs(2 * ll - 1)) : 0;
    if (d) { if (max === r) hh = ((g - b) / d) % 6; else if (max === g) hh = (b - r) / d + 2; else hh = (r - g) / d + 4; }
    hh = (hh * 60 + deg + 360) % 360;
    const c = (1 - Math.abs(2 * ll - 1)) * s, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = ll - c / 2;
    [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  });
}

// browser helper: raster -> canvas (cached by key)
const cache = new Map();
export function toCanvas(key, spec, S = 48, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const r = raster(spec, S, opts);
  const cv = document.createElement('canvas');
  cv.width = r.w; cv.height = r.h;
  cv.getContext('2d').putImageData(new ImageData(r.px, r.w, r.h), 0, 0);
  cache.set(key, cv);
  return cv;
}
