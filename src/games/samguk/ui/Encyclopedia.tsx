import { Portrait } from './art/Portrait';
import { FACTION_COLORS } from '../data/scenarios';
import { useMemo, useState } from 'react';
import { CITY_BY_ID } from '../data/cities';
import { ITEM_BY_ID } from '../data/items';
import { OFFICERS, OFFICER_DEF } from '../data/officers';
import type { FactionKey } from '../data/types';
import { STAT_NAMES, factionName, nameOf, rankOf, RANKS, statsOf, troopCap } from '../engine/officers';
import type { GameState } from '../engine/state';
import { Bar, Sheet, StatCells, StatHeader } from './common';
import { KEY_LABEL } from './labels';

const GROUPS: { k: string; label: string; keys: FactionKey[] }[] = [
  { k: 'all', label: '전체', keys: [] },
  { k: 'wei', label: '위·진', keys: ['cao', 'jin'] },
  { k: 'shu', label: '촉', keys: ['liubei'] },
  { k: 'wu', label: '오', keys: ['sun'] },
  { k: 'other', label: '군웅·재야', keys: [] },
];

const STATUS_LABEL = { hidden: '미등장', free: '재야', serving: '사관', captive: '포로', dead: '사망' } as const;

export function Encyclopedia({ onClose, s, initial }: { onClose: () => void; s?: GameState | null; initial?: string }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [sort, setSort] = useState(-1);
  const [onlyMine, setOnlyMine] = useState<'all' | 'alive'>('all');
  const [sel, setSel] = useState<string | null>(initial ?? null);

  const list = useMemo(() => {
    const g = GROUPS.find((x) => x.k === group)!;
    let arr = OFFICERS.filter((o) => {
      if (q && !(o.name.includes(q) || o.hanja.includes(q) || (o.style ?? '').includes(q))) return false;
      const main = o.svc.length ? o.svc.reduce((best, cur, i, a) => {
        const span = (a[i + 1]?.[0] ?? o.died) - cur[0];
        return span > best.span ? { k: cur[1], span } : best;
      }, { k: o.svc[0][1], span: -1 }).k : 'none';
      if (group === 'other') { if (['cao', 'jin', 'liubei', 'sun'].includes(main)) return false; }
      else if (g.keys.length && !g.keys.includes(main)) return false;
      if (onlyMine === 'alive' && s) { const st = s.officers[o.id]?.status; if (st !== 'serving' && st !== 'free' && st !== 'captive') return false; }
      return true;
    });
    if (sort >= 0) arr = [...arr].sort((a, b) => b.stats[sort] - a.stats[sort]);
    return arr;
  }, [q, group, sort, onlyMine, s]);

  return (
    <Sheet title={`인물 사전 · ${list.length}명`} onClose={onClose} wide>
      {sel ? <PersonCard id={sel} s={s ?? null} onBack={() => setSel(null)} /> : (
        <>
          <div className="sg-enc-tools">
            <input className="sg-input" placeholder="이름·한자·자 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="sg-seg small">
              {GROUPS.map((g) => <button key={g.k} aria-pressed={group === g.k} onClick={() => setGroup(g.k)}>{g.label}</button>)}
            </div>
            {s && (
              <div className="sg-seg small">
                <button aria-pressed={onlyMine === 'all'} onClick={() => setOnlyMine('all')}>모두</button>
                <button aria-pressed={onlyMine === 'alive'} onClick={() => setOnlyMine('alive')}>지금 활동 중</button>
              </div>
            )}
          </div>
          <div className="sg-enc-head">
            <span>이름</span>
            <span className="sg-stats head">
              {STAT_NAMES.map((n, i) => (
                <button key={n} className={`sg-stat ${sort === i ? 'hi' : ''}`} onClick={() => setSort(sort === i ? -1 : i)}>{n.slice(0, 1)}</button>
              ))}
            </span>
          </div>
          <div className="sg-enc-list">
            {list.slice(0, 400).map((o) => (
              <button key={o.id} className="sg-oline" onClick={() => setSel(o.id)}>
                <Portrait id={o.id} size={34} color={colorFor(s ?? null, o.id)} className="sg-oface" />
                <span className="sg-oname">
                  <strong>{o.name}</strong><small>{o.hanja} · {o.born}{o.bornEst ? '?' : ''}–{o.died}{o.diedEst ? '?' : ''}</small>
                  {s && <em className="sg-tag">{STATUS_LABEL[s.officers[o.id]?.status ?? 'hidden']}</em>}
                </span>
                <StatCells s={null} id={o.id} hi={sort} />
              </button>
            ))}
            {list.length > 400 && <p className="sg-muted">검색어로 더 좁혀 보세요.</p>}
          </div>
        </>
      )}
    </Sheet>
  );
}

/** 인물 색: 게임 중이면 지금 세력, 아니면 가장 오래 섬긴 계통 */
function colorFor(s: GameState | null | undefined, id: string): string {
  const o = s?.officers[id];
  if (s && o && o.faction >= 0) return s.factions[o.faction]?.color ?? '#7a6e58';
  const d = OFFICER_DEF[id];
  let best: FactionKey = 'none', span = -1;
  d.svc.forEach(([y, k], i) => { const sp = (d.svc[i + 1]?.[0] ?? d.died) - y; if (sp > span) { span = sp; best = k; } });
  return FACTION_COLORS[best];
}

export function PersonCard({ id, s, onBack }: { id: string; s: GameState | null; onBack?: () => void }) {
  const d = OFFICER_DEF[id];
  const o = s?.officers[id];
  const st = s ? statsOf(s, id) : d.stats;
  return (
    <div className="sg-person">
      {onBack && <button className="sg-link" onClick={onBack}>← 목록</button>}
      <div className="sg-person-head">
        <Portrait id={id} size={108} year={s?.year} color={colorFor(s, id)} ruler={!!(s && o && o.faction >= 0 && s.factions[o.faction]?.ruler === id)} className="sg-bigface" />
        <div>
          <h3>{d.name} <small>{d.hanja}{d.style ? ` · 자 ${d.style}` : ''}</small></h3>
          <p className="sg-muted">
            {d.born}{d.bornEst ? '?' : ''} – {d.died}{d.diedEst ? '?' : ''}년
            {(d.bornEst || d.diedEst) && ' (?는 추정)'} · {CITY_BY_ID[d.home].name} 출신
          </p>
        </div>
      </div>
      <p className="sg-bio">{d.bio}</p>
      <div className="sg-statgrid">
        {STAT_NAMES.map((n, i) => (
          <div key={n} className="sg-statrow">
            <span>{n}</span><Bar v={st[i]} color={st[i] >= 90 ? '#f0b44c' : st[i] >= 75 ? '#7fc4a0' : undefined} /><strong>{st[i]}</strong>
          </div>
        ))}
        <div className="sg-statrow"><span>의리</span><Bar v={d.gi} max={10} /><strong>{d.gi}</strong></div>
        <div className="sg-statrow"><span>야망</span><Bar v={d.amb} max={10} /><strong>{d.amb}</strong></div>
      </div>
      {d.traits.length > 0 && <p><strong>특기</strong> {d.traits.join(' · ')}</p>}
      <div className="sg-svc">
        <strong>소속 이력</strong>
        <ol>{d.svc.map(([y, k], i) => <li key={i}><span>{y}</span>{KEY_LABEL[k]}</li>)}</ol>
      </div>
      {(d.father || d.bonds?.length) && (
        <p className="sg-muted">
          {d.father && <>아버지 {nameOf(d.father)} </>}
          {d.bonds?.length ? <>· 인연 {d.bonds.map(nameOf).join(', ')}</> : null}
        </p>
      )}
      {s && o && (
        <div className="sg-now">
          <strong>지금</strong>{' '}
          {o.status === 'serving' && <>{factionName(s, o.faction)} · {o.city && CITY_BY_ID[o.city].name} · 충성 {o.loyalty} · 공적 {o.merit} · {RANKS[rankOf(o)]} · 병력 상한 {troopCap(s, id).toLocaleString()}</>}
          {o.status === 'free' && <>재야 · {o.city && CITY_BY_ID[o.city].name}{o.found ? '' : ' (아직 아무도 모름)'}</>}
          {o.status === 'captive' && <>{factionName(s, o.captor)}에 포로</>}
          {o.status === 'dead' && <>사망</>}
          {o.status === 'hidden' && <>{o.appear}년 무렵 등장</>}
          {o.items.length > 0 && <> · 보물 {o.items.map((i) => ITEM_BY_ID[i]?.name).join(', ')}</>}
        </div>
      )}
    </div>
  );
}

export { StatHeader };
