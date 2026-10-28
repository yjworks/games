import { memo } from 'react';
import { CITIES, MAP_H, MAP_W, ROADS, project } from '../data/cities';
import { RIVERS, SEA, type LonLat } from '../data/geo';
import { FACTION_COLORS, type ScenarioDef } from '../data/scenarios';
import type { CityId } from '../data/types';

const path = (pts: LonLat[]) => pts.map(([lo, la], i) => { const [x, y] = project(lo, la); return `${i ? 'L' : 'M'}${x} ${y}`; }).join(' ');
const SEA_PTS = SEA.map(([lo, la]) => project(lo, la));
const SEA_PATH = `M${SEA_PTS.map(([x, y]) => `${x} ${y}`).join(' L')} L${MAP_W + 60} ${MAP_H + 60} L${MAP_W + 60} -60 L${SEA_PTS[0][0]} -60 Z`;
const PT = Object.fromEntries(CITIES.map((c) => [c.id, project(c.lon, c.lat)])) as Record<CityId, [number, number]>;

/** 시나리오 고르기용 작은 세력 지도 */
export const MiniMap = memo(function MiniMap({ sc, highlight }: { sc: ScenarioDef; highlight?: string[] }) {
  const owner: Partial<Record<CityId, string>> = {};
  const rulerOf: Partial<Record<CityId, string>> = {};
  for (const f of sc.factions) for (const c of f.cities) { owner[c] = FACTION_COLORS[f.key]; rulerOf[c] = f.ruler; }
  return (
    <svg className="sg-minimap" viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`${sc.name} 세력 지도`}>
      <rect width={MAP_W} height={MAP_H} fill="#d6c196" />
      <path d={SEA_PATH} fill="#8fa7a2" />
      <path d={path(SEA.slice(0, -1))} fill="none" stroke="#4d3a24" strokeWidth="2" />
      {RIVERS.map((r) => <path key={r.name} d={path(r.pts)} fill="none" stroke="#5c8796" strokeWidth={r.width + 1} strokeLinecap="round" />)}
      {ROADS.map(([a, b]) => (
        <line key={`${a}${b}`} x1={PT[a][0]} y1={PT[a][1]} x2={PT[b][0]} y2={PT[b][1]} stroke="#6b4a2a" strokeWidth="1.2" opacity="0.35" />
      ))}
      {CITIES.map((c) => {
        const col = owner[c.id];
        const hi = highlight && rulerOf[c.id] && highlight.includes(rulerOf[c.id]!);
        return (
          <g key={c.id}>
            {col && <circle cx={PT[c.id][0]} cy={PT[c.id][1]} r={hi ? 30 : 22} fill={col} opacity={hi ? 0.55 : 0.32} />}
            <circle cx={PT[c.id][0]} cy={PT[c.id][1]} r={col ? 8 : 5} fill={col ?? '#9a907e'} stroke="#2b1d12" strokeWidth="2" />
          </g>
        );
      })}
      <rect x="3" y="3" width={MAP_W - 6} height={MAP_H - 6} fill="none" stroke="#3a2614" strokeWidth="6" />
    </svg>
  );
});
