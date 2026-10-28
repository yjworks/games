import { BATTLE_MAPS, type BattleMapDef, type Compass, type P } from '../data/battlemaps';
import { CITY_BY_ID } from '../data/cities';
import type { CityId } from '../data/types';

/** 전장 칸 종류 */
export type TileType =
  | 'plain' | 'road' | 'forest' | 'hill' | 'mountain' | 'peak' | 'marsh' | 'water' | 'ford' | 'bridge' | 'village' | 'dam'
  | 'wall' | 'gate' | 'pass' | 'inner' | 'keep' | 'breach';

export interface Tile {
  t: TileType;
  /** 성벽·성문·관문 내구 */
  hp: number;
  /** 처음 내구(표시용) */
  max?: number;
  /** 불타는 남은 날 */
  fire: number;
  /** 물에 잠긴 남은 날(수공) */
  flood: number;
}

export interface MapLabel { text: string; q: number; r: number }

export interface BuiltMap {
  W: number;
  H: number;
  tiles: Tile[];
  keep: [number, number];
  /** 성벽까지의 거리 */
  radius: number;
  size: 'large' | 'medium' | 'small';
  labels: MapLabel[];
  note: string;
}

export const BW = 19;
export const BH = 13;

/* ───────────── 육각 칸 좌표 (odd-r 오프셋) ───────────── */

export function toCube(q: number, r: number): [number, number, number] {
  const x = q - (r - (r & 1)) / 2;
  const z = r;
  return [x, -x - z, z];
}

function fromCube(x: number, z: number): [number, number] {
  return [x + (z - (z & 1)) / 2 + 0, z + 0]; // -0 을 0 으로
}

export function hexDist(a: P, b: P): number {
  const [ax, ay, az] = toCube(a[0], a[1]);
  const [bx, by, bz] = toCube(b[0], b[1]);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

function cubeRound(x: number, y: number, z: number): [number, number, number] {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return [rx, ry, rz];
}

/** 두 칸 사이를 잇는 칸들 */
export function hexLine(a: P, b: P): P[] {
  const n = hexDist(a, b);
  const [ax, ay, az] = toCube(a[0], a[1]);
  const [bx, by, bz] = toCube(b[0], b[1]);
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const [x, , z] = cubeRound(ax + (bx - ax) * t + 1e-6, ay + (by - ay) * t + 1e-6, az + (bz - az) * t - 2e-6);
    out.push(fromCube(x, z));
  }
  return out;
}

function polyline(pts: P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(...hexLine(pts[i], pts[i + 1]));
  if (pts.length === 1) out.push(pts[0]);
  return out;
}

/** 화면 좌표(칸 지름 1 기준) — 방향 계산용 */
export function centerXY(q: number, r: number): [number, number] {
  return [q + (r & 1) * 0.5, r * 0.866];
}

const COMPASS: Record<Compass, [number, number]> = {
  N: [0, -1], NE: [0.7, -0.7], E: [1, 0], SE: [0.7, 0.7], S: [0, 1], SW: [-0.7, 0.7], W: [-1, 0], NW: [-0.7, -0.7],
};

/* ───────────── 결정적 잡음 ───────────── */

function hash(seed: string, q: number, r: number): number {
  let h = 2166136261;
  const str = `${seed}:${q}:${r}`;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const inside = (q: number, r: number) => q >= 0 && q < BW && r >= 0 && r < BH;

/* ───────────── 지도 만들기 ───────────── */

export function buildMap(city: CityId): BuiltMap {
  const def: BattleMapDef = BATTLE_MAPS[city];
  const tiles: Tile[] = [];
  const at = (q: number, r: number) => tiles[r * BW + q];
  const set = (q: number, r: number, t: TileType) => { if (inside(q, r)) at(q, r).t = t; };

  for (let r = 0; r < BH; r++) {
    for (let q = 0; q < BW; q++) {
      const x = hash(city, q, r);
      let t: TileType = 'plain';
      switch (def.base) {
        case 'plain': t = x < 0.07 ? 'forest' : x < 0.1 ? 'hill' : 'plain'; break;
        case 'hill': t = x < 0.12 ? 'forest' : x < 0.34 ? 'hill' : x < 0.37 ? 'mountain' : 'plain'; break;
        case 'mountain': t = x < 0.15 ? 'forest' : x < 0.38 ? 'hill' : x < 0.6 ? 'mountain' : 'plain'; break;
        case 'marsh': t = x < 0.16 ? 'marsh' : x < 0.24 ? 'forest' : 'plain'; break;
      }
      tiles.push({ t, hp: 0, fire: 0, flood: 0 });
    }
  }

  const blob = (cq: number, cr: number, rad: number, t: TileType, keep?: TileType[]) => {
    for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) {
      if (hexDist([q, r], [cq, cr]) > rad) continue;
      if (keep && !keep.includes(at(q, r).t)) continue;
      set(q, r, t);
    }
  };

  for (const [q, r, rad] of def.lakes ?? []) blob(q, r, rad, 'water');
  for (const [q, r, rad] of def.forests ?? []) blob(q, r, rad, 'forest', ['plain', 'hill', 'marsh']);

  /* 굵기: 가로로 흐르면 아래 칸, 세로로 흐르면 오른쪽 칸을 더한다 */
  const thick = (pts: P[], w: number, apply: (q: number, r: number) => void) => {
    const line = polyline(pts);
    const [a, b] = [pts[0], pts[pts.length - 1]];
    const horizontal = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    for (const [q, r] of line) {
      for (let k = 0; k < w; k++) {
        const qq = horizontal ? q : q + k;
        const rr = horizontal ? r + k : r;
        if (inside(qq, rr)) apply(qq, rr);
      }
    }
    return horizontal;
  };

  for (const rg of def.ridges ?? []) thick(rg.pts, rg.w ?? 1, (q, r) => set(q, r, rg.hill ? 'hill' : 'peak'));
  for (const rv of def.rivers ?? []) {
    const w = rv.w ?? 1;
    const horizontal = thick(rv.pts, w, (q, r) => set(q, r, 'water'));
    const cross = (p: P, t: TileType) => {
      for (let k = 0; k < w; k++) {
        const q = horizontal ? p[0] : p[0] + k;
        const r = horizontal ? p[1] + k : p[1];
        if (inside(q, r)) set(q, r, t);
      }
    };
    for (const p of rv.bridges ?? []) cross(p, 'bridge');
    for (const p of rv.fords ?? []) cross(p, 'ford');
  }
  for (const rd of def.roads ?? []) {
    for (const [q, r] of polyline(rd)) {
      const t = at(q, r).t;
      if (t === 'water') set(q, r, 'bridge');
      else if (t !== 'bridge' && t !== 'ford') set(q, r, 'road');
    }
  }
  for (const [q, r] of def.villages ?? []) set(q, r, 'village');
  if (def.sea) {
    const [dx, dy] = COMPASS[def.sea];
    for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) {
      const edge = (dx > 0 && q >= BW - 2) || (dx < 0 && q <= 1) || (dy > 0 && r >= BH - 2) || (dy < 0 && r <= 1);
      if (edge) set(q, r, 'water');
    }
  }
  for (const [q, r] of def.passes ?? []) set(q, r, 'pass');
  for (const [q, r] of def.dams ?? []) set(q, r, 'dam');

  /* 성 */
  const [kq, kr, size] = def.castle;
  const R = size === 'large' ? 3 : 2;
  for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) {
    const d = hexDist([q, r], [kq, kr]);
    if (d === 0) set(q, r, 'keep');
    else if (d < R) set(q, r, 'inner');
    else if (d === R) set(q, r, 'wall');
    else if (d === R + 1 && def.moat) set(q, r, 'water');
    else if (d === R + 1 && ['mountain', 'peak', 'water', 'marsh'].includes(at(q, r).t)) set(q, r, 'plain');
  }
  const [cx, cy] = centerXY(kq, kr);
  const ring: P[] = [];
  for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) if (hexDist([q, r], [kq, kr]) === R) ring.push([q, r]);
  for (const g of def.gates) {
    const [vx, vy] = COMPASS[g];
    let best: P | null = null, bestDot = -Infinity;
    for (const [q, r] of ring) {
      const [x, y] = centerXY(q, r);
      const len = Math.hypot(x - cx, y - cy) || 1;
      const dot = ((x - cx) * vx + (y - cy) * vy) / len;
      if (dot > bestDot) { bestDot = dot; best = [q, r]; }
    }
    if (!best) continue;
    set(best[0], best[1], 'gate');
    /* 해자 위 성문 앞에는 다리 */
    if (def.moat) {
      const [x, y] = centerXY(best[0], best[1]);
      for (let r = 0; r < BH; r++) for (let q = 0; q < BW; q++) {
        if (hexDist([q, r], [best[0], best[1]]) !== 1 || hexDist([q, r], [kq, kr]) !== R + 1) continue;
        const [x2, y2] = centerXY(q, r);
        if ((x2 - x) * (x - cx) + (y2 - y) * (y - cy) > -0.05) set(q, r, 'bridge');
      }
    }
  }

  return {
    W: BW, H: BH, tiles, keep: [kq, kr], radius: R, size,
    labels: (def.labels ?? []).map(([text, q, r]) => ({ text, q, r })),
    note: def.note,
  };
}

/* ───────────── 진입 방향 ───────────── */

/** 출발 도시 쪽을 가리키는 화면 방향(단위 벡터) */
export function entryVector(from: CityId, to: CityId): [number, number] {
  const a = CITY_BY_ID[to], b = CITY_BY_ID[from];
  const dx = b.lon - a.lon;
  const dy = -(b.lat - a.lat);
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

export function compassName(v: [number, number]): string {
  const ang = (Math.atan2(-v[1], v[0]) * 180) / Math.PI; // 동=0, 북=90
  const names = ['동', '동북', '북', '서북', '서', '서남', '남', '동남'];
  return names[((Math.round(ang / 45) % 8) + 8) % 8];
}

const LAND_BLOCK: TileType[] = ['wall', 'gate', 'pass', 'mountain', 'peak', 'water', 'inner', 'keep'];

/**
 * 방향 v 쪽 가장자리에서 부대가 설 칸을 고른다.
 * 수로로 오면 물 칸을 먼저, 아니면 뭍을 고른다. 모자라면 안쪽으로 넓혀 간다.
 */
export function entryTiles(map: { W: number; H: number; tiles: Tile[]; keep: [number, number]; radius: number }, v: [number, number], count: number, naval: boolean, taken: Set<number>): P[] {
  const [kx, ky] = centerXY(map.W / 2 - 0.5, (map.H - 1) / 2);
  const cand: { p: P; proj: number; side: number; water: boolean }[] = [];
  for (let r = 0; r < map.H; r++) for (let q = 0; q < map.W; q++) {
    const t = map.tiles[r * map.W + q].t;
    const water = t === 'water';
    if (!water && LAND_BLOCK.includes(t)) continue;
    if (water && !naval) continue;
    if (hexDist([q, r], map.keep) <= map.radius + 1) continue;
    if (taken.has(r * map.W + q)) continue;
    const [x, y] = centerXY(q, r);
    const proj = (x - kx) * v[0] + (y - ky) * v[1];
    const side = Math.abs((x - kx) * -v[1] + (y - ky) * v[0]);
    cand.push({ p: [q, r], proj, side, water });
  }
  if (!cand.length) return [];
  const maxProj = Math.max(...cand.map((c) => c.proj));
  const out: P[] = [];
  for (let depth = 2.2; out.length < count && depth < 30; depth += 1.5) {
    const band = cand
      .filter((c) => c.proj >= maxProj - depth && !out.some((o) => o[0] === c.p[0] && o[1] === c.p[1]))
      .sort((a, b) => (naval ? Number(b.water) - Number(a.water) : 0) || b.proj - a.proj + (a.side - b.side) * 0.35);
    for (const c of band) { if (out.length >= count) break; out.push(c.p); }
  }
  return out;
}

/** 도시 정보·출진 창에 보여 줄 전장 요약 */
export function mapSummary(city: CityId): { size: string; tags: string[]; note: string } {
  const def = BATTLE_MAPS[city];
  const tags: string[] = [];
  const size = { large: '대성', medium: '성', small: '소성' }[def.castle[2]];
  if (def.moat) tags.push('해자');
  if (def.passes?.length) tags.push(`관문 ${def.passes.length}`);
  if (def.dams?.length) tags.push('수공 가능');
  if (def.rivers?.length) tags.push(`강 ${def.rivers.length}`);
  if (def.sea) tags.push('바다');
  if (def.villages?.length) tags.push(`촌락 ${def.villages.length}`);
  return { size, tags, note: def.note };
}
