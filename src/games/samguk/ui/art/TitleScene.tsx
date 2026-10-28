import { memo } from 'react';
import { seeded } from './util';

/** 산 능선 — 결정적 잡음으로 만든 꺾은선 */
function ridge(seed: number, y0: number, amp: number, w = 1600, step = 40, base = 900): string {
  const rnd = seeded(seed);
  let d = `M0 ${base} L0 ${y0}`;
  let y = y0;
  for (let x = 0; x <= w + step; x += step) {
    y = y0 + (rnd() - 0.5) * amp + Math.sin(x / (200 + seed * 7)) * amp * 0.6;
    const cx = x - step / 2;
    d += ` Q${cx} ${y - amp * 0.35 * rnd()} ${x} ${y}`;
  }
  return `${d} L${w} ${base} Z`;
}

const FLAGS = ['#3f74e0', '#2fa35a', '#d9453a'];

/** 표제 화면 그림: 노을 하늘, 겹산과 안개, 산 위의 성, 강, 능선을 지나는 깃발 행렬 */
export const TitleScene = memo(function TitleScene() {
  const marchers = Array.from({ length: 34 }, (_, i) => i);
  return (
    <svg className="sg-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="ts-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120e1f" />
          <stop offset="0.38" stopColor="#3a2236" />
          <stop offset="0.62" stopColor="#8a4535" />
          <stop offset="0.78" stopColor="#d9894a" />
          <stop offset="1" stopColor="#f0c27a" />
        </linearGradient>
        <radialGradient id="ts-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1c9" />
          <stop offset="0.55" stopColor="#f6cf86" />
          <stop offset="1" stopColor="#f6cf86" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ts-fog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9b58a" stopOpacity="0" />
          <stop offset="1" stopColor="#e9b58a" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="ts-river" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f3c98a" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#fbe3b0" stopOpacity="0.85" />
          <stop offset="1" stopColor="#f3c98a" stopOpacity="0.2" />
        </linearGradient>
        <filter id="ts-blur"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <rect width="1600" height="900" fill="url(#ts-sky)" />
      {/* 해와 노을 구름 */}
      <circle cx="1130" cy="430" r="230" fill="url(#ts-sun)" opacity="0.65" />
      <circle cx="1130" cy="430" r="92" fill="#fbe7bd" />
      <g className="sg-clouds" filter="url(#ts-blur)" opacity="0.75">
        <ellipse cx="300" cy="250" rx="260" ry="22" fill="#6b3a46" />
        <ellipse cx="900" cy="330" rx="340" ry="18" fill="#a2554a" />
        <ellipse cx="1350" cy="220" rx="240" ry="16" fill="#5a3243" />
        <ellipse cx="620" cy="395" rx="300" ry="14" fill="#c46f4e" />
      </g>
      {/* 새 */}
      <g stroke="#2a1a1e" strokeWidth="2" fill="none" className="sg-birds">
        {[[980, 300], [1010, 318], [1046, 292], [1080, 330], [940, 336]].map(([x, y], i) => (
          <path key={i} d={`M${x - 9} ${y} q9 -7 9 0 q0 -7 9 0`} />
        ))}
      </g>
      {/* 먼 산 → 가까운 산 */}
      <path d={ridge(3, 520, 120)} fill="#6b3f45" opacity="0.75" />
      <rect y="430" width="1600" height="200" fill="url(#ts-fog)" />
      <path d={ridge(5, 590, 150, 1600, 50)} fill="#4a2c37" />
      {/* 산 위의 성 */}
      <g transform="translate(330 470)" fill="#2c1b25">
        <path d="M-120 140 L-110 60 L110 60 L120 140 Z" />
        {[-110, -70, -30, 10, 50, 90].map((x) => <rect key={x} x={x} y="48" width="14" height="14" />)}
        <path d="M-40 60 L-40 10 L40 10 L40 60 Z" />
        <path d="M-62 14 Q0 -22 62 14 L52 14 Q0 -6 -52 14 Z" />
        <path d="M-30 -8 L-30 -40 L30 -40 L30 -8 Z" />
        <path d="M-50 -36 Q0 -74 50 -36 L40 -36 Q0 -58 -40 -36 Z" />
        <rect x="-4" y="-88" width="8" height="26" />
        {[-24, -6, 12].map((x) => <rect key={x} x={x} y="24" width="8" height="12" fill="#f2a24c" opacity="0.9" />)}
        <rect x="-10" y="-30" width="6" height="10" fill="#f2a24c" opacity="0.9" />
        <path d="M-4 -88 L22 -80 L-4 -72 Z" fill="#c8362b" className="sg-flag" />
      </g>
      <rect y="560" width="1600" height="160" fill="url(#ts-fog)" opacity="0.8" />
      {/* 강 */}
      <path d="M0 760 C260 700 520 735 760 705 C1000 676 1260 700 1600 664 L1600 700 C1260 734 1000 712 760 744 C520 772 260 744 0 800 Z" fill="url(#ts-river)" />
      <path d={ridge(11, 690, 90, 1600, 60)} fill="#24161d" />
      {/* 앞 능선과 행군 */}
      <path d={ridge(17, 790, 50, 1600, 80)} fill="#0e0a0c" />
      <g className="sg-march">
        {marchers.map((i) => {
          const x = 120 + i * 40;
          const y = 790 - Math.sin(i / 3) * 14 - (i % 2) * 4;
          const c = FLAGS[Math.floor(i / 12) % 3];
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-5 0 L-3 -22 L3 -22 L5 0 Z" fill="#0e0a0c" />
              <circle cx="0" cy="-26" r="4.5" fill="#0e0a0c" />
              <line x1="7" y1="2" x2="10" y2="-54" stroke="#0e0a0c" strokeWidth="1.6" />
              {i % 3 === 0 && (
                <path d="M10 -54 L36 -50 L32 -44 L36 -38 L10 -36 Z" fill={c} className="sg-flag" style={{ animationDelay: `${(i % 7) * -0.3}s` }} />
              )}
            </g>
          );
        })}
      </g>
      <path d="M0 900 L0 840 Q400 800 800 840 T1600 830 L1600 900 Z" fill="#070506" />
    </svg>
  );
});
