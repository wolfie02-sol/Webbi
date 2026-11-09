// Tile renderer: turns a map grid into pre-rendered canvases (two ground frames for animated water and
// lava, plus an overlay layer drawn above characters for tree tops and roofs).
export const T = 16;
const BIOMES = {
  meadow:   { g: '#7cc864', g2: '#68b454', g3: '#94d87c', tall: '#3c9444', tall2: '#58b058', path: '#e4cc94', path2: '#c8ac74', tree: '#2c8048', tree2: '#48a458', tree3: '#7cc870', trunk: '#7c5434', water: '#4c98e8', water2: '#84c0f8', rock: '#a09c90', rock2: '#c8c4b8', wall: '#6c6458', wtop: '#8c8474' },
  forest:   { g: '#5ca858', g2: '#4c9448', g3: '#74b868', tall: '#2c7438', tall2: '#408c48', path: '#c8b080', path2: '#a89060', tree: '#1c5c38', tree2: '#2c7c48', tree3: '#58a060', trunk: '#5c4028', water: '#3c80c8', water2: '#6ca8e0', rock: '#8c8c80', rock2: '#b0b0a4', wall: '#4c4840', wtop: '#6c6858' },
  coast:    { g: '#88d070', g2: '#74bc60', g3: '#a0e088', tall: '#48a050', tall2: '#64b864', path: '#f0dca4', path2: '#d4bc84', tree: '#2c8850', tree2: '#48ac60', tree3: '#80d078', trunk: '#8c6038', water: '#3c9cf0', water2: '#8cd0fc', rock: '#a8a498', rock2: '#d0ccc0', wall: '#6c6458', wtop: '#8c8474', sand: '#f4e4a8', sand2: '#e0cc88' },
  volcanic: { g: '#9c8478', g2: '#8c7468', g3: '#b09888', tall: '#a85838', tall2: '#c87848', path: '#c8b0a0', path2: '#a89080', tree: '#5c4038', tree2: '#7c5848', tree3: '#987060', trunk: '#3c2c28', water: '#4c88c8', water2: '#7cb0e0', rock: '#5c4c4c', rock2: '#7c6c68', wall: '#4c3c3c', wtop: '#6c5858' },
  snow:     { g: '#e8f0f8', g2: '#d0dcec', g3: '#ffffff', tall: '#88b8c8', tall2: '#b0d4e0', path: '#c8d0dc', path2: '#a8b4c4', tree: '#2c6858', tree2: '#48887c', tree3: '#ffffff', trunk: '#5c4838', water: '#78b8e8', water2: '#c0e4fc', rock: '#98a4b4', rock2: '#c8d4e0', wall: '#6c7888', wtop: '#8c98a8' },
  cave:     { g: '#6c6478', g2: '#5c5468', g3: '#7c7488', tall: '#4c8068', tall2: '#68a080', path: '#8c8498', path2: '#6c6478', rock: '#4c4458', rock2: '#6c6478', wall: '#342c40', wtop: '#4c4458', water: '#3c6cb0', water2: '#6898d0', crystal: '#70e8c8' },
  crystal:  { g: '#3c4470', g2: '#2c3460', g3: '#586098', tall: '#70c8e0', tall2: '#a8e8f4', path: '#586098', path2: '#3c4470', rock: '#2c2c50', rock2: '#484878', wall: '#1c1c3c', wtop: '#34345c', water: '#3c6cb0', water2: '#6898d0', crystal: '#f0a8e0' },
  crypt:    { g: '#7c7068', g2: '#6c6058', g3: '#8c8078', tall: '#4c8068', tall2: '#68a080', path: '#a09080', path2: '#807060', rock: '#4c4440', rock2: '#6c6460', wall: '#2c2830', wtop: '#484050', water: '#3c6cb0', water2: '#6898d0', crystal: '#70e8f0' },
  factory:  { g: '#6c7080', g2: '#5c6070', g3: '#7c8090', tall: '#4c8068', tall2: '#68a080', path: '#8c90a0', path2: '#6c7080', rock: '#4c4c5c', rock2: '#6c6c7c', wall: '#34343c', wtop: '#50505c', water: '#3c6cb0', water2: '#6898d0', crystal: '#e04870' },
  interior: { g: '#d8b888', g2: '#c8a878', g3: '#e4c898', path: '#b05c48', path2: '#904838', rock: '#7c5434', rock2: '#a0744c', wall: '#8c6c58', wtop: '#f0e4c8', water: '#4c98e8', water2: '#84c0f8' },
  gymgrass: { g: '#a8d890', g2: '#98c880', g3: '#b8e4a0', path: '#e4cc94', path2: '#c8ac74', rock: '#3c8048', rock2: '#58a460', wall: '#2c6038', wtop: '#48844c', water: '#4c98e8', water2: '#84c0f8' },
  gymwater: { g: '#a8d4f0', g2: '#98c4e4', g3: '#c0e4fc', path: '#e4cc94', path2: '#c8ac74', rock: '#3468b0', rock2: '#5088d0', wall: '#24488c', wtop: '#3c68b0', water: '#4c98e8', water2: '#84c0f8' },
  gymfire:  { g: '#e0b090', g2: '#d0a080', g3: '#f0c4a4', path: '#e4cc94', path2: '#c8ac74', rock: '#a84030', rock2: '#d06040', wall: '#782c24', wtop: '#a84434', water: '#4c98e8', water2: '#84c0f8' },
  gymice:   { g: '#d8ecf8', g2: '#c4dcec', g3: '#f0f8ff', path: '#e4cc94', path2: '#c8ac74', rock: '#4c88b0', rock2: '#70acd0', wall: '#346088', wtop: '#5084ac', water: '#4c98e8', water2: '#84c0f8' },
};
const ROOFS = { hearth: ['#d85848', '#a83c34'], market: ['#4878d0', '#3058a8'], gym: ['#4c4468', '#342c4c'], home: ['#b87848', '#8c5830'], house: ['#b87848', '#8c5830'], tower: ['#58a8a8', '#3c8080'], factory: ['#5c6070', '#40444f'], default: ['#b87848', '#8c5830'] };
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function disc(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) ctx.fillRect(x, y, 1, 1);
}
const R = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

export function renderMap(map) {
  const B = { ...BIOMES.meadow, ...(BIOMES[map.biome] || {}) };
  const H = map.grid.length, W = map.grid[0].length;
  const indoor = !!map.indoor;
  const at = (x, y) => (map.grid[y] && map.grid[y][x]) || (indoor ? 'W' : '#');
  const ent = (x, y) => map.ent[at(x, y)];
  const isH = (x, y) => at(x, y) === 'H' || (ent(x, y) && ent(x, y).door && (at(x - 1, y) === 'H' || at(x + 1, y) === 'H'));
  const pathy = (x, y) => { const c = at(x, y); return c === '=' || c === 'b' || (map.ent[c] && !isH(x, y)); };
  // building kinds: scan each building's bottom row for its door
  const kindAt = (x, y) => {
    let by = y; while (isH(x, by + 1)) by++;
    let lx = x; while (isH(lx - 1, by)) lx--;
    for (let xx = lx; isH(xx, by); xx++) { const e = ent(xx, by); if (e && e.door) return e.kind || 'default'; }
    return 'default';
  };
  const frames = [mk(W * T, H * T), mk(W * T, H * T)];
  const [over, octx] = mk(W * T, H * T);

  const ground = (ctx, x, y, px, py) => {
    R(ctx, B.g, px, py, T, T);
    const h = hash(x, y);
    if (indoor && map.biome === 'interior') { R(ctx, B.g2, px, py + 7, T, 1); R(ctx, B.g2, px, py + 15, T, 1); R(ctx, B.g2, px + (h % 12) + 2, py, 1, 7); R(ctx, B.g2, px + ((h >> 4) % 12) + 2, py + 8, 1, 7); return; }
    if (indoor && map.biome.startsWith('gym')) { R(ctx, B.g2, px, py, T, 1); R(ctx, B.g2, px, py, 1, T); if ((x + y) % 2) R(ctx, B.g3, px + 1, py + 1, T - 1, T - 1); return; }
    for (let i = 0; i < 3; i++) { const hx = (h >> (i * 5)) % 14, hy = (h >> (i * 5 + 3)) % 14; R(ctx, i === 2 ? B.g3 : B.g2, px + hx, py + hy, 2, 1); R(ctx, i === 2 ? B.g3 : B.g2, px + hx + 1, py + hy - 1 < py ? py : py + hy - 1, 1, 1); }
  };
  const tree = (ctx, px, py) => {
    R(ctx, B.trunk, px + 6, py + 9, 4, 7); R(ctx, '#0003', px + 9, py + 9, 1, 7);
    if (map.biome === 'snow') { // pine
      for (let i = 0; i < 4; i++) { const w = 6 + i * 3, yy = py - 7 + i * 5; ctx.fillStyle = B.tree; ctx.beginPath(); for (let r = 0; r < 6; r++) R(ctx, i % 2 ? B.tree : B.tree2, px + 8 - Math.floor((w * (r + 1)) / 12), yy + r, Math.floor((w * (r + 1)) / 6), 1); R(ctx, B.tree3, px + 8 - Math.floor(w / 6), yy, Math.max(2, Math.floor(w / 3)), 2); }
      return;
    }
    disc(ctx, px + 8, py + 4, 8, B.tree); disc(ctx, px + 7.5, py + 3, 6.5, B.tree2); disc(ctx, px + 5.5, py + 0.5, 3, B.tree3);
    R(ctx, B.tree, px + 9, py + 6, 2, 1); R(ctx, B.tree, px + 4, py + 7, 2, 1);
  };
  const draw = (ctx, f, x, y) => {
    const px = x * T, py = y * T, c = at(x, y), h = hash(x, y), e = map.ent[c];
    if (e && isH(x, y)) { building(ctx, x, y, px, py, e); return; }
    if (e) {
      const up = at(x, y - 1), dn = at(x, y + 1);
      const edgeWarp = e.warp && (x === 0 || y === 0 || x === W - 1 || y === H - 1);
      if (e.door && e.kind === 'cave') { R(ctx, B.wall || '#444', px, py, T, T); disc(ctx, px + 8, py + 9, 7, '#0c0a14'); R(ctx, '#0c0a14', px + 1, py + 9, 14, 7); return; }
      if (indoor && e.warp && y === H - 1) { R(ctx, B.path, px, py, T, T); R(ctx, B.path2, px, py, T, 2); R(ctx, '#f4e4a8', px + 2, py + 6, 12, 10); return; }
      if (indoor && e.door) { R(ctx, B.wall, px, py, T, T); disc(ctx, px + 8, py + 9, 7, '#0c0a14'); R(ctx, '#0c0a14', px + 1, py + 9, 14, 7); return; }
      ground(ctx, x, y, px, py);
      if (edgeWarp || [up, dn, at(x - 1, y), at(x + 1, y)].includes('=')) { if (!indoor) path(ctx, x, y, px, py); }
      return;
    }
    switch (c) {
      case '.': ground(ctx, x, y, px, py); break;
      case ',': ground(ctx, x, y, px, py); for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const bx = px + i * 4 + (r % 2 ? 2 : 0), by = py + 1 + r * 5; R(ctx, B.tall, bx, by + 1, 1, 4); R(ctx, B.tall2, bx + 1, by, 1, 5); R(ctx, B.tall, bx + 2, by + 2, 1, 3); } break;
      case 'F': ground(ctx, x, y, px, py); for (let i = 0; i < 3; i++) { const fx = px + 2 + ((h >> (i * 4)) % 11), fy = py + 2 + ((h >> (i * 4 + 12)) % 11), col = ['#f890b8', '#f8e060', '#ffffff', '#f8a050'][(h >> (i * 2)) % 4]; R(ctx, col, fx - 1, fy, 3, 1); R(ctx, col, fx, fy - 1, 1, 3); R(ctx, '#f8c040', fx, fy, 1, 1); } break;
      case '=': path(ctx, x, y, px, py); break;
      case 's': R(ctx, B.sand || B.path, px, py, T, T); for (let i = 0; i < 3; i++) R(ctx, B.sand2 || B.path2, px + ((h >> (i * 4)) % 14), py + ((h >> (i * 4 + 9)) % 14), 2, 1); break;
      case '~': {
        R(ctx, B.water, px, py, T, T);
        for (let i = 0; i < 2; i++) { const wx = ((h >> (i * 6)) % 10) + (f ? 2 : 0), wy = ((h >> (i * 6 + 3)) % 12) + 2; R(ctx, B.water2, px + wx, py + wy, 4, 1); R(ctx, B.water2, px + wx + 1, py + wy - 1, 2, 1); }
        if (at(x, y - 1) !== '~' && at(x, y - 1) !== 'b') { R(ctx, '#ffffffaa', px, py, T, 2); R(ctx, B.water2, px, py + 2, T, 1); }
        break;
      }
      case 'L': R(ctx, '#e8642c', px, py, T, T); for (let i = 0; i < 3; i++) disc(ctx, px + 2 + ((h >> (i * 5)) % 12) + (f ? 1 : 0), py + 2 + ((h >> (i * 5 + 3)) % 12), 1.6 + (f ? 0.6 : 0), i ? '#f8c040' : '#fff0a0'); if (at(x, y - 1) !== 'L') R(ctx, '#7c2c18', px, py, T, 2); break;
      case 'b': R(ctx, B.water, px, py, T, T); R(ctx, '#a87848', px + 1, py, 14, T); for (let i = 0; i < 4; i++) R(ctx, '#7c5430', px + 1, py + i * 4 + 3, 14, 1); R(ctx, '#5c3c20', px, py, 2, T); R(ctx, '#5c3c20', px + 14, py, 2, T); break;
      case '#': ground(ctx, x, y, px, py); tree(ctx, px, py); break;
      case 'o': ground(ctx, x, y, px, py); disc(ctx, px + 8, py + 9, 7, B.rock); disc(ctx, px + 7, py + 8, 5.5, B.rock2); disc(ctx, px + 9.5, py + 11, 3.5, B.rock); R(ctx, '#ffffff66', px + 5, py + 5, 3, 1); break;
      case 'f': ground(ctx, x, y, px, py); R(ctx, '#c8a878', px, py + 5, T, 2); R(ctx, '#c8a878', px, py + 10, T, 2); R(ctx, '#8c6c44', px + 3, py + 2, 2, 12); R(ctx, '#8c6c44', px + 11, py + 2, 2, 12); break;
      case 'W': {
        const front = at(x, y + 1) !== 'W';
        if (map.biome === 'interior') { R(ctx, front ? B.wtop : B.wall, px, py, T, T); if (front) { R(ctx, B.wall, px, py + 12, T, 4); R(ctx, '#0002', px, py + 11, T, 1); for (let i = 0; i < 4; i++) R(ctx, '#0001', px + i * 4 + 1, py, 1, 11); } break; }
        R(ctx, front ? B.wall : B.wtop, px, py, T, T);
        if (front) { R(ctx, B.wtop, px, py, T, 4); R(ctx, '#0003', px, py + 4, T, 1); for (let i = 0; i < 2; i++) R(ctx, '#0002', px + ((h >> (i * 5)) % 12), py + 7 + i * 4, 4, 1); }
        else for (let i = 0; i < 2; i++) R(ctx, '#0002', px + ((h >> (i * 5)) % 13), py + ((h >> (i * 5 + 3)) % 13), 2, 2);
        break;
      }
      case '*': ground(ctx, x, y, px, py); { const cc = B.crystal || '#70e8f0'; for (let r = 0; r < 12; r++) { const w = r < 4 ? r + 1 : r < 9 ? 5 : 13 - r; R(ctx, cc, px + 8 - Math.ceil(w / 2), py + 2 + r, w, 1); } R(ctx, '#ffffffcc', px + 6, py + 5, 1, 5); R(ctx, '#0003', px + 9, py + 5, 1, 7); for (let r = 0; r < 6; r++) R(ctx, cc, px + 11, py + 9 + r, r < 2 ? r + 1 : 2, 1); } break;
      case 'p': ground(ctx, x, y, px, py); R(ctx, B.rock2, px + 4, py + 2, 8, 13); R(ctx, B.rock, px + 10, py + 2, 2, 13); R(ctx, B.rock2, px + 2, py + 12, 12, 3); R(ctx, B.rock, px + 2, py + 14, 12, 1); R(ctx, B.rock2, px + 3, py, 10, 3); R(ctx, '#ffffff55', px + 5, py + 3, 1, 9); break;
      case 't': ground(ctx, x, y, px, py); R(ctx, '#8c6038', px + 1, py + 3, 14, 9); R(ctx, '#a87848', px + 1, py + 3, 14, 6); R(ctx, '#5c3c20', px + 2, py + 12, 2, 3); R(ctx, '#5c3c20', px + 12, py + 12, 2, 3); R(ctx, ['#f0e8d8', '#70e8f0', '#f4b840'][h % 3], px + 4 + (h % 5), py + 4, 4, 3); break;
      case 'm': ground(ctx, x, y, px, py); R(ctx, '#50545f', px + 1, py + 1, 14, 14); R(ctx, '#6c7080', px + 1, py + 1, 14, 4); R(ctx, '#2c2c34', px + 3, py + 7, 10, 5); R(ctx, f ? '#e04870' : '#70e8f0', px + 4, py + 8, 2, 2); R(ctx, f ? '#70e8f0' : '#f4b840', px + 8, py + 8, 2, 2); R(ctx, '#0005', px + 1, py + 14, 14, 1); break;
      case 'H': building(ctx, x, y, px, py, null); break;
      default: R(ctx, '#000', px, py, T, T);
    }
  };
  function path(ctx, x, y, px, py) {
    R(ctx, B.path, px, py, T, T);
    const h = hash(x, y);
    for (let i = 0; i < 2; i++) R(ctx, B.path2, px + 2 + ((h >> (i * 5)) % 11), py + 2 + ((h >> (i * 5 + 3)) % 11), 2, 1);
    if (!pathy(x, y - 1)) R(ctx, B.path2, px, py, T, 1);
    if (!pathy(x, y + 1)) R(ctx, B.path2, px, py + 15, T, 1);
    if (!pathy(x - 1, y)) R(ctx, B.path2, px, py, 1, T);
    if (!pathy(x + 1, y)) R(ctx, B.path2, px + 15, py, 1, T);
  }
  function building(ctx, x, y, px, py, e) {
    const kind = kindAt(x, y), [r1, r2] = ROOFS[kind] || ROOFS.default;
    const bottom = !isH(x, y + 1), left = !isH(x - 1, y), right = !isH(x + 1, y), top = !isH(x, y - 1);
    if (!bottom) {
      R(ctx, r1, px, py, T, T);
      for (let i = 0; i < 4; i++) { R(ctx, r2, px, py + i * 4 + 3, T, 1); R(ctx, r2, px + ((i % 2) * 4 + 3), py + i * 4, 1, 3); R(ctx, r2, px + ((i % 2) * 4 + 11) % 16, py + i * 4, 1, 3); }
      if (top) R(ctx, '#ffffff55', px, py, T, 2);
      if (left) R(ctx, r2, px, py, 2, T);
      if (right) R(ctx, r2, px + 14, py, 2, T);
      // emblem on the roof tile directly above the door
      const below = ent(x, y + 1);
      if (below && below.door && !isH(x, y + 2)) {
        disc(ctx, px + 8, py + 8, 5.5, '#f6ecd2'); disc(ctx, px + 8, py + 8, 4.5, '#2a2440');
        if (kind === 'hearth') { disc(ctx, px + 8, py + 9, 2.5, '#f4b840'); R(ctx, '#f4b840', px + 7, py + 5, 2, 3); R(ctx, '#fff4c0', px + 7, py + 8, 2, 2); }
        else if (kind === 'market') { disc(ctx, px + 8, py + 8, 3, '#f4b840'); R(ctx, '#a87020', px + 7, py + 6, 2, 4); }
        else if (kind === 'gym' || kind === 'tower') { for (let r = 0; r < 7; r++) { const w = r < 4 ? r * 2 + 1 : (6 - r) * 2 + 1; R(ctx, kind === 'tower' ? '#70e8f0' : '#f4b840', px + 8 - Math.floor(w / 2), py + 5 + r, w, 1); } }
        else if (kind === 'factory') { R(ctx, '#e04870', px + 5, py + 7, 6, 2); }
        else { R(ctx, '#f4b840', px + 6, py + 6, 4, 4); }
      }
      return;
    }
    const wall = kind === 'factory' ? '#787c88' : kind === 'gym' || kind === 'tower' ? '#d8d4e4' : '#f4e8cc';
    R(ctx, wall, px, py, T, T); R(ctx, '#0003', px, py, T, 2); R(ctx, '#0002', px, py + 14, T, 2);
    if (left) R(ctx, '#0003', px, py, 1, T);
    if (right) R(ctx, '#0003', px + 15, py, 1, T);
    if (e && e.door) {
      const dc = kind === 'factory' ? '#3c4050' : '#7c4c2c';
      R(ctx, '#2a2440', px + 2, py + 1, 12, 15); R(ctx, dc, px + 3, py + 2, 10, 14); R(ctx, '#0003', px + 8, py + 2, 1, 14); R(ctx, '#f4b840', px + 10, py + 9, 2, 2);
    } else if (hash(x, y) % 3 !== 0 || true) {
      R(ctx, '#2a2440', px + 4, py + 4, 8, 7); R(ctx, '#8cc8f0', px + 5, py + 5, 6, 5); R(ctx, '#2a2440', px + 7, py + 5, 1, 5); R(ctx, '#ffffffaa', px + 5, py + 5, 2, 2);
    }
  }
  for (let f = 0; f < 2; f++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) draw(frames[f][1], f, x, y);
  // overlay: tree tops overhang the tile above
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) === '#' && y > 0 && at(x, y - 1) !== '#') {
      octx.save(); octx.beginPath(); octx.rect(x * T - 2, (y - 1) * T, T + 4, T); octx.clip(); tree(octx, x * T, y * T); octx.restore();
    }
  }
  return { frames: frames.map((f) => f[0]), over, W, H };
}
