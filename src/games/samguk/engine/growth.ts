import { OFFICER_DEF } from '../data/officers';
import type { Officer } from './state';

/**
 * 장수 성장 — 일을 할수록 그 일에 쓰는 능력이 자란다.
 * 경험 100마다 능력 +1. 능력마다 최대 +10, 100은 넘지 않는다.
 * 원래 능력이 낮을수록 빨리 는다(배우는 맛). 컴퓨터 세력 장수도 똑같이 자란다.
 */

export const GROW_MAX = 10;
const NAMES = ['통솔', '무력', '지력', '정치', '매력'];

/** 방금 오른 능력(화면이 알림에 덧붙이고 지운다) */
export const growNote: { text: string | null } = { text: null };

export function growthOf(o: Officer | undefined): number[] {
  return o?.grow ?? [0, 0, 0, 0, 0];
}

/** 경험을 더한다. 능력이 오르면 「무력 97→98」 같은 글을 돌려준다 */
export function gainXp(o: Officer, k: number, amount: number): string | null {
  const d = OFFICER_DEF[o.id];
  if (!d || k < 0 || k > 4 || amount <= 0) return null;
  o.grow = o.grow ?? [0, 0, 0, 0, 0];
  o.xp = o.xp ?? [0, 0, 0, 0, 0];
  const from = d.stats[k] + o.grow[k];
  const can = () => o.grow![k] < GROW_MAX && d.stats[k] + o.grow![k] < 100;
  if (!can()) return null;
  const speed = from < 60 ? 1.5 : from < 80 ? 1.2 : 1;
  o.xp[k] += Math.round(amount * speed);
  while (o.xp[k] >= 100 && can()) { o.xp[k] -= 100; o.grow[k] += 1; }
  if (!can()) o.xp[k] = 0;
  const to = d.stats[k] + o.grow[k];
  if (to === from) return null;
  const text = `${NAMES[k]} ${from}→${to}`;
  growNote.text = growNote.text ? `${growNote.text}, ${text}` : text;
  return text;
}

/** 여러 능력의 경험을 한꺼번에(전투 뒤 정산) */
export function gainXpAll(o: Officer, xp: number[]): string[] {
  const out: string[] = [];
  for (let k = 0; k < 5; k++) {
    const t = gainXp(o, k, xp[k] ?? 0);
    if (t) out.push(t);
  }
  return out;
}
