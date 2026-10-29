import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { CITY_BY_ID } from '../data/cities';
import {
  type BattleState, type Target, type Unit, TACTICS, TILE_NAMES, alive, attackTargets, attackTile, attackUnit, autoResolve, canFlood,
  confuseChance, dist, doConfuse, doDuel, doFire, doFlood, doRetreat, doTactic, doWait, endSide, fireChance, floodChance, moveUnit,
  reachable, runUntilHuman, shootRange, tacticChance, tacticTargets, tileAt, unitAt,
} from '../engine/battle';
import { kindOf } from '../engine/units';
import { factionName } from '../engine/officers';
import type { GameState } from '../engine/state';
import { battleCue, sg } from '../audio';
import { useGame } from '../store';
import { pct } from './common';
import { fmt, seasonOf } from './labels';
import { UnitBanner } from './art/BattleArt';
import { HEX_R as R, HEX_W as HW, hexCenter as center, paintField } from './art/battlefield';
import { Portrait } from './art/Portrait';
import { surname } from './art/util';
import { OFFICER_DEF } from '../data/officers';
import type { Fx, Overlay } from './three/BattleScene';
import { ROOT_NS, readJSON, writeJSON } from '../../../shared/storage';

const Field3D = lazy(() => import('./three/Field3D'));

const hexPath = (cx: number, cy: number, rr = R) => {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};
const WIND_ARROW = ['→', '↗', '↖', '←', '↙', '↘'];
const SIZE_NAME = { large: '대성', medium: '성', small: '소성' } as const;
const VIEW_KEY = `${ROOT_NS}:samguk:battleview`;

type Mode = 'normal' | 'fire' | 'confuse' | 'duel' | 'tactic';

interface Float { id: number; x: number; y: number; text: string; cls: string; delay: number }
interface Shot { id: number; x1: number; y1: number; x2: number; y2: number; delay: number }
interface Lunge { uid: number; dx: number; dy: number }

let fxSeq = 1;
const FLOAT_COLOR: Record<string, string> = { atk: '#ffb4a6', def: '#a6d2ff', wall: '#f3e6c4', break: '#ffdf6a' };

function webglOk(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

export function BattleView({ s }: { s: GameState }) {
  const bs = s.battle!;
  const bump = useGame((u) => u.bump);
  const done = useGame((u) => u.battleDone);
  useGame((u) => u.rev);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [duelShow, setDuelShow] = useState(0);
  const [showNote, setShowNote] = useState(true);
  const [cut, setCut] = useState<string | null>('出陣');
  const [floats, setFloats] = useState<Float[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [lunge, setLunge] = useState<Lunge[]>([]);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<{ officer: string; tactic: string } | null>(null);
  const [view3d, setView3d] = useState<boolean>(() => readJSON<boolean>(VIEW_KEY, true) && webglOk());
  const fxQueue = useRef<Fx[]>([]);
  const [tick, setTick] = useState(0);

  const humanSide = bs.human[bs.side] ? bs.side : null;
  const unit = sel !== null ? bs.units.find((u) => u.uid === sel && !u.gone) ?? null : null;
  const mineSel = unit && humanSide !== null && unit.side === humanSide ? unit : null;

  const unitKey = bs.units.map((u) => `${u.q},${u.r},${u.moved},${u.gone}`).join();
  const reach = useMemo(() => (mineSel && mode === 'normal' ? reachable(bs, mineSel) : new Map<number, number>()), [bs, mineSel, mode, unitKey]);
  const targets = mineSel && mode === 'normal' ? attackTargets(bs, mineSel) : [];
  const tTargets: Target[] = mineSel && !mineSel.acted ? tacticTargets(bs, mineSel) : [];

  /* 지금 고를 수 있는 칸(계략·일기토·전법) */
  const special = useMemo(() => {
    const out: { q: number; r: number; p: number; color: string }[] = [];
    if (!mineSel) return out;
    if (mode === 'fire') bs.tiles.forEach((_, i) => { const q = i % bs.W, r = Math.floor(i / bs.W); const p = fireChance(bs, mineSel, q, r); if (p > 0) out.push({ q, r, p, color: '#ff9a3c' }); });
    if (mode === 'confuse') for (const u of bs.units) if (!u.gone && u.side !== mineSel.side) { const p = confuseChance(bs, mineSel, u); if (p > 0) out.push({ q: u.q, r: u.r, p, color: '#ff8ad0' }); }
    if (mode === 'duel') for (const u of bs.units) if (!u.gone && u.side !== mineSel.side && u.officer && dist([u.q, u.r], [mineSel.q, mineSel.r]) === 1) out.push({ q: u.q, r: u.r, p: -1, color: '#ffd27a' });
    if (mode === 'tactic') for (const t of tTargets) out.push({ q: t.q, r: t.r, p: tacticChance(bs, mineSel, t.q, t.r), color: '#c88bff' });
    return out;
  }, [bs, mineSel, mode, unitKey, bs.log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 좁은 화면에서는 전장이 가로로 넘친다 — 처음에 사람이 지휘하는 부대 쪽을 보여 준다 */
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fieldRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const side = bs.human[0] ? 0 : 1;
    const mine = bs.units.filter((u) => !u.gone && u.side === side);
    if (!mine.length) return;
    const avg = mine.reduce((a, u) => a + center(u.q, u.r)[0], 0) / mine.length;
    const total = bs.W * HW + HW / 2;
    el.scrollLeft = Math.max(0, (avg / total) * el.scrollWidth - el.clientWidth / 2);
  }, [bs, view3d]);

  /* 출진·승패 붓글씨 */
  useEffect(() => { const t = setTimeout(() => setCut(null), 1700); return () => clearTimeout(t); }, []);
  const overSeen = useRef(false);
  useEffect(() => {
    if (!bs.over || overSeen.current) return;
    overSeen.current = true;
    const me = bs.human[0] ? 0 : bs.human[1] ? 1 : -1;
    setCut(me < 0 ? '終' : bs.over.winner === me ? '勝' : '敗');
    const t = setTimeout(() => setCut(null), 1900);
    return () => clearTimeout(t);
  }, [bs.over]);

  /* 필살 전법 — 장수 컷인 */
  useEffect(() => {
    if (!bs.flash) return;
    setFlash(bs.flash);
    bs.flash = null;
    sg.crit();
    const t = setTimeout(() => setFlash(null), 1500);
    return () => clearTimeout(t);
  });

  /* 일기토 연출 */
  useEffect(() => {
    if (!bs.duel) return;
    setDuelShow(1);
    const t = setInterval(() => setDuelShow((n) => n + 1), 420);
    return () => clearInterval(t);
  }, [bs.duel]);

  /* 병력·내구가 줄면 숫자를 띄우고, 전투 기록으로 돌진·화살을 그리며 효과음을 고른다 */
  const lastTroops = useRef(new Map(bs.units.map((u) => [u.uid, u.troops])));
  const lastHp = useRef(bs.tiles.map((t) => t.hp));
  const heard = useRef(bs.log.length);
  useEffect(() => {
    const nf: Float[] = [];
    const fx: Fx[] = [];
    let n = 0;
    for (const u of bs.units) {
      const before = lastTroops.current.get(u.uid);
      if (before !== undefined && u.troops < before) {
        const [x, y] = center(u.q, u.r);
        const cls = u.side === 0 ? 'atk' : 'def';
        const text = `−${(before - u.troops).toLocaleString('ko-KR')}`;
        nf.push({ id: fxSeq++, x, y: y - 22, text, cls, delay: n * 90 });
        fx.push({ id: fxSeq++, type: 'float', q: u.q, r: u.r, text, color: FLOAT_COLOR[cls], delay: n * 90 });
        n++;
      }
      lastTroops.current.set(u.uid, u.troops);
    }
    let broke = false;
    bs.tiles.forEach((t, i) => {
      const before = lastHp.current[i];
      if (before !== undefined && t.hp < before) {
        const q = i % bs.W, r = Math.floor(i / bs.W);
        const [x, y] = center(q, r);
        const cls = t.hp === 0 ? 'break' : 'wall';
        const text = t.hp === 0 ? '破' : `−${before - t.hp}`;
        if (t.hp === 0) broke = true;
        nf.push({ id: fxSeq++, x, y: y - 14, text, cls, delay: n * 90 });
        fx.push({ id: fxSeq++, type: 'float', q, r, text, color: FLOAT_COLOR[cls], delay: n * 90 });
        n++;
      }
      lastHp.current[i] = t.hp;
    });
    const fresh = bs.log.slice(heard.current);
    heard.current = bs.log.length;
    const ns: Shot[] = [];
    const nl: Lunge[] = [];
    const byName = (name: string) => bs.units.find((u) => u.name === name);
    fresh.forEach((line, i) => {
      const m = /^(\S+?)(?:의 \S+?!(?: 필살)?)? → (\S+?): (공격|사격|전법) −/.exec(line);
      if (!m) return;
      const a = byName(m[1]);
      if (!a) return;
      const d = byName(m[2]);
      const to: [number, number] | null = d ? [d.q, d.r] : null;
      if (!to) return;
      const ranged = m[3] === '사격' || (m[3] === '전법' && (kindOf(a.kind).range > 0 || a.kind === '공성') && dist([a.q, a.r], to) > 1);
      const [x1, y1] = center(a.q, a.r), [x2, y2] = center(to[0], to[1]);
      if (ranged) {
        ns.push({ id: fxSeq++, x1, y1: y1 - 10, x2, y2: y2 - 6, delay: i * 120 });
        fx.push({ id: fxSeq++, type: 'shot', from: [a.q, a.r], to, delay: i * 120, volley: m[3] === '전법' ? 9 : 5, stone: a.kind === '공성' });
      } else {
        nl.push({ uid: a.uid, dx: (x2 - x1) * 0.32, dy: (y2 - y1) * 0.32 });
        fx.push({ id: fxSeq++, type: 'lunge', uid: a.uid, to });
      }
    });
    /* 성벽 공격(공성 투석 포함)은 기록으로 과녁 칸을 모르니, 깨진 칸을 향해 돌을 날린다 */
    if (broke) fx.push({ id: fxSeq++, type: 'shake' });
    const cues = fresh.map(battleCue).filter((c): c is () => void => !!c).slice(-5);
    cues.forEach((c, i) => setTimeout(c, i * 230));
    if (broke) { setShake(true); setTimeout(() => setShake(false), 480); }
    if (nf.length) {
      setFloats((f) => [...f, ...nf]);
      setTimeout(() => setFloats((f) => f.filter((x) => !nf.includes(x))), 1500 + n * 90);
    }
    if (ns.length) {
      setShots((f) => [...f, ...ns]);
      setTimeout(() => setShots((f) => f.filter((x) => !ns.includes(x))), 900 + ns.length * 120);
    }
    if (nl.length) {
      setLunge(nl);
      setTimeout(() => setLunge([]), 260);
    }
    if (fx.length) { fxQueue.current.push(...fx); setTick((t) => t + 1); }
  });

  const after = () => { setMode('normal'); bump(); };

  const onTile = (q: number, r: number) => {
    if (bs.over || humanSide === null) return;
    const u = unitAt(bs, q, r);
    if (mineSel && mode === 'fire') {
      if (fireChance(bs, mineSel, q, r) > 0) doFire(bs, mineSel, q, r);
      after(); return;
    }
    if (mineSel && mode === 'confuse') {
      if (u && u.side !== mineSel.side && confuseChance(bs, mineSel, u) > 0) doConfuse(bs, mineSel, u);
      after(); return;
    }
    if (mineSel && mode === 'duel') {
      if (u && u.side !== mineSel.side && dist([u.q, u.r], [mineSel.q, mineSel.r]) === 1 && u.officer) { doDuel(bs, mineSel, u); sg.duel(); }
      after(); return;
    }
    if (mineSel && mode === 'tactic') {
      if (tTargets.some((t) => t.q === q && t.r === r)) doTactic(bs, mineSel, q, r);
      after(); return;
    }
    if (mineSel) {
      const t = targets.find((x) => x.q === q && x.r === r);
      if (t) {
        if (t.kind === 'unit') attackUnit(bs, mineSel, unitAt(bs, q, r)!, t.ranged);
        else attackTile(bs, mineSel, q, r);
        after(); return;
      }
      if (reach.has(r * bs.W + q) && !(q === mineSel.q && r === mineSel.r)) {
        moveUnit(bs, mineSel, q, r); sg.march(mineSel.kind); after(); return;
      }
    }
    if (u) { setSel(u.uid); setMode('normal'); return; }
    setSel(null);
  };

  const endMySide = () => {
    endSide(bs);
    runUntilHuman(bs);
    setSel(null); setMode('normal');
    bump();
  };
  const auto = () => { autoResolve(bs); bump(); };
  const toggleView = () => { const v = !view3d; setView3d(v); writeJSON(VIEW_KEY, v); };

  const atk = alive(bs, 0), def = alive(bs, 1);
  const sum = (l: Unit[]) => l.reduce((a, u) => a + u.troops, 0);
  const sideName = (side: 0 | 1) => (side === 0 ? factionName(s, bs.attacker) : bs.defender >= 0 ? factionName(s, bs.defender) : '수비대');
  const sideColor = (side: 0 | 1) => {
    const f = side === 0 ? bs.attacker : bs.defender;
    return f >= 0 ? s.factions[f]?.color ?? '#888' : '#7b8190';
  };
  const colorOf = (u: Unit) => (u.faction >= 0 ? s.factions[u.faction]?.color ?? '#888' : '#7b8190');
  const labelOf = (u: Unit) => (u.officer ? surname(OFFICER_DEF[u.officer]?.hanja ?? u.name) : '守');
  const city = CITY_BY_ID[bs.to];
  const ta = sum(atk), td = sum(def);
  const cmdOf = (side: 0 | 1) => bs.units.find((u) => u.side === side && u.commander && u.officer)?.officer ?? bs.units.find((u) => u.side === side && u.officer)?.officer;
  const ca = cmdOf(0), cdf = cmdOf(1);

  const overlays: Overlay[] = [
    ...[...reach.keys()].filter((k) => !(mineSel && k === mineSel.r * bs.W + mineSel.q)).map((k) => ({ q: k % bs.W, r: Math.floor(k / bs.W), kind: 'reach' as const })),
    ...targets.map((t) => ({ q: t.q, r: t.r, kind: 'target' as const })),
    ...special.map((x) => ({ q: x.q, r: x.r, kind: 'special' as const, color: x.color, label: x.p >= 0 ? pct(x.p) : undefined })),
  ];

  const tactic = mineSel ? TACTICS[mineSel.kind] : null;

  return (
    <div className="sg-battle">
      <div className="sg-bt-top">
        <div className="sg-bt-vs">
          <div className="sg-bt-army atk" style={{ ['--fac' as string]: sideColor(0) }}>
            {ca && <Portrait id={ca} size={40} year={s.year} color={sideColor(0)} className="sg-bt-face" />}
            <span><b>{sideName(0)}</b><small>{fmt(ta)} · 군량 {fmt(bs.food)}</small></span>
          </div>
          <div className="sg-bt-mid">
            <strong>{city.name} {SIZE_NAME[bs.size]} 공방전</strong>
            <span className="sg-bt-ratio"><i style={{ width: `${(ta / Math.max(1, ta + td)) * 100}%`, background: sideColor(0) }} /><i style={{ flex: 1, background: sideColor(1) }} /></span>
            <small>{bs.day}/{bs.maxDay}일 · {bs.weather} · 바람 {WIND_ARROW[bs.wind]} · {bs.entry}쪽 진입</small>
          </div>
          <div className="sg-bt-army def" style={{ ['--fac' as string]: sideColor(1) }}>
            <span><b>{sideName(1)}</b><small>{fmt(td)}</small></span>
            {cdf && <Portrait id={cdf} size={40} year={s.year} color={sideColor(1)} className="sg-bt-face" flip />}
          </div>
        </div>
        <div className="sg-bt-sub">
          {bs.reinforce.map((rf, i) => (
            <span key={i} className={`sg-bt-rein ${rf.side === 0 ? 'atk' : 'def'}`}>
              원군 {rf.units.length}부대 · {CITY_BY_ID[rf.from].name} · {rf.day}일째
            </span>
          ))}
          <button className="sg-chip sg-viewbtn" onClick={toggleView} aria-pressed={view3d}>{view3d ? '3D' : '2D'} 보기</button>
          <span className={`sg-bt-turn ${bs.side === 0 ? 'atk' : 'def'}`}>{bs.over ? '전투 종료' : `${bs.side === 0 ? '공격' : '수비'} 측 차례`}</span>
        </div>
      </div>
      {showNote && (
        <button className="sg-bt-note" onClick={() => setShowNote(false)}>
          {bs.note} <small>닫기</small>
        </button>
      )}
      <div className="sg-bt-fieldwrap">
        <Weather w={bs.weather} month={s.month} wind={bs.wind} />
        {view3d ? (
          <Suspense fallback={<div className="sg-bt3d sg-bt3d-wait">전장을 세우는 중…</div>}>
            <Field3D bs={bs} month={s.month} sel={sel} overlays={overlays} colorOf={colorOf} labelOf={labelOf} onTile={onTile}
              fxQueue={fxQueue} tick={tick} focus={mineSel ? [mineSel.q, mineSel.r] : null} onFail={() => setView3d(false)} />
          </Suspense>
        ) : (
          <div className="sg-bt-field" ref={fieldRef}>
            <Field2D s={s} bs={bs} sel={sel} reach={reach} targets={targets} special={special} mineSel={mineSel} onTile={onTile}
              floats={floats} shots={shots} lunge={lunge} shake={shake} />
          </div>
        )}
        {flash && (
          <div className="sg-flash" aria-hidden="true">
            <div className="sg-flash-face"><Portrait id={flash.officer} size={180} year={s.year} color={s.officers[flash.officer]?.faction >= 0 ? s.factions[s.officers[flash.officer].faction]?.color : undefined} className="sg-bigface" /></div>
            <div className="sg-flash-txt"><b>{flash.tactic}</b><small>{OFFICER_DEF[flash.officer]?.name} · 필살</small></div>
          </div>
        )}
      </div>

      <div className="sg-bt-panel sg-win">
        {unit ? (
          <div className="sg-bt-unit">
            <div className="sg-bt-uhead">
              {unit.officer && <Portrait id={unit.officer} size={60} year={s.year} color={unit.faction >= 0 ? s.factions[unit.faction]?.color : undefined} className="sg-bt-uface" />}
              <div>
                <strong>{unit.name}</strong>
                <span className="sg-bt-urole">
                  <b className="sg-kind-tag">{kindOf(unit.kind).hanja} {kindOf(unit.kind).name}</b>
                  {unit.side === 0 ? '공격' : '수비'}{unit.commander ? ' · 총대장' : ''}{unit.home ? ` · ${CITY_BY_ID[unit.home].name} 원군` : ''}
                  {unit.guard ? ' · 관문 수비' : ''} · {TILE_NAMES[tileAt(bs, unit.q, unit.r).t]}
                </span>
              </div>
            </div>
            <div className="sg-bt-ustats">
              <span><i>兵</i><b>{fmt(unit.troops)}</b><small>/{fmt(unit.maxTroops)}</small></span>
              <span><i>氣</i><b>{unit.morale}</b></span>
              <span><i>練</i><b>{unit.training}</b></span>
              <span><i>移</i><b>{unit.move}</b></span>
              <span className="wide">통 <b>{unit.stats[0]}</b> · 무 <b>{unit.stats[1]}</b> · 지 <b>{unit.stats[2]}</b>{unit.traits.length ? ` · ${unit.traits.join('·')}` : ''}</span>
            </div>
            <p className="sg-kind-desc">{kindOf(unit.kind).desc}{shootRange(bs, unit) ? ` 사거리 ${shootRange(bs, unit)}칸.` : ''}</p>
            {mineSel && !bs.over && !mineSel.acted && (
              <div className="sg-bt-acts">
                {tactic && (
                  <button className={`sg-cmd tactic ${mode === 'tactic' ? 'on' : ''}`} disabled={!tTargets.length} onClick={() => setMode(mode === 'tactic' ? 'normal' : 'tactic')}
                    title={tactic.desc}>
                    <b>{tactic.hanja}</b> {tactic.name}
                  </button>
                )}
                <button className={`sg-cmd ${mode === 'fire' ? 'on' : ''}`} disabled={bs.weather === '비'} onClick={() => setMode(mode === 'fire' ? 'normal' : 'fire')}>화계</button>
                <button className={`sg-cmd ${mode === 'confuse' ? 'on' : ''}`} onClick={() => setMode(mode === 'confuse' ? 'normal' : 'confuse')}>혼란</button>
                <button className={`sg-cmd ${mode === 'duel' ? 'on' : ''}`} disabled={!mineSel.officer} onClick={() => setMode(mode === 'duel' ? 'normal' : 'duel')}>일기토</button>
                {canFlood(bs, mineSel) && (
                  <button className="sg-cmd flood" onClick={() => { doFlood(bs, mineSel); after(); }}>
                    수공 {pct(floodChance(bs, mineSel))}
                  </button>
                )}
                <button className="sg-cmd" onClick={() => { doWait(bs, mineSel); after(); }}>대기</button>
                <button className="sg-cmd" onClick={() => { doRetreat(bs, mineSel); setSel(null); after(); }}>퇴각</button>
              </div>
            )}
            {mineSel && mode === 'tactic' && tactic && <p className="sg-muted"><b className="sg-tac-name">{tactic.hanja} {tactic.name}</b> — {tactic.desc} 보라 칸을 누르세요.</p>}
            {mineSel && mode === 'duel' && <p className="sg-muted">맞닿은 적 장수를 누르세요. 상대가 피할 수도 있습니다.</p>}
            {mineSel && mode === 'normal' && !mineSel.acted && (
              <p className="sg-muted">
                초록 칸으로 이동, 붉은 테두리를 눌러 공격합니다.{tTargets.length ? ` 「${tactic?.name}」 전법을 쓸 수 있습니다.` : ''}
                {mineSel.side === 0 && !bs.floodUsed && bs.tiles.some((t) => t.t === 'dam') && ' 堤(제방)에 서면 수공을 쓸 수 있습니다.'}
              </p>
            )}
          </div>
        ) : (
          <p className="sg-muted">{humanSide !== null ? '움직일 부대를 누르세요.' : '상대가 움직이고 있습니다.'}{view3d ? ' 끌어서 옮기고, 휠·두 손가락으로 당기고, 오른쪽 끌기·두 손가락 돌리기로 둘러봅니다.' : ''}</p>
        )}
        <div className="sg-bt-log">
          {bs.log.slice(-6).map((l, i) => <p key={bs.log.length - 6 + i}>{l}</p>)}
        </div>
        <div className="sg-bt-go">
          <button className="sg-btn" onClick={auto} disabled={!!bs.over}>위임</button>
          <button className="sg-btn primary" onClick={endMySide} disabled={!!bs.over || humanSide === null}>차례 끝</button>
        </div>
      </div>

      {cut && (
        <div className={`sg-cutin ${cut === '敗' ? 'lose' : ''}`} aria-hidden="true">
          <span>{cut}</span>
        </div>
      )}

      {bs.duel && duelShow > 0 && (
        <div className="sg-overlay" onClick={() => { bs.duel = null; setDuelShow(0); bump(); }}>
          <div className="sg-sheet sg-duel" onClick={(e) => e.stopPropagation()}>
            <div className="sg-sheet-head"><h2>일기토 <small>一騎討</small></h2></div>
            <div className="sg-sheet-body">
              <DuelFaces s={s} a={bs.duel.a} b={bs.duel.b} step={duelShow} />
              <div className="sg-duel-lines">
                {bs.duel.lines.slice(0, duelShow).map((l, i) => <p key={i}>{l}</p>)}
              </div>
              <div className="sg-form-go">
                <button className="sg-btn primary" onClick={() => { bs.duel = null; setDuelShow(0); bump(); }}>
                  {duelShow >= bs.duel.lines.length ? '닫기' : '건너뛰기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {bs.over && !bs.duel && !cut && (
        <div className="sg-overlay">
          <div className="sg-sheet sg-result">
            <div className="sg-sheet-head"><h2>{bs.over.winner === 0 ? `${sideName(0)} 승리` : `${sideName(1)} 승리`}</h2></div>
            <div className="sg-sheet-body">
              <p className="sg-result-reason">{bs.over.reason}</p>
              <p className="sg-muted">남은 병력 — 공격 {fmt(ta)} · 수비 {fmt(td)} · {bs.day}일째</p>
              <div className="sg-form-go"><button className="sg-btn primary" onClick={done}>결과 확인</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 2D 전장(그림 한 장 위에 칸·부대·연출) — WebGL이 없거나 2D를 고르면 */
function Field2D({ s, bs, sel, reach, targets, special, mineSel, onTile, floats, shots, lunge, shake }: {
  s: GameState; bs: BattleState; sel: number | null; reach: Map<number, number>; targets: Target[];
  special: { q: number; r: number; p: number; color: string }[]; mineSel: Unit | null; onTile: (q: number, r: number) => void;
  floats: Float[]; shots: Shot[]; lunge: Lunge[]; shake: boolean;
}) {
  const W = bs.W * HW + HW / 2;
  const H = bs.H * 1.5 * R + R / 2;
  const ground = paintField(bs, s.month);
  const city = CITY_BY_ID[bs.to];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`sg-bt-svg ${shake ? 'shake' : ''}`} role="img" aria-label={`${city.name} 전장`}>
      <defs>
        <marker id="bt-arrowhead" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="#f3e6c4" />
        </marker>
      </defs>
      {ground ? <image href={ground} x={0} y={0} width={W} height={H} preserveAspectRatio="none" /> : <rect width={W} height={H} fill="#6c7a3c" />}
      {bs.tiles.map((t, i) => {
        const q = i % bs.W, r = Math.floor(i / bs.W);
        const [cx, cy] = center(q, r);
        const k = r * bs.W + q;
        const canMove = reach.has(k) && !(mineSel && mineSel.q === q && mineSel.r === r);
        const isTarget = targets.some((x) => x.q === q && x.r === r);
        const sp = special.find((x) => x.q === q && x.r === r);
        return (
          <g key={i} onClick={() => onTile(q, r)} className="sg-hex">
            <path d={hexPath(cx, cy)} className="sg-hexbase" />
            {(t.t === 'wall' || t.t === 'gate' || t.t === 'pass') && t.max && (t.hp < t.max || t.t !== 'wall') && (
              <g pointerEvents="none">
                <rect x={cx - 14} y={cy + 15} width="28" height="4" rx="1" fill="rgba(0,0,0,0.7)" />
                <rect x={cx - 13.5} y={cy + 15.5} width={27 * (t.hp / t.max)} height="3" rx="1" fill={t.hp / t.max > 0.5 ? '#efe0b0' : '#ef7d6b'} />
              </g>
            )}
            {t.flood > 0 && <path d={hexPath(cx, cy, R * 0.9)} className="sg-flood" />}
            {t.fire > 0 && (
              <g pointerEvents="none">
                <path d={hexPath(cx, cy, R * 0.86)} className="sg-fire" />
                <path d={`M${cx - 8} ${cy + 8} q-3 -12 4 -20 q-1 8 5 10 q2 -6 0 -12 q9 8 5 22 Z`} className="sg-flame" />
              </g>
            )}
            {canMove && <path d={hexPath(cx, cy, R * 0.9)} className="sg-reach" />}
            {isTarget && <path d={hexPath(cx, cy, R * 0.92)} className="sg-target" />}
            {sp && <path d={hexPath(cx, cy, R * 0.9)} className="sg-special" style={{ stroke: sp.color, fill: `${sp.color}33` }} />}
            {sp && sp.p >= 0 && <text x={cx} y={cy - 12} className="sg-pct">{pct(sp.p)}</text>}
          </g>
        );
      })}
      {bs.labels.map((l, i) => {
        const [cx, cy] = center(l.q, l.r);
        return <text key={`l${i}`} x={cx} y={cy - R * 0.62} className="sg-bt-label">{l.text}</text>;
      })}
      {bs.units.filter((u) => !u.gone).sort((a, b) => a.r - b.r).map((u) => {
        const [cx, cy] = center(u.q, u.r);
        const color = u.faction >= 0 ? s.factions[u.faction]?.color ?? '#888' : '#7b8190';
        const lg = lunge.find((l) => l.uid === u.uid);
        return (
          <g key={u.uid} className={`sg-unit ${u.acted && bs.side === u.side ? 'done' : ''} ${sel === u.uid ? 'sel' : ''}`} onClick={() => onTile(u.q, u.r)}
            style={{ transform: lg ? `translate(${lg.dx}px, ${lg.dy}px)` : undefined }}>
            <circle cx={cx} cy={cy} r={R * 0.85} className="sg-unit-hit" />
            {sel === u.uid && <ellipse cx={cx} cy={cy + 14} rx="24" ry="8" className="sg-unit-selring" />}
            <UnitBanner cx={cx} cy={cy} color={color} side={u.side} commander={u.commander} troops={u.troops} kind={u.kind}
              ratio={u.troops / Math.max(1, u.maxTroops)} label={u.officer ? surname(OFFICER_DEF[u.officer]?.hanja ?? u.name) : '守'} />
            {u.home && <text x={cx - R * 0.62} y={cy - R * 0.42} className="sg-rein">援</text>}
            {u.guard && <text x={cx + R * 0.55} y={cy + R * 0.55} className="sg-rein">守</text>}
            {u.confused > 0 && <text x={cx + R * 0.1} y={cy - R * 1.05} className="sg-conf">?</text>}
          </g>
        );
      })}
      {shots.map((sh) => (
        <path key={sh.id} d={`M${sh.x1} ${sh.y1} Q${(sh.x1 + sh.x2) / 2} ${Math.min(sh.y1, sh.y2) - 34} ${sh.x2} ${sh.y2}`}
          className="sg-shot" style={{ animationDelay: `${sh.delay}ms` }} markerEnd="url(#bt-arrowhead)" />
      ))}
      {floats.map((f) => (
        <text key={f.id} x={f.x} y={f.y} className={`sg-float ${f.cls}`} style={{ animationDelay: `${f.delay}ms` }}>{f.text}</text>
      ))}
    </svg>
  );
}

/** 전장 날씨 — 비는 빗줄기, 안개는 흐르는 안개, 강풍은 날리는 잎, 겨울 맑은 날은 눈 */
function Weather({ w, month, wind }: { w: string; month: number; wind: number }) {
  const winter = seasonOf(month) === 'winter';
  const kind = w === '비' ? (winter ? 'sleet' : 'rain') : w === '안개' ? 'fog' : w === '강풍' ? 'gale' : winter ? 'snow' : w === '흐림' ? 'cloud' : null;
  if (!kind) return null;
  const dir = [1, 1, -1, -1, -1, 1][wind] ?? 1;
  return (
    <div className={`sg-weather ${kind}`} style={{ ['--dir' as string]: dir }} aria-hidden="true">
      {(kind === 'gale' || kind === 'snow') && Array.from({ length: kind === 'snow' ? 40 : 18 }, (_, i) => (
        <i key={i} style={{ top: `${(i * 23) % 100}%`, left: `${(i * 41) % 100}%`, animationDuration: `${(kind === 'snow' ? 7 : 2.4) + ((i * 7) % 5) * 0.5}s`, animationDelay: `${-((i * 3) % 7)}s` }} />
      ))}
    </div>
  );
}

/** 일기토 맞대면 — 이름으로 장수를 찾아 초상을 마주 세운다. 줄이 나올 때마다 칼이 번쩍인다 */
function DuelFaces({ s, a, b, step }: { s: GameState; a: string; b: string; step: number }) {
  const find = (name: string) => s.battle?.units.find((u) => u.name === name && u.officer)?.officer;
  const ia = find(a), ib = find(b);
  const col = (id?: string) => (id && s.officers[id]?.faction >= 0 ? s.factions[s.officers[id].faction]?.color : undefined);
  return (
    <div className="sg-duel-faces">
      {ia && <div className="sg-duel-side"><Portrait id={ia} size={110} year={s.year} color={col(ia)} className="sg-bigface" /><b>{a}</b></div>}
      <span key={step} className="sg-duel-vs">對</span>
      {ib && <div className="sg-duel-side"><Portrait id={ib} size={110} year={s.year} color={col(ib)} flip className="sg-bigface" /><b>{b}</b></div>}
    </div>
  );
}
