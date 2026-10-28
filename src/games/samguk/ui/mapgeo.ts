import { CITIES, MAP_H, MAP_W, project } from '../data/cities';
import type { CityId } from '../data/types';

/**
 * 지도 세력권 도형 — 도시마다 「가장 가까운 땅」(보로노이 칸)을 반지름 R 안에서 잘라 둔다.
 * 도시 자리는 바뀌지 않으므로 한 번만 계산하고, 그릴 때는 주인만 보고 칠·경계를 고른다.
 */
type Pt = [number, number];

export const PT = Object.fromEntries(CITIES.map((c) => [c.id, project(c.lon, c.lat)])) as Record<CityId, Pt>;

const R = 92;

export interface Cell {
  id: CityId;
  d: string;
}
export interface Edge {
  a: CityId;
  /** 맞닿은 이웃 칸(없으면 세력권 바깥 테두리) */
  b: CityId | null;
  d: string;
}

function clip(poly: Pt[], labels: (CityId | null)[], a: Pt, b: Pt, j: CityId) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const nx = b[0] - a[0], ny = b[1] - a[1];
  const side = (p: Pt) => (p[0] - mx) * nx + (p[1] - my) * ny;
  const outP: Pt[] = [];
  const outL: (CityId | null)[] = [];
  for (let k = 0; k < poly.length; k++) {
    const P = poly[k], Q = poly[(k + 1) % poly.length], L = labels[k];
    const sp = side(P), sq = side(Q);
    const hit = (): Pt => { const t = sp / (sp - sq); return [P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]; };
    if (sp <= 0 && sq <= 0) { outP.push(P); outL.push(L); }
    else if (sp <= 0 && sq > 0) { outP.push(P); outL.push(L); outP.push(hit()); outL.push(j); }
    else if (sp > 0 && sq <= 0) { outP.push(hit()); outL.push(L); }
  }
  return { poly: outP, labels: outL };
}

const fmt = (p: Pt) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

function build() {
  const cells: Cell[] = [];
  const edges: Edge[] = [];
  for (const c of CITIES) {
    const a = PT[c.id];
    let poly: Pt[] = Array.from({ length: 36 }, (_, i) => {
      const t = (i / 36) * Math.PI * 2;
      return [a[0] + Math.cos(t) * R, a[1] + Math.sin(t) * R * 0.92] as Pt;
    });
    let labels: (CityId | null)[] = poly.map(() => null);
    for (const o of CITIES) {
      if (o.id === c.id) continue;
      const b = PT[o.id];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > R * 2.1) continue;
      ({ poly, labels } = clip(poly, labels, a, b, o.id));
    }
    cells.push({ id: c.id, d: `M${poly.map(fmt).join('L')}Z` });
    /* 같은 이웃과 맞닿은 이어진 변은 한 줄로 묶는다 */
    let k = 0;
    while (k < poly.length) {
      const L = labels[k];
      const pts: Pt[] = [poly[k]];
      while (k < poly.length && labels[k] === L) { pts.push(poly[(k + 1) % poly.length]); k++; }
      if (L === null || c.id < L) edges.push({ a: c.id, b: L, d: `M${pts.map(fmt).join('L')}` });
    }
  }
  return { cells, edges };
}

export const { cells: CELLS, edges: EDGES } = build();

/** 도시 이름표 자리 — 아이콘·다른 이름표와 겹치지 않게 아래·위·오른쪽·왼쪽 순으로 고른다 */
export interface LabelPos { dx: number; dy: number; anchor: 'middle' | 'start' | 'end' }

function placeLabels(): Record<CityId, LabelPos> {
  type Box = [number, number, number, number];
  const boxes: Box[] = CITIES.map((c) => { const [x, y] = PT[c.id]; return [x - 13, y - 24, x + 13, y + 9]; });
  const hit = (b: Box) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  const out = {} as Record<CityId, LabelPos>;
  const order = [...CITIES].sort((a, b) => b.pop - a.pop);
  for (const c of order) {
    const [x, y] = PT[c.id];
    const w = c.name.length * 13 + 10, h = 17;
    const cand: [LabelPos, Box][] = [
      [{ dx: 0, dy: 21, anchor: 'middle' }, [x - w / 2, y + 10, x + w / 2, y + 10 + h]],
      [{ dx: 15, dy: 2, anchor: 'start' }, [x + 14, y - 10, x + 14 + w, y - 10 + h]],
      [{ dx: -15, dy: 2, anchor: 'end' }, [x - 14 - w, y - 10, x - 14, y - 10 + h]],
      [{ dx: 0, dy: -29, anchor: 'middle' }, [x - w / 2, y - 42, x + w / 2, y - 42 + h]],
    ];
    const pick = cand.find(([, b]) => !hit(b)) ?? cand[0];
    out[c.id] = pick[0];
    boxes.push(pick[1]);
  }
  return out;
}

export const LABEL_POS = placeLabels();

export const MAP_BOX = { w: MAP_W, h: MAP_H };
