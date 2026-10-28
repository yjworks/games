import { useEffect, useMemo, useRef, useState } from 'react';
import { CITY_BY_ID } from '../data/cities';
import {
  type Unit, TILE_NAMES, alive, attackTargets, attackTile, attackUnit, autoResolve, canFlood, confuseChance, dist,
  doConfuse, doDuel, doFire, doFlood, doRetreat, doWait, endSide, fireChance, floodChance, moveUnit, reachable,
  runUntilHuman, shootRange, tileAt, unitAt,
} from '../engine/battle';
import { kindOf } from '../engine/units';
import { factionName } from '../engine/officers';
import type { GameState } from '../engine/state';
import { battleCue, sg } from '../audio';
import { useGame } from '../store';
import { pct } from './common';
import { fmt } from './labels';
import { BattleDefs, TILE_FILL, TileArt, UnitBanner } from './art/BattleArt';
import { Portrait } from './art/Portrait';
import { surname } from './art/util';
import { OFFICER_DEF } from '../data/officers';

const R = 30;
const HW = Math.sqrt(3) * R;
const center = (q: number, r: number): [number, number] => [q * HW + (r % 2 ? HW / 2 : 0) + HW / 2, r * 1.5 * R + R];
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

/** 칸 위에 얹는 글자 */
const GLYPH: Partial<Record<string, [string, string]>> = {
  forest: ['♣', 'sg-glyph'],
  mountain: ['▲', 'sg-glyph'],
  peak: ['▲▲', 'sg-glyph peak'],
  hill: ['⌒', 'sg-glyph small'],
  marsh: ['≈', 'sg-glyph small'],
  ford: ['≈', 'sg-glyph ford'],
  village: ['家', 'sg-glyph village'],
  dam: ['堤', 'sg-glyph dam'],
  keep: ['本', 'sg-glyph keep'],
};

type Mode = 'normal' | 'fire' | 'confuse' | 'duel';

export function BattleView({ s }: { s: GameState }) {
  const bs = s.battle!;
  const bump = useGame((u) => u.bump);
  const done = useGame((u) => u.battleDone);
  useGame((u) => u.rev);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [duelShow, setDuelShow] = useState(0);
  const [showNote, setShowNote] = useState(true);

  const humanSide = bs.human[bs.side] ? bs.side : null;
  const unit = sel !== null ? bs.units.find((u) => u.uid === sel && !u.gone) ?? null : null;
  const mineSel = unit && humanSide !== null && unit.side === humanSide ? unit : null;

  const unitKey = bs.units.map((u) => `${u.q},${u.r},${u.moved},${u.gone}`).join();
  const reach = useMemo(() => (mineSel && mode === 'normal' ? reachable(bs, mineSel) : new Map<number, number>()), [bs, mineSel, mode, unitKey]);
  const targets = mineSel && mode === 'normal' ? attackTargets(bs, mineSel) : [];

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
  }, [bs]);

  /* 일기토 연출 */
  useEffect(() => {
    if (!bs.duel) return;
    setDuelShow(1);
    const t = setInterval(() => setDuelShow((n) => n + 1), 420);
    return () => clearInterval(t);
  }, [bs.duel]);

  /* 전투 기록이 늘면 새 줄마다 효과음을 고른다 — 상대 차례에 한꺼번에 늘어도 몇 개만 이어서 */
  const heard = useRef(bs.log.length);
  useEffect(() => {
    const fresh = bs.log.slice(heard.current);
    heard.current = bs.log.length;
    const cues = fresh.map(battleCue).filter((c): c is () => void => !!c).slice(-5);
    cues.forEach((c, i) => setTimeout(c, i * 230));
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

  const W = bs.W * HW + HW / 2;
  const H = bs.H * 1.5 * R + R / 2;
  const atk = alive(bs, 0), def = alive(bs, 1);
  const sum = (l: Unit[]) => l.reduce((a, u) => a + u.troops, 0);
  const sideName = (side: 0 | 1) => (side === 0 ? factionName(s, bs.attacker) : bs.defender >= 0 ? factionName(s, bs.defender) : '수비대');
  const city = CITY_BY_ID[bs.to];

  return (
    <div className="sg-battle">
      <div className="sg-bt-top">
        <strong>{city.name} {SIZE_NAME[bs.size]} 공방전</strong>
        <span>{bs.day}/{bs.maxDay}일 · {bs.weather} · 바람 {WIND_ARROW[bs.wind]} · {bs.entry}쪽 진입</span>
        <span className="sg-bt-side atk">{sideName(0)} {fmt(sum(atk))} · 군량 {fmt(bs.food)}</span>
        <span className="sg-bt-side def">{sideName(1)} {fmt(sum(def))}</span>
        {bs.reinforce.map((rf, i) => (
          <span key={i} className={`sg-bt-rein ${rf.side === 0 ? 'atk' : 'def'}`}>
            원군 {rf.units.length}부대 · {CITY_BY_ID[rf.from].name} · {rf.day}일째
          </span>
        ))}
        <span className="sg-bt-turn">{bs.over ? '전투 종료' : `${bs.side === 0 ? '공격' : '수비'} 측 차례`}</span>
      </div>
      {showNote && (
        <button className="sg-bt-note" onClick={() => setShowNote(false)}>
          {bs.note} <small>닫기</small>
        </button>
      )}
      <div className="sg-bt-field" ref={fieldRef}>
        <svg viewBox={`0 0 ${W} ${H}`} className="sg-bt-svg" role="img" aria-label={`${city.name} 전장`}>
          <BattleDefs />
          {bs.tiles.map((t, i) => {
            const q = i % bs.W, r = Math.floor(i / bs.W);
            const [cx, cy] = center(q, r);
            const k = r * bs.W + q;
            const canMove = reach.has(k) && !(mineSel && mineSel.q === q && mineSel.r === r);
            const isTarget = targets.some((x) => x.q === q && x.r === r);
            const fireOk = mineSel && mode === 'fire' && fireChance(bs, mineSel, q, r) > 0;
            const g = GLYPH[t.t];
            return (
              <g key={i} onClick={() => onTile(q, r)} className="sg-hex">
                <path d={hexPath(cx, cy)} fill={TILE_FILL[t.t]} className={`sg-hexbase sg-t-${t.t}`} />
                <TileArt t={t.t} cx={cx} cy={cy} seed={i} />
                {g && t.t !== 'forest' && t.t !== 'mountain' && t.t !== 'peak' && t.t !== 'village' && t.t !== 'dam' && t.t !== 'keep' && <text x={cx} y={cy + 6} className={g[1]}>{g[0]}</text>}
                {(t.t === 'wall' || t.t === 'gate' || t.t === 'pass') && t.max && (t.hp < t.max || t.t !== 'wall') && (
                  <g pointerEvents="none">
                    <rect x={cx - 13} y={cy + 13} width="26" height="3.5" rx="1" fill="rgba(0,0,0,0.6)" />
                    <rect x={cx - 13} y={cy + 13} width={26 * (t.hp / t.max)} height="3.5" rx="1" fill={t.hp / t.max > 0.5 ? '#e8d6a0' : '#ef7d6b'} />
                  </g>
                )}
                {t.flood > 0 && <path d={hexPath(cx, cy, R * 0.86)} className="sg-flood" />}
                {t.fire > 0 && <path d={hexPath(cx, cy, R * 0.82)} className="sg-fire" />}
                {canMove && <path d={hexPath(cx, cy, R * 0.9)} className="sg-reach" />}
                {isTarget && <path d={hexPath(cx, cy, R * 0.92)} className="sg-target" />}
                {fireOk && <path d={hexPath(cx, cy, R * 0.9)} className="sg-firetarget" />}
                {fireOk && <text x={cx} y={cy - 12} className="sg-pct">{pct(fireChance(bs, mineSel!, q, r))}</text>}
              </g>
            );
          })}
          {bs.labels.map((l, i) => {
            const [cx, cy] = center(l.q, l.r);
            return <text key={`l${i}`} x={cx} y={cy - R * 0.55} className="sg-bt-label">{l.text}</text>;
          })}
          {bs.units.filter((u) => !u.gone).map((u) => {
            const [cx, cy] = center(u.q, u.r);
            const color = u.faction >= 0 ? s.factions[u.faction]?.color ?? '#888' : '#7b8190';
            const confuseOk = mineSel && mode === 'confuse' && u.side !== mineSel.side && confuseChance(bs, mineSel, u) > 0;
            const duelOk = mineSel && mode === 'duel' && u.side !== mineSel.side && u.officer && dist([u.q, u.r], [mineSel.q, mineSel.r]) === 1;
            return (
              <g key={u.uid} className={`sg-unit ${u.acted && bs.side === u.side ? 'done' : ''} ${sel === u.uid ? 'sel' : ''}`} onClick={() => onTile(u.q, u.r)}>
                <circle cx={cx} cy={cy} r={R * 0.85} className="sg-unit-hit" />
                {sel === u.uid && <ellipse cx={cx} cy={cy + 14} rx="20" ry="7" className="sg-unit-selring" />}
                <UnitBanner cx={cx} cy={cy} color={color} side={u.side} commander={u.commander} troops={u.troops} kind={u.kind}
                  ratio={u.troops / Math.max(1, u.maxTroops)} label={u.officer ? surname(OFFICER_DEF[u.officer]?.hanja ?? u.name) : '守'} />
                {u.commander && <text x={cx + R * 0.55} y={cy - R * 0.5} className="sg-star">帥</text>}
                {u.home && <text x={cx - R * 0.5} y={cy - R * 0.38} className="sg-rein">援</text>}
                {u.guard && <text x={cx + R * 0.5} y={cy + R * 0.5} className="sg-rein">守</text>}
                {u.confused > 0 && <text x={cx - R * 0.55} y={cy - R * 0.38} className="sg-conf">?</text>}
                {(confuseOk || duelOk) && <circle cx={cx} cy={cy} r={R * 0.8} className="sg-target-ring" />}
                {confuseOk && <text x={cx} y={cy - R * 0.75} className="sg-pct">{pct(confuseChance(bs, mineSel!, u))}</text>}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="sg-bt-panel">
        {unit ? (
          <div className="sg-bt-unit">
            <div className="sg-bt-uhead">
              {unit.officer && <Portrait id={unit.officer} size={46} year={s.year} color={unit.faction >= 0 ? s.factions[unit.faction]?.color : undefined} className="sg-oface" />}
              <strong>{unit.name}</strong>{' '}
              <small>
                <b className="sg-kind-tag">{kindOf(unit.kind).hanja} {kindOf(unit.kind).name}</b> {unit.side === 0 ? '공격' : '수비'}{unit.commander ? ' · 총대장' : ''}{unit.home ? ` · ${CITY_BY_ID[unit.home].name} 원군` : ''}
                {unit.guard ? ' · 관문 수비' : ''} · {TILE_NAMES[tileAt(bs, unit.q, unit.r).t]}
              </small>
            </div>
            <div className="sg-bt-ustats">
              병력 <b>{fmt(unit.troops)}</b>/{fmt(unit.maxTroops)} · 사기 <b>{unit.morale}</b> · 훈련 {unit.training} · 이동 {unit.move}
              {' '}· 통{unit.stats[0]} 무{unit.stats[1]} 지{unit.stats[2]}{unit.traits.length ? ` · ${unit.traits.join('·')}` : ''}
            </div>
            <p className="sg-kind-desc">{kindOf(unit.kind).desc}{shootRange(bs, unit) ? ` 사거리 ${shootRange(bs, unit)}칸.` : ''}</p>
            {mineSel && !bs.over && !mineSel.acted && (
              <div className="sg-bt-acts">
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
            {mineSel && mode === 'duel' && <p className="sg-muted">맞닿은 적 장수를 누르세요. 상대가 피할 수도 있습니다.</p>}
            {mineSel && mode === 'normal' && !mineSel.acted && (
              <p className="sg-muted">
                초록 칸으로 이동, 붉은 테두리를 눌러 공격합니다.
                {mineSel.side === 0 && !bs.floodUsed && bs.tiles.some((t) => t.t === 'dam') && ' 堤(제방)에 서면 수공을 쓸 수 있습니다.'}
              </p>
            )}
          </div>
        ) : (
          <p className="sg-muted">{humanSide !== null ? '움직일 부대를 누르세요.' : '상대가 움직이고 있습니다.'}</p>
        )}
        <div className="sg-bt-log">
          {bs.log.slice(-5).map((l, i) => <p key={bs.log.length - 5 + i}>{l}</p>)}
        </div>
        <div className="sg-bt-go">
          <button className="sg-btn" onClick={auto} disabled={!!bs.over}>위임</button>
          <button className="sg-btn primary" onClick={endMySide} disabled={!!bs.over || humanSide === null}>차례 끝</button>
        </div>
      </div>

      {bs.duel && duelShow > 0 && (
        <div className="sg-overlay" onClick={() => { bs.duel = null; setDuelShow(0); bump(); }}>
          <div className="sg-sheet sg-duel" onClick={(e) => e.stopPropagation()}>
            <h2>일기토</h2>
            <DuelFaces s={s} a={bs.duel.a} b={bs.duel.b} />
            <div className="sg-duel-lines">
              {bs.duel.lines.slice(0, duelShow).map((l, i) => <p key={i}>{l}</p>)}
            </div>
            <button className="sg-btn primary" onClick={() => { bs.duel = null; setDuelShow(0); bump(); }}>
              {duelShow >= bs.duel.lines.length ? '닫기' : '건너뛰기'}
            </button>
          </div>
        </div>
      )}

      {bs.over && !bs.duel && (
        <div className="sg-overlay">
          <div className="sg-sheet sg-result">
            <h2>{bs.over.winner === 0 ? `${sideName(0)} 승리` : `${sideName(1)} 승리`}</h2>
            <p>{bs.over.reason}</p>
            <p className="sg-muted">남은 병력 — 공격 {fmt(sum(atk))} · 수비 {fmt(sum(def))} · {bs.day}일째</p>
            <button className="sg-btn primary" onClick={done}>결과 확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 일기토 맞대면 — 이름으로 장수를 찾아 초상을 마주 세운다 */
function DuelFaces({ s, a, b }: { s: GameState; a: string; b: string }) {
  const find = (name: string) => s.battle?.units.find((u) => u.name === name && u.officer)?.officer;
  const ia = find(a), ib = find(b);
  const col = (id?: string) => (id && s.officers[id]?.faction >= 0 ? s.factions[s.officers[id].faction]?.color : undefined);
  return (
    <div className="sg-duel-faces">
      {ia && <Portrait id={ia} size={96} year={s.year} color={col(ia)} />}
      <span className="sg-duel-vs">對</span>
      {ib && <Portrait id={ib} size={96} year={s.year} color={col(ib)} flip />}
    </div>
  );
}
