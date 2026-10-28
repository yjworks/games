import { memo } from 'react';
import { CITY_BY_ID } from '../../data/cities';
import type { CityId } from '../../data/types';
import { darken, hashStr, lighten, seeded } from './util';
import { seasonOf } from '../labels';

/**
 * 도시 그림 — 도시 창 머리에 까는 320×112 풍경. 땅 성격(들·강·산·구릉·늪)과 크기, 계절, 주인 색으로 그린다.
 */
export const CityScene = memo(function CityScene({ city, color, month, capital }: { city: CityId; color: string; month: number; capital: boolean }) {
  const cd = CITY_BY_ID[city];
  const rnd = seeded(hashStr(city));
  const winter = seasonOf(month) === 'winter';
  const autumn = seasonOf(month) === 'autumn';
  const big = capital ? 3 : cd.pop >= 60 ? 2 : cd.pop >= 25 ? 1 : 0;
  const uid = `cs-${city}`;
  const sky = winter ? ['#c9d2d6', '#eef0ea'] : autumn ? ['#e7b979', '#f6e4bc'] : ['#a9c3c9', '#efe4c4'];
  const far = winter ? '#9aa6ab' : '#7d8a86';
  const near = winter ? '#e9ece6' : autumn ? '#a98a4a' : '#7f8f55';
  const ground = winter ? '#f2f3ee' : autumn ? '#c2a061' : '#9aa765';
  const ridge = (y: number, amp: number, seed: number) => {
    const r2 = seeded(seed);
    let d = `M0 112 L0 ${y}`;
    for (let x = 0; x <= 320; x += 20) d += ` L${x} ${y - amp * (0.4 + r2())}`;
    return `${d} L320 112 Z`;
  };
  const mountainous = cd.land === 'mountain' || cd.land === 'hill';
  const cx = 150 + rnd() * 30;
  const w = [46, 64, 86, 104][big];
  const wallY = 84;
  const wallH = [12, 15, 18, 20][big];
  return (
    <svg viewBox="0 0 320 112" className="sg-cityscene" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
        <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9dcbc" />
          <stop offset="1" stopColor="#a8936c" />
        </linearGradient>
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#140d07" stopOpacity="0" />
          <stop offset="1" stopColor="#140d07" stopOpacity="0.75" />
        </linearGradient>
        <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>
      <rect width="320" height="112" fill={`url(#${uid}-sky)`} />
      {!winter && <circle cx={260 - rnd() * 40} cy={22} r={9} fill={autumn ? '#f6d08a' : '#fbf3d8'} opacity="0.85" />}
      <path d={ridge(mountainous ? 46 : 62, mountainous ? 30 : 12, hashStr(city + 'f'))} fill={far} opacity="0.55" filter={`url(#${uid}-soft)`} />
      {winter && <path d={ridge(mountainous ? 46 : 62, mountainous ? 30 : 12, hashStr(city + 'f'))} fill="#fff" opacity="0.35" />}
      <path d={ridge(mountainous ? 64 : 74, mountainous ? 22 : 8, hashStr(city + 'n'))} fill={near} opacity="0.85" />
      <rect y="80" width="320" height="32" fill={ground} />
      {cd.land === 'river' && <path d="M0 98 C70 90 120 104 190 96 S290 92 320 98 L320 112 L0 112 Z" fill="#6f9aa6" opacity="0.9" />}
      {cd.land === 'river' && <path d="M0 101 C70 94 120 107 190 99 S290 95 320 101" stroke="#d7e6e4" strokeWidth="1" fill="none" opacity="0.7" />}
      {cd.land === 'marsh' && Array.from({ length: 16 }, (_, i) => (
        <g key={i}>
          <ellipse cx={(i * 47) % 320} cy={96 + (i % 3) * 5} rx={16} ry={2.4} fill="#7fa0a0" opacity="0.7" />
          <path d={`M${(i * 47) % 320 + 4} ${96 + (i % 3) * 5} l-1 -8 M${(i * 47) % 320 + 7} ${96 + (i % 3) * 5} l1 -7`} stroke="#58603a" strokeWidth="1" />
        </g>
      ))}
      {cd.land === 'plain' && Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${i * 60 - 20} 112 L${i * 60 + 10} 86`} stroke={darken(ground, 0.12)} strokeWidth="6" opacity="0.4" />
      ))}
      {/* 나무 */}
      {Array.from({ length: 7 }, (_, i) => {
        const x = (i < 3 ? 14 + i * 26 : 230 + (i - 3) * 24) + rnd() * 8;
        const y = 84 + rnd() * 6;
        return (
          <g key={i}>
            <rect x={x - 0.8} y={y - 4} width="1.6" height="6" fill="#3a2814" />
            <ellipse cx={x} cy={y - 8} rx="5" ry="7" fill={winter ? '#d9ded8' : autumn ? (i % 2 ? '#b5612e' : '#c88b34') : '#4f6a34'} stroke="#2a2214" strokeWidth="0.6" />
          </g>
        );
      })}
      {/* 성 */}
      <g transform={`translate(${cx} 0)`}>
        <rect x={-w / 2} y={wallY - wallH} width={w} height={wallH} fill={`url(#${uid}-wall)`} stroke="#2f2112" strokeWidth="1" />
        {Array.from({ length: Math.floor(w / 6) }, (_, i) => (
          <rect key={i} x={-w / 2 + i * 6 + 1} y={wallY - wallH - 3} width="3.2" height="3" fill="#ddcca6" stroke="#2f2112" strokeWidth="0.5" />
        ))}
        <path d={`M-5 ${wallY} L-5 ${wallY - 8} Q0 ${wallY - 12} 5 ${wallY - 8} L5 ${wallY} Z`} fill="#2a1a0e" />
        {/* 문루 */}
        <rect x={-10} y={wallY - wallH - 11} width="20" height="9" fill="#d8c59c" stroke="#2f2112" strokeWidth="0.8" />
        {[-6, -2, 2, 6].map((x) => <rect key={x} x={x - 0.7} y={wallY - wallH - 9} width="1.4" height="5" fill="#7a2a1c" />)}
        <path d={`M-16 ${wallY - wallH - 10} Q0 ${wallY - wallH - 21} 16 ${wallY - wallH - 10} L12 ${wallY - wallH - 8} Q0 ${wallY - wallH - 15} -12 ${wallY - wallH - 8} Z`}
          fill={big >= 2 ? '#8a2a1e' : '#3e4a4c'} stroke="#1d120a" strokeWidth="0.7" />
        {big >= 1 && [-1, 1].map((sd) => (
          <g key={sd} transform={`translate(${sd * (w / 2 - 4)} 0)`}>
            <rect x={-5} y={wallY - wallH - 8} width="10" height="8" fill="#d8c59c" stroke="#2f2112" strokeWidth="0.7" />
            <path d={`M-8 ${wallY - wallH - 7.5} L0 ${wallY - wallH - 14} L8 ${wallY - wallH - 7.5} Z`} fill="#3e4a4c" stroke="#1d120a" strokeWidth="0.6" />
          </g>
        ))}
        {big >= 2 && (
          <g>
            <rect x={-8} y={wallY - wallH - 26} width="16" height="7" fill="#e4d3ac" stroke="#2f2112" strokeWidth="0.7" />
            <path d={`M-13 ${wallY - wallH - 25} Q0 ${wallY - wallH - 35} 13 ${wallY - wallH - 25} L10 ${wallY - wallH - 23} Q0 ${wallY - wallH - 30} -10 ${wallY - wallH - 23} Z`}
              fill={capital ? '#c9a13e' : '#8a2a1e'} stroke="#1d120a" strokeWidth="0.7" />
          </g>
        )}
        {/* 깃발 */}
        {[-w / 2 + 3, w / 2 - 3].map((x, i) => (
          <g key={i} transform={`translate(${x} ${wallY - wallH - 2})`}>
            <line x1="0" y1="0" x2="0" y2="-22" stroke="#2b1d12" strokeWidth="1.1" />
            <path d="M0 -22 C5 -24 9 -20 14 -22 L14 -13 C9 -11 5 -15 0 -13 Z" fill={color} stroke={darken(color, 0.5)} strokeWidth="0.6" className="sg-flag" />
          </g>
        ))}
      </g>
      {winter && Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 83) % 320} cy={(i * 29) % 100} r="0.9" fill="#fff" opacity="0.85" />)}
      <rect width="320" height="112" fill={`url(#${uid}-fade)`} />
      <rect width="320" height="112" fill="none" stroke={lighten(color, 0.1)} strokeWidth="0" />
    </svg>
  );
});
