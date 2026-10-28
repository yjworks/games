import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITIES, MAP_H, MAP_W, ROADS, project } from '../data/cities';
import { ISLANDS, LAKES, RANGES, REGION_LABELS, RIVERS, SEA, type LonLat } from '../data/geo';
import type { CityId } from '../data/types';
import type { GameState } from '../engine/state';
import { darken, paperTexture, seeded } from './art/util';

const path = (pts: LonLat[], close = false) =>
  pts.map(([lo, la], i) => { const [x, y] = project(lo, la); return `${i ? 'L' : 'M'}${x} ${y}`; }).join(' ') + (close ? ' Z' : '');

/** 바다는 지도 오른쪽·아래 끝까지 닫는다 */
const SEA_PTS = SEA.map(([lo, la]) => project(lo, la));
const SEA_PATH = `M${SEA_PTS.map(([x, y]) => `${x} ${y}`).join(' L')} L${MAP_W + 60} ${MAP_H + 60} L${MAP_W + 60} -60 L${SEA_PTS[0][0]} -60 Z`;
/** 뭍 = 큰 사각형에서 바다를 뺀 것(evenodd) */
const LAND_CLIP = `M-60 -60 L${MAP_W + 60} -60 L${MAP_W + 60} ${MAP_H + 60} L-60 ${MAP_H + 60} Z ${SEA_PATH}`;

const PT = Object.fromEntries(CITIES.map((c) => [c.id, project(c.lon, c.lat)])) as Record<CityId, [number, number]>;

/** 주(州) 이름 자리 — 소속 도시의 무게중심 */
const ZHOU_HANJA: Record<string, string> = {
  유주: '幽州', 기주: '冀州', 병주: '幷州', 청주: '靑州', 연주: '兗州', 서주: '徐州', 예주: '豫州', 양주: '揚州',
  사례: '司隸', 옹주: '雍州', '양주(涼)': '涼州', 익주: '益州', 형주: '荊州', 교주: '交州',
};
const ZHOU_LABELS = (() => {
  const g = new Map<string, [number, number, number]>();
  for (const c of CITIES) {
    const [x, y] = PT[c.id];
    const v = g.get(c.zhou) ?? [0, 0, 0];
    g.set(c.zhou, [v[0] + x, v[1] + y, v[2] + 1]);
  }
  return [...g.entries()].map(([z, [x, y, n]]) => ({ z, h: ZHOU_HANJA[z] ?? z, x: x / n, y: y / n + 26 }));
})();

/** 산 무리: 산줄기를 따라 + 산지 도시 둘레 */
const MOUNTAINS = (() => {
  const out: { x: number; y: number; s: number }[] = [];
  const rnd = seeded(42);
  for (const rg of RANGES) {
    const pts = rg.pts.map(([lo, la]) => project(lo, la));
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t < len; t += 15) {
        const k = t / len;
        out.push({ x: x1 + (x2 - x1) * k + (rnd() - 0.5) * 12, y: y1 + (y2 - y1) * k + (rnd() - 0.5) * 10, s: 0.8 + rnd() * 0.7 });
      }
    }
  }
  for (const c of CITIES) {
    if (c.land !== 'mountain' && c.land !== 'hill') continue;
    const [cx, cy] = PT[c.id];
    const n = c.land === 'mountain' ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, r = 26 + rnd() * 30;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8, s: 0.6 + rnd() * 0.5 });
    }
  }
  /* 성채 둘레는 비워 둔다 */
  const clear = (m: { x: number; y: number }) => CITIES.every((c) => { const [x, y] = PT[c.id]; return (m.x - x) ** 2 + (m.y - y) ** 2 > 22 * 22; });
  return out.filter(clear).sort((a, b) => a.y - b.y);
})();

const TREES = (() => {
  const out: { x: number; y: number }[] = [];
  const rnd = seeded(77);
  for (const c of CITIES) {
    if (c.lat > 31.5 && c.land !== 'hill') continue;
    const [cx, cy] = PT[c.id];
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, r = 20 + rnd() * 34;
      out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.8 });
    }
  }
  return out.filter((t) => CITIES.every((c) => { const [x, y] = PT[c.id]; return (t.x - x) ** 2 + (t.y - y) ** 2 > 16 * 16; }));
})();

/** 북쪽 초원·서쪽 사막 점묘 */
const STEPPE = (() => {
  const out: [number, number][] = [];
  const rnd = seeded(9);
  for (let i = 0; i < 900; i++) {
    const lo = 97.5 + rnd() * 28, la = 36 + rnd() * 7;
    if (la < 39.8 && lo > 104) continue;
    if (lo > 118 && la < 40.5) continue;
    out.push(project(lo, la));
  }
  return out;
})();

/** 세력권 그림 — 가장 가까운 도시의 주인 색으로 칠하고 경계를 긋는다 */
function territoryImage(s: GameState): string {
  if (typeof document === 'undefined') return '';
  const cell = 5;
  const cw = Math.ceil(MAP_W / cell), ch = Math.ceil(MAP_H / cell);
  const owner = new Int16Array(cw * ch).fill(-2);
  const cities = CITIES.map((c) => ({ x: PT[c.id][0], y: PT[c.id][1], o: s.cities[c.id].owner }));
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const x = i * cell + cell / 2, y = j * cell + cell / 2;
      let best = Infinity, o = -2;
      for (const c of cities) {
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < best) { best = d; o = c.o; }
      }
      if (best < 95 * 95) owner[j * cw + i] = o;
    }
  }
  const cv = document.createElement('canvas');
  cv.width = MAP_W; cv.height = MAP_H;
  const ctx = cv.getContext('2d')!;
  const base = document.createElement('canvas');
  base.width = MAP_W; base.height = MAP_H;
  const b = base.getContext('2d')!;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const o = owner[j * cw + i];
    if (o < 0) continue;
    b.fillStyle = s.factions[o]?.color ?? '#888';
    b.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
  }
  ctx.globalAlpha = 0.42;
  ctx.filter = 'blur(4px)';
  ctx.drawImage(base, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  /* 경계선 */
  ctx.fillStyle = 'rgba(60, 36, 20, 0.55)';
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
    const o = owner[j * cw + i];
    if (o === -2) continue;
    const r = i + 1 < cw ? owner[j * cw + i + 1] : o;
    const d = j + 1 < ch ? owner[(j + 1) * cw + i] : o;
    if (r !== o && r !== -2 && (o >= 0 || r >= 0)) ctx.fillRect((i + 1) * cell - 0.8, j * cell, 1.6, cell);
    if (d !== o && d !== -2 && (o >= 0 || d >= 0)) ctx.fillRect(i * cell, (j + 1) * cell - 0.8, cell, 1.6);
  }
  return cv.toDataURL('image/png');
}

interface View { x: number; y: number; w: number }

interface Props {
  s: GameState;
  selected: CityId | null;
  onSelect: (c: CityId) => void;
  /** 강조할 도시(공격 대상 등) */
  marks?: Set<CityId>;
  /** 이 세력 시점(국경 표시) */
  viewer: number;
}

export function MapView({ s, selected, onSelect, marks, viewer }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, w: MAP_W });
  const aspect = useRef(MAP_H / MAP_W);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch?: number }>({ moved: false });

  const [size, setSize] = useState({ w: 1, h: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width || 1, h: r.height || 1 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  aspect.current = size.h / size.w;
  const vh = view.w * aspect.current;

  const clampView = useCallback((v: View): View => {
    const w = Math.min(MAP_W * 1.15, Math.max(180, v.w));
    const h = w * aspect.current;
    const x = Math.min(MAP_W - w * 0.3, Math.max(-w * 0.7, v.x));
    const y = Math.min(MAP_H - h * 0.3, Math.max(-h * 0.7, v.y));
    return { x, y, w };
  }, []);

  const centered = useRef(false);
  useEffect(() => {
    if (centered.current || !selected || size.w <= 1) return;
    centered.current = true;
    const [cx, cy] = PT[selected];
    const w = size.w < 700 ? 420 : 700;
    setView(clampView({ x: cx - w / 2, y: cy - (w * aspect.current) / 2, w }));
  }, [selected, size.w, clampView]);

  const toWorld = (clientX: number, clientY: number, v = view) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: v.x + ((clientX - r.left) / r.width) * v.w, y: v.y + ((clientY - r.top) / r.height) * v.w * aspect.current };
  };

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const r = ref.current!.getBoundingClientRect();
      const px = cx ?? r.left + r.width / 2, py = cy ?? r.top + r.height / 2;
      const p = toWorld(px, py, v);
      const w = Math.min(MAP_W * 1.15, Math.max(180, v.w * factor));
      const fx = (px - r.left) / r.width, fy = (py - r.top) / r.height;
      return clampView({ x: p.x - fx * w, y: p.y - fy * w * aspect.current, w });
    });
  };

  const onWheel = (e: React.WheelEvent) => zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag.current = { moved: false };
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const r = ref.current!.getBoundingClientRect();
    if (pointers.current.size === 2 && drag.current.pinch) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0) { zoom(drag.current.pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2); drag.current.pinch = d; }
      drag.current.moved = true;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag.current.moved) return;
    setView((v) => clampView({ x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.w * aspect.current, w: v.w }));
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) drag.current.pinch = undefined; };

  /* 도시 주인이 바뀔 때만 세력권을 다시 그린다 */
  const ownerKey = CITIES.map((c) => s.cities[c.id].owner).join(',') + s.factions.map((f) => f.color).join('');
  const territory = useMemo(() => territoryImage(s), [ownerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const paper = useMemo(() => paperTexture('map-paper', 320, 320, '#d8c398', '#9c7a4a', 11), []);

  const k = view.w / MAP_W;
  const labelSize = Math.max(9, 14 * Math.sqrt(k));
  const icon = Math.max(0.55, Math.sqrt(k));

  return (
    <div className="sg-map-wrap">
      <svg
        ref={ref}
        className="sg-map"
        viewBox={`${view.x} ${view.y} ${view.w} ${vh}`}
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        role="img"
        aria-label="천하 지도"
      >
        <MapDefs paper={paper} />
        <MapBase territory={territory} />
        {ROADS.map(([a, b, kind]) => {
          const [x1, y1] = PT[a];
          const [x2, y2] = PT[b];
          const oa = s.cities[a].owner, ob = s.cities[b].owner;
          const border = oa !== ob && (oa === viewer || ob === viewer) && viewer >= 0;
          return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`sg-road ${kind === 'w' ? 'water' : ''} ${border ? 'border' : ''}`} />;
        })}
        {CITIES.map((cd) => {
          const c = s.cities[cd.id];
          const [x, y] = PT[cd.id];
          const fac = c.owner >= 0 ? s.factions[c.owner] : null;
          const color = fac?.color ?? '#8a8172';
          const isCap = !!fac && fac.capital === cd.id;
          const sel = selected === cd.id;
          const mark = marks?.has(cd.id);
          return (
            <g key={cd.id} className={`sg-city ${sel ? 'sel' : ''} ${mark ? 'mark' : ''}`}
              onClick={() => { if (!drag.current.moved) onSelect(cd.id); }}
              transform={`translate(${x} ${y}) scale(${icon})`}>
              <circle r="22" className="sg-hit" />
              {mark && <circle r="18" className="sg-mark-ring" />}
              {sel && <circle r="17" className="sg-sel-ring" />}
              {isCap ? <use href="#mv-capital" x={-16} y={-22} width={32} height={30} />
                : cd.pop >= 60 ? <use href="#mv-castle-l" x={-13} y={-13} width={26} height={20} />
                  : <use href="#mv-castle" x={-10} y={-10} width={20} height={16} />}
              {fac && (
                <g transform={isCap ? 'translate(9 -26)' : 'translate(7 -18)'}>
                  <line x1="0" y1="0" x2="0" y2="16" stroke="#2b1d12" strokeWidth="1.2" />
                  <path d="M0 0 C6 -2 10 2 16 0 L16 8 C10 10 6 6 0 8 Z" fill={color} stroke={darken(color, 0.5)} strokeWidth="0.6" className="sg-mflag" />
                </g>
              )}
              <text y={isCap ? 22 : 18} className="sg-cname" fontSize={labelSize / icon}>{cd.name}</text>
            </g>
          );
        })}
        <MapFrame />
      </svg>
      <div className="sg-zoom">
        <button className="sg-zbtn" onClick={() => zoom(1 / 1.3)} aria-label="확대">＋</button>
        <button className="sg-zbtn" onClick={() => zoom(1.3)} aria-label="축소">－</button>
        <button className="sg-zbtn" onClick={() => setView(clampView({ x: 0, y: 0, w: MAP_W }))} aria-label="전체 보기">⤢</button>
      </div>
    </div>
  );
}

/* ───────── 지도 바탕(바뀌지 않는 부분은 따로 기억) ───────── */

const MapDefs = memo(function MapDefs({ paper }: { paper: string }) {
  return (
    <defs>
      <pattern id="mv-paper" width="320" height="320" patternUnits="userSpaceOnUse">
        {paper ? <image href={paper} width="320" height="320" /> : <rect width="320" height="320" fill="#d8c398" />}
      </pattern>
      <pattern id="mv-waves" width="36" height="18" patternUnits="userSpaceOnUse">
        <path d="M0 12 q9 -8 18 0 t18 0" stroke="#5f7f86" strokeWidth="1" fill="none" opacity="0.45" />
      </pattern>
      <clipPath id="mv-land"><path d={LAND_CLIP} clipRule="evenodd" /></clipPath>
      <linearGradient id="mv-sea" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#9fb3ac" />
        <stop offset="1" stopColor="#7f9a98" />
      </linearGradient>
      <symbol id="mv-mtn" viewBox="-14 -12 28 16" overflow="visible">
        <path d="M-13 3 L-4 -9 L0 -4 L5 -11 L13 3 Z" fill="#b59a6c" />
        <path d="M-13 3 L-4 -9 L0 -4 L5 -11 L13 3" fill="none" stroke="#4a3520" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M5 -11 L3 -2 M-4 -9 L-5 -1" stroke="#4a3520" strokeWidth="0.8" opacity="0.7" />
      </symbol>
      <symbol id="mv-tree" viewBox="-5 -9 10 11" overflow="visible">
        <path d="M0 -8 C4 -7 5 -2 0 -1 C-5 -2 -4 -7 0 -8 Z" fill="#6f7a45" stroke="#3d4322" strokeWidth="0.7" />
        <line x1="0" y1="-1" x2="0" y2="2" stroke="#3d4322" strokeWidth="0.8" />
      </symbol>
      <symbol id="mv-castle" viewBox="-10 -10 20 16" overflow="visible">
        <path d="M-9 6 L-9 -4 L-6 -4 L-6 -6 L-3 -6 L-3 -4 L3 -4 L3 -6 L6 -6 L6 -4 L9 -4 L9 6 Z" fill="#e9dcc0" stroke="#3a2a1a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M-2.5 6 L-2.5 1 Q0 -1.5 2.5 1 L2.5 6 Z" fill="#3a2a1a" />
      </symbol>
      <symbol id="mv-castle-l" viewBox="-13 -13 26 20" overflow="visible">
        <path d="M-12 7 L-12 -3 L-9 -3 L-9 -5 L-6 -5 L-6 -3 L6 -3 L6 -5 L9 -5 L9 -3 L12 -3 L12 7 Z" fill="#efe2c4" stroke="#3a2a1a" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M-6 -3 L-6 -8 L6 -8 L6 -3" fill="#e2d2ae" stroke="#3a2a1a" strokeWidth="1" />
        <path d="M-9 -8 Q0 -14 9 -8 Z" fill="#6b2e22" stroke="#3a2a1a" strokeWidth="0.8" />
        <path d="M-3 7 L-3 1 Q0 -2 3 1 L3 7 Z" fill="#3a2a1a" />
      </symbol>
      <symbol id="mv-capital" viewBox="-16 -22 32 30" overflow="visible">
        <path d="M-15 8 L-15 -2 L-12 -2 L-12 -4 L-9 -4 L-9 -2 L9 -2 L9 -4 L12 -4 L12 -2 L15 -2 L15 8 Z" fill="#f3e6c6" stroke="#3a2a1a" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M-8 -2 L-8 -9 L8 -9 L8 -2" fill="#e9d8b0" stroke="#3a2a1a" strokeWidth="1" />
        <path d="M-13 -9 Q0 -17 13 -9 L10 -8 Q0 -13 -10 -8 Z" fill="#8a2a1e" stroke="#3a2a1a" strokeWidth="0.8" />
        <path d="M-4 -12 L-4 -16 L4 -16 L4 -12" fill="#e9d8b0" stroke="#3a2a1a" strokeWidth="0.8" />
        <path d="M-8 -16 Q0 -22 8 -16 Z" fill="#8a2a1e" stroke="#3a2a1a" strokeWidth="0.8" />
        <path d="M-3.5 8 L-3.5 2 Q0 -1.5 3.5 2 L3.5 8 Z" fill="#3a2a1a" />
      </symbol>
    </defs>
  );
});

const MapBase = memo(function MapBase({ territory }: { territory: string }) {
  return (
    <g>
      <rect x={-400} y={-400} width={MAP_W + 800} height={MAP_H + 800} className="sg-table" />
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#mv-paper)" />
      <path d={SEA_PATH} fill="url(#mv-sea)" />
      <path d={SEA_PATH} fill="url(#mv-waves)" />
      <path d={path(SEA.slice(0, -1))} fill="none" stroke="#4d3a24" strokeWidth="1.6" opacity="0.8" />
      <path d={path(SEA.slice(0, -1))} fill="none" stroke="#4d3a24" strokeWidth="5" opacity="0.08" />
      {ISLANDS.map((isl, i) => <path key={i} d={path(isl, true)} fill="url(#mv-paper)" stroke="#4d3a24" strokeWidth="1.2" />)}
      {territory && <image href={territory} x={0} y={0} width={MAP_W} height={MAP_H} clipPath="url(#mv-land)" />}
      <g clipPath="url(#mv-land)">
        {STEPPE.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.9" fill="#8a6a3c" opacity="0.5" />)}
      </g>
      {RIVERS.map((rv) => (
        <g key={rv.name}>
          <path d={path(rv.pts)} className="sg-river-bank" strokeWidth={rv.width + 3} />
          <path d={path(rv.pts)} className="sg-river" strokeWidth={rv.width} />
        </g>
      ))}
      {LAKES.map((lk) => {
        const [x, y] = project(lk.at[0], lk.at[1]);
        const [x2] = project(lk.at[0] + lk.rx, lk.at[1]);
        const [, y2] = project(lk.at[0], lk.at[1] - lk.ry);
        return <ellipse key={lk.name} cx={x} cy={y} rx={x2 - x} ry={y2 - y} className="sg-lake" />;
      })}
      {TREES.map((t, i) => <use key={`t${i}`} href="#mv-tree" x={t.x - 5} y={t.y - 9} width="10" height="11" />)}
      {MOUNTAINS.map((m, i) => <use key={`m${i}`} href="#mv-mtn" x={m.x - 14 * m.s} y={m.y - 12 * m.s} width={28 * m.s} height={16 * m.s} />)}
      {ZHOU_LABELS.map((z) => (
        <text key={z.z} x={z.x} y={z.y} className="sg-zhou">{z.h}</text>
      ))}
      {REGION_LABELS.map((l) => {
        const [x, y] = project(l.at[0], l.at[1]);
        return <text key={l.name} x={x} y={y} className="sg-region">{l.name}</text>;
      })}
      {[['渤海', 120.2, 38.8], ['東海', 123.2, 33.5], ['南海', 116.5, 21.2]].map(([n, lo, la]) => {
        const [x, y] = project(lo as number, la as number);
        return <text key={n as string} x={x} y={y} className="sg-seaname">{n}</text>;
      })}
    </g>
  );
});

const MapFrame = memo(function MapFrame() {
  const [cx, cy] = [MAP_W - 70, MAP_H - 80];
  return (
    <g pointerEvents="none">
      <rect x={4} y={4} width={MAP_W - 8} height={MAP_H - 8} fill="none" stroke="#3a2614" strokeWidth="3" />
      <rect x={12} y={12} width={MAP_W - 24} height={MAP_H - 24} fill="none" stroke="#3a2614" strokeWidth="1" />
      {[[12, 12], [MAP_W - 12, 12], [12, MAP_H - 12], [MAP_W - 12, MAP_H - 12]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x={-8} y={-8} width={16} height={16} fill="#7a2a1c" stroke="#3a2614" strokeWidth="1.2" transform="rotate(45)" />
          <circle r="3" fill="#d8c398" />
        </g>
      ))}
      {/* 제목 띠 */}
      <g transform="translate(36 30)">
        <rect width="132" height="46" rx="3" fill="#efe1bd" stroke="#3a2614" strokeWidth="1.6" />
        <rect x="4" y="4" width="124" height="38" rx="2" fill="none" stroke="#3a2614" strokeWidth="0.7" />
        <text x="54" y="31" className="sg-cartouche">天下全圖</text>
        <rect x="104" y="12" width="20" height="22" fill="#b0342a" />
        <text x="114" y="28" className="sg-seal">漢</text>
      </g>
      {/* 나침반 */}
      <g transform={`translate(${cx} ${cy})`} opacity="0.85">
        <circle r="30" fill="#efe1bd" stroke="#3a2614" strokeWidth="1.2" />
        <circle r="24" fill="none" stroke="#3a2614" strokeWidth="0.6" />
        <path d="M0 -26 L5 0 L0 26 L-5 0 Z" fill="#3a2614" />
        <path d="M0 -26 L5 0 L-5 0 Z" fill="#b0342a" />
        <path d="M-26 0 L0 4 L26 0 L0 -4 Z" fill="#7a6040" opacity="0.6" />
        <text y="-34" className="sg-compass">北</text>
      </g>
    </g>
  );
});

