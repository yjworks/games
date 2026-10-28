import type { FactionKey } from '../data/types';

/**
 * 연호(年號) — 달이 바뀔 때 띄우는 붓글씨 알림용.
 * 220년까지는 후한, 그 뒤로는 칭제한 세력이면 그 나라, 아니면 위(魏) 연호를 쓴다. 해가 겹치면 늦게 시작한 연호.
 */
type Era = [start: number, name: string];

const HAN: Era[] = [[184, '中平'], [190, '初平'], [194, '興平'], [196, '建安'], [220, '延康']];
const WEI: Era[] = [[220, '黃初'], [227, '太和'], [233, '青龍'], [237, '景初'], [240, '正始'], [249, '嘉平'], [254, '正元'], [256, '甘露'], [260, '景元'], [264, '咸熙']];
const JIN: Era[] = [[265, '泰始'], [275, '咸寧'], [280, '太康']];
const SHU: Era[] = [[221, '章武'], [223, '建興'], [238, '延熙'], [258, '景耀'], [263, '炎興']];
const WU: Era[] = [[222, '黃武'], [229, '黃龍'], [232, '嘉禾'], [238, '赤烏'], [251, '太元'], [252, '建興'], [254, '五鳳'], [256, '太平'], [258, '永安'], [264, '元興'], [265, '甘露'], [266, '寶鼎'], [269, '建衡'], [272, '鳳凰'], [275, '天冊'], [276, '天璽'], [277, '天紀']];

const DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function hanNum(n: number): string {
  if (n <= 0) return '〇';
  if (n < 10) return DIGIT[n];
  if (n < 20) return `十${DIGIT[n % 10]}`;
  if (n < 100) return `${DIGIT[Math.floor(n / 10)]}十${DIGIT[n % 10]}`;
  return String(n).split('').map((c) => (c === '0' ? '〇' : DIGIT[+c])).join('');
}

function pick(list: Era[], year: number): string | null {
  let best: Era | null = null;
  for (const e of list) if (e[0] <= year) best = e;
  if (!best) return null;
  const n = year - best[0] + 1;
  return `${best[1]}${n === 1 ? '元' : hanNum(n)}年`;
}

export function eraName(year: number, key: FactionKey | null, emperor: boolean): string {
  if (year < 220) return pick(HAN, year) ?? `${hanNum(year)}年`;
  if (emperor) {
    const own = key === 'liubei' ? SHU : key === 'sun' ? WU : key === 'jin' ? JIN : key === 'cao' ? WEI : null;
    const v = own && pick(own, year);
    if (v) return v;
  }
  if (year >= 265) return pick(JIN, year)!;
  return pick(WEI, year)!;
}

export const MONTH_HAN = (m: number) => (m === 1 ? '正月' : `${hanNum(m)}月`);
export const SEASON_HAN = (m: number) => (m <= 3 ? '春' : m <= 6 ? '夏' : m <= 9 ? '秋' : '冬');
