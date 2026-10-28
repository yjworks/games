import { GameId } from '../registry';

/**
 * 게임마다 하나씩 있는 작은 표식.
 * 이모지 대신 판의 한 조각을 그려 두어, 목록에서도 게임 안에서도
 * 같은 그림으로 알아볼 수 있게 한다. 48×48 좌표계에 맞춰 그린다.
 */

interface Props {
  id: GameId;
  size?: number;
  className?: string;
}

const R = 11; // 바탕 모서리

function Bg({ fill }: { fill: string }) {
  return <rect x="0" y="0" width="48" height="48" rx={R} fill={fill} />;
}

const MARKS: Record<GameId, JSX.Element> = {
  omok: (
    <>
      <Bg fill="#3b2a17" />
      <g stroke="#a97f4b" strokeWidth="1.2" opacity="0.85">
        {[14, 24, 34].map((v) => <line key={`h${v}`} x1="8" y1={v} x2="40" y2={v} />)}
        {[14, 24, 34].map((v) => <line key={`v${v}`} x1={v} y1="8" x2={v} y2="40" />)}
      </g>
      <circle cx="14" cy="14" r="5" fill="#14181f" stroke="#454b57" />
      <circle cx="24" cy="24" r="5" fill="#14181f" stroke="#454b57" />
      <circle cx="34" cy="34" r="5" fill="#f2f4f8" stroke="#b9c0cc" />
      <circle cx="34" cy="14" r="5" fill="#f2f4f8" stroke="#b9c0cc" />
    </>
  ),
  janggi: (
    <>
      <Bg fill="#3a2b1a" />
      <g stroke="#b08a55" strokeWidth="1.1" opacity="0.8">
        <line x1="9" y1="16" x2="39" y2="16" />
        <line x1="9" y1="32" x2="39" y2="32" />
        <line x1="16" y1="9" x2="16" y2="39" />
        <line x1="32" y1="9" x2="32" y2="39" />
      </g>
      <circle cx="16" cy="16" r="9" fill="#1f6f4f" stroke="#8ce0b8" strokeWidth="1.4" />
      <text x="16" y="20" textAnchor="middle" fontSize="11" fontWeight="800" fill="#d6ffee">楚</text>
      <circle cx="32" cy="32" r="9" fill="#9a2b22" stroke="#ffb3a4" strokeWidth="1.4" />
      <text x="32" y="36" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffe4de">漢</text>
    </>
  ),
  sudoku: (
    <>
      <Bg fill="#141a2b" />
      <g stroke="#38477a" strokeWidth="1">
        {[18, 28].map((v) => <line key={`h${v}`} x1="8" y1={v} x2="40" y2={v} />)}
        {[18, 28].map((v) => <line key={`v${v}`} x1={v} y1="8" x2={v} y2="40" />)}
      </g>
      <rect x="8" y="8" width="32" height="32" rx="3" fill="none" stroke="#5b76c9" strokeWidth="1.6" />
      <g fontSize="9" fontWeight="800" textAnchor="middle" fill="#9fb6ff">
        <text x="13" y="17">5</text>
        <text x="23" y="27">3</text>
        <text x="34" y="37">7</text>
      </g>
      <g fontSize="9" fontWeight="800" textAnchor="middle" fill="#e8edff">
        <text x="34" y="17">1</text>
        <text x="13" y="37">9</text>
      </g>
    </>
  ),
  tetris: (
    <>
      <Bg fill="#0f1a18" />
      <g>
        <rect x="9" y="10" width="9" height="9" rx="1.6" fill="#f05a5a" />
        <rect x="18" y="10" width="9" height="9" rx="1.6" fill="#f05a5a" />
        <rect x="18" y="19" width="9" height="9" rx="1.6" fill="#f05a5a" />
        <rect x="27" y="19" width="9" height="9" rx="1.6" fill="#f05a5a" />
        <rect x="9" y="29" width="9" height="9" rx="1.6" fill="#22c1a4" />
        <rect x="18" y="29" width="9" height="9" rx="1.6" fill="#22c1a4" />
        <rect x="27" y="29" width="9" height="9" rx="1.6" fill="#f7c948" />
        <rect x="36" y="29" width="3" height="9" rx="1.2" fill="#f7c948" />
      </g>
    </>
  ),
  reversi: (
    <>
      <Bg fill="#1d7a52" />
      <g stroke="rgba(0,0,0,0.28)" strokeWidth="1">
        {[16, 24, 32].map((v) => <line key={`h${v}`} x1="6" y1={v} x2="42" y2={v} />)}
        {[16, 24, 32].map((v) => <line key={`v${v}`} x1={v} y1="6" x2={v} y2="42" />)}
      </g>
      <circle cx="19" cy="19" r="5.6" fill="#f4f6fa" />
      <circle cx="29" cy="29" r="5.6" fill="#f4f6fa" />
      <circle cx="29" cy="19" r="5.6" fill="#11151c" />
      <circle cx="19" cy="29" r="5.6" fill="#11151c" />
    </>
  ),
  kkodle: (
    <>
      <Bg fill="#171a20" />
      <rect x="5" y="13" width="18" height="22" rx="3" fill="#2fa96b" />
      <text x="14" y="29" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff">꼬</text>
      <rect x="25" y="13" width="18" height="22" rx="3" fill="#d8a72a" />
      <text x="34" y="29" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#fff">들</text>
    </>
  ),
  minesweeper: (
    <>
      <Bg fill="#1a2030" />
      <g>
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={8 + c * 11} y={8 + r * 11} width="10" height="10" rx="2"
            fill={(r + c) % 2 === 0 ? '#2b3550' : '#243049'}
          />
        )))}
      </g>
      <g fontSize="8" fontWeight="800" textAnchor="middle">
        <text x="13" y="17" fill="#63a8ff">1</text>
        <text x="24" y="28" fill="#5fd39a">2</text>
        <text x="35" y="39" fill="#ffb35e">3</text>
      </g>
      <g>
        <line x1="35" y1="11" x2="35" y2="18" stroke="#cfd8ea" strokeWidth="1.4" />
        <path d="M35 11 L41 13.5 L35 16 Z" fill="#e8503a" />
      </g>
    </>
  ),
  nonogram: (
    <>
      <Bg fill="#1b1730" />
      <g>
        {[
          [0, 1, 1, 0],
          [1, 1, 1, 1],
          [1, 0, 0, 1],
          [0, 1, 1, 0],
        ].map((row, r) => row.map((v, c) => (
          <rect
            key={`${r}-${c}`}
            x={14 + c * 8} y={14 + r * 8} width="7" height="7" rx="1.2"
            fill={v ? '#a78bfa' : 'rgba(255,255,255,0.07)'}
          />
        )))}
      </g>
      <g fontSize="6.5" fontWeight="800" fill="#8f83c4" textAnchor="end">
        <text x="12" y="20">2</text>
        <text x="12" y="28">4</text>
        <text x="12" y="36">1 1</text>
      </g>
      <g fontSize="6.5" fontWeight="800" fill="#8f83c4" textAnchor="middle">
        <text x="17.5" y="12">3</text>
        <text x="25.5" y="12">1</text>
        <text x="33.5" y="12">3</text>
      </g>
    </>
  ),
  solitaire: (
    <>
      <Bg fill="#0e3d2c" />
      <g transform="rotate(-12 20 26)">
        <rect x="9" y="13" width="19" height="26" rx="3.2" fill="#f6f8fb" stroke="#c3ccd8" />
        <text x="13.5" y="22" fontSize="8" fontWeight="800" fill="#111827">A</text>
        <text x="18.5" y="34" textAnchor="middle" fontSize="13" fill="#111827">♠</text>
      </g>
      <g transform="rotate(9 30 26)">
        <rect x="22" y="13" width="19" height="26" rx="3.2" fill="#f6f8fb" stroke="#c3ccd8" />
        <text x="26" y="22" fontSize="8" fontWeight="800" fill="#c0392b">K</text>
        <text x="31.5" y="34" textAnchor="middle" fontSize="13" fill="#c0392b">♥</text>
      </g>
    </>
  ),
  g2048: (
    <>
      <Bg fill="#2b2620" />
      <rect x="7" y="7" width="15" height="15" rx="3" fill="#eee4da" />
      <text x="14.5" y="18" textAnchor="middle" fontSize="9" fontWeight="800" fill="#6b6459">2</text>
      <rect x="26" y="7" width="15" height="15" rx="3" fill="#f2b179" />
      <text x="33.5" y="18" textAnchor="middle" fontSize="9" fontWeight="800" fill="#f9f6f2">4</text>
      <rect x="7" y="26" width="15" height="15" rx="3" fill="#f59563" />
      <text x="14.5" y="37" textAnchor="middle" fontSize="9" fontWeight="800" fill="#f9f6f2">8</text>
      <rect x="26" y="26" width="15" height="15" rx="3" fill="#edc22e" />
      <text x="33.5" y="37" textAnchor="middle" fontSize="8" fontWeight="800" fill="#f9f6f2">16</text>
    </>
  ),
  breakout: (
    <>
      <Bg fill="#0b1a1c" />
      <g>
        {['#ff6b6b', '#ffa94d', '#5eead4'].map((c, r) =>
          [0, 1, 2, 3].map((i) => (
            <rect key={`${r}-${i}`} x={7 + i * 9} y={9 + r * 6} width="7.5" height="4.4" rx="1.2" fill={c} />
          ))
        )}
      </g>
      <circle cx="30" cy="31" r="3" fill="#fff" />
      <rect x="15" y="37" width="18" height="4" rx="2" fill="#dff7f4" />
    </>
  ),
  yut: (
    <>
      <Bg fill="#33220f" />
      {[
        { x: 8, rot: -9, flat: true },
        { x: 17, rot: 4, flat: false },
        { x: 26, rot: -3, flat: true },
        { x: 35, rot: 8, flat: true },
      ].map((s, i) => (
        <g key={i} transform={`rotate(${s.rot} ${s.x + 2.5} 24)`}>
          <rect
            x={s.x} y="9" width="5.5" height="30" rx="2.6"
            fill={s.flat ? '#e9d3a8' : '#6b4a2c'}
            stroke={s.flat ? '#a8814d' : '#3a2716'}
          />
          {i === 0 && (
            <path d={`M${s.x + 0.9} 15 L${s.x + 4.6} 19 M${s.x + 4.6} 15 L${s.x + 0.9} 19`}
              stroke="#8c3a26" strokeWidth="1.2" />
          )}
        </g>
      ))}
    </>
  ),
  samguk: (
    <>
      <Bg fill="#1d1a14" />
      {/* 세 갈래로 나뉜 땅과 가운데 성 */}
      <path d="M24 24 L24 6 A18 18 0 0 1 39.6 33 Z" fill="#3f74e0" opacity="0.85" />
      <path d="M24 24 L39.6 33 A18 18 0 0 1 8.4 33 Z" fill="#d9453a" opacity="0.85" />
      <path d="M24 24 L8.4 33 A18 18 0 0 1 24 6 Z" fill="#2fa35a" opacity="0.85" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="#d4a24c" strokeWidth="1.6" />
      <rect x="18" y="18" width="12" height="12" rx="2" fill="#1d1a14" stroke="#d4a24c" strokeWidth="1.4" />
      <text x="24" y="28.2" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f3d79a">天</text>
    </>
  ),
};

export function GameMark({ id, size = 46, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      width={size}
      height={size}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[id]}
    </svg>
  );
}
