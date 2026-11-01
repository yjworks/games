import { Calendar } from './calendar';
import { PlaceId, Stage } from './types';

/**
 * 블록 마을 — 옆에서 본 단면. 32×18칸, 한 칸 10px → 320×180 캔버스.
 * 땅 위 한 줄에 집·학교·동네·체험센터가 ①~④ 순서로 서고, 땅 밑으로 흙·돌 층이 보인다.
 * 여기는 순수 함수(칸 배치)만 두고, 그리기는 WorldView 가 한다.
 */
export const COLS = 32;
export const ROWS = 18;
export const BLOCK = 10;
export const WIDTH = COLS * BLOCK;
export const HEIGHT = ROWS * BLOCK;
/** 잔디가 깔린 줄. 사람은 그 위(GROUND-1 줄)에 선다 */
export const GROUND = 12;

export enum B {
  Air, Grass, Dirt, Stone, Coal, Gold, Plank, Log, Leaf, Brick, Roof, Glass, Door, Cobble,
  WoolR, WoolW, Lamp, Quartz, Iron, Books, WoolB, Slab, Snow,
}

/** 건물 칸 — 장소 i 는 8i ~ 8i+7 열 */
export const SLOT_W = 8;
export const PLACE_SLOT: Record<PlaceId, number> = { home: 0, school: 1, town: 2, center: 3 };

/** 아이가 문 앞에 서는 x(칸 단위, 사람의 가운데) */
export const doorX = (place: PlaceId) => PLACE_SLOT[place] * SLOT_W + 4;

export type Season = Calendar['season'];

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export type Grid = Uint8Array;
export const at = (g: Grid, x: number, y: number) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? B.Air : g[y * COLS + x]);
const put = (g: Grid, x: number, y: number, b: B) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) g[y * COLS + x] = b; };
const rect = (g: Grid, x0: number, y0: number, x1: number, y1: number, b: B) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, b);
};

/** 건물 하나의 꼭대기 줄 — 간판을 띄울 높이 */
export interface Building { place: PlaceId; top: number }

/**
 * 학교급(초·중·고)마다 건물이 자란다. 마을 모양은 늘 같아서(같은 씨앗) 매번 같은 동네다.
 */
export function buildWorld(stage: Stage): { grid: Grid; buildings: Building[] } {
  const g: Grid = new Uint8Array(COLS * ROWS);
  const r = rng(20261030);

  /* 땅 — 잔디 · 흙 두 줄 · 돌(광석이 섞인다) */
  for (let x = 0; x < COLS; x++) {
    put(g, x, GROUND, B.Grass);
    put(g, x, GROUND + 1, B.Dirt);
    put(g, x, GROUND + 2, r() < 0.25 ? B.Stone : B.Dirt);
    for (let y = GROUND + 3; y < ROWS; y++) {
      const v = r();
      put(g, x, y, v < 0.06 ? B.Coal : v < 0.08 && y > GROUND + 4 ? B.Gold : B.Stone);
    }
  }

  const buildings: Building[] = [];
  const base = GROUND - 1;

  /* ① 집 — 나무 벽과 세모 지붕, 굴뚝 */
  {
    const x = 0;
    rect(g, x + 1, base - 2, x + 6, base, B.Plank);
    put(g, x + 1, base - 2, B.Log); put(g, x + 1, base - 1, B.Log); put(g, x + 1, base, B.Log);
    put(g, x + 6, base - 2, B.Log); put(g, x + 6, base - 1, B.Log); put(g, x + 6, base, B.Log);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    put(g, x + 3, base - 1, B.Door); put(g, x + 4, base - 1, B.Door);
    put(g, x + 3, base, B.Door); put(g, x + 4, base, B.Door);
    rect(g, x, base - 3, x + 7, base - 3, B.Roof);
    rect(g, x + 1, base - 4, x + 6, base - 4, B.Roof);
    rect(g, x + 2, base - 5, x + 5, base - 5, B.Roof);
    rect(g, x + 3, base - 6, x + 4, base - 6, B.Roof);
    put(g, x + 5, base - 6, B.Brick); put(g, x + 5, base - 7, B.Brick);
    buildings.push({ place: 'home', top: base - 7 });
  }

  /* ② 학교 — 벽돌 건물, 학교급마다 한 층씩 높아진다 */
  {
    const x = SLOT_W;
    const h = 4 + stage;
    rect(g, x + 1, base - h + 1, x + 6, base, B.Brick);
    for (let y = base - h + 2; y <= base - 2; y += 2) { put(g, x + 2, y, B.Glass); put(g, x + 5, y, B.Glass); put(g, x + 3, y, B.Glass); put(g, x + 4, y, B.Glass); }
    put(g, x + 3, base - 1, B.Door); put(g, x + 4, base - 1, B.Door);
    put(g, x + 3, base, B.Door); put(g, x + 4, base, B.Door);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    rect(g, x, base - h, x + 7, base - h, B.Slab);
    /* 시계탑 */
    put(g, x + 3, base - h - 1, B.Quartz); put(g, x + 4, base - h - 1, B.Quartz);
    buildings.push({ place: 'school', top: base - h - 1 });
  }

  /* ③ 동네 — 초: 줄무늬 차양 노점 · 중: 책방 · 고: 유리 카페 */
  {
    const x = SLOT_W * 2;
    if (stage === 0) {
      put(g, x + 1, base, B.Log); put(g, x + 1, base - 1, B.Log); put(g, x + 1, base - 2, B.Log);
      put(g, x + 6, base, B.Log); put(g, x + 6, base - 1, B.Log); put(g, x + 6, base - 2, B.Log);
      for (let i = 0; i < 8; i++) put(g, x + i, base - 3, i % 2 ? B.WoolW : B.WoolR);
      rect(g, x + 2, base, x + 5, base, B.Plank);
      put(g, x + 2, base - 1, B.Books); put(g, x + 5, base - 1, B.Books);
      buildings.push({ place: 'town', top: base - 3 });
    } else if (stage === 1) {
      rect(g, x + 1, base - 3, x + 6, base, B.Plank);
      rect(g, x + 1, base - 3, x + 6, base - 3, B.Books);
      put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
      put(g, x + 3, base - 1, B.Door); put(g, x + 4, base - 1, B.Door);
      put(g, x + 3, base, B.Door); put(g, x + 4, base, B.Door);
      for (let i = 0; i < 8; i++) put(g, x + i, base - 4, i % 2 ? B.WoolW : B.WoolB);
      rect(g, x + 1, base - 5, x + 6, base - 5, B.Roof);
      buildings.push({ place: 'town', top: base - 5 });
    } else {
      rect(g, x + 1, base - 4, x + 6, base, B.Glass);
      rect(g, x + 1, base - 4, x + 1, base, B.Log); rect(g, x + 6, base - 4, x + 6, base, B.Log);
      rect(g, x + 1, base - 2, x + 6, base - 2, B.Plank);
      put(g, x + 3, base - 1, B.Door); put(g, x + 4, base - 1, B.Door);
      put(g, x + 3, base, B.Door); put(g, x + 4, base, B.Door);
      for (let i = 0; i < 8; i++) put(g, x + i, base - 5, i % 2 ? B.WoolW : B.WoolR);
      rect(g, x + 1, base - 6, x + 6, base - 6, B.Slab);
      buildings.push({ place: 'town', top: base - 6 });
    }
    /* 가로등 */
    put(g, x + 7, base, B.Log); put(g, x + 7, base - 1, B.Log); put(g, x + 7, base - 2, B.Lamp);
  }

  /* ④ 체험센터 — 초: 작은 교실 · 중: 철 공방 · 고: 유리 타워 */
  {
    const x = SLOT_W * 3;
    const h = [4, 6, 8][stage];
    const wall = [B.Quartz, B.Cobble, B.Quartz][stage];
    rect(g, x + 1, base - h + 1, x + 6, base, wall);
    if (stage === 1) { rect(g, x + 1, base - h + 1, x + 6, base - h + 1, B.Iron); }
    for (let y = base - h + 2; y <= base - 2; y += stage === 2 ? 1 : 2) {
      rect(g, x + 2, y, x + 5, y, B.Glass);
      if (stage === 2) { put(g, x + 3, y, y % 2 ? B.Glass : B.Quartz); }
    }
    put(g, x + 3, base - 1, B.Door); put(g, x + 4, base - 1, B.Door);
    put(g, x + 3, base, B.Door); put(g, x + 4, base, B.Door);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    rect(g, x, base - h, x + 7, base - h, B.Slab);
    if (stage === 2) { put(g, x + 4, base - h - 1, B.Iron); put(g, x + 4, base - h - 2, B.Lamp); }
    buildings.push({ place: 'center', top: base - h - (stage === 2 ? 2 : 0) });
  }

  return { grid: g, buildings };
}

/** 친구가 서는 자리 — 사람 가운데의 x(칸 단위) */
export const FRIEND_X: Record<string, number> = {
  seoyeon: 8.6, doyun: 14.9, haeun: 16.5, minjun: 24.4,
};
/** 관심 분야 소품 두 자리(집 옆, 마을 오른쪽 끝)와 트로피 자리 */
export const PROP_X = [7, 31] as const;
export const TROPHY_X = 0;
