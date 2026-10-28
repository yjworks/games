import { ReactNode, useEffect } from 'react';
import { def, STAT_NAMES, statsOf, rankOf, RANKS, traitsOf } from '../engine/officers';
import type { GameState } from '../engine/state';

export function Sheet({ title, onClose, children, wide, foot }: {
  title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; foot?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sg-overlay" onClick={onClose}>
      <div className={`sg-sheet ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sg-sheet-head">
          <h2>{title}</h2>
          <button className="sg-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="sg-sheet-body">{children}</div>
        {foot && <div className="sg-sheet-foot">{foot}</div>}
      </div>
    </div>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span className="sg-dot" style={{ background: color, width: size, height: size }} />;
}

export function Bar({ v, max = 100, color }: { v: number; max?: number; color?: string }) {
  const p = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
  return <span className="sg-bar"><span style={{ width: `${p}%`, background: color }} /></span>;
}

/** 능력치 다섯 칸 — hi는 강조할 능력치 번호 */
export function StatCells({ s, id, hi }: { s: GameState | null; id: string; hi?: number }) {
  const st = s ? statsOf(s, id) : def(id).stats;
  return (
    <span className="sg-stats">
      {st.map((v, i) => (
        <span key={i} className={`sg-stat ${hi === i ? 'hi' : ''} ${v >= 90 ? 'top' : v >= 75 ? 'good' : v < 40 ? 'low' : ''}`} title={STAT_NAMES[i]}>
          {v}
        </span>
      ))}
    </span>
  );
}

export function StatHeader() {
  return (
    <span className="sg-stats head">
      {STAT_NAMES.map((n) => <span key={n} className="sg-stat">{n.slice(0, 1)}</span>)}
    </span>
  );
}

export function OfficerLine({ s, id, hi, right, onClick, dim, sel }: {
  s: GameState; id: string; hi?: number; right?: ReactNode; onClick?: () => void; dim?: boolean; sel?: boolean;
}) {
  const o = s.officers[id];
  const d = def(id);
  const tr = traitsOf(s, id);
  const isRuler = o && o.faction >= 0 && s.factions[o.faction]?.ruler === id;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`sg-oline ${dim ? 'dim' : ''} ${sel ? 'sel' : ''}`} onClick={onClick}>
      <span className="sg-oname">
        <strong>{d.name}</strong>
        {isRuler && <em className="sg-tag ruler">군주</em>}
        {o?.status === 'serving' && !isRuler && <em className="sg-tag">{RANKS[rankOf(o)]}</em>}
        {tr.length > 0 && <small>{tr.join('·')}</small>}
      </span>
      <StatCells s={s} id={id} hi={hi} />
      {right !== undefined && <span className="sg-oright">{right}</span>}
    </Tag>
  );
}

export function Slider({ label, value, min, max, step = 100, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string;
}) {
  return (
    <label className="sg-slider">
      <span>{label}</span>
      <input type="range" min={min} max={Math.max(min, max)} step={step} value={Math.min(value, max)}
        onChange={(e) => onChange(Number(e.target.value))} disabled={max <= min} />
      <strong>{Math.min(value, max).toLocaleString('ko-KR')}{unit}</strong>
    </label>
  );
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;
