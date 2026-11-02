import { DISTRICTS, placeById } from './data';
import { PlaceId } from './types';

/**
 * 위에서 내려다본 마을 지도 — 배치와 길만(순수 함수). 그리기는 townpaint.ts.
 * 칸 8px, 34×38칸(272×304). 구역마다 가로 거리 하나에 장소가 늘어서고, 왼쪽 큰길이 거리들을 잇는다.
 * 맨 왼쪽 세 칸은 구역 이름표 자리다.
 */
export const TILE = 8;
export const MAP_W = 34;
export const MAP_H = 38;
export const MAP_PX_W = MAP_W * TILE;
export const MAP_PX_H = MAP_H * TILE;

export enum T { Grass, Street, Avenue, Lot, Water, Sand, Flower, Tree }

/** 구역 띠의 맨 윗줄 — 건물 5줄, 거리 2줄, 풀밭 2줄 */
const BAND_TOP = [1, 10, 19, 28];
/** 장소 칸의 왼쪽 끝 */
const SLOT_X = [6, 13, 20, 27];
/** 큰길 열 */
const AVENUE = [3, 4];
const LOT_W = 6;
const LOT_H = 5;

export interface Lot {
  place: PlaceId;
  /** 건물 자리(칸) */
  x: number; y: number; w: number; h: number;
  /** 문 칸(건물 아래 가운데)과 문 앞 거리 칸 */
  door: { x: number; y: number };
  stand: { x: number; y: number };
}

export interface TownLayout {
  tiles: T[];
  lots: Record<PlaceId, Lot>;
  /** 구역 이름표 자리 */
  districtSigns: { id: string; x: number; y: number }[];
}

const idx = (x: number, y: number) => y * MAP_W + x;

/** 같은 씨앗 → 같은 마을 */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildTown(): TownLayout {
  const tiles: T[] = new Array(MAP_W * MAP_H).fill(T.Grass);
  const set = (x: number, y: number, t: T) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[idx(x, y)] = t; };
  const lots = {} as Record<PlaceId, Lot>;
  const districtSigns: TownLayout['districtSigns'] = [];

  /* 왼쪽 큰길 */
  for (let y = 0; y < MAP_H; y++) for (const x of AVENUE) set(x, y, T.Avenue);

  DISTRICTS.forEach((d, di) => {
    const top = BAND_TOP[di];
    /* 구역 거리 */
    for (let x = AVENUE[0]; x < MAP_W; x++) { set(x, top + LOT_H, T.Street); set(x, top + LOT_H + 1, T.Street); }
    districtSigns.push({ id: d.id, x: 0, y: top + 1 });
    d.places.forEach((id, i) => {
      const x = SLOT_X[i];
      const y = top;
      for (let yy = y; yy < y + LOT_H; yy++) for (let xx = x; xx < x + LOT_W; xx++) set(xx, yy, T.Lot);
      const door = { x: x + Math.floor(LOT_W / 2), y: y + LOT_H - 1 };
      lots[id] = { place: id, x, y, w: LOT_W, h: LOT_H, door, stand: { x: door.x, y: y + LOT_H } };
    });
  });

  /* 집 구역 빈자리 — 작은 연못과 꽃밭 */
  const homeTop = BAND_TOP[0];
  for (let y = homeTop + 1; y < homeTop + 4; y++) for (let x = 21; x < 25; x++) set(x, y, T.Water);
  for (let y = homeTop; y < homeTop + 5; y++) for (let x = 27; x < 33; x++) set(x, y, (x + y) % 3 ? T.Flower : T.Grass);

  /* 거리 아래 풀밭에 나무 */
  const r = rng(77);
  for (const top of BAND_TOP) {
    for (let x = 6; x < MAP_W - 1; x += 3 + Math.floor(r() * 3)) {
      const y = top + LOT_H + 2 + Math.floor(r() * 2);
      if (y < MAP_H && tiles[idx(x, y)] === T.Grass) set(x, y, T.Tree);
    }
  }
  /* 지도 오른쪽 끝 나무 줄 */
  for (let y = 0; y < MAP_H; y += 2) if (tiles[idx(MAP_W - 1, y)] === T.Grass) set(MAP_W - 1, y, T.Tree);

  return { tiles, lots, districtSigns };
}

const WALK = new Set([T.Street, T.Avenue]);

/** 거리·큰길만 따라가는 최단 길(4방향). from·to 는 칸, 결과는 지나는 칸들(시작 포함) */
export function findPath(layout: TownLayout, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number }[] {
  const prev = new Map<number, number>();
  const start = idx(from.x, from.y);
  const goal = idx(to.x, to.y);
  const q = [start];
  prev.set(start, -1);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const n = idx(nx, ny);
      if (prev.has(n) || !WALK.has(layout.tiles[n])) continue;
      prev.set(n, cur);
      q.push(n);
    }
  }
  if (!prev.has(goal)) return [from, to];
  const out: { x: number; y: number }[] = [];
  for (let c = goal; c !== -1; c = prev.get(c)!) out.push({ x: c % MAP_W, y: Math.floor(c / MAP_W) });
  return out.reverse();
}

/** 장소가 어느 구역 띠에 있는지(이름표용) */
export const districtOf = (id: PlaceId) => placeById(id)!.district;
