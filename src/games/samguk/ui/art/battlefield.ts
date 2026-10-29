import type { Tile, TileType } from '../../engine/battlemap';
import { seeded } from './util';
import { seasonOf } from '../labels';

/**
 * 전장 그림 — 칸마다 단색을 칠하던 것을 캔버스 한 장에 이어 그린다.
 * 바닥색을 번지게 칠한 뒤 물·길·늪·구릉·산·숲·마을·성벽(이웃 성벽과 잇는다)·성문·관문·본진을 얹는다.
 * 칸 모양은 바뀌지 않으므로 지형이 바뀔 때(성벽이 무너질 때)만 다시 그린다.
 */

export const HEX_R = 30;
export const HEX_W = Math.sqrt(3) * HEX_R;
export const hexCenter = (q: number, r: number): [number, number] => [q * HEX_W + (r % 2 ? HEX_W / 2 : 0) + HEX_W / 2, r * 1.5 * HEX_R + HEX_R];

const SCALE = 2;
const DIRS_EVEN: [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const DIRS_ODD: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

interface Field { W: number; H: number; tiles: Tile[] }

const BASE: Record<TileType, string> = {
  plain: '#76843f', road: '#76843f', forest: '#4f6a2c', hill: '#8d8448', mountain: '#7b7058', peak: '#6c6254',
  marsh: '#5f6f44', water: '#2f6a86', ford: '#4f8ea6', bridge: '#2f6a86', village: '#7d8a45', dam: '#8b7c55',
  wall: '#857a63', gate: '#857a63', pass: '#7b7058', inner: '#8a7d63', keep: '#8a7d63', breach: '#7d725e',
};
const WATERY = new Set<TileType>(['water', 'ford', 'bridge']);
const WALLISH = new Set<TileType>(['wall', 'gate', 'breach']);
const ROADISH = new Set<TileType>(['road', 'gate', 'bridge', 'pass', 'breach', 'keep', 'dam']);

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rr: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function nb(f: Field, q: number, r: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  (r % 2 === 0 ? DIRS_EVEN : DIRS_ODD).forEach(([dq, dr], d) => {
    const nq = q + dq, nr = r + dr;
    if (nq >= 0 && nq < f.W && nr >= 0 && nr < f.H) out.push([nq, nr, d]);
  });
  return out;
}

const tt = (f: Field, q: number, r: number) => f.tiles[r * f.W + q].t;

/** 지형이 바뀌었는지 알아보는 열쇠 */
export function fieldKey(f: Field): string {
  return f.tiles.map((t) => `${t.t[0]}${t.t[1]}${t.max && t.hp < t.max * 0.5 ? '!' : ''}`).join('');
}

const cache = new Map<string, string>();

export function paintField(f: Field, month: number): string {
  const key = `${f.W}x${f.H}:${month}:${fieldKey(f)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = draw(f, month, false);
  if (!cv) return '';
  const url = cv.toDataURL('image/webp', 0.86);
  if (cache.size > 6) cache.delete(cache.keys().next().value as string);
  cache.set(key, url);
  return url;
}

/** 3D 전장의 바닥 그림 — 숲·산·집·성벽은 3D로 따로 세우므로 땅·물·길만 칠한다 */
export function paintGround(f: Field, month: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  return draw(f, month, true);
}

function draw(f: Field, month: number, groundOnly: boolean): HTMLCanvasElement | null {
  const w = Math.ceil(f.W * HEX_W + HEX_W / 2), h = Math.ceil(f.H * 1.5 * HEX_R + HEX_R / 2);
  const cv = document.createElement('canvas');
  cv.width = w * SCALE; cv.height = h * SCALE;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  const winter = seasonOf(month) === 'winter';
  const autumn = seasonOf(month) === 'autumn';
  const each = (fn: (q: number, r: number, t: Tile, cx: number, cy: number, rnd: () => number) => void) => {
    for (let r = 0; r < f.H; r++) for (let q = 0; q < f.W; q++) {
      const [cx, cy] = hexCenter(q, r);
      fn(q, r, f.tiles[r * f.W + q], cx, cy, seeded(r * 977 + q * 131 + 7));
    }
  };

  /* 1. 바닥색 — 넓게 칠하고 번지게 */
  const ground = document.createElement('canvas');
  ground.width = cv.width; ground.height = cv.height;
  const g = ground.getContext('2d')!;
  g.scale(SCALE, SCALE);
  g.fillStyle = '#6c7a3c';
  g.fillRect(0, 0, w, h);
  each((_q, _r, t, cx, cy, rnd) => {
    let c = BASE[t.t];
    if (winter && !WATERY.has(t.t)) c = mixHex(c, '#e8ece6', t.t === 'peak' || t.t === 'mountain' ? 0.5 : 0.3);
    else if (autumn && (t.t === 'plain' || t.t === 'village' || t.t === 'road')) c = mixHex(c, '#b08a3e', 0.35);
    else if (autumn && t.t === 'forest') c = mixHex(c, '#8a4a22', 0.3);
    g.fillStyle = mixHex(c, rnd() < 0.5 ? '#000000' : '#ffffff', rnd() * 0.07);
    hexPath(g, cx, cy, HEX_R * 1.08);
    g.fill();
  });
  ctx.filter = 'blur(7px)';
  ctx.drawImage(ground, 0, 0, w, h);
  ctx.filter = 'none';

  /* 2. 결 — 풀잎·흙 알갱이 */
  each((_q, _r, t, cx, cy, rnd) => {
    if (WATERY.has(t.t)) return;
    const n = t.t === 'plain' || t.t === 'village' || t.t === 'hill' ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * HEX_R;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.9;
      ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,250,200,0.14)' : 'rgba(20,24,8,0.16)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 2, y - 2.5 - rnd() * 2.5);
      ctx.stroke();
    }
  });

  /* 3. 물 — 강·여울, 물가에 흰 거품 */
  const waterLayer = document.createElement('canvas');
  waterLayer.width = cv.width; waterLayer.height = cv.height;
  const wl = waterLayer.getContext('2d')!;
  wl.scale(SCALE, SCALE);
  each((_q, _r, t, cx, cy) => {
    if (!WATERY.has(t.t)) return;
    wl.fillStyle = t.t === 'ford' ? '#4f8ea6' : winter ? '#55819a' : '#2f6a86';
    hexPath(wl, cx, cy, HEX_R * 1.04);
    wl.fill();
  });
  ctx.save();
  ctx.filter = 'blur(2.2px)';
  ctx.drawImage(waterLayer, 0, 0, w, h);
  ctx.restore();
  each((q, r, t, cx, cy, rnd) => {
    if (!WATERY.has(t.t)) return;
    ctx.strokeStyle = t.t === 'ford' ? 'rgba(220,240,245,0.4)' : 'rgba(170,215,230,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = cy - 14 + i * 8 + rnd() * 3, x = cx - 16 + rnd() * 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 6, y - 3, x + 12, y);
      ctx.quadraticCurveTo(x + 18, y + 3, x + 24, y);
      ctx.stroke();
    }
    if (t.t === 'ford') {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(160,160,140,0.85)';
        ctx.beginPath();
        ctx.ellipse(cx + (rnd() - 0.5) * 36, cy + (rnd() - 0.5) * 30, 2.4 + rnd() * 2, 1.6 + rnd(), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    /* 물가 */
    for (const [nq, nr] of nb(f, q, r)) {
      if (WATERY.has(tt(f, nq, nr))) continue;
      const [nx, ny] = hexCenter(nq, nr);
      const mx = (cx + nx) / 2, my = (cy + ny) / 2;
      const ang = Math.atan2(ny - cy, nx - cx) + Math.PI / 2;
      const L = HEX_R * 0.6;
      ctx.strokeStyle = 'rgba(235,240,225,0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(mx - Math.cos(ang) * L, my - Math.sin(ang) * L);
      ctx.lineTo(mx + Math.cos(ang) * L, my + Math.sin(ang) * L);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(80,60,30,0.35)';
      ctx.lineWidth = 3;
      const ox = (nx - cx) * 0.06, oy = (ny - cy) * 0.06;
      ctx.beginPath();
      ctx.moveTo(mx - Math.cos(ang) * L + ox, my - Math.sin(ang) * L + oy);
      ctx.lineTo(mx + Math.cos(ang) * L + ox, my + Math.sin(ang) * L + oy);
      ctx.stroke();
    }
  });

  /* 4. 길 — 이웃 길과 흙길로 잇는다 */
  const roads: [number, number, number, number][] = [];
  each((q, r, t, cx, cy) => {
    if (!ROADISH.has(t.t)) return;
    let linked = 0;
    for (const [nq, nr] of nb(f, q, r)) {
      if (!ROADISH.has(tt(f, nq, nr))) continue;
      linked++;
      if (nr * f.W + nq < r * f.W + q) continue;
      const [nx, ny] = hexCenter(nq, nr);
      roads.push([cx, cy, nx, ny]);
    }
    if (!linked) roads.push([cx - 10, cy, cx + 10, cy]);
  });
  for (const [lw, col] of [[15, 'rgba(70,50,25,0.45)'], [11, winter ? '#cfc6b2' : '#a68c5c'], [4, winter ? 'rgba(255,255,255,0.35)' : 'rgba(210,190,140,0.5)']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [x1, y1, x2, y2] of roads) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo((x1 + x2) / 2 + (y2 - y1) * 0.06, (y1 + y2) / 2 + (x1 - x2) * 0.06, x2, y2);
      ctx.stroke();
    }
  }

  /* 5. 지형 장식 */
  each((_q, _r, t, cx, cy, rnd) => {
    if (groundOnly && t.t !== 'marsh' && t.t !== 'village' && t.t !== 'inner') return;
    if (groundOnly && t.t === 'inner') { ctx.fillStyle = 'rgba(60,50,35,0.25)'; hexPath(ctx, cx, cy, HEX_R * 0.98); ctx.fill(); return; }
    if (groundOnly && t.t === 'village') {
      ctx.strokeStyle = 'rgba(60,50,20,0.25)';
      ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx - 24, cy + 14 + i * 4); ctx.lineTo(cx + 24, cy + 10 + i * 4); ctx.stroke(); }
      return;
    }
    switch (t.t) {
      case 'marsh':
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = 'rgba(90,130,135,0.75)';
          ctx.beginPath();
          ctx.ellipse(cx + (rnd() - 0.5) * 34, cy + (rnd() - 0.5) * 28, 6 + rnd() * 6, 2.5 + rnd() * 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#4a5228';
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          const x = cx + (rnd() - 0.5) * 40, y = cy + (rnd() - 0.5) * 34;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 1, y - 6 - rnd() * 4); ctx.stroke();
        }
        break;
      case 'hill':
        for (let i = 0; i < 2; i++) mound(ctx, cx + (i ? 9 : -8) + (rnd() - 0.5) * 6, cy + (i ? 6 : -4), 17 + rnd() * 5, 9 + rnd() * 3, winter);
        break;
      case 'mountain':
      case 'pass':
        if (t.t === 'mountain') {
          rock(ctx, cx - 10 + rnd() * 4, cy + 10, 22, 26 + rnd() * 6, rnd, winter, false);
          rock(ctx, cx + 9 + rnd() * 4, cy + 13, 18, 20 + rnd() * 6, rnd, winter, false);
        }
        break;
      case 'peak':
        rock(ctx, cx - 9, cy + 14, 24, 36 + rnd() * 6, rnd, winter, true);
        rock(ctx, cx + 10, cy + 16, 20, 30 + rnd() * 6, rnd, winter, true);
        break;
      case 'forest':
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + rnd() * 0.5, d = i === 8 ? 0 : 12 + rnd() * 9;
          tree(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85 + 4, 7 + rnd() * 3, winter, autumn, rnd);
        }
        break;
      case 'village': {
        ctx.strokeStyle = 'rgba(60,50,20,0.25)';
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx - 24, cy + 14 + i * 4); ctx.lineTo(cx + 24, cy + 10 + i * 4); ctx.stroke(); }
        house(ctx, cx - 11, cy - 4, 1, winter);
        house(ctx, cx + 9, cy - 8, 0.9, winter);
        house(ctx, cx + 1, cy + 8, 1.05, winter);
        break;
      }
      case 'inner':
        ctx.fillStyle = 'rgba(60,50,35,0.25)';
        hexPath(ctx, cx, cy, HEX_R * 0.98); ctx.fill();
        for (let i = 0; i < 2; i++) house(ctx, cx + (i ? 10 : -10) + (rnd() - 0.5) * 6, cy + (i ? 6 : -6) + (rnd() - 0.5) * 6, 0.85, winter);
        break;
      case 'dam': {
        ctx.fillStyle = '#9a8a60';
        ctx.strokeStyle = '#4e4430';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 24, cy + 8); ctx.lineTo(cx - 17, cy - 8); ctx.lineTo(cx + 17, cy - 8); ctx.lineTo(cx + 24, cy + 8); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,50,30,0.6)';
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx - 18 + i * 2, cy - 2 + Math.abs(i)); ctx.lineTo(cx + 18 - i * 2, cy - 2 + Math.abs(i)); ctx.stroke(); }
        break;
      }
      default:
    }
  });

  if (groundOnly) return cv;

  /* 6. 성벽 — 이웃 성벽·성문과 이어 쌓는다 */
  const walls: [number, number, number, number][] = [];
  each((q, r, t, cx, cy) => {
    if (!WALLISH.has(t.t)) return;
    for (const [nq, nr] of nb(f, q, r)) {
      if (!WALLISH.has(tt(f, nq, nr)) || nr * f.W + nq < r * f.W + q) continue;
      const [nx, ny] = hexCenter(nq, nr);
      const broken = t.t === 'breach' || tt(f, nq, nr) === 'breach';
      if (!broken) walls.push([cx, cy, nx, ny]);
    }
  });
  ctx.lineCap = 'butt';
  for (const [lw, col] of [[19, '#2c241a'], [15, winter ? '#c9c3b6' : '#a89c80'], [6, winter ? '#e6e2d8' : '#c4b898']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    for (const [x1, y1, x2, y2] of walls) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  }
  /* 성가퀴 */
  ctx.fillStyle = winter ? '#ddd8cc' : '#bdb192';
  ctx.strokeStyle = '#2c241a';
  ctx.lineWidth = 0.8;
  for (const [x1, y1, x2, y2] of walls) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    for (let s = 4; s < len - 2; s += 7) {
      const x = x1 + ux * s - uy * 7, y = y1 + uy * s + ux * 7;
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.strokeRect(x - 2, y - 2, 4, 4);
    }
  }
  each((q, r, t, cx, cy, rnd) => {
    if (t.t === 'wall') {
      ctx.fillStyle = winter ? '#d4cfc3' : '#b3a688';
      ctx.strokeStyle = '#2c241a';
      ctx.lineWidth = 1.2;
      ctx.fillRect(cx - 9, cy - 9, 18, 18);
      ctx.strokeRect(cx - 9, cy - 9, 18, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx - 9, cy + 3, 18, 6);
      if (t.max && t.hp < t.max * 0.5) cracks(ctx, cx, cy, rnd);
    } else if (t.t === 'gate') {
      gatehouse(ctx, cx, cy, !!(t.max && t.hp < t.max * 0.5), rnd, winter);
    } else if (t.t === 'breach') {
      rubble(ctx, cx, cy, rnd);
    } else if (t.t === 'pass') {
      passGate(ctx, cx, cy, !!(t.max && t.hp < t.max * 0.5), rnd, winter);
    } else if (t.t === 'keep') {
      palace(ctx, cx, cy, winter);
    } else if (t.t === 'bridge') {
      bridge(ctx, f, q, r, cx, cy);
    }
  });

  /* 7. 마무리 — 가장자리 그늘, 따뜻한 빛 */
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(20,10,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = winter ? 'rgba(200,215,230,0.08)' : 'rgba(255,220,150,0.06)';
  ctx.fillRect(0, 0, w, h);

  return cv;
}

/* ───────── 그림 조각 ───────── */

function mixHex(a: string, b: string, t: number): string {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const h = (x: number) => Math.round(x).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

function mound(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, winter: boolean) {
  const gr = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.6, 1, x, y, rx);
  gr.addColorStop(0, winter ? '#f4f4ee' : '#b5a96a');
  gr.addColorStop(0.6, winter ? '#d9dcd4' : '#8f8448');
  gr.addColorStop(1, winter ? 'rgba(180,185,180,0)' : 'rgba(95,85,45,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, Math.PI, 0);
  ctx.quadraticCurveTo(x + rx, y + ry * 0.4, x, y + ry * 0.35);
  ctx.quadraticCurveTo(x - rx, y + ry * 0.4, x - rx, y);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,25,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 0.95, ry * 0.95, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
}

function rock(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, ht: number, rnd: () => number, winter: boolean, high: boolean) {
  const tx = x + (rnd() - 0.5) * hw * 0.4, ty = y - ht;
  /* 그늘 */
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 1, hw, 4, 0, 0, Math.PI * 2); ctx.fill();
  /* 밝은 면 */
  ctx.fillStyle = high ? '#a29585' : '#9c8e6c';
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x - hw * 0.45, y - ht * 0.55);
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx + 2, y);
  ctx.closePath();
  ctx.fill();
  /* 어두운 면 */
  ctx.fillStyle = high ? '#5c5249' : '#6a5d45';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(x + hw * 0.5, y - ht * 0.45);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(tx + 2, y);
  ctx.closePath();
  ctx.fill();
  /* 눈 */
  if (high || winter) {
    ctx.fillStyle = '#f1efe9';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - hw * 0.28, ty + ht * 0.3);
    ctx.lineTo(tx - hw * 0.08, ty + ht * 0.24);
    ctx.lineTo(tx + hw * 0.06, ty + ht * 0.34);
    ctx.lineTo(tx + hw * 0.22, ty + ht * 0.26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2218';
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.lineTo(x - hw * 0.45, y - ht * 0.55);
  ctx.lineTo(tx, ty);
  ctx.lineTo(x + hw * 0.5, y - ht * 0.45);
  ctx.lineTo(x + hw, y);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(tx, ty); ctx.lineTo(tx + 1, y - ht * 0.3);
  ctx.moveTo(x - hw * 0.45, y - ht * 0.55); ctx.lineTo(x - hw * 0.3, y - ht * 0.2);
  ctx.stroke();
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, winter: boolean, autumn: boolean, rnd: () => number) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 2, s * 0.9, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3e2a16';
  ctx.fillRect(x - 0.9, y - s * 0.4, 1.8, s * 0.6);
  const base = winter ? '#5f6a5a' : autumn ? (rnd() < 0.5 ? '#a8582a' : '#b98a2e') : rnd() < 0.5 ? '#3f5f26' : '#4d6d2c';
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.9, s * 0.85, s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = winter ? '#eef0ea' : 'rgba(190,220,130,0.35)';
  ctx.beginPath(); ctx.ellipse(x - s * 0.25, y - s * 1.25, s * 0.45, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(20,28,10,0.65)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.9, s * 0.85, s, 0, 0, Math.PI * 2); ctx.stroke();
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, winter: boolean) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x - 7 * k + 2, y + 3 * k, 14 * k, 3);
  ctx.fillStyle = '#d6c49c';
  ctx.strokeStyle = '#3a2614';
  ctx.lineWidth = 0.8;
  ctx.fillRect(x - 6 * k, y - 2 * k, 12 * k, 6 * k);
  ctx.strokeRect(x - 6 * k, y - 2 * k, 12 * k, 6 * k);
  ctx.fillStyle = winter ? '#eceae4' : '#6e3a24';
  ctx.beginPath();
  ctx.moveTo(x - 8.5 * k, y - 1.5 * k);
  ctx.lineTo(x - 5 * k, y - 7 * k);
  ctx.lineTo(x + 5 * k, y - 7 * k);
  ctx.lineTo(x + 8.5 * k, y - 1.5 * k);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2614';
  ctx.fillRect(x - 1.2 * k, y + 0.5 * k, 2.4 * k, 3.5 * k);
}

function roof(ctx: CanvasRenderingContext2D, x: number, y: number, hw: number, ht: number, col: string) {
  ctx.fillStyle = col;
  ctx.strokeStyle = '#1c120a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - hw - 3, y);
  ctx.quadraticCurveTo(x - hw * 0.5, y - ht * 0.6, x - hw * 0.55, y - ht);
  ctx.lineTo(x + hw * 0.55, y - ht);
  ctx.quadraticCurveTo(x + hw * 0.5, y - ht * 0.6, x + hw + 3, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function gatehouse(ctx: CanvasRenderingContext2D, x: number, y: number, damaged: boolean, rnd: () => number, winter: boolean) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 15, y + 8, 32, 5);
  ctx.fillStyle = '#b8ab8c';
  ctx.strokeStyle = '#2c241a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(x - 15, y - 6, 30, 16);
  ctx.strokeRect(x - 15, y - 6, 30, 16);
  ctx.fillStyle = '#5a361c';
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 10); ctx.lineTo(x - 6, y + 1); ctx.quadraticCurveTo(x, y - 4, x + 6, y + 1); ctx.lineTo(x + 6, y + 10); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9a13e';
  for (const [dx, dy] of [[-3, 3], [3, 3], [-3, 7], [3, 7]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 0.9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#d8c6a0';
  ctx.fillRect(x - 11, y - 13, 22, 8);
  ctx.strokeRect(x - 11, y - 13, 22, 8);
  ctx.fillStyle = '#7a2a1c';
  for (const dx of [-7, -2, 3]) ctx.fillRect(x + dx, y - 11.5, 2.5, 5);
  roof(ctx, x, y - 12, 13, 8, winter ? '#dfe0dc' : '#8a2a1e');
  if (damaged) cracks(ctx, x, y, rnd);
}

function passGate(ctx: CanvasRenderingContext2D, x: number, y: number, damaged: boolean, rnd: () => number, winter: boolean) {
  rock(ctx, x - 20, y + 12, 12, 22, rnd, winter, false);
  rock(ctx, x + 20, y + 12, 12, 22, rnd, winter, false);
  ctx.fillStyle = '#a89878';
  ctx.strokeStyle = '#2c241a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(x - 16, y - 4, 32, 15);
  ctx.strokeRect(x - 16, y - 4, 32, 15);
  ctx.fillStyle = '#3a2210';
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 11); ctx.lineTo(x - 5, y + 3); ctx.quadraticCurveTo(x, y - 1, x + 5, y + 3); ctx.lineTo(x + 5, y + 11); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d8c6a0';
  ctx.fillRect(x - 10, y - 11, 20, 7);
  ctx.strokeRect(x - 10, y - 11, 20, 7);
  roof(ctx, x, y - 10, 12, 8, winter ? '#dfe0dc' : '#6b2a1c');
  ctx.fillStyle = '#d9b44a';
  ctx.font = 'bold 7px serif';
  ctx.textAlign = 'center';
  ctx.fillText('關', x, y - 5.5);
  if (damaged) cracks(ctx, x, y, rnd);
}

function palace(ctx: CanvasRenderingContext2D, x: number, y: number, winter: boolean) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x + 3, y + 13, 26, 6, 0, 0, Math.PI * 2); ctx.fill();
  /* 기단 */
  ctx.fillStyle = '#c9bc9c';
  ctx.strokeStyle = '#2c241a';
  ctx.lineWidth = 1;
  ctx.fillRect(x - 24, y + 4, 48, 8);
  ctx.strokeRect(x - 24, y + 4, 48, 8);
  ctx.fillStyle = '#e4d5b0';
  ctx.fillRect(x - 18, y - 6, 36, 11);
  ctx.strokeRect(x - 18, y - 6, 36, 11);
  ctx.fillStyle = '#8a2a1e';
  for (let i = 0; i < 6; i++) ctx.fillRect(x - 15 + i * 6, y - 5, 2.4, 10);
  roof(ctx, x, y - 5, 21, 10, winter ? '#e5e4df' : '#c9a13e');
  ctx.fillStyle = '#e8d9b5';
  ctx.fillRect(x - 10, y - 20, 20, 6);
  ctx.strokeRect(x - 10, y - 20, 20, 6);
  roof(ctx, x, y - 19, 13, 9, winter ? '#e5e4df' : '#c9a13e');
  ctx.strokeStyle = '#4a3210';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x, y - 33); ctx.stroke();
}

function bridge(ctx: CanvasRenderingContext2D, f: Field, q: number, r: number, cx: number, cy: number) {
  const link = nb(f, q, r).filter(([nq, nr]) => !WATERY.has(tt(f, nq, nr)) || tt(f, nq, nr) === 'bridge');
  let ang = 0;
  if (link.length) {
    const [nx, ny] = hexCenter(link[0][0], link[0][1]);
    ang = Math.atan2(ny - cy, nx - cx);
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-30, -6, 60, 14);
  ctx.fillStyle = '#8a6239';
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 0.8;
  ctx.fillRect(-30, -8, 60, 14);
  for (let x = -30; x < 30; x += 4) { ctx.beginPath(); ctx.moveTo(x, -8); ctx.lineTo(x, 6); ctx.stroke(); }
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-30, -8); ctx.lineTo(30, -8); ctx.moveTo(-30, 6); ctx.lineTo(30, 6); ctx.stroke();
  ctx.restore();
}

function cracks(ctx: CanvasRenderingContext2D, x: number, y: number, rnd: () => number) {
  ctx.strokeStyle = 'rgba(20,12,6,0.85)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    let px = x + (rnd() - 0.5) * 14, py = y - 8 + rnd() * 4;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let k = 0; k < 3; k++) { px += (rnd() - 0.5) * 7; py += 3 + rnd() * 3; ctx.lineTo(px, py); }
    ctx.stroke();
  }
}

function rubble(ctx: CanvasRenderingContext2D, x: number, y: number, rnd: () => number) {
  for (let i = 0; i < 12; i++) {
    const px = x + (rnd() - 0.5) * 34, py = y + (rnd() - 0.5) * 26, s = 2 + rnd() * 4;
    ctx.fillStyle = rnd() < 0.5 ? '#a49880' : '#7d725e';
    ctx.strokeStyle = '#2c241a';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(px - s, py + s * 0.6); ctx.lineTo(px - s * 0.3, py - s); ctx.lineTo(px + s, py - s * 0.2); ctx.lineTo(px + s * 0.6, py + s * 0.7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
