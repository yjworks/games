import { FIELD_PROPS, TROPHY, drawProp } from './sprites';
import { FieldKey, PlaceId } from './types';
import { Lot, MAP_H, MAP_PX_H, MAP_PX_W, MAP_W, T, TILE, TownLayout } from './towntop';
import type { Season } from './world';
import type { Sky } from './render';

/**
 * 위에서 내려다본 마을 그리기 — 지붕과 앞벽이 보이는 3/4 시점 픽셀 그림(이미지 파일 없음).
 * 움직이지 않는 것은 한 번 그려 두고(base), 밤에 켜지는 창문은 따로(glow).
 */
function mk(w: number, h: number) {
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

const GRASS: Record<Season, [string, string, string]> = {
  봄: ['#7ccf5a', '#6abd4a', '#f2a8c8'],
  여름: ['#4fae3c', '#43a033', '#62c04c'],
  가을: ['#b8a845', '#a89838', '#d08a35'],
  겨울: ['#eef4fb', '#dfe8f4', '#ffffff'],
};
const LEAF: Record<Season, [string, string, string]> = {
  봄: ['#f2a8c8', '#e888b0', '#7ccf5a'],
  여름: ['#3f9a3a', '#2f7a2c', '#55b048'],
  가을: ['#e07a30', '#c94a2a', '#f2c230'],
  겨울: ['#e8eef8', '#c8d4e4', '#8a6a48'],
};

/** 장소마다 지붕·벽 */
interface Style { roof: string[]; flat?: boolean; stripe?: string; wall: string[]; window?: string; special?: 'field' | 'park' | 'market' }
const STYLE: Record<PlaceId, Style> = {
  room: { roof: ['#a8403a', '#8a3030', '#c45048'], wall: ['#c49a5a', '#b08848', '#d0a868'] },
  kitchen: { roof: ['#7a5a3a', '#6a4a2e', '#8a6a48'], wall: ['#b5523a', '#a4462f', '#c4614a'] },
  classroom: { roof: ['#9a9da4', '#8a8d93', '#aaadb4'], flat: true, wall: ['#b5523a', '#a4462f', '#c4614a'] },
  field: { roof: [], wall: [], special: 'field' },
  club: { roof: ['#3a8a8a', '#2e7474', '#4a9a9a'], flat: true, wall: ['#7a7d84', '#5e6168', '#9a9da4'] },
  counsel: { roof: ['#4a7ad8', '#f4f4f4'], stripe: 'v', wall: ['#ece8e0', '#e0dcd2', '#f6f2ea'] },
  library: { roof: ['#7a3a2a', '#6a2e22', '#8a4a38'], wall: ['#c49a5a', '#b08848', '#d0a868'], window: '#d04848' },
  park: { roof: [], wall: [], special: 'park' },
  market: { roof: ['#d84848', '#f4f4f4'], stripe: 'v', wall: ['#c49a5a'], special: 'market' },
  welfare: { roof: ['#4fae6a', '#3f9a5a', '#62c07a'], flat: true, wall: ['#ece8e0', '#e0dcd2', '#f6f2ea'] },
  academy: { roof: ['#b8bcc4', '#a8acb4', '#c8ccd2'], flat: true, wall: ['#ece8e0', '#e0dcd2', '#f6f2ea'] },
  maker: { roof: ['#8a9098', '#7a8088', '#9aa0a8'], flat: true, wall: ['#7a7d84', '#5e6168', '#9a9da4'] },
  media: { roof: ['#3a4058', '#2e3448', '#4a5068'], flat: true, wall: ['#a8dcf0', '#8ccbe4', '#c4e8f6'] },
  parttime: { roof: ['#4a7ad8', '#f4f4f4'], stripe: 'v', wall: ['#a8dcf0', '#8ccbe4', '#c4e8f6'] },
};

export interface TownOpts {
  season: Season;
  sky: Sky;
  /** 열린 장소 */
  open: Set<PlaceId>;
  props: FieldKey[];
  trophies: number;
}

export interface TownScene { base: HTMLCanvasElement; glow: HTMLCanvasElement }

export const townKey = (o: TownOpts) => `${o.season}|${o.sky}|${[...o.open].sort().join(',')}|${o.props.join(',')}|${o.trophies}`;

export function paintTown(layout: TownLayout, o: TownOpts): TownScene {
  const base = mk(MAP_PX_W, MAP_PX_H);
  const glow = mk(MAP_PX_W, MAP_PX_H);
  const c = base.getContext('2d')!;
  const g = glow.getContext('2d')!;
  const r = rng(1234);
  const px = (x: number, y: number, col: string, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const noise = (x0: number, y0: number, w: number, h: number, cols: string[], p: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (r() < p) px(x, y, cols[Math.floor(r() * cols.length)]);
  };

  /* 땅 */
  const [g1, g2, g3] = GRASS[o.season];
  c.fillStyle = g1;
  c.fillRect(0, 0, MAP_PX_W, MAP_PX_H);
  noise(0, 0, MAP_PX_W, MAP_PX_H, [g2, g2, g3], 0.18);

  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const t = layout.tiles[ty * MAP_W + tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (t === T.Street || t === T.Avenue) {
        px(x, y, t === T.Avenue ? '#8a8072' : '#9a9080', TILE, TILE);
        noise(x, y, TILE, TILE, ['#8a8070', '#aaa090', '#7a7062'], 0.25);
        if (o.season === '겨울' && r() < 0.5) px(x + Math.floor(r() * 6), y + Math.floor(r() * 6), '#f4f8ff', 2, 2);
      } else if (t === T.Water) {
        const frozen = o.season === '겨울';
        px(x, y, frozen ? '#cfe6f4' : '#3f7fd8', TILE, TILE);
        if (!frozen) { px(x + 1, y + 2, '#6aa4ec', 3, 1); px(x + 4, y + 5, '#6aa4ec', 3, 1); }
      } else if (t === T.Flower) {
        const f = ['#ff6b8a', '#ffd84a', '#ffffff', '#b07af0'][(tx * 3 + ty) % 4];
        if (o.season !== '겨울') { px(x + 2, y + 2, f, 2, 2); px(x + 5, y + 5, f, 2, 2); px(x + 3, y + 4, '#3f8a30'); }
      }
    }
  }
  /* 거리 가장자리 선 */
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const t = layout.tiles[ty * MAP_W + tx];
    if (t !== T.Street && t !== T.Avenue) continue;
    const up = ty > 0 ? layout.tiles[(ty - 1) * MAP_W + tx] : t;
    if (up !== T.Street && up !== T.Avenue) px(tx * TILE, ty * TILE, '#6a6258', TILE, 1);
  }

  /* 건물 */
  for (const lot of Object.values(layout.lots)) {
    if (o.open.has(lot.place)) paintLot(c, g, lot, STYLE[lot.place], o, r);
    else paintConstruction(c, lot, r);
  }

  /* 나무 — 건물 뒤가 아니라 위에 얹는다 */
  const leaf = LEAF[o.season];
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    if (layout.tiles[ty * MAP_W + tx] !== T.Tree) continue;
    const x = tx * TILE;
    const y = ty * TILE;
    px(x + 3, y + 5, '#6a4a2a', 2, 4);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(x - 1, y + 7, 10, 2);
    for (let k = 0; k < 30; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * 5;
      px(x + 4 + Math.round(Math.cos(a) * d), y + 2 + Math.round(Math.sin(a) * d * 0.8), leaf[Math.floor(r() * 3)], 2, 2);
    }
  }

  /* 집 마당 — 관심 분야 소품(꽃밭)과 트로피(연못 옆) */
  o.props.slice(0, 2).forEach((f, i) => drawProp(c, FIELD_PROPS[f], 224 + i * 14, 18));
  for (let i = 0; i < Math.min(o.trophies, 3); i++) drawProp(c, TROPHY, 202, 8 + i * 11);

  return { base, glow };
}

/** 지붕 + 앞벽(창문·문). 지붕은 3줄, 앞벽은 2줄 */
function paintLot(c: CanvasRenderingContext2D, g: CanvasRenderingContext2D, lot: Lot, st: Style, o: TownOpts, r: () => number) {
  const x0 = lot.x * TILE;
  const y0 = lot.y * TILE;
  const w = lot.w * TILE;
  const h = lot.h * TILE;
  const px = (x: number, y: number, col: string, ww = 1, hh = 1) => { c.fillStyle = col; c.fillRect(x, y, ww, hh); };

  if (st.special === 'field') {
    /* 모래 운동장 + 흰 선 + 골대 */
    px(x0, y0 + 2, '#d8c088', w, h - 2);
    for (let k = 0; k < 40; k++) px(x0 + Math.floor(r() * w), y0 + 2 + Math.floor(r() * (h - 2)), '#c8b078');
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1;
    c.strokeRect(x0 + 2.5, y0 + 4.5, w - 5, h - 8);
    c.beginPath(); c.moveTo(x0 + w / 2 + 0.5, y0 + 4); c.lineTo(x0 + w / 2 + 0.5, y0 + h - 4); c.stroke();
    px(x0 + 2, y0 + 12, '#f4f4f4', 2, 12); px(x0 + w - 4, y0 + 12, '#f4f4f4', 2, 12);
    px(x0 + w / 2 - 2, y0 + 16, '#f4f4f4', 4, 4);
    return;
  }
  if (st.special === 'park') {
    /* 공원 — 잔디, 연못, 벤치, 꽃 */
    const pond = o.season === '겨울' ? '#cfe6f4' : '#3f7fd8';
    px(x0 + 6, y0 + 6, pond, 22, 14);
    px(x0 + 4, y0 + 8, pond, 26, 10);
    if (o.season !== '겨울') { px(x0 + 10, y0 + 10, '#6aa4ec', 6, 1); px(x0 + 16, y0 + 14, '#6aa4ec', 6, 1); }
    px(x0 + 34, y0 + 26, '#8a5a30', 10, 3); px(x0 + 35, y0 + 29, '#6a4a2a', 1, 3); px(x0 + 42, y0 + 29, '#6a4a2a', 1, 3);
    for (let k = 0; k < 8; k++) px(x0 + 30 + Math.floor(r() * 16), y0 + 4 + Math.floor(r() * 16), ['#ff6b8a', '#ffd84a', '#ffffff'][k % 3], 2, 2);
    /* 입구 */
    px(x0 + w / 2 - 6, y0 + h - 3, '#9a9080', 12, 3);
    return;
  }

  /* 그림자 */
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fillRect(x0 + 2, y0 + 2, w, h);

  /* 지붕(위 3줄) */
  const roofH = TILE * 3;
  if (st.stripe) {
    for (let x = 0; x < w; x += 4) px(x0 + x, y0, st.roof[(x / 4) % 2], 4, roofH);
    px(x0, y0 + roofH - 2, 'rgba(0,0,0,0.2)', w, 2);
  } else {
    px(x0, y0, st.roof[0], w, roofH);
    for (let k = 0; k < w * roofH * 0.2; k++) px(x0 + Math.floor(r() * w), y0 + Math.floor(r() * roofH), st.roof[1 + Math.floor(r() * 2)]);
    if (st.flat) {
      c.strokeStyle = st.roof[1];
      c.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, roofH - 1);
      px(x0 + 2, y0 + 2, 'rgba(255,255,255,0.18)', w - 4, 2);
    } else {
      /* 맞배지붕 — 가운데 용마루와 기와 줄 */
      px(x0, y0 + roofH / 2 - 1, st.roof[1], w, 2);
      for (let y = 2; y < roofH; y += 4) px(x0, y0 + y, 'rgba(0,0,0,0.12)', w, 1);
    }
  }
  if (o.season === '겨울' && !st.stripe) { px(x0, y0, '#ffffff', w, 4); px(x0 + 3, y0 + 4, '#e8eef8', w - 6, 2); }

  /* 앞벽(아래 2줄) */
  const wy = y0 + roofH;
  const wh = h - roofH;
  px(x0, wy, st.wall[0], w, wh);
  for (let k = 0; k < w * wh * 0.25; k++) px(x0 + Math.floor(r() * w), wy + Math.floor(r() * wh), st.wall[Math.floor(r() * st.wall.length)]);
  px(x0, wy, 'rgba(0,0,0,0.25)', w, 1);
  /* 창문 두 개 */
  const win = st.window ?? '#a8dcf0';
  for (const wx of [x0 + 4, x0 + w - 10]) {
    px(wx, wy + 4, '#4a3a2a', 6, 6);
    px(wx + 1, wy + 5, win, 4, 4);
    g.fillStyle = '#ffd36a';
    g.fillRect(wx + 1, wy + 5, 4, 4);
  }
  /* 문 */
  const dx = lot.door.x * TILE;
  px(dx - 4, wy + 3, '#5e4024', 8, wh - 3);
  px(dx - 3, wy + 4, '#8a6538', 6, wh - 4);
  px(dx + 1, wy + 9, '#f2c230');
  if (st.special === 'market') {
    /* 노점 — 물건 상자 */
    px(x0 + 4, wy + 10, '#e05040', 4, 3); px(x0 + w - 8, wy + 10, '#4fbf6b', 4, 3);
  }
}

/** 아직 안 열린 곳 — 흙바닥, 울타리, 비계 */
function paintConstruction(c: CanvasRenderingContext2D, lot: Lot, r: () => number) {
  const x0 = lot.x * TILE;
  const y0 = lot.y * TILE;
  const w = lot.w * TILE;
  const h = lot.h * TILE;
  c.fillStyle = '#8a6a48';
  c.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
  for (let k = 0; k < 60; k++) { c.fillStyle = r() < 0.5 ? '#7a5a3a' : '#9a7a58'; c.fillRect(x0 + 2 + Math.floor(r() * (w - 4)), y0 + 2 + Math.floor(r() * (h - 4)), 1, 1); }
  c.fillStyle = '#c49a5a';
  for (let x = x0 + 2; x < x0 + w - 2; x += 4) { c.fillRect(x, y0 + 2, 2, 3); c.fillRect(x, y0 + h - 5, 2, 3); }
  c.fillRect(x0 + 2, y0 + 3, w - 4, 1); c.fillRect(x0 + 2, y0 + h - 4, w - 4, 1);
  c.fillStyle = '#ffc23d';
  c.fillRect(x0 + 10, y0 + 12, w - 20, 4);
  c.fillStyle = '#2a2230';
  for (let x = x0 + 10; x < x0 + w - 10; x += 4) c.fillRect(x, y0 + 12, 2, 4);
}
