import { Suspense, lazy, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ROOT_NS, readJSON, writeJSON } from '../../../shared/storage';
import { useGame } from '../store';
import { CITIES, MAP_H, MAP_W, ROADS, project } from '../data/cities';
import { LAKES, REGION_LABELS, RIVERS, type LonLat } from '../data/geo';
import { OFFICER_DEF } from '../data/officers';
import type { CityId } from '../data/types';
import type { GameState } from '../engine/state';
import { darken, lighten, mix, paperTexture, surname } from './art/util';
import { CELLS, EDGES, LABEL_POS, LAND_URL, PT, TERRAIN_URL, ZHOU_LABELS } from './mapgeo';
export { TERRAIN_URL } from './mapgeo';
import { seasonOf } from './labels';

const path = (pts: LonLat[], close = false) =>
  pts.map(([lo, la], i) => { const [x, y] = project(lo, la); return `${i ? 'L' : 'M'}${x} ${y}`; }).join(' ') + (close ? ' Z' : '');

/** 철마다 지도 빛깔을 조금 바꾼다 */
function seasonTint(month: number): { color: string; op: number; mode: 'screen' | 'multiply' | 'soft-light' } | null {
  const se = seasonOf(month);
  if (se === 'winter') return { color: '#dfe7ec', op: 0.3, mode: 'screen' };
  if (se === 'autumn') return { color: '#d29a52', op: 0.16, mode: 'multiply' };
  if (se === 'spring') return { color: '#a9cf7a', op: 0.12, mode: 'soft-light' };
  return null;
}

interface View { x: number; y: number; w: number }

const WorldMap3D = lazy(() => import('./three/WorldMap3D'));
const MAP3D_KEY = `${ROOT_NS}:samguk:map3d`;
function webglOk(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

/** 지도 — 3D(기본)와 2D 그림 지도를 고를 수 있다 */
export function MapView(p: Props) {
  const [three, setThree] = useState<boolean>(() => readJSON<boolean>(MAP3D_KEY, true) && webglOk());
  const rev = useGame((u) => u.rev);
  const api = useRef<{ zoom: (f: number) => void; overview: () => void } | null>(null);
  const toggle = () => { const v = !three; setThree(v); writeJSON(MAP3D_KEY, v); };
  if (!three) return <MapView2D {...p} onToggle={toggle} />;
  return (
    <div className="sg-map-wrap">
      <Suspense fallback={<div className="sg-map3d sg-bt3d-wait">천하를 펼치는 중…</div>}>
        <WorldMap3D s={p.s} rev={rev} selected={p.selected} onSelect={p.onSelect} marks={p.marks} viewer={p.viewer}
          onFail={() => setThree(false)} onView={(a) => { api.current = a; }} />
      </Suspense>
      <SeasonFx month={p.s.month} />
      <div className="sg-zoom">
        <button className="sg-zbtn" onClick={() => api.current?.zoom(0.75)} aria-label="확대">＋</button>
        <button className="sg-zbtn" onClick={() => api.current?.zoom(1.33)} aria-label="축소">－</button>
        <button className="sg-zbtn" onClick={() => api.current?.overview()} aria-label="전체 보기">⤢</button>
        <button className="sg-zbtn sg-zbtn-txt" onClick={toggle} aria-label="2D 지도로">2D</button>
      </div>
    </div>
  );
}

interface Props {
  s: GameState;
  selected: CityId | null;
  onSelect: (c: CityId) => void;
  /** 강조할 도시(공격 대상 등) */
  marks?: Set<CityId>;
  /** 이 세력 시점(국경 표시) */
  viewer: number;
}

function MapView2D({ s, selected, onSelect, marks, viewer, onToggle }: Props & { onToggle: () => void }) {
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

  const paper = useMemo(() => paperTexture('map-paper', 320, 320, '#d8c398', '#9c7a4a', 11), []);
  const ownerKey = CITIES.map((c) => s.cities[c.id].owner).join(',') + s.factions.map((f) => f.color).join('');

  const k = view.w / MAP_W;
  /* 좁은 화면에서는 성과 이름표를 조금 키운다 */
  const fit = Math.min(1.5, Math.max(1, 760 / size.w));
  const icon = Math.min(1.25, Math.max(0.55, Math.sqrt(k)) * fit);
  const tint = seasonTint(s.month);

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
        <MapBase />
        <Territory s={s} ownerKey={ownerKey} />
        {tint && <rect x={0} y={0} width={MAP_W} height={MAP_H} fill={tint.color} opacity={tint.op} style={{ mixBlendMode: tint.mode }} pointerEvents="none" />}
        <MapWater />
        <Clouds />
        {ROADS.map(([a, b, kind]) => {
          const [x1, y1] = PT[a];
          const [x2, y2] = PT[b];
          const oa = s.cities[a].owner, ob = s.cities[b].owner;
          const border = oa !== ob && (oa === viewer || ob === viewer) && viewer >= 0;
          return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`sg-road ${kind === 'w' ? 'water' : ''} ${border ? 'border' : ''}`} />;
        })}
        <MapLabels />
        <Marches s={s} />
        {CITIES.map((cd) => {
          const c = s.cities[cd.id];
          const [x, y] = PT[cd.id];
          const fac = c.owner >= 0 ? s.factions[c.owner] : null;
          const color = fac?.color ?? '#8a8172';
          const isCap = !!fac && fac.capital === cd.id;
          const sel = selected === cd.id;
          const mark = marks?.has(cd.id);
          const lp = LABEL_POS[cd.id];
          const w = cd.name.length * 13 + 10;
          const px = lp.anchor === 'middle' ? -w / 2 : lp.anchor === 'start' ? lp.dx - 4 : lp.dx - w + 4;
          const sur = fac ? surname(OFFICER_DEF[fac.ruler]?.hanja ?? '') : '';
          return (
            <g key={cd.id} className={`sg-city ${sel ? 'sel' : ''} ${mark ? 'mark' : ''}`}
              onClick={() => { if (!drag.current.moved) onSelect(cd.id); }}
              transform={`translate(${x} ${y}) scale(${icon})`}>
              <circle r="22" className="sg-hit" />
              <ellipse cy="8" rx={isCap ? 19 : 15} ry="5" fill="#1a1008" opacity="0.35" />
              {mark && <circle r="21" className="sg-mark-ring" />}
              {sel && <circle r="20" className="sg-sel-ring" />}
              {isCap ? <use href="#mv-capital" x={-19} y={-25} width={38} height={34} />
                : cd.pop >= 60 ? <use href="#mv-castle-l" x={-15} y={-17} width={30} height={26} />
                  : <use href="#mv-castle" x={-12} y={-12} width={24} height={20} />}
              {fac && (
                <g transform={isCap ? 'translate(12 -30)' : 'translate(9 -22)'}>
                  <line x1="0" y1="-1" x2="0" y2="21" stroke="#2b1d12" strokeWidth="1.4" />
                  <circle cy="-1.5" r="1.3" fill="#d9b44a" />
                  <path d="M0 0 C6 -2 11 2 18 0 L18 11 C11 13 6 9 0 11 Z" fill={color} stroke={darken(color, 0.55)} strokeWidth="0.7" className="sg-mflag" />
                  <text x="8.6" y="8.9" className="sg-mflag-txt" fill={lighten(color, 0.85)}>{sur}</text>
                </g>
              )}
              <g transform={`translate(0 ${lp.dy})`}>
                <rect x={px} y={-12} width={w} height={16} rx="2" className={`sg-cplate ${fac?.idx === viewer ? 'mine' : ''}`}
                  style={{ ['--fac' as string]: fac ? color : '#8a8172' }} />
                <text x={lp.anchor === 'middle' ? 0 : lp.dx} y={1} textAnchor={lp.anchor} className="sg-cname">{cd.name}</text>
              </g>
            </g>
          );
        })}
        <MapFrame />
      </svg>
      <SeasonFx month={s.month} />
      <div className="sg-zoom">
        <button className="sg-zbtn" onClick={() => zoom(1 / 1.3)} aria-label="확대">＋</button>
        <button className="sg-zbtn" onClick={() => zoom(1.3)} aria-label="축소">－</button>
        <button className="sg-zbtn" onClick={() => setView(clampView({ x: 0, y: 0, w: MAP_W }))} aria-label="전체 보기">⤢</button>
        <button className="sg-zbtn sg-zbtn-txt" onClick={onToggle} aria-label="3D 지도로">3D</button>
      </div>
    </div>
  );
}

/* ───────── 이달의 진군 — 붓으로 그은 화살표, 끝에 승패 도장 ───────── */

function Marches({ s }: { s: GameState }) {
  const list = (s.marches ?? []).filter((m) => m.y === s.year && m.m === s.month);
  if (!list.length) return null;
  return (
    <g pointerEvents="none" className="sg-marches">
      {list.map((m, i) => {
        const [x1, y1] = PT[m.from], [x2, y2] = PT[m.to];
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const bend = Math.min(40, len * 0.22) * (i % 2 ? -1 : 1);
        const mx = (x1 + x2) / 2 + nx * bend, my = (y1 + y2) / 2 + ny * bend;
        /* 끝은 성 앞에서 멈춘다 */
        const ex = x2 - (x2 - mx) / Math.hypot(x2 - mx, y2 - my) * 16, ey = y2 - (y2 - my) / Math.hypot(x2 - mx, y2 - my) * 16;
        const sx = x1 + (mx - x1) / Math.hypot(mx - x1, my - y1) * 12, sy = y1 + (my - y1) / Math.hypot(mx - x1, my - y1) * 12;
        /* 붓 — 굵게 시작해 가늘어지는 획 */
        const pts: string[] = [], back: string[] = [];
        for (let k = 0; k <= 16; k++) {
          const t = k / 16;
          const px = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
          const py = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;
          const tx = 2 * (1 - t) * (mx - sx) + 2 * t * (ex - mx), ty = 2 * (1 - t) * (my - sy) + 2 * t * (ey - my);
          const tl = Math.hypot(tx, ty) || 1;
          const w = 5.5 * (1 - t * 0.7) + (k % 3 === 1 ? 0.6 : 0);
          pts.push(`${(px - (ty / tl) * w).toFixed(1)},${(py + (tx / tl) * w).toFixed(1)}`);
          back.unshift(`${(px + (ty / tl) * w).toFixed(1)},${(py - (tx / tl) * w).toFixed(1)}`);
        }
        const ang = Math.atan2(ey - my, ex - mx);
        const head = [[0, 0], [-15, -9], [-11, 0], [-15, 9]].map(([hx, hy]) =>
          `${(ex + Math.cos(ang) * (hx + 6) - Math.sin(ang) * hy).toFixed(1)},${(ey + Math.sin(ang) * (hx + 6) + Math.cos(ang) * hy).toFixed(1)}`).join(' ');
        const col = s.factions[m.f]?.color ?? '#a33';
        const won = s.cities[m.to].owner === m.f;
        return (
          <g key={i} className="sg-marchar" style={{ animationDelay: `${i * 0.25}s` }}>
            <polygon points={[...pts, ...back].join(' ')} fill={darken(col, 0.55)} transform="translate(1.5 2)" opacity="0.5" />
            <polygon points={[...pts, ...back].join(' ')} fill={col} stroke={darken(col, 0.5)} strokeWidth="0.8" />
            <polygon points={head} fill={col} stroke={darken(col, 0.5)} strokeWidth="0.8" />
            <g transform={`translate(${x2 + 15} ${y2 - 30})`}>
              <rect x="-9" y="-9" width="18" height="18" fill={won ? '#b0342a' : '#3a3a42'} stroke="#f1e4c3" strokeWidth="1" transform="rotate(-8)" />
              <text y="5" className="sg-march-seal" transform="rotate(-8)">{won ? '破' : '退'}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** 철마다 지도 위로 흩날리는 것 — 겨울 눈, 봄 꽃잎, 가을 낙엽 */
const SeasonFx = memo(function SeasonFx({ month }: { month: number }) {
  const se = seasonOf(month);
  const kind = se === 'winter' ? 'snow' : se === 'spring' ? 'petal' : se === 'autumn' ? 'leaf' : null;
  if (!kind) return null;
  return (
    <div className={`sg-seasonfx ${kind}`} aria-hidden="true">
      {Array.from({ length: kind === 'snow' ? 34 : 16 }, (_, i) => (
        <i key={i} style={{
          left: `${(i * 37) % 100}%`,
          animationDuration: `${(kind === 'snow' ? 9 : 13) + ((i * 7) % 9)}s`,
          animationDelay: `${-((i * 13) % 17)}s`,
          transform: `scale(${0.6 + ((i * 5) % 7) / 10})`,
        }} />
      ))}
    </div>
  );
});

/* ───────── 세력권 — 주인 색으로 옅게 물들이고(곱하기) 세력 사이에 먹선을 긋는다 ───────── */

const Territory = memo(function Territory({ s }: { s: GameState; ownerKey: string }) {
  const owner = (id: CityId) => s.cities[id].owner;
  const col = (o: number) => s.factions[o]?.color ?? '#888';
  return (
    <g pointerEvents="none">
      <g mask="url(#mv-landmask)" style={{ mixBlendMode: 'multiply' }}>
        {CELLS.map((c) => {
          const o = owner(c.id);
          if (o < 0) return null;
          return <path key={c.id} d={c.d} fill={mix(col(o), '#ffffff', 0.18)} opacity="0.72" />;
        })}
      </g>
      <g mask="url(#mv-landmask)">
        {EDGES.map((e, i) => {
          const oa = owner(e.a);
          const ob = e.b ? owner(e.b) : -2;
          if (oa === ob) return null;
          if (e.b === null) {
            return oa >= 0 ? <path key={i} d={e.d} className="sg-tborder outer" stroke={darken(col(oa), 0.35)} /> : null;
          }
          if (oa < 0 && ob < 0) return null;
          return (
            <g key={i}>
              <path d={e.d} className="sg-tborder glow" />
              <path d={e.d} className="sg-tborder" />
            </g>
          );
        })}
      </g>
    </g>
  );
}, (a, b) => a.ownerKey === b.ownerKey);

/* ───────── 지도 바탕(바뀌지 않는 부분은 따로 기억) ───────── */

const MapDefs = memo(function MapDefs({ paper }: { paper: string }) {
  return (
    <defs>
      <pattern id="mv-paper" width="320" height="320" patternUnits="userSpaceOnUse">
        {paper ? <image href={paper} width="320" height="320" /> : <rect width="320" height="320" fill="#d8c398" />}
      </pattern>
      <mask id="mv-landmask" maskUnits="userSpaceOnUse" x={0} y={0} width={MAP_W} height={MAP_H}>
        <image href={LAND_URL} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
      </mask>
      <radialGradient id="mv-cloud">
        <stop offset="0" stopColor="#1a1008" stopOpacity="0.16" />
        <stop offset="1" stopColor="#1a1008" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mv-roof" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a5a5e" />
        <stop offset="1" stopColor="#24302f" />
      </linearGradient>
      <linearGradient id="mv-roof-red" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a8382a" />
        <stop offset="1" stopColor="#5e1a12" />
      </linearGradient>
      <linearGradient id="mv-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f0e4c6" />
        <stop offset="1" stopColor="#b9a47c" />
      </linearGradient>
      {/* 작은 성: 네모난 토성과 문루 하나 */}
      <symbol id="mv-castle" viewBox="-12 -12 24 20" overflow="visible">
        <path d="M-11 7 L-11 -2 L11 -2 L11 7 Z" fill="url(#mv-wall)" stroke="#2f2112" strokeWidth="1.1" strokeLinejoin="round" />
        {[-10, -6, -2, 2, 6].map((x) => <rect key={x} x={x} y="-4.4" width="2.4" height="2.6" fill="#e6d7b4" stroke="#2f2112" strokeWidth="0.6" />)}
        <rect x="-4.5" y="-8" width="9" height="6" fill="#d9c69c" stroke="#2f2112" strokeWidth="0.8" />
        <path d="M-7.5 -7.5 Q0 -12.5 7.5 -7.5 L5.5 -6.4 Q0 -9.4 -5.5 -6.4 Z" fill="url(#mv-roof)" stroke="#1d1810" strokeWidth="0.6" />
        <path d="M-2.2 7 L-2.2 2.4 Q0 0.6 2.2 2.4 L2.2 7 Z" fill="#2a1a0e" />
      </symbol>
      {/* 큰 성: 모서리 각루와 이층 문루 */}
      <symbol id="mv-castle-l" viewBox="-15 -17 30 26" overflow="visible">
        <path d="M-14 8 L-14 -3 L14 -3 L14 8 Z" fill="url(#mv-wall)" stroke="#2f2112" strokeWidth="1.2" strokeLinejoin="round" />
        {[-13, -9, -5, 3, 7, 11].map((x) => <rect key={x} x={x} y="-5.2" width="2.6" height="2.8" fill="#e6d7b4" stroke="#2f2112" strokeWidth="0.6" />)}
        {[-14, 14].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="-7" width="6" height="8" fill="#e2d2ac" stroke="#2f2112" strokeWidth="0.8" />
            <path d={`M${x - 4.4} -6.6 L${x} -10 L${x + 4.4} -6.6 Z`} fill="url(#mv-roof)" stroke="#1d1810" strokeWidth="0.6" />
          </g>
        ))}
        <rect x="-6" y="-8" width="12" height="6" fill="#d9c69c" stroke="#2f2112" strokeWidth="0.8" />
        <path d="M-9.5 -7.5 Q0 -13.5 9.5 -7.5 L7 -6.2 Q0 -10 -7 -6.2 Z" fill="url(#mv-roof-red)" stroke="#2a0e08" strokeWidth="0.6" />
        <rect x="-3.6" y="-12.5" width="7.2" height="4" fill="#e6d7b4" stroke="#2f2112" strokeWidth="0.6" />
        <path d="M-6.6 -12.2 Q0 -17 6.6 -12.2 L4.8 -11.2 Q0 -14 -4.8 -11.2 Z" fill="url(#mv-roof-red)" stroke="#2a0e08" strokeWidth="0.6" />
        <path d="M-2.8 8 L-2.8 2.6 Q0 0.4 2.8 2.6 L2.8 8 Z" fill="#2a1a0e" />
      </symbol>
      {/* 도읍: 겹성과 궁궐 */}
      <symbol id="mv-capital" viewBox="-19 -25 38 34" overflow="visible">
        <path d="M-18 9 L-18 -3 L18 -3 L18 9 Z" fill="url(#mv-wall)" stroke="#2f2112" strokeWidth="1.3" strokeLinejoin="round" />
        {[-17, -13, -9, 7, 11, 15].map((x) => <rect key={x} x={x} y="-5.4" width="2.8" height="3" fill="#ecdcb8" stroke="#2f2112" strokeWidth="0.6" />)}
        {[-18, 18].map((x) => (
          <g key={x}>
            <rect x={x - 3.4} y="-8" width="6.8" height="9" fill="#e6d6b0" stroke="#2f2112" strokeWidth="0.8" />
            <path d={`M${x - 5} -7.6 Q${x} -12 ${x + 5} -7.6 Z`} fill="url(#mv-roof-red)" stroke="#2a0e08" strokeWidth="0.6" />
          </g>
        ))}
        <rect x="-10" y="-10" width="20" height="8" fill="#e9d8b0" stroke="#2f2112" strokeWidth="0.9" />
        {[-7, -2.5, 2, 6.5].map((x) => <rect key={x} x={x} y="-8.6" width="1.6" height="5" fill="#7a2a1c" />)}
        <path d="M-14 -9.5 Q0 -17 14 -9.5 L11 -8 Q0 -13 -11 -8 Z" fill="#c9a13e" stroke="#4a3210" strokeWidth="0.7" />
        <rect x="-6" y="-16" width="12" height="6" fill="#efe0bb" stroke="#2f2112" strokeWidth="0.8" />
        <path d="M-9.5 -15.5 Q0 -22 9.5 -15.5 L7 -14.2 Q0 -18.4 -7 -14.2 Z" fill="#c9a13e" stroke="#4a3210" strokeWidth="0.7" />
        <path d="M-5 -20 Q0 -25 5 -20 Z" fill="#c9a13e" stroke="#4a3210" strokeWidth="0.6" />
        <line x1="0" y1="-24" x2="0" y2="-26.5" stroke="#4a3210" strokeWidth="0.8" />
        <path d="M-3.4 9 L-3.4 2.6 Q0 0 3.4 2.6 L3.4 9 Z" fill="#2a1a0e" />
      </symbol>
    </defs>
  );
});

const MapBase = memo(function MapBase() {
  return (
    <g pointerEvents="none">
      <rect x={-400} y={-400} width={MAP_W + 800} height={MAP_H + 800} className="sg-table" />
      <image href={TERRAIN_URL} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
      <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#mv-paper)" opacity="0.42" style={{ mixBlendMode: 'multiply' }} />
    </g>
  );
});

/** 강·호수 — 후한대 물길(황하·회수 옛길)을 손으로 그린 것 */
const MapWater = memo(function MapWater() {
  return (
    <g pointerEvents="none">
      {RIVERS.map((rv) => (
        <g key={rv.name}>
          <path d={path(rv.pts)} className="sg-river-bank" strokeWidth={rv.width * 0.75 + 2.2} />
          <path d={path(rv.pts)} className="sg-river" strokeWidth={rv.width * 0.75} />
          <path d={path(rv.pts)} className="sg-river-hi" strokeWidth={Math.max(0.5, rv.width * 0.22)} />
        </g>
      ))}
      {LAKES.map((lk) => {
        const [x, y] = project(lk.at[0], lk.at[1]);
        const [x2] = project(lk.at[0] + lk.rx, lk.at[1]);
        const [, y2] = project(lk.at[0], lk.at[1] - lk.ry);
        return <ellipse key={lk.name} cx={x} cy={y} rx={x2 - x} ry={y2 - y} className="sg-lake" />;
      })}
    </g>
  );
});

/** 천천히 흘러가는 구름 그늘 */
const Clouds = memo(function Clouds() {
  return (
    <g className="sg-cloudshadow" pointerEvents="none">
      {[[180, 160, 170], [620, 300, 210], [420, 620, 190], [860, 560, 150], [300, 420, 120]].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.45} fill="url(#mv-cloud)" />
      ))}
    </g>
  );
});

const MapLabels = memo(function MapLabels() {
  return (
    <g pointerEvents="none">
      {ZHOU_LABELS.map((z) => <text key={z.z} x={z.x} y={z.y} className="sg-zhou">{z.h}</text>)}
      {REGION_LABELS.map((l) => {
        const [x, y] = project(l.at[0], l.at[1]);
        return <text key={l.name} x={x} y={y} className="sg-region">{l.name}</text>;
      })}
      {[['渤海', 120.4, 38.6], ['東海', 123.4, 31.5], ['南海', 116.5, 21.2]].map(([n, lo, la]) => {
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
      <rect x={3} y={3} width={MAP_W - 6} height={MAP_H - 6} fill="none" stroke="#2a1a0c" strokeWidth="6" />
      <rect x={9} y={9} width={MAP_W - 18} height={MAP_H - 18} fill="none" stroke="#c9a13e" strokeWidth="1.4" opacity="0.8" />
      <rect x={13} y={13} width={MAP_W - 26} height={MAP_H - 26} fill="none" stroke="#2a1a0c" strokeWidth="0.8" opacity="0.7" />
      {[[13, 13], [MAP_W - 13, 13], [13, MAP_H - 13], [MAP_W - 13, MAP_H - 13]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x={-9} y={-9} width={18} height={18} fill="#7a2a1c" stroke="#c9a13e" strokeWidth="1.2" transform="rotate(45)" />
          <circle r="3.2" fill="#e9d6a6" />
        </g>
      ))}
      {/* 제목 띠 */}
      <g transform="translate(36 30)">
        <rect width="140" height="48" rx="3" fill="#efe1bd" stroke="#2a1a0c" strokeWidth="1.8" />
        <rect x="4" y="4" width="132" height="40" rx="2" fill="none" stroke="#7a2a1c" strokeWidth="0.8" />
        <text x="58" y="32" className="sg-cartouche">天下全圖</text>
        <rect x="110" y="12" width="21" height="24" fill="#b0342a" />
        <text x="120.5" y="29" className="sg-seal">漢</text>
      </g>
      {/* 나침반 */}
      <g transform={`translate(${cx} ${cy})`} opacity="0.9">
        <circle r="31" fill="#efe1bd" stroke="#2a1a0c" strokeWidth="1.4" />
        <circle r="25" fill="none" stroke="#7a2a1c" strokeWidth="0.7" />
        <path d="M0 -27 L5 0 L0 27 L-5 0 Z" fill="#2a1a0c" />
        <path d="M0 -27 L5 0 L-5 0 Z" fill="#b0342a" />
        <path d="M-27 0 L0 4 L27 0 L0 -4 Z" fill="#7a6040" opacity="0.6" />
        <text y="-36" className="sg-compass">北</text>
      </g>
    </g>
  );
});
