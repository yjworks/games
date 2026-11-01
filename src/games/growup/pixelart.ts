import type { Expression } from './engine';

/**
 * 초상용 픽셀 그림 — 프리셋 6개와, 학생이 직접 그리는 픽셀 편집기가 함께 쓰는 형식.
 * 칸 하나에 색 하나('#rrggbb', 빈칸은 '').
 */
export interface PixelGrid {
  w: number;
  h: number;
  px: string[];
}

export const GRID_SIZES = [16, 24, 32] as const;

export const blankGrid = (w: number, h = w): PixelGrid => ({ w, h, px: new Array(w * h).fill('') });

/** 크기를 바꿀 때 — 가장 가까운 칸을 그대로 가져온다(확대해도 또렷하다) */
export function resizeGrid(g: PixelGrid, w: number, h = w): PixelGrid {
  const out = blankGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    out.px[y * w + x] = g.px[Math.floor((y * g.h) / h) * g.w + Math.floor((x * g.w) / w)];
  }
  return out;
}

/** 이어진 같은 색 칸을 모두 칠한다 */
export function floodFill(g: PixelGrid, x: number, y: number, color: string): PixelGrid {
  const from = g.px[y * g.w + x];
  if (from === color) return g;
  const px = [...g.px];
  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= g.w || cy >= g.h) continue;
    const i = cy * g.w + cx;
    if (px[i] !== from) continue;
    px[i] = color;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return { ...g, px };
}

/* ── 프리셋 ── */
const BASE = [
  '................',
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '...HHHHHHHHHH...',
  '...HHSSSSSSHH...',
  '...HSSSSSSSSH...',
  '...HSEESSEESH...',
  '...SSEESSEESS...',
  '...SCSSSSSSCS...',
  '...SSSSMMSSSS...',
  '....SSSSSSSS....',
  '......SSSS......',
  '....TTKKKKTT....',
  '..TTTTTKKTTTTT..',
  '.TTTTTTTTTTTTTT.',
  '.TTTTTTTTTTTTTT.',
];

const FACE: Record<Expression, Record<number, string>> = {
  normal: {},
  happy: { 7: '...SSSSSSSSSS...', 9: '...SSSMMMMSSS...', 10: '....SSSMMSSS....' },
  tired: { 6: '...HSSSSSSSSH...' },
  sad: { 8: '...SCWSSSSSCS...', 9: '...SSSSMMSSSS...', 10: '....SSMSSMSS....' },
  sick: { 6: '...HSESSSSESH...', 7: '...SSSESSESSS...', 8: '...SGSSSSSSGS...', 9: '...SSSMSMSSSS...' },
};

type Hair = 'short' | 'long' | 'bob' | 'spiky' | 'bun' | 'pony';

export interface Preset { id: string; name: string; hair: string; shirt: string; style: Hair }

export const PRESETS: Preset[] = [
  { id: 'p1', name: '하늘', hair: '#5a3a24', shirt: '#f6c445', style: 'short' },
  { id: 'p2', name: '바다', hair: '#1f2330', shirt: '#4a8af0', style: 'long' },
  { id: 'p3', name: '들꽃', hair: '#b0602a', shirt: '#e0609a', style: 'bob' },
  { id: 'p4', name: '번개', hair: '#2a2a38', shirt: '#e05040', style: 'spiky' },
  { id: 'p5', name: '구름', hair: '#7a4a2a', shirt: '#4fbf6b', style: 'bun' },
  { id: 'p6', name: '별', hair: '#c98a3a', shirt: '#8b6cf0', style: 'pony' },
];

const COLORS: Record<string, string> = {
  S: '#ffd9bf', E: '#2a2230', C: '#ff9aa8', M: '#c94a5a', K: '#f4f4f8', W: '#8fd0ff', G: '#b8d8a0', R: '#ff5a7a',
};

export function presetGrid(p: Preset, expr: Expression = 'normal'): PixelGrid {
  const rows = BASE.map((r, i) => (FACE[expr][i] ?? r).split(''));
  const set = (x: number, y: number, c: string) => { if (rows[y]?.[x] !== undefined) rows[y][x] = c; };
  switch (p.style) {
    case 'long':
      for (let y = 4; y <= 14; y++) { set(2, y, 'H'); set(13, y, 'H'); }
      for (let y = 7; y <= 10; y++) { set(3, y, 'H'); set(12, y, 'H'); }
      break;
    case 'bob':
      for (let y = 4; y <= 10; y++) { set(2, y, 'H'); set(13, y, 'H'); }
      break;
    case 'spiky':
      rows[0] = '....H..HH..H....'.split('');
      rows[1] = '....HHHHHHHH....'.split('');
      break;
    case 'bun':
      rows[0] = '......HHHH......'.split('');
      break;
    case 'pony':
      for (let y = 3; y <= 9; y++) { set(13, y, 'H'); set(14, y, 'H'); }
      set(13, 3, 'R');
      break;
    default:
      break;
  }
  const pal: Record<string, string> = { ...COLORS, H: p.hair, T: p.shirt };
  return { w: 16, h: 16, px: rows.flat().map((c) => (c === '.' ? '' : pal[c] ?? '')) };
}

/* ── 그림 ↔ 이미지 ── */
export function gridToDataUrl(g: PixelGrid): string {
  const c = document.createElement('canvas');
  c.width = g.w;
  c.height = g.h;
  const ctx = c.getContext('2d')!;
  g.px.forEach((col, i) => {
    if (!col) return;
    ctx.fillStyle = col;
    ctx.fillRect(i % g.w, Math.floor(i / g.w), 1, 1);
  });
  return c.toDataURL('image/png');
}

/** 저장해 둔 작은 그림을 편집기 칸으로 되돌린다(최대 32칸) */
export function imageToGrid(url: string): Promise<PixelGrid | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width > 32 || img.height > 32) { resolve(null); return; }
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      const px: string[] = [];
      for (let i = 0; i < d.length; i += 4) {
        px.push(d[i + 3] < 128 ? '' : `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
      }
      resolve({ w: img.width, h: img.height, px });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 편집기 기본 팔레트 — 피부·머리·옷에 자주 쓰는 색 */
export const PALETTE = [
  '#2a2230', '#5a5a6a', '#9aa0aa', '#f4f4f8',
  '#ffd9bf', '#f2bfa0', '#c98a5a', '#7a4a2a',
  '#3a2a20', '#1f2330', '#c94a5a', '#ff9aa8',
  '#e05040', '#f6c445', '#4fbf6b', '#2f7a4a',
  '#8fd0ff', '#4a8af0', '#34497e', '#8b6cf0',
];
