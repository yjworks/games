import { Calendar } from './calendar';
import { PLACES } from './data';
import { PlaceId, Stage } from './types';

/**
 * 블록 마을 — 옆에서 본 단면. 장소 14곳이 구역 순서(집·학교·동네·시내)대로 가로로 늘어선다.
 * 한 장소가 8칸, 한 칸 10px → 마을 폭 1120px. 화면에는 320×180 만큼 보이고 아이를 따라 옆으로 흐른다.
 * 여기는 순수 함수(칸 배치)만 두고, 그리기는 render.ts·WorldView 가 한다.
 */
export const SLOT_W = 8;
export const COLS = PLACES.length * SLOT_W;
export const ROWS = 18;
export const BLOCK = 10;
export const WIDTH = COLS * BLOCK;
export const HEIGHT = ROWS * BLOCK;
/** 화면에 보이는 폭 */
export const VIEW_W = 320;
/** 잔디가 깔린 줄. 사람은 그 위(GROUND-1 줄)에 선다 */
export const GROUND = 12;

export enum B {
  Air, Grass, Dirt, Stone, Coal, Gold, Plank, Log, Leaf, Brick, Roof, Glass, Door, Cobble,
  WoolR, WoolW, Lamp, Quartz, Iron, Books, WoolB, Slab, Snow, Water,
}

/** 장소 i 는 8i ~ 8i+7 열 */
export const PLACE_SLOT = Object.fromEntries(PLACES.map((p, i) => [p.id, i])) as Record<PlaceId, number>;

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

/** 건물 하나 — 꼭대기 줄(간판 높이)과 열렸는지 */
export interface Building { place: PlaceId; top: number; open: boolean }

const base = GROUND - 1;

/** 가운데 문(2칸 폭, 2칸 높이) */
function door(g: Grid, x: number) {
  rect(g, x + 3, base - 1, x + 4, base, B.Door);
}

/* 장소마다 생김새. x 는 그 장소 칸의 왼쪽 끝. 돌려주는 값은 꼭대기 줄 */
const BUILD: Record<PlaceId, (g: Grid, x: number, stage: Stage) => number> = {
  room: (g, x) => {
    rect(g, x + 1, base - 2, x + 6, base, B.Plank);
    rect(g, x + 1, base - 2, x + 1, base, B.Log); rect(g, x + 6, base - 2, x + 6, base, B.Log);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    rect(g, x, base - 3, x + 7, base - 3, B.Roof);
    rect(g, x + 1, base - 4, x + 6, base - 4, B.Roof);
    rect(g, x + 2, base - 5, x + 5, base - 5, B.Roof);
    rect(g, x + 3, base - 6, x + 4, base - 6, B.Roof);
    put(g, x + 5, base - 6, B.Brick); put(g, x + 5, base - 7, B.Brick);
    return base - 7;
  },
  kitchen: (g, x) => {
    rect(g, x + 1, base - 2, x + 6, base, B.Brick);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    for (let i = 0; i < 8; i++) put(g, x + i, base - 3, i % 2 ? B.WoolW : B.WoolR);
    rect(g, x + 1, base - 4, x + 6, base - 4, B.Slab);
    put(g, x + 2, base - 5, B.Cobble); put(g, x + 2, base - 6, B.Cobble);
    return base - 6;
  },
  classroom: (g, x, stage) => {
    const h = 4 + stage;
    rect(g, x + 1, base - h + 1, x + 6, base, B.Brick);
    for (let y = base - h + 2; y <= base - 2; y += 2) rect(g, x + 2, y, x + 5, y, B.Glass);
    door(g, x);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    rect(g, x, base - h, x + 7, base - h, B.Slab);
    put(g, x + 3, base - h - 1, B.Quartz); put(g, x + 4, base - h - 1, B.Quartz);
    return base - h - 1;
  },
  field: (g, x) => {
    /* 축구 골대 */
    rect(g, x + 1, base - 2, x + 1, base, B.Quartz); rect(g, x + 6, base - 2, x + 6, base, B.Quartz);
    rect(g, x + 1, base - 2, x + 6, base - 2, B.Quartz);
    for (let i = x + 2; i <= x + 5; i++) put(g, i, base - 1, B.WoolW);
    return base - 2;
  },
  club: (g, x) => {
    rect(g, x + 1, base - 2, x + 6, base, B.Cobble);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    rect(g, x, base - 3, x + 7, base - 3, B.Slab);
    put(g, x + 6, base - 4, B.Log); put(g, x + 6, base - 5, B.Log); put(g, x + 5, base - 5, B.WoolR);
    return base - 5;
  },
  counsel: (g, x) => {
    rect(g, x + 1, base - 3, x + 6, base, B.Quartz);
    rect(g, x + 2, base - 2, x + 5, base - 2, B.Glass);
    door(g, x);
    for (let i = 0; i < 8; i++) put(g, x + i, base - 4, i % 2 ? B.WoolW : B.WoolB);
    return base - 4;
  },
  lang: (g, x) => {
    /* 상가 건물 — 1층 가게, 2층 학원 간판 */
    rect(g, x + 1, base - 4, x + 6, base, B.Quartz);
    rect(g, x + 2, base - 3, x + 5, base - 3, B.Glass);
    for (let i = 1; i <= 6; i++) put(g, x + i, base - 2, i % 2 ? B.WoolB : B.WoolW);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    rect(g, x, base - 5, x + 7, base - 5, B.Slab);
    return base - 5;
  },
  library: (g, x) => {
    rect(g, x + 1, base - 3, x + 6, base, B.Plank);
    rect(g, x + 1, base - 3, x + 6, base - 3, B.Books);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    rect(g, x, base - 4, x + 7, base - 4, B.Roof);
    rect(g, x + 1, base - 5, x + 6, base - 5, B.Roof);
    return base - 5;
  },
  park: (g, x) => {
    /* 큰 나무, 벤치, 작은 연못 */
    rect(g, x + 2, base - 2, x + 2, base, B.Log);
    rect(g, x, base - 5, x + 4, base - 3, B.Leaf);
    rect(g, x + 1, base - 6, x + 3, base - 6, B.Leaf);
    put(g, x + 5, base, B.Plank); put(g, x + 6, base, B.Plank);
    put(g, x + 5, GROUND, B.Water); put(g, x + 6, GROUND, B.Water);
    return base - 6;
  },
  market: (g, x) => {
    rect(g, x + 1, base - 2, x + 1, base, B.Log); rect(g, x + 6, base - 2, x + 6, base, B.Log);
    for (let i = 0; i < 8; i++) put(g, x + i, base - 3, i % 2 ? B.WoolW : B.WoolR);
    rect(g, x + 2, base, x + 5, base, B.Plank);
    put(g, x + 2, base - 1, B.Books); put(g, x + 5, base - 1, B.Books);
    put(g, x + 7, base, B.Log); put(g, x + 7, base - 1, B.Log); put(g, x + 7, base - 2, B.Lamp);
    return base - 3;
  },
  welfare: (g, x) => {
    rect(g, x + 1, base - 3, x + 6, base, B.Quartz);
    put(g, x + 2, base - 1, B.Glass); put(g, x + 5, base - 1, B.Glass);
    door(g, x);
    put(g, x + 3, base - 3, B.WoolR); put(g, x + 4, base - 3, B.WoolR); put(g, x + 3, base - 2, B.WoolR); put(g, x + 4, base - 2, B.WoolR);
    rect(g, x, base - 4, x + 7, base - 4, B.Slab);
    return base - 4;
  },
  academy: (g, x, stage) => {
    const h = 5 + stage;
    rect(g, x + 1, base - h + 1, x + 6, base, B.Quartz);
    for (let y = base - h + 2; y <= base - 2; y += 2) rect(g, x + 2, y, x + 5, y, B.Glass);
    door(g, x);
    rect(g, x, base - h, x + 7, base - h, B.Slab);
    return base - h;
  },
  maker: (g, x) => {
    rect(g, x + 1, base - 4, x + 6, base, B.Cobble);
    rect(g, x + 1, base - 4, x + 6, base - 4, B.Iron);
    rect(g, x + 2, base - 2, x + 5, base - 2, B.Glass);
    door(g, x);
    put(g, x + 5, base - 5, B.Cobble); put(g, x + 5, base - 6, B.Cobble);
    return base - 6;
  },
  media: (g, x) => {
    rect(g, x + 1, base - 5, x + 6, base, B.Glass);
    rect(g, x + 1, base - 5, x + 1, base, B.Iron); rect(g, x + 6, base - 5, x + 6, base, B.Iron);
    rect(g, x + 1, base - 3, x + 6, base - 3, B.Iron);
    door(g, x);
    rect(g, x, base - 6, x + 7, base - 6, B.Slab);
    put(g, x + 4, base - 7, B.Iron); put(g, x + 4, base - 8, B.Lamp);
    return base - 8;
  },
  parttime: (g, x) => {
    rect(g, x + 1, base - 3, x + 6, base, B.Glass);
    rect(g, x + 1, base - 3, x + 1, base, B.Log); rect(g, x + 6, base - 3, x + 6, base, B.Log);
    rect(g, x + 1, base - 2, x + 6, base - 2, B.Plank);
    door(g, x);
    for (let i = 0; i < 8; i++) put(g, x + i, base - 4, i % 2 ? B.WoolW : B.WoolB);
    rect(g, x + 1, base - 5, x + 6, base - 5, B.Slab);
    return base - 5;
  },
};

/** 아직 열리지 않은 곳 — 울타리와 비계 */
function construction(g: Grid, x: number): number {
  for (const i of [1, 3, 5]) rect(g, x + i, base - 3, x + i, base, B.Log);
  rect(g, x + 1, base - 1, x + 6, base - 1, B.Plank);
  rect(g, x + 1, base - 3, x + 5, base - 3, B.Plank);
  put(g, x + 6, base, B.WoolR);
  return base - 3;
}

/**
 * 마을 — 학교급에 따라 교실·학원가가 자라고, 학년에 따라 공사 중이던 곳이 열린다.
 * 같은 씨앗이라 매번 같은 동네다.
 */
export function buildWorld(stage: Stage, grade: number): { grid: Grid; buildings: Building[] } {
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

  const buildings: Building[] = PLACES.map((p, i) => {
    const x = i * SLOT_W;
    const open = grade >= p.from;
    const top = open ? BUILD[p.id](g, x, stage) : construction(g, x);
    return { place: p.id, top, open };
  });

  return { grid: g, buildings };
}

/** 친구가 서는 자리 — 자기 장소 왼쪽(칸 단위, 사람의 가운데) */
export const friendX = (place: PlaceId) => PLACE_SLOT[place] * SLOT_W + 0.9;
/** 관심 분야 소품 두 자리(집 구역)와 트로피 자리 */
export const PROP_X = [7, 15] as const;
export const TROPHY_X = 0;
