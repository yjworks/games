import { FieldKey, Stage } from './types';
import { B, BLOCK, COLS, GROUND, Grid, HEIGHT, PROP_X, ROWS, Season, TROPHY_X, WIDTH, at, buildWorld, Building } from './world';
import { FIELD_PROPS, TROPHY, drawProp } from './sprites';

/**
 * 블록 마을 그리기 — 블록 무늬는 코드로 만든 10×10 픽셀 텍스처(이미지 파일 없음).
 * 움직이지 않는 부분(하늘·언덕·블록·소품)은 한 번 그려 두고, 사람·구름·날씨만 매 프레임 그린다.
 */
export type Sky = 'day' | 'dusk' | 'night';

export function skyOf(hour: number): Sky {
  if (hour >= 19 || hour < 5) return 'night';
  if (hour >= 17 || hour < 7) return 'dusk';
  return 'day';
}

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── 계절 색 ── */
const GRASS: Record<Season, string[]> = {
  봄: ['#7ccf5a', '#68b84a', '#f2a8c8'],
  여름: ['#4fae3c', '#3f9230', '#5fc04a'],
  가을: ['#b8a845', '#9a8a35', '#d08a35'],
  겨울: ['#f4f8ff', '#dfe8f4', '#ffffff'],
};
const LEAF: Record<Season, string[]> = {
  봄: ['#f2a8c8', '#e888b0', '#7ccf5a', '#ffd0e0'],
  여름: ['#3f9a3a', '#2f7a2c', '#55b048', '#2a6a28'],
  가을: ['#e07a30', '#c94a2a', '#f2c230', '#b05a28'],
  겨울: ['#e8eef8', '#ffffff', '#7a5530', '#d0dae8'],
};

/** 블록 하나의 10×10 텍스처 */
function paintBlock(b: B, season: Season, lit: boolean, variant: number): HTMLCanvasElement {
  const c = mkCanvas(BLOCK, BLOCK);
  const x = c.getContext('2d')!;
  const r = rng(b * 97 + variant * 31 + 7);
  const px = (i: number, j: number, col: string) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  const fill = (col: string) => { x.fillStyle = col; x.fillRect(0, 0, BLOCK, BLOCK); };
  const noise = (cols: string[], p: number) => {
    for (let j = 0; j < BLOCK; j++) for (let i = 0; i < BLOCK; i++) if (r() < p) px(i, j, cols[Math.floor(r() * cols.length)]);
  };
  const dirt = () => { fill('#8a5a35'); noise(['#6e4527', '#a06a40', '#7a4e2e'], 0.35); };

  switch (b) {
    case B.Grass: {
      dirt();
      const [g1, g2, g3] = GRASS[season];
      for (let i = 0; i < BLOCK; i++) {
        const d = 2 + Math.floor(r() * 2);
        for (let j = 0; j < d; j++) px(i, j, r() < 0.2 ? g2 : g1);
        if (r() < 0.15) px(i, d, g3);
      }
      break;
    }
    case B.Dirt: dirt(); break;
    case B.Stone: fill('#8a8d93'); noise(['#767980', '#9ea1a8', '#6e7178'], 0.4); break;
    case B.Coal: fill('#8a8d93'); noise(['#767980', '#9ea1a8'], 0.35);
      for (let k = 0; k < 4; k++) { const i = 1 + Math.floor(r() * 7); const j = 1 + Math.floor(r() * 7); x.fillStyle = '#2a2a2e'; x.fillRect(i, j, 2, 2); }
      break;
    case B.Gold: fill('#8a8d93'); noise(['#767980', '#9ea1a8'], 0.35);
      for (let k = 0; k < 3; k++) { const i = 1 + Math.floor(r() * 7); const j = 1 + Math.floor(r() * 7); x.fillStyle = '#f2c230'; x.fillRect(i, j, 2, 1); px(i, j + 1, '#ffe680'); }
      break;
    case B.Plank:
      fill('#c49a5a'); noise(['#b88c4c', '#d0a868'], 0.25);
      x.fillStyle = '#9a7440'; x.fillRect(0, 4, BLOCK, 1); x.fillRect(0, 9, BLOCK, 1);
      x.fillRect(variant ? 3 : 7, 0, 1, 4); x.fillRect(variant ? 8 : 2, 5, 1, 4);
      break;
    case B.Log:
      fill('#7a5530');
      for (let i = 0; i < BLOCK; i += 3) { x.fillStyle = '#5e4024'; x.fillRect(i, 0, 1, BLOCK); }
      noise(['#8a6538', '#6a4828'], 0.2);
      break;
    case B.Leaf: {
      const l = LEAF[season];
      fill(l[0]); noise(l, 0.6);
      for (let k = 0; k < 4; k++) px(Math.floor(r() * 10), Math.floor(r() * 10), 'rgba(0,0,0,0.25)');
      break;
    }
    case B.Brick:
      fill('#b5523a'); noise(['#a4462f', '#c4614a'], 0.25);
      x.fillStyle = '#d8c8b8'; x.fillRect(0, 4, BLOCK, 1); x.fillRect(0, 9, BLOCK, 1);
      x.fillRect(4, 0, 1, 4); x.fillRect(9, 0, 1, 4); x.fillRect(1, 5, 1, 4); x.fillRect(6, 5, 1, 4);
      break;
    case B.Roof:
      fill('#8a3a3a'); noise(['#7a3232', '#9a4444'], 0.25);
      x.fillStyle = '#6e2c2c'; x.fillRect(0, 3, BLOCK, 1); x.fillRect(0, 8, BLOCK, 1);
      break;
    case B.Glass:
      if (lit) { fill('#ffd36a'); noise(['#ffe08a', '#f2c050'], 0.3); }
      else { fill('#a8dcf0'); x.fillStyle = '#d8f0fa'; x.fillRect(2, 2, 1, 3); x.fillRect(3, 2, 1, 1); }
      x.fillStyle = lit ? '#b08a40' : '#e8f6ff';
      x.fillRect(0, 0, BLOCK, 1); x.fillRect(0, 9, BLOCK, 1); x.fillRect(0, 0, 1, BLOCK); x.fillRect(9, 0, 1, BLOCK);
      x.fillRect(5, 0, 1, BLOCK);
      break;
    case B.Door:
      fill('#7a5530');
      x.fillStyle = '#5e4024'; x.fillRect(1, 1, 8, 8);
      x.fillStyle = '#8a6538'; x.fillRect(2, 2, 6, 6);
      if (variant) { px(7, 5, '#f2c230'); }
      break;
    case B.Cobble:
      fill('#7a7d84');
      for (let k = 0; k < 6; k++) { x.fillStyle = r() < 0.5 ? '#5e6168' : '#9a9da4'; x.fillRect(Math.floor(r() * 8), Math.floor(r() * 8), 2 + Math.floor(r() * 2), 2); }
      x.fillStyle = '#55585e'; x.fillRect(0, 9, BLOCK, 1); x.fillRect(9, 0, 1, BLOCK);
      break;
    case B.WoolR: fill('#d84848'); noise(['#c43c3c', '#e45a5a'], 0.3); break;
    case B.WoolW: fill('#f4f4f4'); noise(['#e4e4e4', '#ffffff'], 0.3); break;
    case B.WoolB: fill('#4a7ad8'); noise(['#3c68c4', '#5a8ae4'], 0.3); break;
    case B.Lamp:
      fill('#7a5530'); x.fillStyle = lit ? '#fff0a0' : '#ffd36a'; x.fillRect(2, 2, 6, 6);
      x.fillStyle = lit ? '#ffe680' : '#f2b040'; x.fillRect(3, 3, 4, 4);
      break;
    case B.Quartz:
      fill('#ece8e0'); noise(['#e0dcd2', '#f6f2ea'], 0.2);
      x.fillStyle = '#d0ccc4'; x.fillRect(0, 9, BLOCK, 1); x.fillRect(9, 0, 1, BLOCK);
      break;
    case B.Iron:
      fill('#c8ccd2'); noise(['#b8bcc4', '#d8dce2'], 0.25);
      x.fillStyle = '#9aa0a8'; x.fillRect(0, 0, BLOCK, 1); x.fillRect(0, 9, BLOCK, 1);
      px(2, 2, '#7a8088'); px(7, 2, '#7a8088'); px(2, 7, '#7a8088'); px(7, 7, '#7a8088');
      break;
    case B.Books: {
      fill('#c49a5a');
      const spines = ['#d04848', '#4a6fd0', '#4fbf6b', '#f6c445', '#9a5ad0'];
      for (let i = 1; i < 9; i++) { x.fillStyle = spines[Math.floor(r() * spines.length)]; x.fillRect(i, 1, 1, 3); }
      for (let i = 1; i < 9; i++) { x.fillStyle = spines[Math.floor(r() * spines.length)]; x.fillRect(i, 6, 1, 3); }
      x.fillStyle = '#9a7440'; x.fillRect(0, 4, BLOCK, 2);
      break;
    }
    case B.Slab:
      fill('#9a9da4'); noise(['#8a8d93', '#aaadb4'], 0.25);
      x.fillStyle = '#c0c3c8'; x.fillRect(0, 0, BLOCK, 1);
      x.fillStyle = '#6e7178'; x.fillRect(0, 9, BLOCK, 1);
      break;
    case B.Snow: fill('#f4f8ff'); noise(['#e4ecf8', '#ffffff'], 0.3); break;
    case B.Water:
      if (season === '겨울') { fill('#cfe6f4'); noise(['#e4f2fa', '#b8d8ec'], 0.3); }
      else { fill('#3f7fd8'); x.fillStyle = '#6aa4ec'; x.fillRect(0, 0, BLOCK, 2); x.fillRect(variant ? 2 : 5, 5, 3, 1); }
      break;
    default: break;
  }
  return c;
}

const texCache = new Map<string, HTMLCanvasElement>();
function tex(b: B, season: Season, lit: boolean, variant: number) {
  const key = `${b}|${season}|${lit ? 1 : 0}|${variant}`;
  let t = texCache.get(key);
  if (!t) { t = paintBlock(b, season, lit, variant); texCache.set(key, t); }
  return t;
}

/* ── 하늘 ── */
const SKY: Record<Sky, Record<Season, [string, string]>> = {
  day: { 봄: ['#7ec4f8', '#cfeeff'], 여름: ['#4aa8f0', '#b8e4ff'], 가을: ['#7ab0e0', '#f4dcb8'], 겨울: ['#a8c4dc', '#e8f0f8'] },
  dusk: { 봄: ['#5a5aa8', '#f4a888'], 여름: ['#4a4a98', '#ffb070'], 가을: ['#4a3a78', '#f08a58'], 겨울: ['#4a5a88', '#e8a8a8'] },
  night: { 봄: ['#0c1030', '#1e2a58'], 여름: ['#0a0e2a', '#1a2a5a'], 가을: ['#0c0c28', '#24204a'], 겨울: ['#0e1430', '#2a3458'] },
};

export function skyColors(sky: Sky, season: Season) { return SKY[sky][season]; }

/** 하늘 — 화면(320×180)에 고정. 마을이 옆으로 흘러도 해·달·별은 그대로다 */
export function drawSky(ctx: CanvasRenderingContext2D, sky: Sky, season: Season, hour: number, w: number) {
  const [top, bottom] = SKY[sky][season];
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND * BLOCK);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, GROUND * BLOCK);
  if (sky === 'night') {
    const r = rng(424242);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = r() < 0.2 ? '#fff6c0' : '#ffffff';
      ctx.fillRect(Math.floor(r() * w), Math.floor(r() * 90), 1, 1);
    }
  }
  /* 해·달 — 시각에 따라 하늘을 가로지른다 */
  const t = sky === 'night' ? ((hour + 5) % 24) / 10 : (hour - 6) / 12;
  const sx = 20 + Math.max(0, Math.min(1, t)) * (w - 50);
  const sy = 18 + Math.abs(0.5 - Math.max(0, Math.min(1, t))) * 50;
  if (sky === 'night') {
    ctx.fillStyle = '#f4f0dc'; ctx.fillRect(sx, sy, 12, 12);
    ctx.fillStyle = '#d8d4c0'; ctx.fillRect(sx + 3, sy + 3, 3, 3); ctx.fillRect(sx + 7, sy + 7, 2, 2);
  } else {
    ctx.fillStyle = sky === 'dusk' ? '#ff9a50' : '#ffe680';
    ctx.fillRect(sx - 2, sy - 2, 18, 18);
    ctx.fillStyle = sky === 'dusk' ? '#ffc070' : '#fff6c0';
    ctx.fillRect(sx, sy, 14, 14);
  }
}

export interface StaticScene {
  base: HTMLCanvasElement;
  /** 밤에 켜지는 불빛(창문·가로등) — 어두운 막을 덮은 뒤 위에 얹는다 */
  glow: HTMLCanvasElement;
  buildings: Building[];
  grid: Grid;
}

export interface SceneOpts {
  stage: Stage;
  /** 학년(0~11) — 공사 중이던 곳이 열린다 */
  grade: number;
  season: Season;
  sky: Sky;
  hour: number;
  /** 집 앞에 놓는 관심 분야 소품(많아야 2개) */
  props: FieldKey[];
  trophies: number;
}

export function sceneKey(o: SceneOpts) {
  return `${o.stage}|${o.grade}|${o.season}|${o.sky}|${o.hour}|${o.props.join(',')}|${o.trophies}`;
}

export function renderStatic(o: SceneOpts): StaticScene {
  const { grid, buildings } = buildWorld(o.stage, o.grade);
  const base = mkCanvas(WIDTH, HEIGHT);
  const ctx = base.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  /* 하늘·해·달은 화면에 고정해서 drawSky 가 그린다 — 여기는 땅과 건물만(하늘 자리는 투명) */
  const r = rng(424242);

  /* 먼 언덕 — 블록 계단 실루엣 */
  const hill = o.sky === 'night' ? '#1a2440' : o.sky === 'dusk' ? '#6a5a7a'
    : { 봄: '#9ad0a0', 여름: '#78b888', 가을: '#c0b088', 겨울: '#c8d8e8' }[o.season];
  ctx.fillStyle = hill;
  let h = 3;
  for (let i = 0; i < COLS; i++) {
    h = Math.max(1, Math.min(5, h + Math.floor(r() * 3) - 1));
    ctx.fillRect(i * BLOCK, (GROUND - h) * BLOCK, BLOCK, h * BLOCK);
  }

  /* 언덕 위 나무 — 계절 따라 벚꽃·초록·단풍·눈 */
  const leaf = LEAF[o.season];
  const dim = o.sky === 'night' ? 'rgba(10,16,40,0.55)' : o.sky === 'dusk' ? 'rgba(60,40,80,0.3)' : 'rgba(255,255,255,0.18)';
  for (let tx = 3.5; tx < COLS; tx += 5.3 + (Math.floor(tx) % 3)) {
    const bx = Math.round(tx * BLOCK);
    const by = (GROUND - 1) * BLOCK - 6;
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(bx + 3, by - 2, 3, 10);
    for (let k = 0; k < 26; k++) {
      ctx.fillStyle = leaf[Math.floor(r() * leaf.length)];
      ctx.fillRect(bx + Math.floor(r() * 10) - 1, by - 12 + Math.floor(r() * 11), 2, 2);
    }
    ctx.fillStyle = dim;
    ctx.fillRect(bx - 1, by - 12, 12, 20);
  }

  /* 블록 */
  const glow = mkCanvas(WIDTH, HEIGHT);
  const g = glow.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const b = at(grid, x, y) as B;
      if (b === B.Air) continue;
      const v = (x * 7 + y * 13) % 2;
      ctx.drawImage(tex(b, o.season, false, v), x * BLOCK, y * BLOCK);
      /* 땅 밑은 깊을수록 어둡게 */
      if (y > GROUND) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, (y - GROUND) * 0.07)})`;
        ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, BLOCK);
      }
      /* 겨울엔 위가 빈 블록마다 눈이 쌓인다 */
      if (o.season === '겨울' && y < GROUND && at(grid, x, y - 1) === B.Air && b !== B.Glass && b !== B.Door) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x * BLOCK, y * BLOCK, BLOCK, 2);
        ctx.fillStyle = '#e4ecf8';
        ctx.fillRect(x * BLOCK + (v ? 2 : 6), y * BLOCK + 2, 2, 1);
      }
      if (o.sky !== 'day' && (b === B.Glass || b === B.Lamp)) {
        g.drawImage(tex(b, o.season, true, v), x * BLOCK, y * BLOCK);
        if (b === B.Lamp) {
          const rg = g.createRadialGradient(x * BLOCK + 5, y * BLOCK + 5, 1, x * BLOCK + 5, y * BLOCK + 5, 22);
          rg.addColorStop(0, 'rgba(255,220,120,0.55)');
          rg.addColorStop(1, 'rgba(255,220,120,0)');
          g.fillStyle = rg;
          g.fillRect(x * BLOCK - 20, y * BLOCK - 20, 50, 50);
        }
      }
    }
  }

  /* 집 앞 — 관심 분야 소품과 트로피 */
  const groundY = (GROUND - 1) * BLOCK;
  o.props.slice(0, 2).forEach((f, i) => drawProp(ctx, FIELD_PROPS[f], PROP_X[i] * BLOCK, groundY));
  for (let i = 0; i < Math.min(o.trophies, 3); i++) {
    drawProp(ctx, TROPHY, TROPHY_X * BLOCK, groundY - i * BLOCK);
  }

  return { base, glow, buildings, grid };
}
