import { useEffect, useMemo, useState } from 'react';
import { CITY_BY_ID, NEIGHBORS } from '../data/cities';
import { OFFICER_DEF } from '../data/officers';
import type { CityId } from '../data/types';
import { allied, captiveChance, treatCaptive } from '../engine/commands';
import { captivesOf, factionName, nameOf } from '../engine/officers';
import { SLOTS } from '../engine/save';
import { RANK_TITLES } from '../engine/setup';
import type { GameState, LogEntry } from '../engine/state';
import { currentHuman, factionSummary } from '../engine/turn';
import { useGame } from '../store';
import { BattleView } from './BattleView';
import { CityPanel, type CmdKey } from './CityPanel';
import { CommandSheet } from './CommandSheet';
import { Dot, OfficerLine, Sheet, StatHeader, pct } from './common';
import { Encyclopedia, PersonCard } from './Encyclopedia';
import { SEASON, fmt } from './labels';
import { MapView } from './MapView';
import { LoadSheet } from './Title';
import { jo } from '../engine/josa';

export function Game() {
  const s = useGame((u) => u.game)!;
  useGame((u) => u.rev);
  const city = useGame((u) => u.city);
  const select = useGame((u) => u.select);
  const panel = useGame((u) => u.panel);
  const open = useGame((u) => u.open);
  const endTurn = useGame((u) => u.endTurn);
  const bump = useGame((u) => u.bump);
  const [cmd, setCmd] = useState<CmdKey | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const me = currentHuman(s);
  /* 사람 세력이 여럿이면 지금 차례인 세력, 아니면 처음 고른 세력 시점 */
  const viewer = me >= 0 ? me : s.factions.find((f) => f.human && f.alive)?.idx ?? -1;
  const sum = viewer >= 0 ? factionSummary(s, viewer) : null;
  const caps = viewer >= 0 ? captivesOf(s, viewer).length : 0;

  const marks = useMemo(() => {
    if (!city || viewer < 0 || s.cities[city].owner !== viewer) return undefined;
    return new Set(NEIGHBORS[city].filter((n) => s.cities[n.to].owner !== viewer && !allied(s, viewer, s.cities[n.to].owner)).map((n) => n.to));
  }, [city, viewer, s, s.cities[city ?? 'ji']?.owner]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (s.battle || cmd || panel) return;
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); endTurn(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s, cmd, panel, endTurn]);

  if (s.battle) return <BattleView s={s} />;
  if (s.over) return <Ending s={s} />;

  const onSelect = (c: CityId) => { select(c); setPanelOpen(true); };

  return (
    <div className="sg-game">
      <div className="sg-status">
        <span className="sg-date"><b>{s.year}</b>년 <b>{s.month}</b>월 <small>{SEASON(s.month)}</small></span>
        {viewer >= 0 && (
          <span className="sg-me"><Dot color={s.factions[viewer].color} /> {factionName(s, viewer)} <small>{RANK_TITLES[s.factions[viewer].rank]}</small></span>
        )}
        {sum && <span className="sg-res">도시 {sum.cities} · 장수 {sum.officers} · 병력 {fmt(sum.troops)} · 금 {fmt(sum.gold)} · 군량 {fmt(sum.food)}</span>}
        {s.emperor >= 0 && <span className="sg-emp">천자: {factionName(s, s.emperor)}</span>}
      </div>
      <div className="sg-main">
        <MapView s={s} selected={city} onSelect={onSelect} marks={marks} viewer={viewer} />
        {city && panelOpen && (
          <CityPanel s={s} city={city} me={me} onCmd={setCmd} onPerson={setPerson}
            onToggleDelegate={() => { s.cities[city].delegated = !s.cities[city].delegated; bump(); }}
            onClose={() => setPanelOpen(false)} />
        )}
      </div>
      <div className="sg-bottom">
        <button className="sg-tab" onClick={() => open('report')}>보고{s.news.length ? <em>{Math.min(99, s.news.length)}</em> : null}</button>
        <button className="sg-tab" onClick={() => open('factions')}>세력</button>
        <button className="sg-tab" onClick={() => open('people')}>인물</button>
        <button className="sg-tab" onClick={() => open('captives')}>포로{caps ? <em>{caps}</em> : null}</button>
        <button className="sg-tab" onClick={() => open('menu')}>메뉴</button>
        <button className="sg-btn primary sg-end" onClick={endTurn} disabled={me < 0}>
          턴 종료 <small className="kbd-only">⇧↵</small>
        </button>
      </div>

      {cmd && city && me >= 0 && <CommandSheet s={s} city={city} me={me} cmd={cmd} onClose={() => setCmd(null)} />}
      {person && (
        <Sheet title="인물" onClose={() => setPerson(null)}><PersonCard id={person} s={s} /></Sheet>
      )}
      {panel === 'report' && <Report s={s} viewer={viewer} onClose={() => { s.news = []; open(null); }} />}
      {panel === 'factions' && <Factions s={s} viewer={viewer} onClose={() => open(null)} onCity={(c) => { onSelect(c); open(null); }} />}
      {panel === 'people' && <Encyclopedia s={s} onClose={() => open(null)} />}
      {panel === 'captives' && <Captives s={s} me={me} onClose={() => open(null)} />}
      {panel === 'menu' && <Menu s={s} onClose={() => open(null)} />}
    </div>
  );
}

const KIND_ICON: Record<LogEntry['kind'], string> = { info: '·', war: '⚔', event: '◆', death: '✝', person: '人', diplo: '⇄', disaster: '!' };

function Report({ s, viewer, onClose }: { s: GameState; viewer: number; onClose: () => void }) {
  const [all, setAll] = useState(false);
  const list = (all ? s.log : s.news).slice().reverse();
  return (
    <Sheet title={all ? '연대기' : '이번 달 보고'} onClose={onClose} wide
      foot={<button className="sg-btn" onClick={() => setAll(!all)}>{all ? '이번 달만' : '연대기 전체'}</button>}>
      {list.length === 0 && <p className="sg-muted">새 소식이 없습니다.</p>}
      <ul className="sg-news">
        {list.map((n, i) => (
          <li key={i} className={`k-${n.kind} ${n.f === viewer ? 'mine' : ''}`}>
            <span className="sg-news-icon">{KIND_ICON[n.kind]}</span>
            <span className="sg-news-date">{n.y}.{n.m}</span>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function Factions({ s, viewer, onClose, onCity }: { s: GameState; viewer: number; onClose: () => void; onCity: (c: CityId) => void }) {
  const rows = s.factions.filter((f) => f.alive).map((f) => ({ f, sum: factionSummary(s, f.idx) })).sort((a, b) => b.sum.cities - a.sum.cities);
  return (
    <Sheet title="세력 일람" onClose={onClose} wide>
      <div className="sg-ftable">
        <div className="sg-frow head"><span>세력</span><span>도시</span><span>장수</span><span>병력</span><span>금</span><span>우호</span></div>
        {rows.map(({ f, sum }) => (
          <button key={f.idx} className={`sg-frow ${f.idx === viewer ? 'mine' : ''}`} onClick={() => onCity(f.capital)}>
            <span><Dot color={f.color} /> {nameOf(f.ruler)} <small>{RANK_TITLES[f.rank]}{f.human ? ' · 사람' : ''}</small></span>
            <span>{sum.cities}</span><span>{sum.officers}</span><span>{fmt(sum.troops)}</span><span>{fmt(sum.gold)}</span>
            <span>{viewer >= 0 && f.idx !== viewer ? <>{s.factions[viewer].rel[f.idx] ?? 50}{allied(s, viewer, f.idx) ? ' 동맹' : ''}</> : '—'}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function Captives({ s, me, onClose }: { s: GameState; me: number; onClose: () => void }) {
  const act = useGame((u) => u.act);
  useGame((u) => u.rev);
  if (me < 0) return <Sheet title="포로" onClose={onClose}><p className="sg-muted">지금은 처우할 수 없습니다.</p></Sheet>;
  const list = captivesOf(s, me);
  return (
    <Sheet title={`포로 ${list.length}명`} onClose={onClose}>
      {list.length === 0 && <p className="sg-muted">잡고 있는 포로가 없습니다.</p>}
      {list.length > 0 && <div className="sg-olist-head"><span>포로</span><StatHeader /><span className="sg-oright">옛 소속</span></div>}
      {list.map((o) => (
        <div key={o.id} className="sg-captive">
          <OfficerLine s={s} id={o.id} right={factionName(s, o.faction)} />
          <div className="sg-captive-acts">
            <button className="sg-cmd" disabled={o.acted} onClick={() => act((g) => treatCaptive(g, me, o.id, 'recruit'))}>
              등용 {pct(captiveChance(s, me, o.id))}
            </button>
            <button className="sg-cmd" onClick={() => act((g) => treatCaptive(g, me, o.id, 'release'))}>석방</button>
            <button className="sg-cmd danger" onClick={() => { if (confirm(`${jo(OFFICER_DEF[o.id].name, '을를')} 처형할까요? 인연 있는 장수의 충성이 떨어집니다.`)) act((g) => treatCaptive(g, me, o.id, 'execute')); }}>처형</button>
          </div>
        </div>
      ))}
    </Sheet>
  );
}

function Menu({ s, onClose }: { s: GameState; onClose: () => void }) {
  const save = useGame((u) => u.save);
  const quit = useGame((u) => u.quit);
  const bump = useGame((u) => u.bump);
  const [loading, setLoading] = useState(false);
  if (loading) return <LoadSheet onClose={() => { setLoading(false); onClose(); }} />;
  return (
    <Sheet title="메뉴" onClose={onClose}>
      <h4 className="sg-sub">저장</h4>
      <div className="sg-list">
        {Array.from({ length: SLOTS }, (_, i) => (
          <button key={i} className="sg-row-btn" onClick={() => save(i)}><strong>{i + 1}번 칸에 저장</strong><span>{s.year}년 {s.month}월</span></button>
        ))}
        <button className="sg-row-btn" onClick={() => setLoading(true)}><strong>불러오기</strong><span>자동 저장·저장 칸</span></button>
      </div>
      <h4 className="sg-sub">설정</h4>
      <div className="sg-seg">
        <button aria-pressed={s.options.manualBattle} onClick={() => { s.options.manualBattle = true; bump(); }}>전투 직접 지휘</button>
        <button aria-pressed={!s.options.manualBattle} onClick={() => { s.options.manualBattle = false; bump(); }}>전투 위임</button>
      </div>
      <p className="sg-muted">난이도 {{ easy: '쉬움', normal: '보통', hard: '어려움' }[s.options.difficulty]} · 수명 {s.options.lifespan === 'history' ? '역사대로' : '가상'} · 매달 자동 저장</p>
      <div className="sg-form-go"><button className="sg-btn" onClick={quit}>표제로 나가기</button></div>
    </Sheet>
  );
}

function Ending({ s }: { s: GameState }) {
  const quit = useGame((u) => u.quit);
  const over = s.over!;
  const months = (over.year - s.startYear) * 12 + (over.month - s.startMonth);
  const win = 'winner' in over ? s.factions[over.winner] : null;
  return (
    <div className="sg-ending center-scroll">
      <div className="sg-title-art" aria-hidden="true"><span>{win ? '統' : '亡'}</span></div>
      {win ? (
        <>
          <h2>{nameOf(win.ruler)}, 천하를 통일하다</h2>
          <p>{over.year}년 {over.month}월 — {Math.floor(months / 12)}년 {months % 12}개월 만에 난세가 끝났습니다.</p>
          <p className="sg-muted">{win.human ? '당신의 세력이 마지막까지 남았습니다.' : '천하는 다른 이의 손에 들어갔습니다.'}</p>
        </>
      ) : (
        <>
          <h2>세력이 멸망했습니다</h2>
          <p>{over.year}년 {over.month}월. 남은 장수들은 뿔뿔이 흩어졌습니다.</p>
        </>
      )}
      <button className="sg-btn primary" onClick={quit}>표제로</button>
      <p className="sg-muted">{CITY_BY_ID[win?.capital ?? 'luoyang'].name}</p>
    </div>
  );
}
