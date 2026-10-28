import { memo } from 'react';
import type { TileType } from '../../engine/battlemap';
import { darken, lighten } from './util';

/** 전장 칸 무늬와 그림 기호. 한 번만 그려 두고 <use>로 재사용한다 */
export const BattleDefs = memo(function BattleDefs() {
  return (
    <defs>
      <pattern id="bt-grass" width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="#5f6d3a" />
        <path d="M3 8 l1 -4 M5 8 l-1 -3 M14 17 l1 -4 M16 17 l-1 -3 M18 6 l1 -3" stroke="#87934f" strokeWidth="1" />
        <path d="M9 14 l1 -3 M11 14 l-1 -2" stroke="#4b5730" strokeWidth="1" />
      </pattern>
      <pattern id="bt-road" width="18" height="18" patternUnits="userSpaceOnUse">
        <rect width="18" height="18" fill="#8d7550" />
        <circle cx="4" cy="5" r="1.2" fill="#6e5a3c" /><circle cx="12" cy="11" r="1" fill="#a68d64" /><circle cx="15" cy="3" r="0.8" fill="#6e5a3c" />
      </pattern>
      <pattern id="bt-forest" width="22" height="22" patternUnits="userSpaceOnUse">
        <rect width="22" height="22" fill="#3a5428" />
        <path d="M2 18 l2 -3 M15 6 l2 -3" stroke="#2a3f1c" strokeWidth="1" />
      </pattern>
      <pattern id="bt-hill" width="26" height="20" patternUnits="userSpaceOnUse">
        <rect width="26" height="20" fill="#7d7247" />
        <path d="M2 14 q6 -8 12 0 M14 8 q5 -6 10 0" stroke="#5f5532" strokeWidth="1.2" fill="none" />
      </pattern>
      <pattern id="bt-mountain" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#6d6455" />
        <path d="M0 20 l6 -6 l4 3" stroke="#4f483d" strokeWidth="1" fill="none" />
      </pattern>
      <pattern id="bt-peak" width="24" height="24" patternUnits="userSpaceOnUse">
        <rect width="24" height="24" fill="#5a5047" />
        <path d="M0 22 l5 -5 l3 2 M14 10 l4 -4 l3 3" stroke="#3e372f" strokeWidth="1" fill="none" />
      </pattern>
      <pattern id="bt-marsh" width="20" height="16" patternUnits="userSpaceOnUse">
        <rect width="20" height="16" fill="#4c5d42" />
        <path d="M2 12 h7 M11 6 h7" stroke="#6f8e88" strokeWidth="1.2" />
        <path d="M5 12 l-1 -6 M7 12 l1 -5 M14 6 l0 -5" stroke="#8c9a5a" strokeWidth="0.9" />
      </pattern>
      <pattern id="bt-water" width="30" height="14" patternUnits="userSpaceOnUse">
        <rect width="30" height="14" fill="#2c637f" />
        <path d="M0 8 q7.5 -5 15 0 t15 0" stroke="#5b95b0" strokeWidth="1.2" fill="none" />
        <path d="M-7 2 q7.5 -4 15 0 t15 0 t15 0" stroke="#3f7a96" strokeWidth="0.8" fill="none" />
      </pattern>
      <pattern id="bt-ford" width="20" height="14" patternUnits="userSpaceOnUse">
        <rect width="20" height="14" fill="#4f8aa3" />
        <circle cx="5" cy="5" r="1.8" fill="#9aa59a" /><circle cx="14" cy="10" r="1.4" fill="#9aa59a" />
        <path d="M0 10 q5 -3 10 0 t10 0" stroke="#86b5c8" strokeWidth="0.9" fill="none" />
      </pattern>
      <pattern id="bt-bridge" width="8" height="30" patternUnits="userSpaceOnUse">
        <rect width="8" height="30" fill="#8a6239" />
        <line x1="0.5" y1="0" x2="0.5" y2="30" stroke="#5b3e22" strokeWidth="1" />
      </pattern>
      <pattern id="bt-stone" width="20" height="12" patternUnits="userSpaceOnUse">
        <rect width="20" height="12" fill="#9d927d" />
        <path d="M0 6 h20 M0 12 h20 M6 0 v6 M16 0 v6 M1 6 v6 M11 6 v6" stroke="#6d6453" strokeWidth="1" />
      </pattern>
      <pattern id="bt-pave" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="#6c6150" />
        <path d="M0 8 h16 M8 0 v8 M4 8 v8 M12 8 v8" stroke="#5a5042" strokeWidth="0.8" />
      </pattern>
      <pattern id="bt-earth" width="18" height="10" patternUnits="userSpaceOnUse">
        <rect width="18" height="10" fill="#8a7a56" />
        <path d="M0 5 h18" stroke="#6e6042" strokeWidth="1" />
        <circle cx="5" cy="2.5" r="1.2" fill="#a9997a" /><circle cx="13" cy="7.5" r="1.2" fill="#a9997a" />
      </pattern>
      <pattern id="bt-rubble" width="16" height="16" patternUnits="userSpaceOnUse">
        <rect width="16" height="16" fill="#6a6152" />
        <path d="M2 5 l4 -2 l3 3 l-3 3 Z M10 12 l4 -2 l1 4 Z" fill="#9d927d" stroke="#4e463b" strokeWidth="0.6" />
      </pattern>

      <symbol id="bt-tree" viewBox="-7 -14 14 16" overflow="visible">
        <path d="M0 -13 C6 -11 7 -4 0 -3 C-7 -4 -6 -11 0 -13 Z" fill="#4d6e30" stroke="#22331a" strokeWidth="0.8" />
        <path d="M-2 -9 C0 -11 2 -10 3 -8" stroke="#6d9442" strokeWidth="1" fill="none" />
        <rect x="-0.8" y="-3.5" width="1.6" height="5" fill="#4a3320" />
      </symbol>
      <symbol id="bt-mtn" viewBox="-16 -16 32 20" overflow="visible">
        <path d="M-15 3 L-5 -11 L-1 -6 L5 -14 L15 3 Z" fill="#a49478" stroke="#3b342b" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M5 -14 L2 -6 L6 -2 M-5 -11 L-6 -4" stroke="#3b342b" strokeWidth="0.8" fill="none" />
        <path d="M5 -14 L15 3 L6 3 Z" fill="#000" opacity="0.18" />
      </symbol>
      <symbol id="bt-peak" viewBox="-18 -22 36 26" overflow="visible">
        <path d="M-17 4 L-7 -14 L-2 -8 L6 -21 L17 4 Z" fill="#9a8d7a" stroke="#1e1a16" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 -21 L2 -13 L5 -12 L9 -15 Z M-7 -14 L-9 -9 L-6 -9 Z" fill="#ebe7df" />
        <path d="M6 -21 L17 4 L7 4 Z" fill="#000" opacity="0.25" />
      </symbol>
      <symbol id="bt-house" viewBox="-8 -10 16 12" overflow="visible">
        <path d="M-7 -4 L0 -9 L7 -4 Z" fill="#7b3b26" stroke="#3a1c12" strokeWidth="0.7" />
        <rect x="-5.5" y="-4" width="11" height="6" fill="#d9c7a2" stroke="#3a1c12" strokeWidth="0.7" />
        <rect x="-1.4" y="-1.5" width="2.8" height="3.5" fill="#3a1c12" />
      </symbol>
      <symbol id="bt-gate" viewBox="-14 -14 28 28" overflow="visible">
        <rect x="-12" y="-11" width="24" height="22" fill="#7a4a26" stroke="#2f1c0e" strokeWidth="1.2" />
        <line x1="0" y1="-11" x2="0" y2="11" stroke="#2f1c0e" strokeWidth="1.2" />
        {[-7, 0, 7].map((y) => [-7, 7].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="#c9a13e" />))}
      </symbol>
      <symbol id="bt-pass" viewBox="-16 -18 32 30" overflow="visible">
        <rect x="-13" y="-4" width="26" height="14" fill="#8a5a32" stroke="#2f1c0e" strokeWidth="1.1" />
        <path d="M-3.5 10 L-3.5 3 Q0 0 3.5 3 L3.5 10 Z" fill="#2f1c0e" />
        <path d="M-16 -4 Q0 -14 16 -4 L13 -2 Q0 -9 -13 -2 Z" fill="#6b2a1c" stroke="#2f1c0e" strokeWidth="0.9" />
        <rect x="-6" y="-14" width="12" height="6" fill="#c9a882" stroke="#2f1c0e" strokeWidth="0.7" />
        <path d="M-9 -13 Q0 -19 9 -13 Z" fill="#6b2a1c" stroke="#2f1c0e" strokeWidth="0.7" />
      </symbol>
      <symbol id="bt-keep" viewBox="-18 -24 36 32" overflow="visible">
        <rect x="-14" y="-2" width="28" height="10" fill="#d8c49c" stroke="#2f1c0e" strokeWidth="1" />
        {[-10, -4, 2, 8].map((x) => <rect key={x} x={x} y="1" width="3" height="5" fill="#7a2a1c" />)}
        <path d="M-18 -2 Q0 -11 18 -2 L14 0 Q0 -6 -14 0 Z" fill="#8a2a1e" stroke="#2f1c0e" strokeWidth="0.9" />
        <rect x="-8" y="-12" width="16" height="7" fill="#e5d3ad" stroke="#2f1c0e" strokeWidth="0.8" />
        <path d="M-12 -11 Q0 -19 12 -11 L9 -9 Q0 -14 -9 -9 Z" fill="#8a2a1e" stroke="#2f1c0e" strokeWidth="0.8" />
        <line x1="0" y1="-18" x2="0" y2="-24" stroke="#c9a13e" strokeWidth="1.4" />
      </symbol>
      <symbol id="bt-dam" viewBox="-14 -8 28 14" overflow="visible">
        <path d="M-13 5 L-9 -5 L9 -5 L13 5 Z" fill="#a39373" stroke="#4e4430" strokeWidth="1" />
        <path d="M-9 -1 h18 M-11 3 h22" stroke="#6e6042" strokeWidth="0.8" />
      </symbol>
    </defs>
  );
});

export const TILE_FILL: Record<TileType, string> = {
  plain: 'url(#bt-grass)', road: 'url(#bt-road)', forest: 'url(#bt-forest)', hill: 'url(#bt-hill)', mountain: 'url(#bt-mountain)',
  peak: 'url(#bt-peak)', marsh: 'url(#bt-marsh)', water: 'url(#bt-water)', ford: 'url(#bt-ford)', bridge: 'url(#bt-bridge)',
  village: 'url(#bt-grass)', dam: 'url(#bt-earth)', wall: 'url(#bt-stone)', gate: 'url(#bt-stone)', pass: 'url(#bt-mountain)',
  inner: 'url(#bt-pave)', keep: 'url(#bt-pave)', breach: 'url(#bt-rubble)',
};

/** 칸 위에 얹는 그림 */
export function TileArt({ t, cx, cy, seed }: { t: TileType; cx: number; cy: number; seed: number }) {
  const j = (k: number) => ((seed * 9301 + k * 49297) % 233280) / 233280 - 0.5;
  switch (t) {
    case 'forest':
      return (
        <g pointerEvents="none">
          {[[-9, 2], [7, -2], [-1, 12], [10, 12]].map(([x, y], i) => (
            <use key={i} href="#bt-tree" x={cx + x + j(i) * 5 - 7} y={cy + y + j(i + 9) * 4 - 14} width="14" height="16" />
          ))}
        </g>
      );
    case 'mountain':
      return <use href="#bt-mtn" x={cx - 16 + j(1) * 4} y={cy - 10} width="32" height="20" pointerEvents="none" />;
    case 'peak':
      return <use href="#bt-peak" x={cx - 19} y={cy - 16} width="38" height="27" pointerEvents="none" />;
    case 'village':
      return (
        <g pointerEvents="none">
          <use href="#bt-house" x={cx - 14} y={cy - 8} width="16" height="12" />
          <use href="#bt-house" x={cx - 2} y={cy - 1} width="16" height="12" />
        </g>
      );
    case 'gate':
      return <use href="#bt-gate" x={cx - 11} y={cy - 11} width="22" height="22" pointerEvents="none" />;
    case 'pass':
      return <use href="#bt-pass" x={cx - 16} y={cy - 16} width="32" height="30" pointerEvents="none" />;
    case 'keep':
      return <use href="#bt-keep" x={cx - 18} y={cy - 18} width="36" height="32" pointerEvents="none" />;
    case 'dam':
      return <use href="#bt-dam" x={cx - 14} y={cy - 6} width="28" height="14" pointerEvents="none" />;
    case 'wall':
      return (
        <g pointerEvents="none">
          {[-12, -4, 4].map((x) => <rect key={x} x={cx + x} y={cy - 16} width="6" height="5" fill="#b3a88f" stroke="#5d5545" strokeWidth="0.6" />)}
        </g>
      );
    default:
      return null;
  }
}

/** 군기(旗) 부대 — 세력 색 깃발에 장수의 성을 쓴다 */
export function UnitBanner({ cx, cy, color, label, side, commander, ratio, troops }: {
  cx: number; cy: number; color: string; label: string; side: 0 | 1; commander: boolean; ratio: number; troops: number;
}) {
  const men = troops >= 6000 ? 3 : troops >= 2500 ? 2 : 1;
  const ring = side === 0 ? '#ffb19e' : '#9fc8ff';
  const two = label.length > 1;
  return (
    <g pointerEvents="none">
      <ellipse cx={cx} cy={cy + 15} rx="17" ry="5" fill="#000" opacity="0.35" />
      <ellipse cx={cx} cy={cy + 14} rx="15" ry="4.5" fill="none" stroke={ring} strokeWidth="2" opacity="0.9" />
      {/* 병사 */}
      {Array.from({ length: men }, (_, i) => {
        const x = cx - 10 + i * 9;
        return (
          <g key={i}>
            <line x1={x + 3} y1={cy + 12} x2={x + 5} y2={cy - 4} stroke="#2a2420" strokeWidth="1" />
            <path d={`M${x - 2.5} ${cy + 13} L${x - 1.8} ${cy + 5} L${x + 1.8} ${cy + 5} L${x + 2.5} ${cy + 13} Z`} fill={darken(color, 0.45)} />
            <circle cx={x} cy={cy + 3} r="2.3" fill="#d9b48d" />
          </g>
        );
      })}
      {/* 깃대와 깃발 */}
      <line x1={cx - 12} y1={cy + 12} x2={cx - 12} y2={cy - 22} stroke="#3a2414" strokeWidth="1.8" />
      {commander && <circle cx={cx - 12} cy={cy - 23} r="2.4" fill="#e7c25a" stroke="#6d531a" strokeWidth="0.6" />}
      <path d={`M${cx - 11} ${cy - 21} L${cx + 13} ${cy - 21} L${cx + 13} ${cy + 1} L${cx + 6} ${cy - 3} L${cx - 1} ${cy + 1} L${cx - 11} ${cy - 2} Z`}
        fill={color} stroke={darken(color, 0.5)} strokeWidth="1" className="sg-ubanner" />
      <path d={`M${cx - 11} ${cy - 21} L${cx + 13} ${cy - 21}`} stroke={lighten(color, 0.45)} strokeWidth="2" />
      <text x={cx + 1} y={cy - (two ? 8 : 5)} className={`sg-ubanner-txt ${two ? 'two' : ''}`}>{label}</text>
      {/* 병력 띠 */}
      <rect x={cx - 16} y={cy + 18} width="32" height="4" rx="1" fill="rgba(0,0,0,0.65)" />
      <rect x={cx - 16} y={cy + 18} width={32 * Math.max(0, Math.min(1, ratio))} height="4" rx="1" fill={ratio > 0.5 ? '#8be08f' : ratio > 0.25 ? '#e8c25a' : '#ef7d6b'} />
    </g>
  );
}
