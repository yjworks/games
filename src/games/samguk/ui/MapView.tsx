import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CITIES, MAP_H, MAP_W, ROADS, project } from '../data/cities';
import { ISLANDS, LAKES, RANGES, REGION_LABELS, RIVERS, SEA, type LonLat } from '../data/geo';
import type { CityId } from '../data/types';
import type { GameState } from '../engine/state';

const path = (pts: LonLat[], close = false) =>
  pts.map(([lo, la], i) => { const [x, y] = project(lo, la); return `${i ? 'L' : 'M'}${x} ${y}`; }).join(' ') + (close ? ' Z' : '');

/** 바다는 지도 오른쪽·아래 끝까지 닫는다 */
const SEA_PATH = (() => {
  const pts = SEA.map(([lo, la]) => project(lo, la));
  return `M${pts.map(([x, y]) => `${x} ${y}`).join(' L')} L${MAP_W + 40} ${MAP_H + 40} L${MAP_W + 40} -40 L${pts[0][0]} -40 Z`;
})();

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

  /* 화면 비율에 맞춰 보이는 높이를 정한다 */
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
    const w = Math.min(MAP_W * 1.1, Math.max(180, v.w));
    const h = w * aspect.current;
    const x = Math.min(MAP_W - w * 0.3, Math.max(-w * 0.7, v.x));
    const y = Math.min(MAP_H - h * 0.3, Math.max(-h * 0.7, v.y));
    return { x, y, w };
  }, []);

  /* 처음에는 선택 도시를 가운데로 */
  const centered = useRef(false);
  useEffect(() => {
    if (centered.current || !selected || size.w <= 1) return;
    centered.current = true;
    const c = CITIES.find((x) => x.id === selected)!;
    const [cx, cy] = project(c.lon, c.lat);
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
      const w = Math.min(MAP_W * 1.1, Math.max(180, v.w * factor));
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

  const pts = useMemo(() => Object.fromEntries(CITIES.map((c) => [c.id, project(c.lon, c.lat)])) as Record<CityId, [number, number]>, []);
  const k = view.w / MAP_W; // 확대 정도(작을수록 확대)
  const labelSize = Math.max(9, 15 * Math.sqrt(k));
  const r0 = Math.max(5.5, 10 * Math.sqrt(k));

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
        <rect x={-100} y={-100} width={MAP_W + 200} height={MAP_H + 200} className="sg-land" />
        <path d={SEA_PATH} className="sg-sea" />
        {ISLANDS.map((isl, i) => <path key={i} d={path(isl, true)} className="sg-land" />)}
        {RANGES.map((rg) => <path key={rg.name} d={path(rg.pts)} className="sg-range" />)}
        {RIVERS.map((rv) => <path key={rv.name} d={path(rv.pts)} className="sg-river" strokeWidth={rv.width} />)}
        {LAKES.map((lk) => {
          const [x, y] = project(lk.at[0], lk.at[1]);
          const [x2] = project(lk.at[0] + lk.rx, lk.at[1]);
          const [, y2] = project(lk.at[0], lk.at[1] - lk.ry);
          return <ellipse key={lk.name} cx={x} cy={y} rx={x2 - x} ry={y2 - y} className="sg-lake" />;
        })}
        {REGION_LABELS.map((l) => {
          const [x, y] = project(l.at[0], l.at[1]);
          return <text key={l.name} x={x} y={y} className="sg-region" fontSize={18}>{l.name}</text>;
        })}
        {ROADS.map(([a, b, kind]) => {
          const [x1, y1] = pts[a];
          const [x2, y2] = pts[b];
          const oa = s.cities[a].owner, ob = s.cities[b].owner;
          const border = oa !== ob && (oa === viewer || ob === viewer) && viewer >= 0;
          return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className={`sg-road ${kind === 'w' ? 'water' : ''} ${border ? 'border' : ''}`} />;
        })}
        {CITIES.map((cd) => {
          const c = s.cities[cd.id];
          const [x, y] = pts[cd.id];
          const color = c.owner >= 0 ? s.factions[c.owner].color : '#5b6170';
          const isCap = c.owner >= 0 && s.factions[c.owner].capital === cd.id;
          const sel = selected === cd.id;
          const mark = marks?.has(cd.id);
          return (
            <g
              key={cd.id}
              className={`sg-city ${sel ? 'sel' : ''} ${mark ? 'mark' : ''}`}
              onClick={() => { if (!drag.current.moved) onSelect(cd.id); }}
            >
              <circle cx={x} cy={y} r={r0 * 2.4} className="sg-hit" />
              {mark && <circle cx={x} cy={y} r={r0 * 1.9} className="sg-mark-ring" />}
              {sel && <circle cx={x} cy={y} r={r0 * 1.6} className="sg-sel-ring" />}
              {isCap
                ? <rect x={x - r0} y={y - r0} width={r0 * 2} height={r0 * 2} rx={r0 * 0.35} fill={color} className="sg-node" />
                : <circle cx={x} cy={y} r={r0 * 0.85} fill={color} className="sg-node" />}
              <text x={x} y={y + r0 + labelSize * 0.95} className="sg-cname" fontSize={labelSize}>{cd.name}</text>
            </g>
          );
        })}
      </svg>
      <div className="sg-zoom">
        <button className="sg-zbtn" onClick={() => zoom(1 / 1.3)} aria-label="확대">＋</button>
        <button className="sg-zbtn" onClick={() => zoom(1.3)} aria-label="축소">－</button>
        <button className="sg-zbtn" onClick={() => setView(clampView({ x: 0, y: 0, w: MAP_W }))} aria-label="전체 보기">⤢</button>
      </div>
    </div>
  );
}
