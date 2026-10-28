import { useEffect, useMemo, useState } from 'react';
import { CITY_BY_ID } from '../data/cities';
import {
  type Unit, TILE_NAMES, alive, attackTargets, attackTile, attackUnit, autoResolve, confuseChance, dist,
  doConfuse, doDuel, doFire, doRetreat, doWait, endSide, fireChance, moveUnit, reachable, runUntilHuman,
  tileAt, unitAt,
} from '../engine/battle';
import { factionName } from '../engine/officers';
import type { GameState } from '../engine/state';
import { sfx } from '../../../shared/sound';
import { useGame } from '../store';
import { pct } from './common';
import { fmt } from './labels';

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

type Mode = 'normal' | 'fire' | 'confuse' | 'duel';

export function BattleView({ s }: { s: GameState }) {
  const bs = s.battle!;
  const bump = useGame((u) => u.bump);
  const done = useGame((u) => u.battleDone);
  useGame((u) => u.rev);
  const [sel, setSel] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('normal');
  const [duelShow, setDuelShow] = useState(0);

  const humanSide = bs.human[bs.side] ? bs.side : null;
  const unit = sel !== null ? bs.units.find((u) => u.uid === sel && !u.gone) ?? null : null;
  const mineSel = unit && humanSide !== null && unit.side === humanSide ? unit : null;

  const reach = useMemo(() => (mineSel && mode === 'normal' ? reachable(bs, mineSel) : new Map<number, number>()), [bs, mineSel, mode, bs.units.map((u) => `${u.q},${u.r},${u.moved}`).join()]);
  const targets = mineSel && mode === 'normal' ? attackTargets(bs, mineSel) : [];

  /* 일기토 연출 */
  useEffect(() => {
    if (!bs.duel) return;
    setDuelShow(1);
    const t = setInterval(() => setDuelShow((n) => n + 1), 420);
    return () => clearInterval(t);
  }, [bs.duel]);

  const after = () => { setMode('normal'); bump(); };

  const onTile = (q: number, r: number) => {
    if (bs.over || humanSide === null) return;
    const u = unitAt(bs, q, r);
    if (mineSel && mode === 'fire') {
      if (fireChance(bs, mineSel, q, r) > 0) { doFire(bs, mineSel, q, r); sfx.capture(); }
      after(); return;
    }
    if (mineSel && mode === 'confuse') {
      if (u && u.side !== mineSel.side && confuseChance(bs, mineSel, u) > 0) { doConfuse(bs, mineSel, u); sfx.alert(); }
      after(); return;
    }
    if (mineSel && mode === 'duel') {
      if (u && u.side !== mineSel.side && dist([u.q, u.r], [mineSel.q, mineSel.r]) === 1 && u.officer) { doDuel(bs, mineSel, u); sfx.capture(); }
      after(); return;
    }
    if (mineSel) {
      const t = targets.find((x) => x.q === q && x.r === r);
      if (t) {
        if (t.kind === 'unit') attackUnit(bs, mineSel, unitAt(bs, q, r)!, t.ranged);
        else attackTile(bs, mineSel, q, r);
        sfx.capture();
        after(); return;
      }
      if (reach.has(r * bs.W + q) && !(q === mineSel.q && r === mineSel.r)) {
        moveUnit(bs, mineSel, q, r); sfx.move(); after(); return;
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

  return (
    <div className="sg-battle">
      <div className="sg-bt-top">
        <strong>{CITY_BY_ID[bs.to].name} 공방전</strong>
        <span>{bs.day}/{bs.maxDay}일 · {bs.weather} · 바람 {WIND_ARROW[bs.wind]}</span>
        <span className="sg-bt-side atk">{sideName(0)} {fmt(sum(atk))} · 군량 {fmt(bs.food)}</span>
        <span className="sg-bt-side def">{sideName(1)} {fmt(sum(def))}</span>
        <span className="sg-bt-turn">{bs.over ? '전투 종료' : `${bs.side === 0 ? '공격' : '수비'} 측 차례`}</span>
      </div>
      <div className="sg-bt-field">
        <svg viewBox={`0 0 ${W} ${H}`} className="sg-bt-svg" role="img" aria-label="전장">
          {bs.tiles.map((t, i) => {
            const q = i % bs.W, r = Math.floor(i / bs.W);
            const [cx, cy] = center(q, r);
            const k = r * bs.W + q;
            const canMove = reach.has(k) && !(mineSel && mineSel.q === q && mineSel.r === r);
            const isTarget = targets.some((x) => x.q === q && x.r === r);
            const fireOk = mineSel && mode === 'fire' && fireChance(bs, mineSel, q, r) > 0;
            return (
              <g key={i} onClick={() => onTile(q, r)} className="sg-hex">
                <path d={hexPath(cx, cy)} className={`sg-t-${t.t}`} />
                {t.t === 'forest' && <text x={cx} y={cy + 6} className="sg-glyph">♣</text>}
                {t.t === 'mountain' && <text x={cx} y={cy + 7} className="sg-glyph">▲</text>}
                {t.t === 'hill' && <text x={cx} y={cy + 6} className="sg-glyph small">⌒</text>}
                {(t.t === 'wall' || t.t === 'gate') && <text x={cx} y={cy + 4} className="sg-hp">{t.hp}</text>}
                {t.t === 'keep' && <text x={cx} y={cy + 6} className="sg-glyph keep">本</text>}
                {t.fire > 0 && <path d={hexPath(cx, cy, R * 0.82)} className="sg-fire" />}
                {canMove && <path d={hexPath(cx, cy, R * 0.9)} className="sg-reach" />}
                {isTarget && <path d={hexPath(cx, cy, R * 0.92)} className="sg-target" />}
                {fireOk && <path d={hexPath(cx, cy, R * 0.9)} className="sg-firetarget" />}
                {fireOk && <text x={cx} y={cy - 12} className="sg-pct">{pct(fireChance(bs, mineSel!, q, r))}</text>}
              </g>
            );
          })}
          {bs.units.filter((u) => !u.gone).map((u) => {
            const [cx, cy] = center(u.q, u.r);
            const color = u.faction >= 0 ? s.factions[u.faction]?.color ?? '#888' : '#7b8190';
            const confuseOk = mineSel && mode === 'confuse' && u.side !== mineSel.side && confuseChance(bs, mineSel, u) > 0;
            const duelOk = mineSel && mode === 'duel' && u.side !== mineSel.side && u.officer && dist([u.q, u.r], [mineSel.q, mineSel.r]) === 1;
            return (
              <g key={u.uid} className={`sg-unit ${u.acted && bs.side === u.side ? 'done' : ''} ${sel === u.uid ? 'sel' : ''}`} onClick={() => onTile(u.q, u.r)}>
                <circle cx={cx} cy={cy} r={R * 0.62} fill={color} className={u.side === 0 ? 'atk' : 'def'} />
                <text x={cx} y={cy + 4} className="sg-uname">{u.name.slice(0, 2)}</text>
                <rect x={cx - R * 0.6} y={cy + R * 0.62} width={R * 1.2} height={4} className="sg-ubar-bg" />
                <rect x={cx - R * 0.6} y={cy + R * 0.62} width={R * 1.2 * Math.max(0, u.troops / Math.max(1, u.maxTroops))} height={4} className="sg-ubar" />
                {u.commander && <text x={cx + R * 0.5} y={cy - R * 0.38} className="sg-star">★</text>}
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
              <strong>{unit.name}</strong> <small>{unit.side === 0 ? '공격' : '수비'}{unit.commander ? ' · 총대장' : ''} · {TILE_NAMES[tileAt(bs, unit.q, unit.r).t]}</small>
            </div>
            <div className="sg-bt-ustats">
              병력 <b>{fmt(unit.troops)}</b>/{fmt(unit.maxTroops)} · 사기 <b>{unit.morale}</b> · 훈련 {unit.training}
              {' '}· 통{unit.stats[0]} 무{unit.stats[1]} 지{unit.stats[2]}{unit.traits.length ? ` · ${unit.traits.join('·')}` : ''}
            </div>
            {mineSel && !bs.over && !mineSel.acted && (
              <div className="sg-bt-acts">
                <button className={`sg-cmd ${mode === 'fire' ? 'on' : ''}`} disabled={bs.weather === '비'} onClick={() => setMode(mode === 'fire' ? 'normal' : 'fire')}>화계</button>
                <button className={`sg-cmd ${mode === 'confuse' ? 'on' : ''}`} onClick={() => setMode(mode === 'confuse' ? 'normal' : 'confuse')}>혼란</button>
                <button className={`sg-cmd ${mode === 'duel' ? 'on' : ''}`} disabled={!mineSel.officer} onClick={() => setMode(mode === 'duel' ? 'normal' : 'duel')}>일기토</button>
                <button className="sg-cmd" onClick={() => { doWait(bs, mineSel); after(); }}>대기</button>
                <button className="sg-cmd" onClick={() => { doRetreat(bs, mineSel); setSel(null); after(); }}>퇴각</button>
              </div>
            )}
            {mineSel && mode === 'duel' && <p className="sg-muted">맞닿은 적 장수를 누르세요. 상대가 피할 수도 있습니다.</p>}
            {mineSel && mode === 'normal' && !mineSel.acted && <p className="sg-muted">초록 칸으로 이동, 붉은 테두리를 눌러 공격합니다.</p>}
            {unit && humanSide !== null && unit.side !== humanSide && mineSel === null && unit.officer && (
              <p className="sg-muted">일기토 거절 가능성은 상대 무력·지력에 따라 다릅니다.</p>
            )}
          </div>
        ) : (
          <p className="sg-muted">{humanSide !== null ? '움직일 부대를 누르세요.' : '상대가 움직이고 있습니다.'}</p>
        )}
        <div className="sg-bt-log">
          {bs.log.slice(-4).map((l, i) => <p key={bs.log.length - 4 + i}>{l}</p>)}
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
