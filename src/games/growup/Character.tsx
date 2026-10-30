import { HAIR_COLORS } from './data';
import type { Expression } from './engine';
import { Look, Stage } from './types';

interface Props {
  look: Look;
  stage: Stage;
  expr: Expression;
  size?: number;
  className?: string;
}

const SKIN = '#ffd9bf';
const SKIN_SHADE = '#f2bfa0';
const INK = '#2a2230';

/** 단계별 머리·몸 비율 — 자랄수록 머리가 작아지고 몸이 길어진다 */
const BODY = [
  { r: 30, cy: 52, w: 58, shirt: '#f6c445', trim: '#e0a92a' },
  { r: 27, cy: 46, w: 62, shirt: '#34497e', trim: '#f4f4f8' },
  { r: 25, cy: 42, w: 66, shirt: '#2f5c4c', trim: '#f4f4f8' },
] as const;

/** 코드로 그리는 아이 — 상반신만 그린다(120×140) */
export function Character({ look, stage, expr, size = 120, className }: Props) {
  const { r, cy, w, shirt, trim } = BODY[stage];
  const cx = 60;
  const hair = HAIR_COLORS[look.hair % HAIR_COLORS.length];
  const top = cy + r - 2;
  const ex = r * 0.38;
  const ey = cy + r * 0.12;
  const my = cy + r * 0.5;

  return (
    <svg className={className} viewBox="0 0 120 140" width={size} height={size * 140 / 120}
      role="img" aria-label="캐릭터" focusable="false">
      {/* 긴 머리는 몸 뒤로 */}
      {look.style === 1 && (
        <rect x={cx - r - 4} y={cy - r * 0.3} width={2 * r + 8} height={r * 1.75} rx={r * 0.6} fill={hair} />
      )}
      {look.style === 2 && (
        <g>
          <ellipse cx={cx + r * 0.98} cy={cy - r * 0.15} rx={r * 0.32} ry={r * 0.6} fill={hair}
            transform={`rotate(-18 ${cx + r * 0.98} ${cy - r * 0.15})`} />
          <circle cx={cx + r * 0.78} cy={cy - r * 0.62} r={3.2} fill="#ff6b8a" />
        </g>
      )}

      {/* 몸 */}
      <rect x={cx - 7} y={top - 6} width="14" height="12" fill={SKIN_SHADE} />
      <path d={`M ${cx - w / 2} 140 L ${cx - w / 2} ${top + 14} Q ${cx - w / 2} ${top + 2} ${cx - w / 2 + 12} ${top + 2}
        L ${cx + w / 2 - 12} ${top + 2} Q ${cx + w / 2} ${top + 2} ${cx + w / 2} ${top + 14} L ${cx + w / 2} 140 Z`} fill={shirt} />
      {stage === 0 ? (
        <path d={`M ${cx - 9} ${top + 2} Q ${cx} ${top + 11} ${cx + 9} ${top + 2}`} fill="none" stroke={trim} strokeWidth="3" />
      ) : (
        <>
          {/* 교복 깃 */}
          <path d={`M ${cx - 12} ${top + 2} L ${cx} ${top + 18} L ${cx + 12} ${top + 2} Z`} fill={trim} />
          <path d={`M ${cx - 3} ${top + 8} L ${cx + 3} ${top + 8} L ${cx + 4} ${top + 30} L ${cx} ${top + 34} L ${cx - 4} ${top + 30} Z`}
            fill={stage === 1 ? '#c9403f' : '#d9a53c'} />
          <path d={`M ${cx - 20} ${top + 2} L ${cx - 4} ${top + 40} M ${cx + 20} ${top + 2} L ${cx + 4} ${top + 40}`}
            stroke="rgba(0,0,0,0.25)" strokeWidth="2" fill="none" />
        </>
      )}

      {/* 귀와 얼굴 */}
      <circle cx={cx - r} cy={cy + 3} r={r * 0.2} fill={SKIN_SHADE} />
      <circle cx={cx + r} cy={cy + 3} r={r * 0.2} fill={SKIN_SHADE} />
      <circle cx={cx} cy={cy} r={r} fill={expr === 'sick' ? '#f6d8c8' : SKIN} />

      {/* 앞머리 */}
      <path d={`M ${cx - r - 2} ${cy + 4}
        C ${cx - r - 2} ${cy - r * 1.42}, ${cx + r + 2} ${cy - r * 1.42}, ${cx + r + 2} ${cy + 4}
        C ${cx + r * 0.72} ${cy - r * 0.42}, ${cx + r * 0.2} ${cy - r * 0.6}, ${cx - r * 0.05} ${cy - r * 0.32}
        C ${cx - r * 0.35} ${cy - r * 0.62}, ${cx - r * 0.8} ${cy - r * 0.4}, ${cx - r - 2} ${cy + 4} Z`} fill={hair} />

      {/* 볼 */}
      <ellipse cx={cx - r * 0.6} cy={cy + r * 0.42} rx={r * 0.16} ry={r * 0.1}
        fill={expr === 'sick' ? '#ff6b6b' : '#ff9aa8'} opacity={expr === 'sick' ? 0.8 : 0.55} />
      <ellipse cx={cx + r * 0.6} cy={cy + r * 0.42} rx={r * 0.16} ry={r * 0.1}
        fill={expr === 'sick' ? '#ff6b6b' : '#ff9aa8'} opacity={expr === 'sick' ? 0.8 : 0.55} />

      <Face cx={cx} ex={ex} ey={ey} my={my} r={r} expr={expr} />
    </svg>
  );
}

function Face({ cx, ex, ey, my, r, expr }: { cx: number; ex: number; ey: number; my: number; r: number; expr: Expression }) {
  const eyes = [cx - ex, cx + ex];
  const stroke = { stroke: INK, strokeWidth: 2.2, strokeLinecap: 'round' as const, fill: 'none' };
  switch (expr) {
    case 'happy':
      return (
        <g>
          {eyes.map((x) => <path key={x} d={`M ${x - 4} ${ey + 1} Q ${x} ${ey - 5} ${x + 4} ${ey + 1}`} {...stroke} />)}
          <path d={`M ${cx - 7} ${my - 2} Q ${cx} ${my + 9} ${cx + 7} ${my - 2} Z`} fill="#c94a5a" />
        </g>
      );
    case 'tired':
      return (
        <g>
          {eyes.map((x) => <path key={x} d={`M ${x - 4} ${ey + 1} Q ${x} ${ey + 3} ${x + 4} ${ey + 1}`} {...stroke} />)}
          <path d={`M ${cx - 4} ${my + 1} L ${cx + 4} ${my + 1}`} {...stroke} />
          <path d={`M ${cx + r * 0.75} ${ey - r * 0.35} q 3 5 0 7 q -3 -2 0 -7 Z`} fill="#8fd0ff" />
        </g>
      );
    case 'sad':
      return (
        <g>
          {eyes.map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy={ey} rx={2.6} ry={3.2} fill={INK} />
              <path d={i === 0 ? `M ${x - 4} ${ey - 6} L ${x + 3} ${ey - 8}` : `M ${x - 3} ${ey - 8} L ${x + 4} ${ey - 6}`} {...stroke} strokeWidth={1.8} />
            </g>
          ))}
          <path d={`M ${cx - 5} ${my + 3} Q ${cx} ${my - 2} ${cx + 5} ${my + 3}`} {...stroke} />
        </g>
      );
    case 'sick':
      return (
        <g>
          <path d={`M ${eyes[0] - 3} ${ey - 3} L ${eyes[0] + 2} ${ey} L ${eyes[0] - 3} ${ey + 3}`} {...stroke} />
          <path d={`M ${eyes[1] + 3} ${ey - 3} L ${eyes[1] - 2} ${ey} L ${eyes[1] + 3} ${ey + 3}`} {...stroke} />
          <path d={`M ${cx - 6} ${my + 1} q 2 -3 4 0 q 2 3 4 0 q 2 -3 4 0`} {...stroke} strokeWidth={1.8} />
          <rect x={cx - r * 0.7} y={ey - r * 0.75} width={r * 1.4} height={r * 0.28} rx={3} fill="#e8f4ff" opacity="0.9" />
        </g>
      );
    default:
      return (
        <g>
          {eyes.map((x) => (
            <g key={x}>
              <ellipse cx={x} cy={ey} rx={2.7} ry={3.5} fill={INK} />
              <circle cx={x + 0.9} cy={ey - 1.2} r={0.9} fill="#fff" />
            </g>
          ))}
          <path d={`M ${cx - 5} ${my} Q ${cx} ${my + 4} ${cx + 5} ${my}`} {...stroke} />
        </g>
      );
  }
}
