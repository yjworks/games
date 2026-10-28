import { useMemo, useState } from 'react';
import { OFFICER_DEF } from '../data/officers';
import { SCENARIOS, FACTION_COLORS } from '../data/scenarios';
import { CITY_BY_ID } from '../data/cities';
import { SLOTS, slotInfo } from '../engine/save';
import type { Difficulty, Lifespan, Options } from '../engine/state';
import { useGame } from '../store';
import { StatCells } from './common';
import { Encyclopedia } from './Encyclopedia';
import { jo } from '../engine/josa';
import { TitleScene } from './art/TitleScene';
import { Portrait } from './art/Portrait';
import { MiniMap } from './MiniMap';

export function Title() {
  const go = useGame((u) => u.go);
  const load = useGame((u) => u.load);
  const say = useGame((u) => u.say);
  const [book, setBook] = useState(false);
  const [loading, setLoading] = useState(false);
  const auto = slotInfo(-1);
  return (
    <div className="sg-title">
      <TitleScene />
      <div className="sg-title-body center-scroll">
        <div className="sg-title-logo">
          <div className="sg-title-art" aria-hidden="true">
            <span>天</span><span>下</span><span>三</span><span>分</span>
          </div>
          <h2 className="sg-title-name">천하삼분</h2>
          <p className="sg-title-sub">一百九十年 — 二百八十年 · 五十三城 · 七百英傑</p>
        </div>
        <div className="sg-title-menu">
          {auto && (
            <button className="sg-plaque primary" onClick={() => { if (!load(-1)) say('이어 할 기록이 없습니다.', false); }}>
              <span>이어하기</span><small>{auto.label}</small>
            </button>
          )}
          <button className={`sg-plaque ${auto ? '' : 'primary'}`} onClick={() => go('setup')}><span>새로 시작</span><small>시나리오 일곱 · 세력 선택</small></button>
          <button className="sg-plaque" onClick={() => setLoading(true)}><span>불러오기</span><small>저장 칸 셋 · 자동 저장</small></button>
          <button className="sg-plaque" onClick={() => setBook(true)}><span>인물 사전</span><small>정사에 실존한 711명</small></button>
        </div>
        <p className="sg-title-note">
          인물·사건은 진수 『삼국지』와 배송지 주, 『후한서』·『진서』를 바탕으로 새로 썼습니다.
          능력치는 이 게임의 독자 평가이며, 그림은 모두 코드로 그렸습니다.
        </p>
      </div>
      {book && <Encyclopedia onClose={() => setBook(false)} />}
      {loading && <LoadSheet onClose={() => setLoading(false)} />}
    </div>
  );
}

export function LoadSheet({ onClose }: { onClose: () => void }) {
  const load = useGame((u) => u.load);
  const say = useGame((u) => u.say);
  const rows = [-1, ...Array.from({ length: SLOTS }, (_, i) => i)];
  return (
    <div className="sg-overlay" onClick={onClose}>
      <div className="sg-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sg-sheet-head"><h2>불러오기</h2><button className="sg-x" onClick={onClose} aria-label="닫기">✕</button></div>
        <div className="sg-sheet-body">
          {rows.map((i) => {
            const info = slotInfo(i);
            return (
              <button key={i} className="sg-row-btn" disabled={!info}
                onClick={() => { if (load(i)) onClose(); else say('불러올 수 없습니다.', false); }}>
                <strong>{i < 0 ? '자동 저장' : `${i + 1}번 칸`}</strong>
                <span>{info ? `${info.label} · ${new Date(info.at).toLocaleString('ko-KR')}` : '비어 있음'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Setup() {
  const go = useGame((u) => u.go);
  const start = useGame((u) => u.start);
  const [sid, setSid] = useState(SCENARIOS[0].id);
  const [picked, setPicked] = useState<string[]>([]);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [life, setLife] = useState<Lifespan>('history');
  const [manual, setManual] = useState(true);
  const sc = SCENARIOS.find((x) => x.id === sid)!;
  const factions = useMemo(
    () => sc.factions.filter((f) => OFFICER_DEF[f.ruler]).sort((a, b) => b.cities.length - a.cities.length),
    [sc],
  );
  const toggle = (r: string) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  const opts: Options = { difficulty: diff, lifespan: life, manualBattle: manual };
  return (
    <div className="sg-setup">
      <div className="sg-setup-col">
        <h3 className="sg-h">시나리오</h3>
        <div className="sg-sc-list">
          {SCENARIOS.map((x) => (
            <button key={x.id} className={`sg-sc ${x.id === sid ? 'sel' : ''}`} onClick={() => { setSid(x.id); setPicked([]); }}>
              <span className="sg-sc-year">{x.year}<small>년 {x.month}월</small></span>
              <span className="sg-sc-name">{x.name}</span>
            </button>
          ))}
        </div>
        <div className="sg-sc-card">
          <MiniMap sc={sc} highlight={picked} />
          <div className="sg-sc-desc">
            <h4>{sc.year}년 · {sc.name}</h4>
            {sc.desc.map((p, i) => <p key={i}>{p}</p>)}
            {sc.liberty && <p className="sg-liberty">※ {sc.liberty}</p>}
          </div>
        </div>
      </div>
      <div className="sg-setup-col">
        <h3 className="sg-h">군주 선택 <small>여럿 고르면 번갈아 지휘(핫시트)</small></h3>
        <div className="sg-fac-list">
          {factions.map((f) => {
            const d = OFFICER_DEF[f.ruler];
            const on = picked.includes(f.ruler);
            const color = FACTION_COLORS[f.key];
            return (
              <button key={f.ruler} className={`sg-fac ${on ? 'sel' : ''}`} onClick={() => toggle(f.ruler)} aria-pressed={on}
                style={{ ['--fac' as string]: color }}>
                <Portrait id={f.ruler} size={52} year={sc.year} color={color} ruler />
                <span className="sg-fac-main">
                  <strong>{d.name} <em>{d.hanja}</em></strong>
                  <small>{CITY_BY_ID[f.capital].name} · 도시 {f.cities.length} · {sc.year - d.born}세</small>
                </span>
                <StatCells s={null} id={f.ruler} />
              </button>
            );
          })}
        </div>
        <h3 className="sg-h">설정</h3>
        <div className="sg-opts">
          <div className="sg-seg" role="group" aria-label="난이도">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <button key={d} aria-pressed={diff === d} onClick={() => setDiff(d)}>{{ easy: '쉬움', normal: '보통', hard: '어려움' }[d]}</button>
            ))}
          </div>
          <div className="sg-seg" role="group" aria-label="수명">
            <button aria-pressed={life === 'history'} onClick={() => setLife('history')}>수명: 역사대로</button>
            <button aria-pressed={life === 'fiction'} onClick={() => setLife('fiction')}>수명: 가상</button>
          </div>
          <div className="sg-seg" role="group" aria-label="전투">
            <button aria-pressed={manual} onClick={() => setManual(true)}>전투 직접 지휘</button>
            <button aria-pressed={!manual} onClick={() => setManual(false)}>전투 위임</button>
          </div>
        </div>
        <div className="sg-setup-go">
          <button className="sg-btn" onClick={() => go('title')}>뒤로</button>
          <button className="sg-btn primary" disabled={!picked.length} onClick={() => start(sid, picked, opts)}>
            {picked.length ? `${jo(picked.map((r) => OFFICER_DEF[r].name).join('·'), '로')} 시작` : '군주를 고르세요'}
          </button>
        </div>
      </div>
    </div>
  );
}
