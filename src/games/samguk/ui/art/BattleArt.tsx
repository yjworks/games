import { KINDS, type UnitKind } from '../../engine/units';
import { darken, lighten } from './util';

/** 병종별 병사 그림 — 기준점(x, y)은 발밑. s는 크기 배율 */
function Soldier({ x, y, kind, color, s = 1 }: { x: number; y: number; kind: UnitKind; color: string; s?: number }) {
  const body = darken(color, 0.4);
  const trim = lighten(color, 0.25);
  const skin = '#dcb58c';
  const ink = '#1d150e';
  const steel = '#c9ced6';
  const t = `translate(${x} ${y}) scale(${s})`;
  switch (kind) {
    case '기병':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0.5" rx="10" ry="2" fill="#000" opacity="0.3" />
          {/* 말 */}
          <path d="M-9 -7 Q-2 -11 6 -8 L9 -13 Q11 -14 12.5 -12 L11 -9 Q10 -6 8 -5 Q2 -3 -7 -4 Q-10 -5 -9 -7 Z" fill="#6b4529" stroke={ink} strokeWidth="0.7" />
          <path d="M9 -13 L8 -15 L10 -14 Z M-9 -7 Q-12 -5 -12 -1" fill="#3a2414" stroke="#3a2414" strokeWidth="1" />
          {[-6, -3, 3, 6].map((dx, i) => <line key={dx} x1={dx} y1={-4.5} x2={dx + (i % 2 ? 1.5 : -1.5)} y2={0} stroke={ink} strokeWidth="1.2" />)}
          <path d="M-3 -9 L4 -9 L3 -7 L-2 -7 Z" fill={color} stroke={ink} strokeWidth="0.4" />
          {/* 기수 */}
          <path d="M-2 -9 L-1.5 -15.5 L2 -15.5 L2.5 -9 Z" fill={body} stroke={ink} strokeWidth="0.5" />
          <circle cx="0.4" cy="-17.6" r="2.1" fill={skin} stroke={ink} strokeWidth="0.4" />
          <path d="M-1.8 -18.4 Q0.4 -21.4 2.6 -18.4 Z" fill={steel} stroke={ink} strokeWidth="0.4" />
          <line x1="2" y1="-14" x2="13" y2="-24" stroke={ink} strokeWidth="1" />
          <path d="M13 -24 l2.2 -1.6 l-0.8 2.6 Z" fill={steel} />
          <path d="M12 -23 l2 2.5" stroke={trim} strokeWidth="1.4" />
        </g>
      );
    case '수군':
      return (
        <g transform={t}>
          <path d="M-11 -4 L11 -4 Q10 1 0 1.5 Q-10 1 -11 -4 Z" fill="#7a5530" stroke={ink} strokeWidth="0.7" />
          <path d="M-11 -4 L11 -4" stroke="#c9a13e" strokeWidth="0.8" />
          <line x1="-7" y1="-3" x2="-12" y2="2" stroke={ink} strokeWidth="1" />
          <line x1="6" y1="-3" x2="11" y2="2" stroke={ink} strokeWidth="1" />
          {[-4, 3].map((dx) => (
            <g key={dx}>
              <path d={`M${dx - 2} -4 L${dx - 1.5} -10 L${dx + 1.5} -10 L${dx + 2} -4 Z`} fill={body} stroke={ink} strokeWidth="0.4" />
              <circle cx={dx} cy={-11.8} r="1.9" fill={skin} stroke={ink} strokeWidth="0.4" />
            </g>
          ))}
        </g>
      );
    case '공성':
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0.5" rx="13" ry="2.4" fill="#000" opacity="0.3" />
          <rect x="-11" y="-11" width="22" height="7" fill="#7a5530" stroke={ink} strokeWidth="0.8" />
          <path d="M-12 -11 L0 -18 L12 -11 Z" fill="#5a3a22" stroke={ink} strokeWidth="0.8" />
          <path d="M-9 -11 L0 -16 L9 -11" fill="none" stroke="#a07a4a" strokeWidth="0.6" />
          <line x1="-16" y1="-7.5" x2="13" y2="-7.5" stroke="#3a2a1a" strokeWidth="2.6" />
          <path d="M-16 -9.5 L-19 -7.5 L-16 -5.5 Z" fill={steel} stroke={ink} strokeWidth="0.5" />
          {[-7, 0, 7].map((dx) => <circle key={dx} cx={dx} cy={-2} r="2.6" fill="#3a2a1a" stroke="#8a6a40" strokeWidth="0.6" />)}
        </g>
      );
    default: {
      const weapon = kind === '창병'
        ? <g><line x1="2" y1="-3" x2="9" y2="-25" stroke={ink} strokeWidth="1.1" /><path d="M9 -25 l1.4 -3.2 l0.6 3.6 Z" fill={steel} /><path d="M8.6 -23 l1.8 1" stroke={trim} strokeWidth="1.2" /></g>
        : kind === '궁병'
          ? <g><path d="M4 -17 Q10 -11 4 -4" stroke={ink} strokeWidth="1.2" fill="none" /><line x1="4" y1="-17" x2="4" y2="-4" stroke="#d8cfb8" strokeWidth="0.4" /><rect x="-5" y="-14" width="2.2" height="7" fill="#6b4a2a" transform="rotate(-12 -4 -10)" /></g>
          : kind === '노병'
            ? <g><line x1="-1" y1="-11" x2="9" y2="-11" stroke="#5a3a1a" strokeWidth="1.8" /><path d="M8 -15 Q10.5 -11 8 -7" stroke={ink} strokeWidth="1.1" fill="none" /></g>
            : <g><line x1="3" y1="-7" x2="7" y2="-18" stroke={steel} strokeWidth="1.2" /><line x1="1.6" y1="-8" x2="4.4" y2="-7" stroke={ink} strokeWidth="1" /><ellipse cx="-3.6" cy="-8.5" rx="3" ry="3.8" fill={darken(color, 0.15)} stroke={ink} strokeWidth="0.6" /><circle cx="-3.6" cy="-8.5" r="0.9" fill="#c9a13e" /></g>;
      return (
        <g transform={t}>
          <ellipse cx="0" cy="0.4" rx="5" ry="1.4" fill="#000" opacity="0.3" />
          <path d="M-1.6 0 L-1.4 -4 M1.6 0 L1.4 -4" stroke={ink} strokeWidth="1.2" />
          <path d="M-3 -3.5 L-2.2 -11 L2.2 -11 L3 -3.5 Z" fill={body} stroke={ink} strokeWidth="0.5" />
          <path d="M-2.4 -9 L2.4 -9" stroke={trim} strokeWidth="1" />
          <circle cx="0" cy="-13" r="2.4" fill={skin} stroke={ink} strokeWidth="0.4" />
          <path d="M-2.6 -13.6 Q0 -17.2 2.6 -13.6 Z" fill={kind === '궁병' || kind === '노병' ? '#3a2a1a' : steel} stroke={ink} strokeWidth="0.4" />
          {weapon}
        </g>
      );
    }
  }
}

/** 군기(旗) 부대 — 세력 색 깃발에 장수의 성을 쓰고, 병력에 맞춰 병종 병사를 세운다 */
export function UnitBanner({ cx, cy, color, label, side, commander, ratio, troops, kind = '보병' }: {
  cx: number; cy: number; color: string; label: string; side: 0 | 1; commander: boolean; ratio: number; troops: number; kind?: UnitKind;
}) {
  const men = kind === '공성' ? 1 : kind === '기병' || kind === '수군' ? (troops >= 5000 ? 2 : 1) + (troops >= 9000 ? 1 : 0) : troops >= 7000 ? 4 : troops >= 4000 ? 3 : troops >= 1500 ? 2 : 1;
  const ring = side === 0 ? '#ff9a85' : '#8fbaff';
  const two = label.length > 1;
  const spots: [number, number][] = kind === '기병' || kind === '수군'
    ? [[2, 15], [-9, 9], [12, 8]]
    : [[0, 16], [-9, 12], [9, 12], [-1, 7]];
  return (
    <g pointerEvents="none">
      <ellipse cx={cx} cy={cy + 15} rx="22" ry="6.5" fill="#000" opacity="0.38" />
      <ellipse cx={cx} cy={cy + 14} rx="20" ry="5.6" fill={color} opacity="0.28" />
      <ellipse cx={cx} cy={cy + 14} rx="20" ry="5.6" fill="none" stroke={ring} strokeWidth="2.2" opacity="0.95" />
      {spots.slice(0, men).sort((a, b) => a[1] - b[1]).map(([dx, dy], i) => (
        <Soldier key={i} x={cx + dx + 3} y={cy + dy} kind={kind} color={color} s={kind === '공성' ? 1.05 : 1.08} />
      ))}
      {/* 깃대와 깃발 */}
      <line x1={cx - 14} y1={cy + 14} x2={cx - 14} y2={cy - 26} stroke="#2a1a0c" strokeWidth="2" />
      <circle cx={cx - 14} cy={cy - 27} r={commander ? 3 : 2} fill="#e7c25a" stroke="#6d531a" strokeWidth="0.6" />
      {commander && <path d={`M${cx - 14} ${cy - 30} l-3 -6 l3 2 l3 -2 Z`} fill="#c83a2e" />}
      <g className="sg-ubanner">
        <path d={`M${cx - 13} ${cy - 25} L${cx + 12} ${cy - 25} L${cx + 12} ${cy - 2} L${cx + 6} ${cy - 6} L${cx - 1} ${cy - 2} L${cx - 13} ${cy - 5} Z`}
          fill={color} stroke={darken(color, 0.55)} strokeWidth="1" />
        <path d={`M${cx - 13} ${cy - 25} L${cx + 12} ${cy - 25} L${cx + 12} ${cy - 21} L${cx - 13} ${cy - 21} Z`} fill={lighten(color, 0.4)} opacity="0.85" />
        <path d={`M${cx + 12} ${cy - 25} l4 2 l-4 2 Z M${cx + 12} ${cy - 17} l4 2 l-4 2 Z M${cx + 12} ${cy - 9} l4 2 l-4 2 Z`} fill={darken(color, 0.3)} />
        <text x={cx - 0.5} y={cy - (two ? 10.5 : 7.5)} className={`sg-ubanner-txt ${two ? 'two' : ''}`}>{label}</text>
      </g>
      {/* 병종 표 */}
      <circle cx={cx + 15} cy={cy + 2} r="6" fill="#f1e4c3" stroke="#3a2614" strokeWidth="1" />
      <text x={cx + 15} y={cy + 5.2} className="sg-ukind">{KINDS[kind].hanja}</text>
      {/* 병력 띠 */}
      <rect x={cx - 18} y={cy + 21} width="36" height="4.6" rx="1" fill="rgba(0,0,0,0.7)" stroke="rgba(244,220,152,0.4)" strokeWidth="0.5" />
      <rect x={cx - 17.5} y={cy + 21.5} width={35 * Math.max(0, Math.min(1, ratio))} height="3.6" rx="0.8" fill={ratio > 0.5 ? '#8be08f' : ratio > 0.25 ? '#e8c25a' : '#ef7d6b'} />
    </g>
  );
}
