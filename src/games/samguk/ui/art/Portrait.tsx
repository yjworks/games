import { memo } from 'react';
import { OFFICER_DEF } from '../../data/officers';
import { PORTRAIT_FILES } from '../../data/portraits';
import { darken, hashStr, lighten, mix, seeded } from './util';

/**
 * 장수 초상. 그려 둔 그림 파일이 있으면 그것을 쓰고(data/portraits.ts),
 * 없으면 능력치·나이·역할로 얼굴·수염·투구·관을 골라 SVG로 그린다. 같은 사람은 늘 같은 얼굴이다.
 */
interface Props {
  id: string;
  size?: number;
  /** 그해 나이로 그린다(없으면 생애 중간) */
  year?: number;
  /** 세력 색(배경·장식) */
  color?: string;
  ruler?: boolean;
  /** 왼쪽을 보게 뒤집기(일기토 맞대면용) */
  flip?: boolean;
  className?: string;
}

type Role = 'ruler' | 'general' | 'warrior' | 'strategist' | 'official' | 'hermit';

const SKIN = ['#ecc7a0', '#e0b48d', '#d4a47c', '#e6bc95', '#d8ab83', '#c99a72', '#f0cfaa'];

/** 사서에 남은 생김새 — 관우의 수염(「髯」), 유비의 큰 귀, 손권의 자줏빛 수염(紫髯) */
const FEATURES: Record<string, { beard?: number; ears?: number; beardColor?: string; head?: string }> = {
  guanyu: { beard: 5 },
  liubei: { ears: 1.6 },
  sunquan: { beardColor: '#5e3654' },
  zhugeliang: { head: 'hood' },
};
const ROBE = { general: '#5a2f2a', warrior: '#4a3a2a', strategist: '#e8e2d2', official: '#2f3a52', hermit: '#6e6a58', ruler: '#6b1f1f' };

export const Portrait = memo(function Portrait({ id, size = 64, year, color = '#8a7a5a', ruler, flip, className }: Props) {
  const d = OFFICER_DEF[id];
  const file = PORTRAIT_FILES[id];
  if (file) {
    return <img src={file} width={size} height={size} alt={d?.name ?? id} className={`sg-portrait ${className ?? ''}`} style={{ transform: flip ? 'scaleX(-1)' : undefined }} />;
  }
  if (!d) return null;
  const rnd = seeded(hashStr(id));
  const [, war, int, pol] = d.stats;
  const age = Math.max(15, Math.min(82, (year ?? Math.round((d.born + d.died) / 2 + 4)) - d.born));
  const hermit = d.svc.every(([, k]) => k === 'none');
  const role: Role = ruler ? 'ruler'
    : hermit ? 'hermit'
      : war >= 80 && war >= int ? 'general'
        : war >= 66 && war >= int ? 'warrior'
          : int >= 84 && int >= pol ? 'strategist' : 'official';

  const feat = FEATURES[id] ?? {};
  const skin = SKIN[Math.floor(rnd() * SKIN.length)];
  const fw = 14.5 + (war / 100) * 3.5 + rnd() * 2.2; // 얼굴 너비
  const jw = 5 + (war / 100) * 5.5 + rnd() * 3;      // 턱 너비
  const fy = 51 + rnd() * 3.5;                        // 얼굴 중심
  const eyeY = fy - 4 + rnd() * 1.2;
  const eyeGap = 6.2 + rnd() * 1.8;
  const eyeW = 3.1 + rnd() * 1.1;
  const noseL = 6 + rnd() * 3;
  const variant = Math.floor(rnd() * 3);
  const earK = feat.ears ?? 1;
  const fierce = war >= 85 && int < 70;
  const calm = int >= 80;
  const hairColor = age >= 62 ? '#d9d6cf' : age >= 50 ? '#8d8a85' : '#1c1814';
  const beardKind = feat.beard ?? (age < 22 ? 0 : age < 30 ? (rnd() < 0.6 ? 1 : 0) : fierce ? 4 : age >= 45 && rnd() < 0.55 ? 3 : rnd() < 0.5 ? 2 : 1);
  const beardColor = feat.beardColor ?? hairColor;
  const uid = `pt-${id}`;
  const robe = role === 'ruler' ? mix(color, '#7a1e1e', 0.4) : ROBE[role];
  const bgTop = darken(color, 0.35);
  const bgBot = darken(color, 0.82);

  const face = `M${50 - fw} ${fy - 10} C${50 - fw} ${fy - 26} ${50 + fw} ${fy - 26} ${50 + fw} ${fy - 10}
    L${50 + fw * 0.95} ${fy + 4} C${50 + fw * 0.82} ${fy + 16} ${50 + jw} ${fy + 22} 50 ${fy + 24}
    C${50 - jw} ${fy + 22} ${50 - fw * 0.82} ${fy + 16} ${50 - fw * 0.95} ${fy + 4} Z`;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`sg-portrait ${className ?? ''}`} role="img" aria-label={`${d.name} 초상`}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bgTop} />
          <stop offset="1" stopColor={bgBot} />
        </linearGradient>
        <radialGradient id={`${uid}-skin`} cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor={lighten(skin, 0.18)} />
          <stop offset="0.7" stopColor={skin} />
          <stop offset="1" stopColor={darken(skin, 0.25)} />
        </radialGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9ccd2" />
          <stop offset="0.45" stopColor="#7c818b" />
          <stop offset="1" stopColor="#3a3e46" />
        </linearGradient>
        <linearGradient id={`${uid}-robe`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(robe, 0.15)} />
          <stop offset="1" stopColor={darken(robe, 0.35)} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${uid}-bg)`} />
      <circle cx="50" cy="46" r="40" fill={lighten(color, 0.1)} opacity="0.12" />

      {/* 몸 */}
      <path d="M4 100 C8 84 24 76 38 74 L62 74 C76 76 92 84 96 100 Z" fill={`url(#${uid}-robe)`} />
      {(role === 'general' || role === 'warrior') && (
        <g>
          <path d="M4 100 C8 84 24 76 38 74 L62 74 C76 76 92 84 96 100 Z" fill={`url(#${uid}-metal)`} opacity="0.85" />
          {[82, 88, 94].map((y) => (
            <path key={y} d={`M${14 + (y - 82) * 0.3} ${y} Q50 ${y + 5} ${86 - (y - 82) * 0.3} ${y}`} stroke="#2a2d33" strokeWidth="0.8" fill="none" opacity="0.7" />
          ))}
          <ellipse cx="17" cy="84" rx="13" ry="8" fill={darken(color, 0.15)} stroke="#1b1d21" strokeWidth="0.8" />
          <ellipse cx="83" cy="84" rx="13" ry="8" fill={darken(color, 0.15)} stroke="#1b1d21" strokeWidth="0.8" />
          <path d="M40 74 L50 88 L60 74" fill={darken(color, 0.1)} />
        </g>
      )}
      {(role === 'official' || role === 'strategist' || role === 'ruler' || role === 'hermit') && (
        <g>
          <path d="M38 74 L50 96 L62 74" fill="#efe9dc" />
          <path d="M38 74 L52 100 L46 100 L34 76 Z" fill={role === 'ruler' ? '#d9b44a' : darken(robe, 0.3)} />
          <path d="M62 74 L48 100 L54 100 L66 76 Z" fill={role === 'ruler' ? '#d9b44a' : darken(robe, 0.3)} opacity="0.8" />
        </g>
      )}

      {/* 목 */}
      <path d={`M${50 - jw * 0.8} ${fy + 18} L${50 - jw * 0.7} 76 L${50 + jw * 0.7} 76 L${50 + jw * 0.8} ${fy + 18} Z`} fill={darken(skin, 0.18)} />

      {/* 뒷머리 */}
      {role !== 'general' && <path d={`M${50 - fw - 1} ${fy - 6} C${50 - fw - 3} ${fy - 30} ${50 + fw + 3} ${fy - 30} ${50 + fw + 1} ${fy - 6} L${50 + fw} ${fy + 2} L${50 - fw} ${fy + 2} Z`} fill={hairColor} />}

      {/* 귀 */}
      <ellipse cx={50 - fw - 0.5 * earK} cy={eyeY + 3 * earK} rx={2.6 * earK} ry={4.2 * earK} fill={darken(skin, 0.1)} />
      <ellipse cx={50 + fw + 0.5 * earK} cy={eyeY + 3 * earK} rx={2.6 * earK} ry={4.2 * earK} fill={darken(skin, 0.1)} />

      {/* 얼굴 */}
      <path d={face} fill={`url(#${uid}-skin)`} />
      <path d={`M${50 - fw * 0.95} ${fy + 4} C${50 - fw * 0.82} ${fy + 16} ${50 - jw} ${fy + 22} 50 ${fy + 24} C${50 - jw * 0.5} ${fy + 18} ${50 - fw * 0.7} ${fy + 12} ${50 - fw * 0.95} ${fy + 4} Z`} fill={darken(skin, 0.3)} opacity="0.35" />
      <ellipse cx={50 - 2} cy={fy - 14} rx={fw * 0.5} ry="3" fill="#fff" opacity="0.12" />
      <ellipse cx={50 - fw * 0.55} cy={fy + 6} rx="4.5" ry="3" fill="#c2573f" opacity={fierce ? 0.28 : 0.14} />
      <ellipse cx={50 + fw * 0.55} cy={fy + 6} rx="4.5" ry="3" fill="#c2573f" opacity={fierce ? 0.28 : 0.14} />
      {/* 앞머리 선 */}
      <path d={`M${50 - fw} ${fy - 10} C${50 - fw * 0.6} ${fy - 17} ${50 + fw * 0.6} ${fy - 17} ${50 + fw} ${fy - 10} L${50 + fw} ${fy - 16} C${50 + fw * 0.5} ${fy - 24} ${50 - fw * 0.5} ${fy - 24} ${50 - fw} ${fy - 16} Z`} fill={hairColor} />

      {/* 눈썹 */}
      {[-1, 1].map((sd) => {
        const x = 50 + sd * eyeGap;
        const tilt = fierce ? 3 : calm ? -0.5 : 1.2;
        return (
          <path key={sd} d={`M${x - sd * 4.6} ${eyeY - 4.2 + (fierce ? -1 : 0)} Q${x} ${eyeY - 6.4} ${x + sd * 4.2} ${eyeY - 4.2 + tilt}`}
            stroke={age >= 62 ? '#bdb8ae' : '#1e1812'} strokeWidth={fierce || war >= 80 ? 2.2 : 1.3} fill="none" strokeLinecap="round" />
        );
      })}
      {/* 눈 */}
      {[-1, 1].map((sd) => {
        const x = 50 + sd * eyeGap;
        const lid = fierce ? 1.6 : calm ? -0.2 : 0.6;
        return (
          <g key={sd}>
            <ellipse cx={x} cy={eyeY - 1.6} rx={eyeW + 1.4} ry="2.4" fill={darken(skin, 0.25)} opacity="0.35" />
            <path d={`M${x - eyeW} ${eyeY} Q${x} ${eyeY - 2.6} ${x + eyeW} ${eyeY + (sd > 0 ? -lid * 0.3 : lid * 0.3)} Q${x} ${eyeY + 2} ${x - eyeW} ${eyeY} Z`} fill="#f3efe6" />
            <circle cx={x + sd * 0.3} cy={eyeY + 0.2} r="1.55" fill="#2a1c12" />
            <circle cx={x + sd * 0.3 + 0.5} cy={eyeY - 0.4} r="0.4" fill="#fff" opacity="0.8" />
            <path d={`M${x - eyeW - 0.2} ${eyeY - 0.2} Q${x} ${eyeY - 3.1 + lid} ${x + eyeW + 0.2} ${eyeY - 0.2}`} stroke="#2a1c12" strokeWidth="1" fill="none" />
            {age >= 45 && <path d={`M${x + sd * 4.4} ${eyeY + 0.5} l${sd * 1.6} 1.4`} stroke={darken(skin, 0.35)} strokeWidth="0.5" />}
          </g>
        );
      })}
      {/* 코 */}
      <path d={`M50.6 ${eyeY + 1} L51.6 ${eyeY + noseL} L50 ${eyeY + noseL + 1.2}`} stroke={darken(skin, 0.3)} strokeWidth="1.6" fill="none" opacity="0.4" />
      <path d={`M50 ${eyeY + 1} L48.6 ${eyeY + noseL} Q50 ${eyeY + noseL + 1.6} 51.6 ${eyeY + noseL}`} stroke={darken(skin, 0.38)} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      {/* 입 */}
      <path d={`M${46.2} ${fy + 12.5} Q50 ${fy + (fierce ? 11.8 : calm || d.stats[4] >= 85 ? 13.8 : 12.8)} ${53.8} ${fy + 12.5}`} stroke="#6e2b22" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d={`M47.5 ${fy + 13.4} Q50 ${fy + 14.8} 52.5 ${fy + 13.4}`} stroke="#b8665a" strokeWidth="0.9" fill="none" opacity="0.6" />
      {age >= 50 && <path d={`M${50 - fw * 0.55} ${fy + 9} q-1 4 1 7 M${50 + fw * 0.55} ${fy + 9} q1 4 -1 7`} stroke={darken(skin, 0.3)} strokeWidth="0.5" fill="none" />}

      {/* 수염 */}
      {beardKind >= 1 && (
        <path d={`M${45.5} ${fy + 11} Q${42} ${fy + 12.5} ${40} ${fy + 15} Q${44} ${fy + 12} 50 ${fy + 10.6} Q${56} ${fy + 12} ${60} ${fy + 15} Q${58} ${fy + 12.5} ${54.5} ${fy + 11} Z`} fill={beardColor} />
      )}
      {beardKind === 2 && <path d={`M47 ${fy + 15} Q50 ${fy + 30} 53 ${fy + 15} Z`} fill={beardColor} />}
      {beardKind === 3 && (
        <path d={`M${50 - jw - 2} ${fy + 12} Q${50 - jw} ${fy + 26} 50 ${fy + 44} Q${50 + jw} ${fy + 26} ${50 + jw + 2} ${fy + 12} Q50 ${fy + 18} ${50 - jw - 2} ${fy + 12} Z`} fill={beardColor} opacity="0.95" />
      )}
      {beardKind === 4 && (
        <path d={`M${50 - fw * 0.95} ${fy + 2} Q${50 - fw} ${fy + 22} ${50 - 6} ${fy + 30} Q50 ${fy + 34} ${50 + 6} ${fy + 30} Q${50 + fw} ${fy + 22} ${50 + fw * 0.95} ${fy + 2} Q${50 + fw * 0.6} ${fy + 16} 50 ${fy + 15} Q${50 - fw * 0.6} ${fy + 16} ${50 - fw * 0.95} ${fy + 2} Z`} fill={beardColor} />
      )}
      {beardKind === 5 && (
        <g fill={beardColor}>
          <path d={`M${50 - jw - 3} ${fy + 11} Q${50 - jw - 2} ${fy + 30} ${50 - 4} 100 L${50 + 4} 100 Q${50 + jw + 2} ${fy + 30} ${50 + jw + 3} ${fy + 11} Q50 ${fy + 17} ${50 - jw - 3} ${fy + 11} Z`} />
          <path d={`M${50 - 3} ${fy + 24} Q50 ${fy + 40} ${50 - 1} 100`} stroke={lighten(beardColor, 0.25)} strokeWidth="0.5" fill="none" />
          <path d={`M${50 + 3} ${fy + 24} Q${50 + 1} ${fy + 40} ${50 + 2} 100`} stroke={lighten(beardColor, 0.25)} strokeWidth="0.5" fill="none" />
        </g>
      )}

      {/* 머리 장식 */}
      {role === 'general' && variant === 1 && (
        <g>
          <path d={`M${50 - fw - 3} ${fy - 9} L${50 - fw + 2} ${fy - 30} L50 ${fy - 38} L${50 + fw - 2} ${fy - 30} L${50 + fw + 3} ${fy - 9} Z`} fill={`url(#${uid}-metal)`} stroke="#22252b" strokeWidth="0.8" />
          <path d={`M${50 - fw - 3} ${fy - 9} L${50 - fw - 9} ${fy - 16} L${50 - fw - 5} ${fy - 6} Z M${50 + fw + 3} ${fy - 9} L${50 + fw + 9} ${fy - 16} L${50 + fw + 5} ${fy - 6} Z`} fill="#c9a13e" />
          <rect x={50 - fw - 3} y={fy - 12} width={fw * 2 + 6} height="3.4" fill={darken(color, 0.2)} />
          <path d={`M50 ${fy - 38} C46 ${fy - 46} 52 ${fy - 50} 49 ${fy - 54}`} stroke="#c83a2e" strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d={`M${50 - fw - 2} ${fy - 6} Q${50 - fw - 4} ${fy + 10} ${50 - fw + 2} ${fy + 14} M${50 + fw + 2} ${fy - 6} Q${50 + fw + 4} ${fy + 10} ${50 + fw - 2} ${fy + 14}`} stroke="#5d626c" strokeWidth="3" fill="none" />
        </g>
      )}
      {role === 'general' && variant === 2 && (
        <g>
          <path d={`M${50 - fw - 2} ${fy - 10} C${50 - fw - 2} ${fy - 30} ${50 + fw + 2} ${fy - 30} ${50 + fw + 2} ${fy - 10} Z`} fill={darken(color, 0.35)} stroke="#111" strokeWidth="0.8" />
          {[-8, -3, 2, 7].map((x) => <rect key={x} x={50 + x} y={fy - 28} width="3.4" height="17" rx="1" fill="#8e7a4a" opacity="0.8" />)}
          <path d={`M${50 - fw - 5} ${fy - 10} Q50 ${fy - 14} ${50 + fw + 5} ${fy - 10} L${50 + fw + 3} ${fy - 7} Q50 ${fy - 11} ${50 - fw - 3} ${fy - 7} Z`} fill="#c9a13e" />
          <path d={`M${50 - 9} ${fy - 26} Q${50 - 18} ${fy - 40} ${50 - 10} ${fy - 44} M${50 + 9} ${fy - 26} Q${50 + 18} ${fy - 40} ${50 + 10} ${fy - 44}`} stroke="#d8cfa8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </g>
      )}
      {role === 'general' && variant === 0 && (
        <g>
          <path d={`M${50 - fw - 3} ${fy - 9} C${50 - fw - 3} ${fy - 34} ${50 + fw + 3} ${fy - 34} ${50 + fw + 3} ${fy - 9} Z`} fill={`url(#${uid}-metal)`} stroke="#22252b" strokeWidth="0.8" />
          <rect x={50 - fw - 4} y={fy - 12} width={fw * 2 + 8} height="4" rx="1" fill="#c9a13e" stroke="#6d531a" strokeWidth="0.5" />
          <path d={`M${50 - fw - 3} ${fy - 9} L${50 - fw - 4} ${fy + 6} L${50 - fw + 1} ${fy + 4} Z M${50 + fw + 3} ${fy - 9} L${50 + fw + 4} ${fy + 6} L${50 + fw - 1} ${fy + 4} Z`} fill={`url(#${uid}-metal)`} />
          <path d={`M50 ${fy - 31} L48 ${fy - 38} L50 ${fy - 44} L52 ${fy - 38} Z`} fill="#c9a13e" />
          <path d={`M50 ${fy - 42} C42 ${fy - 52} 34 ${fy - 46} 30 ${fy - 40} C38 ${fy - 44} 44 ${fy - 44} 50 ${fy - 40}`} fill={lighten(color, 0.1)} />
          <path d={`M50 ${fy - 24} L50 ${fy - 12}`} stroke="#e7e2d6" strokeWidth="1.2" opacity="0.6" />
        </g>
      )}
      {role === 'warrior' && variant === 2 && (
        <g>
          <path d={`M${50 - fw - 1} ${fy - 12} C${50 - fw - 2} ${fy - 30} ${50 + fw + 2} ${fy - 30} ${50 + fw + 1} ${fy - 12} Z`} fill={darken(color, 0.45)} />
          <path d={`M${50 - fw - 1} ${fy - 12} L${50 + fw + 1} ${fy - 12}`} stroke={lighten(color, 0.2)} strokeWidth="2" />
          <path d={`M${50 + fw} ${fy - 14} q6 6 3 16`} stroke={darken(color, 0.45)} strokeWidth="3" fill="none" />
        </g>
      )}
      {role === 'warrior' && variant !== 2 && (
        <g>
          <rect x={50 - fw - 1} y={fy - 15} width={fw * 2 + 2} height="4.4" rx="2" fill={color} stroke={darken(color, 0.4)} strokeWidth="0.6" />
          <ellipse cx="50" cy={fy - 25} rx="5.5" ry="4.5" fill={hairColor} />
          <rect x="44" y={fy - 26} width="12" height="1.6" fill="#c9a13e" />
        </g>
      )}
      {role === 'official' && variant === 1 && (
        <g>
          <path d={`M${50 - fw} ${fy - 13} L${50 - fw + 2} ${fy - 34} L${50 + fw - 2} ${fy - 34} L${50 + fw} ${fy - 13} Z`} fill="#20201e" opacity="0.8" />
          <path d={`M${50 - fw + 2} ${fy - 34} L${50 + fw - 2} ${fy - 34} M${50 - fw + 1} ${fy - 24} L${50 + fw - 1} ${fy - 24}`} stroke="#5d5a50" strokeWidth="0.6" />
          <ellipse cx="50" cy={fy - 18} rx="5" ry="4" fill={hairColor} />
        </g>
      )}
      {role === 'official' && variant !== 1 && (
        <g>
          <path d={`M${50 - fw + 2} ${fy - 15} C${50 - fw + 2} ${fy - 27} ${50 + fw - 2} ${fy - 27} ${50 + fw - 2} ${fy - 15} Z`} fill="#16120f" />
          <path d={`M43 ${fy - 24} L45 ${fy - 36} L57 ${fy - 33} L57 ${fy - 22} Z`} fill="#221c17" stroke="#3b332a" strokeWidth="0.5" />
          <rect x={50 - fw + 1} y={fy - 16} width={fw * 2 - 2} height="2.6" fill="#3b332a" />
        </g>
      )}
      {role === 'strategist' && !(feat.head === 'hood' || int >= 95 || variant === 0) && (
        <g>
          <path d={`M${50 - fw + 1} ${fy - 14} C${50 - fw + 1} ${fy - 28} ${50 + fw - 1} ${fy - 28} ${50 + fw - 1} ${fy - 14} Z`} fill="#1a1612" />
          <path d={`M${50 + fw - 3} ${fy - 20} q10 4 8 18 M${50 + fw - 3} ${fy - 18} q8 6 4 20`} stroke="#1a1612" strokeWidth="1.8" fill="none" />
          <rect x={50 - fw + 1} y={fy - 15} width={fw * 2 - 2} height="2.2" fill="#4a4036" />
        </g>
      )}
      {role === 'strategist' && (feat.head === 'hood' || int >= 95 || variant === 0) && (
        <g>
          <path d={`M${50 - fw - 2} ${fy - 8} C${50 - fw - 5} ${fy - 34} ${50 + fw + 5} ${fy - 34} ${50 + fw + 2} ${fy - 8} C${50 + fw * 0.5} ${fy - 16} ${50 - fw * 0.5} ${fy - 16} ${50 - fw - 2} ${fy - 8} Z`}
            fill="#cfd6dc" stroke="#7d8790" strokeWidth="0.6" />
          <path d={`M${50 - fw - 2} ${fy - 8} L${50 - fw - 5} ${fy + 14} L${50 - fw + 1} ${fy + 4} Z M${50 + fw + 2} ${fy - 8} L${50 + fw + 5} ${fy + 14} L${50 + fw - 1} ${fy + 4} Z`} fill="#b9c2c9" />
          <path d={`M${50 - fw * 0.6} ${fy - 24} L${50 + fw * 0.6} ${fy - 24}`} stroke="#7d8790" strokeWidth="0.6" />
        </g>
      )}
      {role === 'ruler' && (
        <g>
          <path d={`M${50 - fw + 1} ${fy - 15} C${50 - fw + 1} ${fy - 26} ${50 + fw - 1} ${fy - 26} ${50 + fw - 1} ${fy - 15} Z`} fill="#141010" />
          <rect x="44" y={fy - 34} width="12" height="10" fill="#141010" />
          <path d={`M${50 - fw - 6} ${fy - 34} L${50 + fw + 6} ${fy - 34} L${50 + fw + 4} ${fy - 31} L${50 - fw - 4} ${fy - 31} Z`} fill="#141010" stroke="#d9b44a" strokeWidth="0.9" />
          {[-12, -7, -2, 3, 8, 13].map((x) => (
            <g key={x}>
              <line x1={50 + x} y1={fy - 31} x2={50 + x} y2={fy - 20} stroke="#d9b44a" strokeWidth="0.45" />
              {[fy - 28, fy - 24.5, fy - 21].map((y) => <circle key={y} cx={50 + x} cy={y} r="0.9" fill={y === fy - 24.5 ? '#c83a2e' : '#e9d38a'} />)}
            </g>
          ))}
          <rect x={50 - fw + 1} y={fy - 16} width={fw * 2 - 2} height="2.4" fill="#d9b44a" />
        </g>
      )}
      {role === 'hermit' && (
        <g>
          <ellipse cx="50" cy={fy - 26} rx="6.5" ry="5" fill={hairColor} />
          <path d={`M41 ${fy - 26} L59 ${fy - 27}`} stroke="#c9b27a" strokeWidth="1.4" strokeLinecap="round" />
          <path d={`M${50 - fw} ${fy - 14} C${50 - fw * 0.4} ${fy - 19} ${50 + fw * 0.4} ${fy - 19} ${50 + fw} ${fy - 14}`} stroke="#8f8a74" strokeWidth="2.2" fill="none" />
        </g>
      )}
      {/* 흐릿한 테두리 그늘 */}
      <rect width="100" height="100" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="6" />
    </svg>
  );
});
