import { memo } from 'react';
import { OFFICER_DEF } from '../../data/officers';
import { PORTRAIT_FILES } from '../../data/portraits';
import { darken, hashStr, lighten, mix, seeded } from './util';

/**
 * 장수 초상. 그려 둔 그림 파일이 있으면 그것을 쓰고(data/portraits.ts),
 * 없으면 능력치·나이·역할·출신으로 얼굴형·눈·눈썹·수염·관모·갑옷을 골라 SVG로 그린다.
 * 빛은 왼쪽 위에서 오고, 얼굴은 살짝 비껴 선다. 같은 사람은 늘 같은 얼굴이다.
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

const SKIN = ['#efc9a2', '#e4b78f', '#d8a87f', '#e9bf98', '#dcae86', '#cf9f76', '#f2d1ad'];

/**
 * 사서에 남은 생김새.
 * 관우 「美鬚髯」, 유비 「顧自見其耳」, 손권 「紫髯」(헌제춘추), 제갈량 「容貌甚偉」, 주유 「長壯有姿貌」, 손책 「美姿顏」,
 * 조운 「姿顏雄偉」(별전), 허저 「腰大十圍」, 전위 「形貌魁梧」, 노숙 「體貌魁奇」, 정욱·태사자 「美鬚髯」, 최염 「鬚長四尺」,
 * 조조 「姿貌短小」, 장송 「爲人短小」, 공손찬 「有姿儀」, 원소 「有姿貌威容」, 하안 「美姿儀」, 왕찬 「貌寢」.
 */
interface Feat { beard?: number; ears?: number; beardColor?: string; head?: 'hood' | 'fan'; heavy?: boolean; fair?: boolean; small?: boolean }
const FEATURES: Record<string, Feat> = {
  guanyu: { beard: 5 },
  liubei: { ears: 1.7 },
  sunquan: { beardColor: '#6a3a5e' },
  zhugeliang: { head: 'fan', fair: true },
  zhouyu: { fair: true, beard: 0 },
  sunce: { fair: true, beard: 1 },
  zhaoyun: { fair: true },
  xuchu: { heavy: true },
  dianwei: { heavy: true, beard: 6 },
  lusu: { heavy: true },
  chengyu: { beard: 3 },
  taishici: { beard: 3 },
  cuiyan: { beard: 5 },
  caocao: { small: true },
  zhangsong: { small: true },
  gongsunzan: { fair: true },
  yuanshao: { fair: true },
  heyan: { fair: true, beard: 0 },
  wangcan: { small: true },
  zhangfei: { beard: 6 },
  pangtong: { head: 'hood' },
  simayi: { head: 'hood' },
};

const ROBE: Record<Role, string> = { general: '#5a2f2a', warrior: '#4a3a2a', strategist: '#e9e4d6', official: '#2f3a52', hermit: '#6a634e', ruler: '#6b1f1f' };

export const Portrait = memo(function Portrait({ id, size = 64, year, color = '#8a7a5a', ruler, flip, className }: Props) {
  const d = OFFICER_DEF[id];
  const file = PORTRAIT_FILES[id];
  if (file) {
    return <img src={file} width={size} height={size} alt={d?.name ?? id} className={`sg-portrait ${className ?? ''}`} style={{ transform: flip ? 'scaleX(-1)' : undefined }} />;
  }
  if (!d) return null;
  const rnd = seeded(hashStr(id));
  const [lead, war, int, pol, cha] = d.stats;
  const age = Math.max(15, Math.min(82, (year ?? Math.round((d.born + d.died) / 2 + 4)) - d.born));
  const hermit = d.svc.every(([, k]) => k === 'none');
  const yellow = d.svc[0]?.[1] === 'yellow';
  const role: Role = ruler ? 'ruler'
    : hermit ? 'hermit'
      : war >= 80 && war >= int ? 'general'
        : war >= 66 && war >= int ? 'warrior'
          : int >= 84 && int >= pol ? 'strategist' : 'official';

  const feat = FEATURES[id] ?? {};
  const skin = SKIN[Math.floor(rnd() * SKIN.length)];
  const heavy = !!feat.heavy;
  const fair = !!feat.fair;
  const fierce = war >= 85 && int < 70;
  const calm = int >= 80;
  const turn = (rnd() - 0.5) * 0.22;                          // 얼굴이 비낀 정도(−왼, +오른)
  const shape = Math.floor(rnd() * 4);                        // 0 갸름 1 각진 2 긴 3 둥근
  const fw = 14 + (war / 100) * 3 + rnd() * 2 + (heavy ? 3 : 0) + (shape === 3 ? 1.2 : shape === 2 ? -1 : 0);
  const jw = (shape === 1 ? 9 : shape === 3 ? 8 : 5.5) + (war / 100) * 3 + (heavy ? 3 : 0) - (fair ? 1.5 : 0);
  const fy = 50 + rnd() * 3 + (feat.small ? 2.5 : 0);
  const fh = shape === 2 ? 27 : 24;                           // 턱 아래까지
  const ox = turn * fw;                                       // 얼굴 가운데 이동
  const cx = 50 + ox;
  const eyeY = fy - 4 + rnd() * 1.2;
  const eyeGap = 6.2 + rnd() * 1.6 + (heavy ? 0.6 : 0);
  const eyeW = 3 + rnd() * 1 + (fair ? 0.3 : 0);
  const noseL = 6.2 + rnd() * 2.6;
  const variant = Math.floor(rnd() * 3);
  const earK = feat.ears ?? 1;
  const hairColor = age >= 64 ? '#dcd8d0' : age >= 52 ? '#8e8a84' : age >= 44 && rnd() < 0.4 ? '#4a4540' : '#1b1713';
  const beardKind = feat.beard ?? (age < 21 ? 0
    : age < 28 ? (rnd() < 0.55 ? 1 : 0)
      : fierce ? (rnd() < 0.5 ? 6 : 4)
        : role === 'strategist' || role === 'hermit' ? (age >= 40 ? 3 : 2)
          : age >= 45 && rnd() < 0.5 ? 3 : rnd() < 0.5 ? 2 : rnd() < 0.5 ? 4 : 1);
  const beardColor = feat.beardColor ?? hairColor;
  const uid = `pt-${id}-${age >= 52 ? "o" : "y"}-${color.replace(/[^0-9a-z]/gi, "")}`;
  const robe = role === 'ruler' ? mix(color, '#7a1e1e', 0.45) : role === 'official' ? mix(ROBE.official, color, 0.25) : ROBE[role];
  const bgTop = darken(color, 0.25);
  const bgBot = darken(color, 0.85);
  const brow = age >= 62 ? '#c9c4ba' : '#1a140f';
  const lipLine = '#6a2a20';
  const shade = darken(skin, 0.32);
  const armored = role === 'general' || role === 'warrior';
  const covered = role === 'general' || (role === 'ruler') || (role === 'official') || (role === 'strategist') || yellow;

  /* 얼굴 윤곽 */
  const top = fy - 26;
  const face = `M${cx - fw} ${fy - 9}
    C${cx - fw} ${top} ${cx + fw} ${top} ${cx + fw} ${fy - 9}
    C${cx + fw * 1.02} ${fy + 1} ${cx + fw * 0.92} ${fy + 8} ${cx + jw + 2} ${fy + fh - 6}
    Q${cx + jw * 0.5} ${fy + fh} ${cx} ${fy + fh}
    Q${cx - jw * 0.5} ${fy + fh} ${cx - jw - 2} ${fy + fh - 6}
    C${cx - fw * 0.92} ${fy + 8} ${cx - fw * 1.02} ${fy + 1} ${cx - fw} ${fy - 9} Z`;
  const farSide = turn > 0 ? -1 : 1;                          // 그늘 지는 쪽

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={`sg-portrait ${className ?? ''}`} role="img" aria-label={`${d.name} 초상`}
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={bgTop} />
          <stop offset="1" stopColor={bgBot} />
        </linearGradient>
        <radialGradient id={`${uid}-halo`} cx="0.42" cy="0.38" r="0.6">
          <stop offset="0" stopColor={lighten(color, 0.35)} stopOpacity="0.45" />
          <stop offset="1" stopColor={lighten(color, 0.35)} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-skin`} cx={0.42 + turn} cy="0.38" r="0.75">
          <stop offset="0" stopColor={lighten(skin, 0.16)} />
          <stop offset="0.62" stopColor={skin} />
          <stop offset="1" stopColor={darken(skin, 0.28)} />
        </radialGradient>
        <linearGradient id={`${uid}-side`} x1={farSide > 0 ? 1 : 0} y1="0" x2={farSide > 0 ? 0 : 1} y2="0">
          <stop offset="0" stopColor={darken(skin, 0.5)} stopOpacity="0.5" />
          <stop offset="0.45" stopColor={darken(skin, 0.5)} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#e2e5ea" />
          <stop offset="0.4" stopColor="#8c929c" />
          <stop offset="1" stopColor="#353941" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6dc8e" />
          <stop offset="0.5" stopColor="#c9962f" />
          <stop offset="1" stopColor="#7a5414" />
        </linearGradient>
        <linearGradient id={`${uid}-robe`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={lighten(robe, 0.18)} />
          <stop offset="1" stopColor={darken(robe, 0.42)} />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lighten(hairColor, 0.2)} />
          <stop offset="1" stopColor={hairColor} />
        </linearGradient>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1" /></filter>
      </defs>

      {/* 바탕 — 세력 색 물감에 붓질 몇 번 */}
      <rect width="100" height="100" fill={`url(#${uid}-bg)`} />
      <rect width="100" height="100" fill={`url(#${uid}-halo)`} />
      <path d={`M-5 ${30 + rnd() * 20} Q30 ${10 + rnd() * 20} 105 ${25 + rnd() * 20}`} stroke={lighten(color, 0.2)} strokeWidth="14" opacity="0.12" fill="none" />
      <path d={`M-5 ${70 + rnd() * 10} Q50 ${55 + rnd() * 10} 105 ${62 + rnd() * 10}`} stroke={darken(color, 0.5)} strokeWidth="18" opacity="0.18" fill="none" />

      {/* 등 뒤 — 장수는 망토, 책사는 깃 */}
      {armored && <path d={`M2 100 C6 80 18 70 36 70 L64 70 C82 70 94 80 98 100 Z`} fill={darken(color, 0.2)} />}

      {/* 몸 */}
      <path d={`M${heavy ? 0 : 4} 100 C${heavy ? 4 : 9} 83 24 75 ${38 + ox * 0.3} 73 L${62 + ox * 0.3} 73 C76 75 ${heavy ? 96 : 91} 83 ${heavy ? 100 : 96} 100 Z`} fill={`url(#${uid}-robe)`} />
      {armored && <Armor uid={uid} color={color} heavy={heavy} ox={ox * 0.3} lion={role === 'general' && war >= 88} />}
      {!armored && <Robe uid={uid} role={role} robe={robe} color={color} ox={ox * 0.3} />}

      {/* 목 */}
      <path d={`M${cx - jw * 0.72} ${fy + fh - 8} L${cx - jw * 0.7} 75 L${cx + jw * 0.7} 75 L${cx + jw * 0.72} ${fy + fh - 8} Z`} fill={darken(skin, 0.2)} />
      <path d={`M${cx - jw * 0.7} ${fy + fh - 4} Q${cx} ${fy + fh + 3} ${cx + jw * 0.7} ${fy + fh - 4}`} stroke={darken(skin, 0.45)} strokeWidth="2" fill="none" opacity="0.5" />

      {/* 뒷머리 */}
      {!covered && <path d={`M${cx - fw - 1.5} ${fy - 4} C${cx - fw - 4} ${fy - 32} ${cx + fw + 4} ${fy - 32} ${cx + fw + 1.5} ${fy - 4} L${cx + fw} ${fy + 3} L${cx - fw} ${fy + 3} Z`} fill={`url(#${uid}-hair)`} />}

      {/* 귀 */}
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <ellipse cx={cx + sd * (fw + 0.6 * earK) - turn * sd * 2} cy={eyeY + 3.2 * earK} rx={2.5 * earK * (sd === farSide ? 0.8 : 1)} ry={4.4 * earK} fill={darken(skin, 0.08)} />
          <path d={`M${cx + sd * (fw + 0.4 * earK)} ${eyeY + 0.5} q${sd * 1.6 * earK} ${2.4 * earK} 0 ${5.4 * earK}`} stroke={shade} strokeWidth="0.7" fill="none" opacity="0.7" />
        </g>
      ))}

      {/* 얼굴 */}
      <path d={face} fill={`url(#${uid}-skin)`} />
      <path d={face} fill={`url(#${uid}-side)`} />
      {/* 광대·턱 그늘 */}
      <path d={`M${cx + farSide * fw * 0.95} ${fy + 2} Q${cx + farSide * fw * 0.6} ${fy + 10} ${cx + farSide * (jw + 1)} ${fy + fh - 6}`} stroke={shade} strokeWidth="3.4" fill="none" opacity="0.28" filter={`url(#${uid}-soft)`} />
      <ellipse cx={cx} cy={fy + fh - 2} rx={jw * 0.8} ry="2.2" fill={darken(skin, 0.35)} opacity="0.25" filter={`url(#${uid}-soft)`} />
      <ellipse cx={cx - 3 - turn * 6} cy={fy - 15} rx={fw * 0.45} ry="3.2" fill="#fff" opacity="0.13" />
      {/* 볼 */}
      <ellipse cx={cx - fw * 0.55} cy={fy + 5} rx="4.4" ry="2.8" fill="#c8553e" opacity={fierce ? 0.3 : fair ? 0.18 : 0.14} filter={`url(#${uid}-soft)`} />
      <ellipse cx={cx + fw * 0.55} cy={fy + 5} rx="4.4" ry="2.8" fill="#c8553e" opacity={fierce ? 0.3 : fair ? 0.18 : 0.14} filter={`url(#${uid}-soft)`} />
      {/* 젊은 무장의 수염 자국 */}
      {armored && age >= 22 && beardKind <= 2 && (
        <path d={`M${cx - jw - 2} ${fy + 8} Q${cx} ${fy + fh + 2} ${cx + jw + 2} ${fy + 8} Q${cx} ${fy + 15} ${cx - jw - 2} ${fy + 8} Z`} fill="#3a4048" opacity="0.14" filter={`url(#${uid}-soft)`} />
      )}

      {/* 앞머리 */}
      {!covered && (
        <path d={`M${cx - fw} ${fy - 9} C${cx - fw * 0.7} ${fy - 15} ${cx + fw * 0.7} ${fy - 15} ${cx + fw} ${fy - 9} L${cx + fw + 0.6} ${fy - 15} C${cx + fw * 0.5} ${fy - 26} ${cx - fw * 0.5} ${fy - 26} ${cx - fw - 0.6} ${fy - 15} Z`} fill={`url(#${uid}-hair)`} />
      )}

      {/* 눈썹 */}
      {[-1, 1].map((sd) => {
        const x = cx + sd * eyeGap + turn * 1.5;
        const by = eyeY - 4.4;
        const style = fierce ? 'slant' : calm ? 'arch' : war >= 75 ? 'thick' : 'thin';
        const inner = by + (style === 'slant' ? 1.4 : 0);
        const outer = by + (style === 'slant' ? -1.6 : style === 'arch' ? 0.6 : 0);
        const w = style === 'thick' || style === 'slant' ? 2.3 : style === 'arch' ? 1.4 : 1.1;
        return (
          <path key={sd} d={`M${x - sd * 4.4} ${inner} Q${x - sd * 0.5} ${by - (style === 'arch' ? 2.2 : 1.6)} ${x + sd * 4.6} ${outer}`}
            stroke={brow} strokeWidth={w * (sd === farSide ? 0.9 : 1)} fill="none" strokeLinecap="round" />
        );
      })}
      {/* 눈 */}
      {[-1, 1].map((sd) => {
        const k = sd === farSide ? 0.86 : 1;
        const x = cx + sd * eyeGap + turn * 1.5;
        const lid = fierce ? 1.4 : calm ? -0.2 : 0.5;
        const ew = eyeW * k;
        return (
          <g key={sd}>
            <ellipse cx={x} cy={eyeY - 1.6} rx={ew + 1.6} ry="2.4" fill={shade} opacity="0.3" filter={`url(#${uid}-soft)`} />
            <path d={`M${x - ew} ${eyeY} Q${x - sd * 0.4} ${eyeY - 2.5 + lid * 0.4} ${x + ew} ${eyeY - 0.3 * sd * lid} Q${x} ${eyeY + 1.9} ${x - ew} ${eyeY} Z`} fill="#f5f0e6" />
            <circle cx={x + turn * 1.6} cy={eyeY + 0.1} r="1.45" fill="#3a2414" />
            <circle cx={x + turn * 1.6} cy={eyeY + 0.1} r="0.75" fill="#0e0906" />
            <circle cx={x + turn * 1.6 + 0.55} cy={eyeY - 0.5} r="0.42" fill="#fff" opacity="0.85" />
            <path d={`M${x - ew - 0.4} ${eyeY - 0.1} Q${x - sd * 0.3} ${eyeY - 3.2 + lid} ${x + ew + 0.5} ${eyeY - 0.4}`} stroke="#1a110b" strokeWidth="1.15" fill="none" strokeLinecap="round" />
            {!fierce && <path d={`M${x - ew + 0.6} ${eyeY - 2.2} Q${x} ${eyeY - 3.6} ${x + ew - 0.2} ${eyeY - 2.1}`} stroke={shade} strokeWidth="0.45" fill="none" opacity="0.8" />}
            <path d={`M${x - ew + 0.8} ${eyeY + 1.2} Q${x} ${eyeY + 2} ${x + ew - 0.6} ${eyeY + 1}`} stroke={shade} strokeWidth="0.4" fill="none" opacity="0.6" />
            {age >= 45 && <path d={`M${x - ew + 0.5} ${eyeY + 2.6} Q${x} ${eyeY + 3.6} ${x + ew - 0.4} ${eyeY + 2.4}`} stroke={shade} strokeWidth="0.45" fill="none" opacity="0.6" />}
            {age >= 55 && <path d={`M${x + sd * (ew + 0.8)} ${eyeY - 0.4} l${sd * 1.8} -0.8 M${x + sd * (ew + 0.8)} ${eyeY + 0.6} l${sd * 1.8} 0.8`} stroke={shade} strokeWidth="0.4" />}
          </g>
        );
      })}
      {/* 미간 */}
      {(fierce || age >= 50) && <path d={`M${cx - 0.8} ${eyeY - 4} l0.3 2.4 M${cx + 0.9} ${eyeY - 4} l-0.3 2.4`} stroke={shade} strokeWidth="0.45" opacity="0.7" />}
      {/* 코 */}
      <path d={`M${cx + farSide * 1.4} ${eyeY - 1} C${cx + farSide * 1.9} ${eyeY + 3} ${cx + farSide * 2.4} ${eyeY + noseL - 2} ${cx + farSide * 2.6} ${eyeY + noseL}`} stroke={shade} strokeWidth="1.8" fill="none" opacity="0.32" filter={`url(#${uid}-soft)`} />
      <path d={`M${cx - 0.2} ${eyeY - 0.5} L${cx + turn * 3} ${eyeY + noseL - 2}`} stroke="#fff" strokeWidth="1" opacity="0.18" />
      <path d={`M${cx - 3.2 + turn * 2} ${eyeY + noseL} Q${cx - 2.2} ${eyeY + noseL + 1.8} ${cx + turn * 2} ${eyeY + noseL + 1.2} Q${cx + 2.2} ${eyeY + noseL + 1.8} ${cx + 3.2 + turn * 2} ${eyeY + noseL}`}
        stroke={darken(skin, 0.42)} strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <ellipse cx={cx + turn * 2} cy={eyeY + noseL - 0.6} rx="1.6" ry="1" fill="#fff" opacity="0.16" />
      {/* 입 */}
      {(() => {
        const my = fy + 12.2 + (shape === 2 ? 1 : 0);
        const smile = cha >= 85 && !fierce ? -0.9 : fierce ? 0.9 : 0;
        const mw = 4.2 + (heavy ? 0.6 : 0);
        return (
          <g>
            <path d={`M${cx - mw + turn * 2} ${my + smile * 0.3} Q${cx + turn * 2} ${my + 0.9 - smile} ${cx + mw + turn * 2} ${my + smile * 0.3}`} stroke={lipLine} strokeWidth="1" fill="none" strokeLinecap="round" />
            <path d={`M${cx - mw * 0.7 + turn * 2} ${my + 0.8} Q${cx + turn * 2} ${my + 3} ${cx + mw * 0.7 + turn * 2} ${my + 0.8}`} fill="#b8665a" opacity="0.55" />
            <path d={`M${cx - 1.4 + turn * 2} ${my - 2.6} L${cx - 0.6 + turn * 2} ${my - 0.8} M${cx + 1.4 + turn * 2} ${my - 2.6} L${cx + 0.6 + turn * 2} ${my - 0.8}`} stroke={shade} strokeWidth="0.4" opacity="0.55" />
          </g>
        );
      })()}
      {age >= 50 && <path d={`M${cx - fw * 0.5} ${fy + 7} q-1.4 4 0.6 7.4 M${cx + fw * 0.5} ${fy + 7} q1.4 4 -0.6 7.4`} stroke={shade} strokeWidth="0.55" fill="none" opacity="0.8" />}
      {age >= 60 && <path d={`M${cx - 5} ${fy - 17} q5 -1.2 10 0 M${cx - 4} ${fy - 14.6} q4 -1 8 0`} stroke={shade} strokeWidth="0.45" fill="none" opacity="0.6" />}

      <Beard kind={beardKind} cx={cx + turn * 2} fy={fy} fw={fw} jw={jw} fh={fh} color={beardColor} />

      <Headwear role={role} variant={variant} uid={uid} cx={cx} fy={fy} fw={fw} color={color} hair={hairColor} yellow={yellow}
        hood={feat.head === 'hood' || feat.head === 'fan' || (role === 'strategist' && int >= 95)} lead={lead} />

      {/* 깃털 부채 — 지략이 뛰어난 책사 */}
      {feat.head === 'fan' && (
        <g transform="translate(73 78) rotate(-18)">
          <line x1="0" y1="4" x2="0" y2="22" stroke="#6b4a2a" strokeWidth="2.2" />
          <path d="M0 6 C-12 -4 -11 -20 0 -24 C11 -20 12 -4 0 6 Z" fill="#f4f1ea" stroke="#9a9488" strokeWidth="0.6" />
          {[-8, -4, 0, 4, 8].map((x) => <path key={x} d={`M0 4 Q${x * 0.6} -8 ${x} -20`} stroke="#c9c3b6" strokeWidth="0.45" fill="none" />)}
          <path d="M-3 5 h6" stroke="#c9a13e" strokeWidth="1.4" />
        </g>
      )}

      {/* 테두리 그늘 */}
      <rect width="100" height="100" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="7" />
      <rect x="2.5" y="2.5" width="95" height="95" fill="none" stroke={lighten(color, 0.4)} strokeWidth="0.6" opacity="0.35" />
    </svg>
  );
});

/** 갑옷 — 비늘 갑옷(찰갑) 줄, 어깨 갑옷. 이름난 장수는 어깨에 짐승 얼굴(獸面) */
function Armor({ uid, color, heavy, ox, lion }: { uid: string; color: string; heavy: boolean; ox: number; lion: boolean }) {
  const rows = [80, 85, 90, 95];
  return (
    <g>
      <path d={`M${heavy ? 2 : 8} 100 C${heavy ? 6 : 12} 84 26 76 ${38 + ox} 74 L${62 + ox} 74 C74 76 ${heavy ? 94 : 88} 84 ${heavy ? 98 : 92} 100 Z`} fill={`url(#${uid}-metal)`} opacity="0.92" />
      {rows.map((y, i) => (
        <g key={y}>
          {Array.from({ length: 12 }, (_, k) => {
            const x = 14 + k * 6.5 + (i % 2) * 3.2;
            if (x < 12 + (100 - y) * 0.2 || x > 88 - (100 - y) * 0.2) return null;
            return <path key={k} d={`M${x - 3} ${y} q3 3.6 6 0`} stroke="#2a2d33" strokeWidth="0.6" fill="none" opacity="0.75" />;
          })}
        </g>
      ))}
      {/* 가슴 띠 */}
      <path d={`M24 86 Q50 ${92} 76 86`} stroke={darken(color, 0.15)} strokeWidth="3.2" fill="none" />
      <path d={`M24 86 Q50 ${92} 76 86`} stroke={`url(#${uid}-gold)`} strokeWidth="0.8" fill="none" />
      {/* 어깨 */}
      {[-1, 1].map((sd) => (
        <g key={sd}>
          <path d={`M${50 + sd * 22} 76 Q${50 + sd * 38} 76 ${50 + sd * 44} 90 Q${50 + sd * 32} 92 ${50 + sd * 24} 86 Z`} fill={`url(#${uid}-metal)`} stroke="#1b1d21" strokeWidth="0.8" />
          <path d={`M${50 + sd * 26} 80 Q${50 + sd * 36} 80 ${50 + sd * 40} 88`} stroke="#2a2d33" strokeWidth="0.6" fill="none" />
          {lion && (
            <g transform={`translate(${50 + sd * 33} 83)`}>
              <circle r="4.6" fill={`url(#${uid}-gold)`} stroke="#4a3210" strokeWidth="0.5" />
              <circle r="2.6" fill="none" stroke="#5a3e0e" strokeWidth="0.6" />
              {[0, 60, 120, 180, 240, 300].map((a) => <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3.6} cy={Math.sin((a * Math.PI) / 180) * 3.6} r="0.55" fill="#5a3e0e" />)}
              <circle r="1" fill="#8a2416" />
            </g>
          )}
        </g>
      ))}
      {/* 목가리개 */}
      <path d={`M${38 + ox} 74 Q${50 + ox} 80 ${62 + ox} 74 L${60 + ox} 79 Q${50 + ox} 84 ${40 + ox} 79 Z`} fill={darken(color, 0.25)} stroke="#1b1d21" strokeWidth="0.6" />
    </g>
  );
}

/** 도포 — 섶을 여민 깃(交領), 흰 속깃. 군주는 금빛 깃과 무늬 */
function Robe({ uid, role, robe, color, ox }: { uid: string; role: Role; robe: string; color: string; ox: number }) {
  const trim = role === 'ruler' ? `url(#${uid}-gold)` : role === 'strategist' ? '#2a2a30' : darken(robe, 0.35);
  return (
    <g>
      <path d={`M${39 + ox} 73 L${50 + ox} 96 L${61 + ox} 73 Z`} fill="#f1ece0" />
      <path d={`M${39 + ox} 73 L${53 + ox} 100 L${46 + ox} 100 L${34 + ox} 76 Z`} fill={trim} />
      <path d={`M${61 + ox} 73 L${50 + ox} 92 L${54 + ox} 94 L${66 + ox} 76 Z`} fill={trim} opacity="0.9" />
      <path d={`M${40 + ox} 74 L${51 + ox} 93`} stroke="#c9c2b0" strokeWidth="0.5" />
      {role === 'ruler' && (
        <g opacity="0.7" fill="none" stroke={`url(#${uid}-gold)`} strokeWidth="0.9">
          <path d="M16 92 q5 -6 10 0 q5 6 10 0" />
          <path d="M64 92 q5 -6 10 0 q5 6 10 0" />
          <circle cx="22" cy="86" r="2.4" /><circle cx="78" cy="86" r="2.4" />
        </g>
      )}
      {role === 'official' && <path d="M14 96 L86 96" stroke={lighten(color, 0.2)} strokeWidth="2.4" opacity="0.5" />}
      {role === 'hermit' && <path d="M20 88 q15 -4 30 2 q15 6 30 0" stroke={darken(robe, 0.3)} strokeWidth="0.8" fill="none" />}
    </g>
  );
}

/** 수염 — 0 없음 1 콧수염 2 콧수염+턱수염 3 긴 염소수염 4 짧은 구레나룻 5 길게 흐르는 수염 6 덥수룩한 수염 */
function Beard({ kind, cx, fy, fw, jw, fh, color }: { kind: number; cx: number; fy: number; fw: number; jw: number; fh: number; color: string }) {
  if (!kind) return null;
  const hi = lighten(color, 0.3);
  const strands = (x0: number, y0: number, x1: number, y1: number, n: number) => Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const x = x0 + (x1 - x0) * t;
    return <path key={i} d={`M${x} ${y0 + 2} Q${x + (t - 0.5) * 2} ${(y0 + y1) / 2} ${cx + (x - cx) * 0.4} ${y1}`} stroke={hi} strokeWidth="0.35" fill="none" opacity="0.55" />;
  });
  const mus = (
    <path d={`M${cx - 0.4} ${fy + 10.2} Q${cx - 4} ${fy + 9.6} ${cx - 6.8} ${fy + 13} Q${cx - 3.6} ${fy + 11.2} ${cx} ${fy + 11.4} Q${cx + 3.6} ${fy + 11.2} ${cx + 6.8} ${fy + 13} Q${cx + 4} ${fy + 9.6} ${cx + 0.4} ${fy + 10.2} Z`} fill={color} />
  );
  switch (kind) {
    case 1:
      return mus;
    case 2:
      return <g>{mus}<path d={`M${cx - 2.4} ${fy + 15.4} Q${cx} ${fy + fh + 6} ${cx + 2.4} ${fy + 15.4} Q${cx} ${fy + 16.6} ${cx - 2.4} ${fy + 15.4} Z`} fill={color} /></g>;
    case 3:
      return (
        <g>
          {mus}
          <path d={`M${cx - 3.4} ${fy + 15} Q${cx - 2.6} ${fy + fh + 6} ${cx} ${fy + fh + 18} Q${cx + 2.6} ${fy + fh + 6} ${cx + 3.4} ${fy + 15} Q${cx} ${fy + 16.8} ${cx - 3.4} ${fy + 15} Z`} fill={color} />
          {strands(cx - 2.6, fy + 15, cx + 2.6, fy + fh + 14, 4)}
        </g>
      );
    case 4:
      return (
        <g>
          <path d={`M${cx - fw * 0.98} ${fy + 1} Q${cx - fw * 0.9} ${fy + 14} ${cx - jw} ${fy + fh - 4} Q${cx} ${fy + fh + 4} ${cx + jw} ${fy + fh - 4} Q${cx + fw * 0.9} ${fy + 14} ${cx + fw * 0.98} ${fy + 1}
            Q${cx + fw * 0.7} ${fy + 12} ${cx + 5} ${fy + 15.6} Q${cx} ${fy + 17} ${cx - 5} ${fy + 15.6} Q${cx - fw * 0.7} ${fy + 12} ${cx - fw * 0.98} ${fy + 1} Z`} fill={color} opacity="0.92" />
          {mus}
        </g>
      );
    case 5:
      return (
        <g>
          <path d={`M${cx - jw - 3} ${fy + 10} Q${cx - jw - 4} ${fy + 30} ${cx - 5} 100 L${cx + 5} 100 Q${cx + jw + 4} ${fy + 30} ${cx + jw + 3} ${fy + 10} Q${cx} ${fy + 17} ${cx - jw - 3} ${fy + 10} Z`} fill={color} />
          {mus}
          {strands(cx - jw - 1, fy + 14, cx + jw + 1, 98, 9)}
        </g>
      );
    default:
      return (
        <g>
          <path d={`M${cx - fw - 0.5} ${fy - 2} Q${cx - fw - 3} ${fy + 18} ${cx - jw - 2} ${fy + fh + 4} Q${cx - 4} ${fy + fh + 12} ${cx} ${fy + fh + 9} Q${cx + 4} ${fy + fh + 12} ${cx + jw + 2} ${fy + fh + 4} Q${cx + fw + 3} ${fy + 18} ${cx + fw + 0.5} ${fy - 2}
            Q${cx + fw * 0.6} ${fy + 12} ${cx + 5} ${fy + 15.4} Q${cx} ${fy + 16.6} ${cx - 5} ${fy + 15.4} Q${cx - fw * 0.6} ${fy + 12} ${cx - fw - 0.5} ${fy - 2} Z`} fill={color} />
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 13) * Math.PI;
            const x = cx - Math.cos(a) * (fw + 1), y = fy + 8 + Math.sin(a) * (fh - 2);
            return <path key={i} d={`M${x} ${y} l${-Math.cos(a) * 2.4} ${Math.sin(a) * 2.6 + 1}`} stroke={color} strokeWidth="1.4" strokeLinecap="round" />;
          })}
          {mus}
          {strands(cx - jw, fy + 16, cx + jw, fy + fh + 8, 6)}
        </g>
      );
  }
}

/** 머리 장식 — 군주 면류관, 장수 투구 셋, 무사 두건·상투, 관리 진현관, 책사 윤건·도관, 은사 상투, 황건 */
function Headwear({ role, variant, uid, cx, fy, fw, color, hair, yellow, hood, lead }: {
  role: Role; variant: number; uid: string; cx: number; fy: number; fw: number; color: string; hair: string; yellow: boolean; hood: boolean; lead: number;
}) {
  const crownY = fy - 15;
  if (yellow && role !== 'ruler') {
    return (
      <g>
        <path d={`M${cx - fw - 1.5} ${fy - 6} C${cx - fw - 3} ${fy - 33} ${cx + fw + 3} ${fy - 33} ${cx + fw + 1.5} ${fy - 6} Q${cx} ${fy - 14} ${cx - fw - 1.5} ${fy - 6} Z`} fill="#e3b81c" stroke="#7a5c0a" strokeWidth="0.7" />
        <path d={`M${cx - fw - 1} ${fy - 10} Q${cx} ${fy - 15} ${cx + fw + 1} ${fy - 10}`} stroke="#a8840e" strokeWidth="1.6" fill="none" />
        <path d={`M${cx + fw} ${fy - 12} q7 3 6 16 M${cx + fw - 1} ${fy - 10} q5 5 2 17`} stroke="#e3b81c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
    );
  }
  switch (role) {
    case 'ruler':
      return (
        <g>
          <path d={`M${cx - fw + 0.5} ${crownY} C${cx - fw + 0.5} ${fy - 27} ${cx + fw - 0.5} ${fy - 27} ${cx + fw - 0.5} ${crownY} Z`} fill={hair} />
          <rect x={cx - 6} y={fy - 34} width="12" height="10" rx="1" fill="#141010" stroke="#3a2e22" strokeWidth="0.5" />
          <path d={`M${cx - fw - 7} ${fy - 34.5} L${cx + fw + 7} ${fy - 33.5} L${cx + fw + 5} ${fy - 30.5} L${cx - fw - 5} ${fy - 31.5} Z`} fill="#141010" stroke={`url(#${uid}-gold)`} strokeWidth="1" />
          {[-13, -8, -3, 2, 7, 12].map((x) => (
            <g key={x}>
              <line x1={cx + x} y1={fy - 31} x2={cx + x} y2={fy - 19} stroke="#d9b44a" strokeWidth="0.45" />
              {[fy - 28, fy - 24.5, fy - 21].map((y, k) => <circle key={y} cx={cx + x} cy={y} r="0.95" fill={k === 1 ? '#c83a2e' : k === 2 ? '#3f8a5a' : '#e9d38a'} />)}
            </g>
          ))}
          <rect x={cx - fw + 0.5} y={crownY - 1.4} width={fw * 2 - 1} height="2.6" fill={`url(#${uid}-gold)`} />
          <path d={`M${cx + fw - 1} ${crownY} q3 6 1 14`} stroke="#c83a2e" strokeWidth="1.1" fill="none" />
        </g>
      );
    case 'general':
      if (variant === 1) {
        /* 봉시 투구 — 금빛 날개 */
        return (
          <g>
            <path d={`M${cx - fw - 3} ${fy - 8} L${cx - fw + 1} ${fy - 30} Q${cx} ${fy - 40} ${cx + fw - 1} ${fy - 30} L${cx + fw + 3} ${fy - 8} Q${cx} ${fy - 14} ${cx - fw - 3} ${fy - 8} Z`} fill={`url(#${uid}-metal)`} stroke="#22252b" strokeWidth="0.8" />
            {[-1, 1].map((sd) => (
              <path key={sd} d={`M${cx + sd * (fw + 1)} ${fy - 16} Q${cx + sd * (fw + 12)} ${fy - 24} ${cx + sd * (fw + 14)} ${fy - 36} Q${cx + sd * (fw + 6)} ${fy - 26} ${cx + sd * (fw - 1)} ${fy - 22} Z`} fill={`url(#${uid}-gold)`} stroke="#5a3e0e" strokeWidth="0.6" />
            ))}
            <rect x={cx - fw - 3} y={fy - 12} width={fw * 2 + 6} height="3.6" rx="1" fill={darken(color, 0.15)} stroke={`url(#${uid}-gold)`} strokeWidth="0.6" />
            <path d={`M${cx} ${fy - 38} C${cx - 4} ${fy - 46} ${cx + 3} ${fy - 50} ${cx - 1} ${fy - 56}`} stroke="#c83a2e" strokeWidth="3.4" fill="none" strokeLinecap="round" />
            <path d={`M${cx - fw - 2} ${fy - 6} Q${cx - fw - 4} ${fy + 10} ${cx - fw + 2} ${fy + 14} M${cx + fw + 2} ${fy - 6} Q${cx + fw + 4} ${fy + 10} ${cx + fw - 2} ${fy + 14}`} stroke="#5d626c" strokeWidth="3" fill="none" />
          </g>
        );
      }
      if (variant === 2) {
        /* 꿩깃 투구 — 이름난 맹장 */
        return (
          <g>
            <path d={`M${cx - fw - 2} ${fy - 9} C${cx - fw - 2} ${fy - 32} ${cx + fw + 2} ${fy - 32} ${cx + fw + 2} ${fy - 9} Q${cx} ${fy - 14} ${cx - fw - 2} ${fy - 9} Z`} fill={darken(color, 0.35)} stroke="#111" strokeWidth="0.8" />
            {[-8, -3, 2, 7].map((x) => <rect key={x} x={cx + x} y={fy - 29} width="3.4" height="17" rx="1" fill="#a28a54" opacity="0.75" />)}
            <path d={`M${cx - fw - 5} ${fy - 10} Q${cx} ${fy - 15} ${cx + fw + 5} ${fy - 10} L${cx + fw + 3} ${fy - 7} Q${cx} ${fy - 11} ${cx - fw - 3} ${fy - 7} Z`} fill={`url(#${uid}-gold)`} />
            {lead >= 80 && [-1, 1].map((sd) => (
              <path key={sd} d={`M${cx + sd * 6} ${fy - 27} C${cx + sd * 16} ${fy - 44} ${cx + sd * 26} ${fy - 52} ${cx + sd * 36} ${fy - 50}`} stroke="#e2d6a8" strokeWidth="2" fill="none" strokeLinecap="round" />
            ))}
            {lead >= 80 && [-1, 1].map((sd) => (
              <path key={`b${sd}`} d={`M${cx + sd * 10} ${fy - 33} l${sd * 2} -3 M${cx + sd * 18} ${fy - 42} l${sd * 2} -3 M${cx + sd * 26} ${fy - 47} l${sd * 2} -3`} stroke="#6b5a2a" strokeWidth="1.1" />
            ))}
          </g>
        );
      }
      return (
        <g>
          <path d={`M${cx - fw - 3} ${fy - 8} C${cx - fw - 3} ${fy - 35} ${cx + fw + 3} ${fy - 35} ${cx + fw + 3} ${fy - 8} Q${cx} ${fy - 13} ${cx - fw - 3} ${fy - 8} Z`} fill={`url(#${uid}-metal)`} stroke="#22252b" strokeWidth="0.8" />
          <path d={`M${cx} ${fy - 33} L${cx} ${fy - 12}`} stroke="#eef0f3" strokeWidth="1.3" opacity="0.6" />
          <rect x={cx - fw - 4} y={fy - 12} width={fw * 2 + 8} height="4" rx="1" fill={`url(#${uid}-gold)`} stroke="#6d531a" strokeWidth="0.5" />
          <path d={`M${cx - fw - 3} ${fy - 8} L${cx - fw - 5} ${fy + 7} L${cx - fw + 1} ${fy + 4} Z M${cx + fw + 3} ${fy - 8} L${cx + fw + 5} ${fy + 7} L${cx + fw - 1} ${fy + 4} Z`} fill={`url(#${uid}-metal)`} />
          <path d={`M${cx} ${fy - 32} L${cx - 2} ${fy - 39} L${cx} ${fy - 45} L${cx + 2} ${fy - 39} Z`} fill={`url(#${uid}-gold)`} />
          <path d={`M${cx} ${fy - 43} C${cx - 8} ${fy - 52} ${cx - 16} ${fy - 46} ${cx - 20} ${fy - 38} C${cx - 12} ${fy - 44} ${cx - 6} ${fy - 44} ${cx} ${fy - 40}`} fill={lighten(color, 0.1)} />
        </g>
      );
    case 'warrior':
      if (variant === 2) {
        return (
          <g>
            <path d={`M${cx - fw - 1} ${fy - 12} C${cx - fw - 2} ${fy - 31} ${cx + fw + 2} ${fy - 31} ${cx + fw + 1} ${fy - 12} Z`} fill={darken(color, 0.45)} />
            <path d={`M${cx - fw - 1} ${fy - 12} L${cx + fw + 1} ${fy - 12}`} stroke={lighten(color, 0.25)} strokeWidth="2.2" />
            <path d={`M${cx + fw} ${fy - 14} q7 6 3 17`} stroke={darken(color, 0.45)} strokeWidth="3" fill="none" />
          </g>
        );
      }
      return (
        <g>
          <ellipse cx={cx} cy={fy - 26.5} rx="5.8" ry="4.8" fill={`url(#${uid}-hair)`} />
          <rect x={cx - 6.5} y={fy - 27.5} width="13" height="1.8" fill={`url(#${uid}-gold)`} />
          <rect x={cx - fw - 1} y={fy - 15.5} width={fw * 2 + 2} height="4.6" rx="2" fill={color} stroke={darken(color, 0.45)} strokeWidth="0.6" />
          <path d={`M${cx + fw - 1} ${fy - 13} q6 2 7 10 M${cx + fw - 1} ${fy - 12} q4 4 3 11`} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'official':
      /* 진현관 — 검은 옻칠 관, 앞으로 기운 들보 */
      return (
        <g>
          <path d={`M${cx - fw + 1.5} ${fy - 14} C${cx - fw + 1.5} ${fy - 26} ${cx + fw - 1.5} ${fy - 26} ${cx + fw - 1.5} ${fy - 14} Z`} fill={hair} />
          <path d={`M${cx - 7} ${fy - 22} L${cx - 4} ${fy - 37} L${cx + 8} ${fy - 33} L${cx + 8} ${fy - 21} Z`} fill="#1d1813" stroke="#3b332a" strokeWidth="0.6" />
          <path d={`M${cx - 4} ${fy - 37} L${cx + 8} ${fy - 33}`} stroke="#6d6252" strokeWidth="0.8" />
          {variant === 1 && <path d={`M${cx - 2} ${fy - 32} L${cx + 6} ${fy - 30}`} stroke="#6d6252" strokeWidth="0.6" />}
          <rect x={cx - fw + 1} y={fy - 16.2} width={fw * 2 - 2} height="2.8" fill="#2b241c" />
          <path d={`M${cx - fw + 2} ${fy - 14} q-2 8 0 16 M${cx + fw - 2} ${fy - 14} q2 8 0 16`} stroke="#2b241c" strokeWidth="0.8" fill="none" />
        </g>
      );
    case 'strategist':
      if (hood) {
        /* 윤건 — 비단 두건과 늘어진 끈 */
        return (
          <g>
            <path d={`M${cx - fw - 2} ${fy - 8} C${cx - fw - 5} ${fy - 35} ${cx + fw + 5} ${fy - 35} ${cx + fw + 2} ${fy - 8} C${cx + fw * 0.5} ${fy - 16} ${cx - fw * 0.5} ${fy - 16} ${cx - fw - 2} ${fy - 8} Z`}
              fill="#2a3038" stroke="#151a20" strokeWidth="0.6" />
            {[-6, -2, 2, 6].map((x) => <path key={x} d={`M${cx + x} ${fy - 31} Q${cx + x * 1.3} ${fy - 22} ${cx + x * 1.6} ${fy - 13}`} stroke="#4a525c" strokeWidth="0.5" fill="none" />)}
            <path d={`M${cx + fw} ${fy - 12} q8 6 6 22 M${cx + fw - 1} ${fy - 10} q5 8 1 22`} stroke="#2a3038" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        );
      }
      return (
        <g>
          <path d={`M${cx - fw + 1} ${fy - 14} C${cx - fw + 1} ${fy - 28} ${cx + fw - 1} ${fy - 28} ${cx + fw - 1} ${fy - 14} Z`} fill="#1a1612" />
          <path d={`M${cx - 5} ${fy - 26} L${cx - 3} ${fy - 33} L${cx + 3} ${fy - 33} L${cx + 5} ${fy - 26} Z`} fill="#1a1612" />
          <rect x={cx - 1} y={fy - 36} width="2" height="10" fill={`url(#${uid}-gold)`} transform={`rotate(70 ${cx} ${fy - 31})`} />
          <rect x={cx - fw + 1} y={fy - 15} width={fw * 2 - 2} height="2.2" fill="#4a4036" />
        </g>
      );
    default:
      /* 은사 — 상투와 나무 비녀 */
      return (
        <g>
          <ellipse cx={cx} cy={fy - 27} rx="6.5" ry="5.2" fill={`url(#${uid}-hair)`} />
          <path d={`M${cx - 10} ${fy - 26} L${cx + 10} ${fy - 28}`} stroke="#b89a60" strokeWidth="1.5" strokeLinecap="round" />
          <path d={`M${cx - fw} ${fy - 14} C${cx - fw * 0.4} ${fy - 19} ${cx + fw * 0.4} ${fy - 19} ${cx + fw} ${fy - 14}`} stroke="#8f8a74" strokeWidth="2.2" fill="none" />
        </g>
      );
  }
}
