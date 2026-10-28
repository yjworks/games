import { memo } from 'react';

export type SceneKind = 'court' | 'hut' | 'war' | 'scroll' | 'land' | 'fire' | 'naval' | 'oath' | 'funeral' | 'disaster';

/** 사건 문구로 삽화를 고른다 */
export function sceneFor(text: string): SceneKind {
  if (/적벽|화공|불태|불을 질|불길|이릉/.test(text)) return 'fire';
  if (/수군|배를|강을 건너|수전|장강/.test(text)) return 'naval';
  if (/세상을 떠|죽었|사망|붕어|병사했|숨을 거|전사/.test(text)) return 'funeral';
  if (/역병|가뭄|메뚜기|기근|홍수|지진|흉년/.test(text)) return 'disaster';
  if (/동맹|결의|의형제|맹약|맹세|연합/.test(text)) return 'oath';
  if (/초려|제갈량|출사|융중/.test(text)) return 'hut';
  if (/황제|즉위|위왕|위공|선양|천자|헌제|진\(晉\)|칭제/.test(text)) return 'court';
  if (/암살|베었|반기|독립|청주|고평릉|군사|병력|자립/.test(text)) return 'war';
  if (/뒤를|맡겼|양도|이었/.test(text)) return 'scroll';
  return 'land';
}

const SKY: Record<SceneKind, [string, string]> = {
  court: ['#e8d6ae', '#c9ad78'], hut: ['#c9cfd1', '#eef0ee'], war: ['#4a1f1a', '#b65a32'], scroll: ['#e8d6ae', '#c9ad78'],
  land: ['#e8d6ae', '#c9ad78'], fire: ['#1a0c0a', '#a8341c'], naval: ['#a9bcc0', '#e6e2cf'], oath: ['#f3d9a8', '#e8b97a'],
  funeral: ['#9aa0a4', '#d6d8d4'], disaster: ['#b8a274', '#d9c79a'],
};

/** 사건 카드 삽화 — 320×180 수묵채색 */
export const EventArt = memo(function EventArt({ kind }: { kind: SceneKind }) {
  return (
    <svg viewBox="0 0 320 180" className="sg-event-art" aria-hidden="true">
      <defs>
        <linearGradient id="ev-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY[kind][0]} />
          <stop offset="1" stopColor={SKY[kind][1]} />
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
          <path d="M0 70 Q40 30 70 62 Q95 20 130 58 L130 120 L0 120 Z" fill="#6a6250" opacity="0.35" filter="url(#ev-soft)" />
          <circle cx="250" cy="40" r="16" fill="#f3e2b0" opacity="0.9" />
          {/* 먼 탑 */}
          <g transform="translate(222 92)" fill="#4a3a2a">
            {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${-10 + i * 1.4} ${-i * 8} L${10 - i * 1.4} ${-i * 8} L${7 - i * 1.4} ${-i * 8 - 3} L${-7 + i * 1.4} ${-i * 8 - 3} Z`} />)}
            <rect x="-5" y="-2" width="10" height="6" />
            <line x1="0" y1="-38" x2="0" y2="-46" stroke="#4a3a2a" strokeWidth="1.2" />
          </g>
          {/* 소나무 */}
          {[[34, 150], [70, 156]].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x} ${y} Q${x - 4} ${y - 30} ${x + 6} ${y - 52}`} stroke="#3a2a1a" strokeWidth="3" fill="none" />
              {[0, 1, 2].map((k) => <ellipse key={k} cx={x + 6 - k * 8 + (k % 2) * 14} cy={y - 50 + k * 12} rx="13" ry="4.5" fill="#3f5a36" />)}
            </g>
          ))}
          <path d="M150 50 l6 3 l6 -3 M168 44 l5 2.6 l5 -2.6 M182 52 l4 2 l4 -2" stroke="#2a2018" strokeWidth="1" fill="none" />
        </g>
      )}
      {kind === 'fire' && (
        <g>
          {/* 불타는 배들 — 장강 위 화공 */}
          <rect y="118" width="320" height="62" fill="#2a1410" />
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M0 ${126 + i * 8} q40 -4 80 0 t80 0 t80 0 t80 0`} stroke="#c25a2a" strokeWidth="1" fill="none" opacity={0.5 - i * 0.05} />)}
          {[40, 110, 190, 260].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 26} 120 L${x + 26} 120 L${x + 18} 132 L${x - 18} 132 Z`} fill="#1a0c08" />
              <line x1={x} y1="120" x2={x} y2={84 - i * 4} stroke="#1a0c08" strokeWidth="2" />
              <path d={`M${x - 20} 118 C${x - 26} 92 ${x - 4} 86 ${x - 8} ${58 - i * 6} C${x + 6} 80 ${x + 26} 84 ${x + 18} 118 Z`} fill="#f39a3a" opacity="0.9" filter="url(#ev-soft)" />
              <path d={`M${x - 10} 118 C${x - 12} 100 ${x} 96 ${x - 2} ${76 - i * 5} C${x + 8} 92 ${x + 14} 100 ${x + 10} 118 Z`} fill="#ffe07a" opacity="0.9" />
            </g>
          ))}
          {[60, 150, 230, 300].map((x, i) => <path key={x} d={`M${x} 70 C${x - 30} 40 ${x + 20} 20 ${x - 10} -10`} stroke="#3a1a14" strokeWidth={18 - i * 2} fill="none" opacity="0.35" filter="url(#ev-soft)" />)}
          {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 53) % 320} cy={(i * 31) % 110} r="1.1" fill="#ffcf6a" opacity="0.8" />)}
        </g>
      )}
      {kind === 'naval' && (
        <g>
          <path d="M0 80 Q80 64 160 78 T320 72 L320 100 L0 100 Z" fill="#8a9a98" opacity="0.6" filter="url(#ev-soft)" />
          <rect y="98" width="320" height="82" fill="#6f8e94" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${-20 + (i % 2) * 20} ${108 + i * 9} q20 -5 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0`} stroke="#e8efe8" strokeWidth="1" fill="none" opacity="0.55" />)}
          {[[70, 128, 1], [180, 118, 0.8], [260, 134, 1.1]].map(([x, y, k], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${k})`}>
              <path d="M-40 0 L40 0 L30 14 L-32 14 Z" fill="#4a2e1a" stroke="#1e120a" strokeWidth="1.2" />
              <rect x="-24" y="-14" width="36" height="14" fill="#7a4a26" stroke="#1e120a" strokeWidth="1" />
              <path d="M-28 -14 Q-6 -22 16 -14 Z" fill="#3a2618" />
              <line x1="-2" y1="-14" x2="-2" y2="-62" stroke="#1e120a" strokeWidth="2" />
              <path d="M-2 -60 Q18 -48 -2 -22 Z" fill="#e8dcc0" stroke="#6b5a40" strokeWidth="0.8" />
              <path d="M-2 -62 L16 -58 L-2 -54 Z" fill={['#3f74e0', '#d9453a', '#2fa35a'][i]} />
              {[-30, -18, -6, 6, 18].map((dx) => <line key={dx} x1={dx} y1="8" x2={dx - 6} y2="20" stroke="#1e120a" strokeWidth="1" />)}
            </g>
          ))}
        </g>
      )}
      {kind === 'oath' && (
        <g>
          {/* 복숭아꽃 아래 향로와 맹세 */}
          {[[40, 40], [270, 30], [300, 70], [20, 80]].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x} 180 Q${x + 6} ${y + 60} ${x + (i % 2 ? -10 : 10)} ${y + 20}`} stroke="#4a2e1e" strokeWidth="5" fill="none" />
              {Array.from({ length: 9 }, (_, k) => <circle key={k} cx={x + ((k * 17) % 40) - 20} cy={y + ((k * 11) % 30)} r="5" fill="#f2a6b4" opacity="0.85" />)}
            </g>
          ))}
          <rect y="140" width="320" height="40" fill="#b48a52" />
          <rect x="120" y="104" width="80" height="36" fill="#6b2a1c" stroke="#2a120a" strokeWidth="1.5" />
          <path d="M146 104 L146 92 Q160 82 174 92 L174 104 Z" fill="#8a6a2a" stroke="#2a120a" strokeWidth="1.2" />
          {[152, 160, 168].map((x) => <path key={x} d={`M${x} 90 q-4 -12 2 -24 q4 -10 -2 -22`} stroke="#d9d0c0" strokeWidth="1.2" fill="none" opacity="0.8" />)}
          {[[96, 0], [224, 1], [160, 2]].map(([x, i]) => (
            <g key={x} fill="#2a1a12">
              <circle cx={x} cy={i === 2 ? 132 : 120} r="6" />
              <path d={`M${x - 9} ${i === 2 ? 178 : 168} L${x - 7} ${i === 2 ? 140 : 128} L${x + 7} ${i === 2 ? 140 : 128} L${x + 9} ${i === 2 ? 178 : 168} Z`} />
              <path d={`M${x + (x < 160 ? 6 : -6)} ${i === 2 ? 146 : 134} L${x + (x < 160 ? 20 : -20)} ${i === 2 ? 132 : 122}`} stroke="#2a1a12" strokeWidth="3" />
            </g>
          ))}
          {Array.from({ length: 24 }, (_, i) => <ellipse key={i} cx={(i * 47) % 320} cy={(i * 29) % 150} rx="2.4" ry="1.4" fill="#f6b8c4" opacity="0.8" transform={`rotate(${i * 30} ${(i * 47) % 320} ${(i * 29) % 150})`} />)}
        </g>
      )}
      {kind === 'funeral' && (
        <g>
          <path d="M0 120 Q100 100 200 118 T320 112 L320 180 L0 180 Z" fill="#7d8286" opacity="0.7" />
          <rect x="130" y="70" width="60" height="70" fill="#f1ede4" stroke="#3a3a3a" strokeWidth="1.5" />
          <text x="160" y="112" textAnchor="middle" fontSize="28" fontWeight="800" fill="#2a2a2a">奠</text>
          {[[60, 0], [260, 1]].map(([x]) => (
            <g key={x}>
              <line x1={x} y1="40" x2={x} y2="150" stroke="#3a3a3a" strokeWidth="2" />
              <path d={`M${x} 44 L${x + (x < 160 ? 22 : -22)} 48 L${x + (x < 160 ? 18 : -18)} 110 L${x} 104 Z`} fill="#f4f2ec" stroke="#8a8a8a" strokeWidth="0.8" />
            </g>
          ))}
          {[100, 120, 200, 220].map((x) => (
            <g key={x} fill="#3a3a3e">
              <circle cx={x} cy="140" r="4.5" />
              <path d={`M${x - 7} 172 L${x - 5} 146 L${x + 5} 146 L${x + 7} 172 Z`} />
            </g>
          ))}
          {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(i * 61) % 320} cy={(i * 37) % 170} r="1" fill="#fff" opacity="0.7" />)}
        </g>
      )}
      {kind === 'disaster' && (
        <g>
          <circle cx="250" cy="44" r="22" fill="#f2c25a" opacity="0.9" />
          <circle cx="250" cy="44" r="34" fill="#f2c25a" opacity="0.2" />
          <path d="M0 120 L320 120 L320 180 L0 180 Z" fill="#a9905a" />
          {Array.from({ length: 22 }, (_, i) => <path key={i} d={`M${(i * 31) % 320} ${126 + (i % 5) * 10} l12 4 l-6 6 l14 3`} stroke="#5a4426" strokeWidth="1.2" fill="none" />)}
          {[50, 90, 230].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 120 L${x} ${86 + i * 6} M${x} ${96 + i * 6} L${x - 12} ${86 + i * 6} M${x} ${102 + i * 6} L${x + 12} ${92 + i * 6}`} stroke="#4a3420" strokeWidth="2" />
            </g>
          ))}
          {[140, 158].map((x, i) => (
            <g key={x} fill="#3a2a1c">
              <circle cx={x} cy={128 + i * 4} r="4" />
              <path d={`M${x - 6} ${160 + i * 4} Q${x - 4} ${136 + i * 4} ${x + 4} ${134 + i * 4} L${x + 6} ${160 + i * 4} Z`} />
            </g>
          ))}
          {Array.from({ length: 40 }, (_, i) => <path key={i} d={`M${(i * 29) % 320} ${(i * 17) % 100 + 6} l3 -1 l-1 2 Z`} fill="#3a2a10" opacity="0.6" />)}
        </g>
      )}
      <rect x="2" y="2" width="316" height="176" fill="none" stroke="#3a2614" strokeWidth="4" />
    </svg>
  );
});
