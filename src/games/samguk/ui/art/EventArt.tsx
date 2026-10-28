import { memo } from 'react';

export type SceneKind = 'court' | 'hut' | 'war' | 'scroll' | 'land';

/** 사건 문구로 삽화를 고른다 */
export function sceneFor(text: string): SceneKind {
  if (/초려|제갈량|출사|융중/.test(text)) return 'hut';
  if (/황제|즉위|위왕|위공|선양|천자|헌제|진\(晉\)|칭제/.test(text)) return 'court';
  if (/암살|베었|반기|독립|청주|고평릉|군사|병력|자립/.test(text)) return 'war';
  if (/뒤를|맡겼|양도|이었/.test(text)) return 'scroll';
  return 'land';
}

/** 사건 카드 삽화 — 320×180 수묵채색 */
export const EventArt = memo(function EventArt({ kind }: { kind: SceneKind }) {
  return (
    <svg viewBox="0 0 320 180" className="sg-event-art" aria-hidden="true">
      <defs>
        <linearGradient id="ev-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={kind === 'war' ? '#4a1f1a' : kind === 'hut' ? '#c9cfd1' : '#e8d6ae'} />
          <stop offset="1" stopColor={kind === 'war' ? '#b65a32' : kind === 'hut' ? '#eef0ee' : '#c9ad78'} />
        </linearGradient>
        <filter id="ev-soft"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <rect width="320" height="180" fill="url(#ev-sky)" />
      {kind === 'court' && (
        <g>
          <rect y="120" width="320" height="60" fill="#5a3a22" />
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={20 + i * 52} y="40" width="12" height="90" fill="#9a2a1e" stroke="#3a1a10" />)}
          <path d="M0 40 L160 6 L320 40 Z" fill="#3a2a1e" />
          <path d="M10 40 L310 40 L300 48 L20 48 Z" fill="#c9a13e" />
          <rect x="110" y="96" width="100" height="26" fill="#7a4a26" stroke="#3a1a10" />
          <rect x="130" y="70" width="60" height="28" fill="#c9a13e" stroke="#6d531a" />
          <path d="M145 70 L145 58 L175 58 L175 70" fill="#141010" />
          <path d="M138 58 L182 58 L180 54 L140 54 Z" fill="#141010" stroke="#d9b44a" />
          {[40, 280].map((x) => (
            <g key={x}>
              <line x1={x} y1="60" x2={x} y2="130" stroke="#3a2414" strokeWidth="2" />
              <path d={`M${x} 62 L${x + (x < 160 ? 22 : -22)} 66 L${x} 92 Z`} fill="#c8362b" />
            </g>
          ))}
          {[70, 90, 230, 250].map((x) => <path key={x} d={`M${x} 160 l-5 -26 l5 -8 l5 8 l-5 26 Z`} fill="#2a1d14" />)}
        </g>
      )}
      {kind === 'hut' && (
        <g>
          <path d="M0 120 Q80 92 160 112 T320 104 L320 180 L0 180 Z" fill="#e9ecea" />
          <path d="M0 70 Q60 30 110 60 Q150 20 210 56 Q260 34 320 64 L320 120 L0 120 Z" fill="#9aa6a6" opacity="0.7" filter="url(#ev-soft)" />
          {[30, 44, 260, 274, 288].map((x, i) => (
            <g key={x}>
              <line x1={x} y1="150" x2={x + (i % 2 ? 3 : -3)} y2="50" stroke="#3f5a3a" strokeWidth="3" />
              {[70, 90, 110].map((y) => <path key={y} d={`M${x} ${y} q14 -6 22 2 M${x} ${y + 6} q-14 -4 -20 4`} stroke="#4d6e42" strokeWidth="2.4" fill="none" />)}
            </g>
          ))}
          <path d="M110 124 L160 88 L210 124 Z" fill="#a8946a" stroke="#4a3a24" strokeWidth="1.5" />
          <path d="M112 122 L160 90 L208 122" fill="none" stroke="#fff" strokeWidth="3" opacity="0.8" />
          <rect x="122" y="122" width="76" height="32" fill="#c9b48a" stroke="#4a3a24" strokeWidth="1.5" />
          <rect x="152" y="130" width="16" height="24" fill="#4a3a24" />
          <g fill="#2a2420">
            <circle cx="92" cy="138" r="4" /><path d="M88 142 L96 142 L98 160 L86 160 Z" />
            <circle cx="76" cy="140" r="3.6" /><path d="M72 144 L80 144 L82 160 L70 160 Z" />
            <circle cx="62" cy="141" r="3.6" /><path d="M58 145 L66 145 L68 160 L56 160 Z" />
          </g>
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 73) % 320} cy={(i * 41) % 170} r="1.2" fill="#fff" opacity="0.8" />)}
        </g>
      )}
      {kind === 'war' && (
        <g>
          <circle cx="250" cy="60" r="26" fill="#f3a057" opacity="0.8" />
          <path d="M0 130 Q100 110 200 126 T320 118 L320 180 L0 180 Z" fill="#2a1410" />
          {[60, 120, 190, 250].map((x, i) => (
            <path key={x} d={`M${x} 120 C${x - 20} 80 ${x + 20} 70 ${x - 5} 30`} stroke="#5a3a32" strokeWidth="14" fill="none" opacity={0.35 - i * 0.05} filter="url(#ev-soft)" />
          ))}
          {Array.from({ length: 14 }, (_, i) => {
            const x = 20 + i * 22;
            const lean = (i % 3) - 1;
            return (
              <g key={i}>
                <line x1={x} y1="150" x2={x + lean * 6} y2={i % 2 ? 72 : 86} stroke="#140a08" strokeWidth="2" />
                {i % 3 === 0 && <path d={`M${x + lean * 6} ${i % 2 ? 72 : 86} l24 4 l-4 7 l4 7 l-24 2 Z`} fill={['#3f74e0', '#d9453a', '#2fa35a', '#d9a93b'][i % 4]} />}
                <path d={`M${x - 5} 152 L${x - 3} 128 L${x + 3} 128 L${x + 5} 152 Z`} fill="#140a08" />
                <circle cx={x} cy="123" r="5" fill="#140a08" />
              </g>
            );
          })}
        </g>
      )}
      {kind === 'scroll' && (
        <g>
          <rect x="40" y="40" width="240" height="100" fill="#f1e4c3" stroke="#5a3a22" strokeWidth="2" />
          <rect x="30" y="34" width="14" height="112" rx="6" fill="#7a2a1c" />
          <rect x="276" y="34" width="14" height="112" rx="6" fill="#7a2a1c" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <line key={i} x1={248 - i * 30} y1="54" x2={248 - i * 30} y2="124" stroke="#2b1d12" strokeWidth="3" strokeDasharray="7 5" opacity="0.6" />)}
          <rect x="70" y="96" width="30" height="30" fill="#b0342a" />
          <text x="85" y="117" textAnchor="middle" fontSize="16" fontWeight="800" fill="#f3e2c0">印</text>
          <path d="M210 150 l0 -20 q5 -8 10 0 l0 20 Z" fill="#e9d38a" />
          <path d="M215 130 q-4 -8 0 -14 q4 6 0 14" fill="#f3a057" />
        </g>
      )}
      {kind === 'land' && (
        <g>
          <path d="M0 110 Q60 60 120 96 Q170 50 230 90 Q280 64 320 86 L320 180 L0 180 Z" fill="#8a7a5a" opacity="0.6" />
          <path d="M0 140 Q90 110 180 136 T320 128 L320 180 L0 180 Z" fill="#5a4a32" />
          <path d="M0 160 C80 150 140 166 220 154 S300 150 320 156" stroke="#6f9aa8" strokeWidth="8" fill="none" opacity="0.8" />
        </g>
      )}
      <rect x="2" y="2" width="316" height="176" fill="none" stroke="#3a2614" strokeWidth="4" />
    </svg>
  );
});
