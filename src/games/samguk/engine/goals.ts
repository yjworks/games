import { log } from './commands';
import { chance, pick, rint } from './rng';
import type { GameState } from './state';

/**
 * 천명(天命) — 사람 세력이 늘 두 가지 단기 목표를 갖는다. 기한 안에 이루면 수도 창고에 상이 들어온다.
 * 목표가 있으면 「이번 달 무엇을 할까」가 뚜렷해진다. 컴퓨터 세력에는 없다.
 */

export type GoalKind = 'conquer' | 'recruit' | 'loyalty' | 'troops' | 'wealth' | 'food';

export interface Goal {
  kind: GoalKind;
  /** 목표치(점령·등용은 늘릴 수, 나머지는 도달 값) */
  target: number;
  /** 시작할 때 값(점령·등용 비교용) */
  base: number;
  /** 기한(연·월 포함) */
  until: [number, number];
  gold: number;
  food: number;
}

export const GOAL_TEXT: Record<GoalKind, (g: Goal) => string> = {
  conquer: (g) => `도시 ${g.target}곳을 더 얻는다`,
  recruit: (g) => `장수 ${g.target}명을 더 거둔다`,
  loyalty: (g) => `모든 도시 민심 ${g.target} 이상`,
  troops: (g) => `병력 ${g.target.toLocaleString('ko-KR')} 모으기`,
  wealth: (g) => `금 ${g.target.toLocaleString('ko-KR')} 쌓기`,
  food: (g) => `군량 ${g.target.toLocaleString('ko-KR')} 비축`,
};

function metric(s: GameState, f: number, kind: GoalKind): number {
  const cities = Object.values(s.cities).filter((c) => c.owner === f);
  switch (kind) {
    case 'conquer': return cities.length;
    case 'recruit': return Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f).length;
    case 'loyalty': return cities.length ? Math.min(...cities.map((c) => c.loyalty)) : 0;
    case 'troops': return cities.reduce((a, c) => a + c.troops, 0);
    case 'wealth': return cities.reduce((a, c) => a + c.gold, 0);
    case 'food': return cities.reduce((a, c) => a + c.food, 0);
  }
}

/** 진척: [지금, 목표] */
export function goalProgress(s: GameState, f: number, g: Goal): [number, number] {
  const now = metric(s, f, g.kind);
  if (g.kind === 'conquer' || g.kind === 'recruit') return [Math.max(0, now - g.base), g.target];
  return [now, g.target];
}

const monthsLeft = (s: GameState, g: Goal) => (g.until[0] - s.year) * 12 + (g.until[1] - s.month);
export const goalMonthsLeft = monthsLeft;

function newGoal(s: GameState, f: number, avoid: GoalKind[]): Goal {
  const kinds: GoalKind[] = (['conquer', 'recruit', 'loyalty', 'troops', 'wealth', 'food'] as GoalKind[]).filter((k) => !avoid.includes(k));
  const kind = pick(s, kinds);
  const now = metric(s, f, kind);
  const cities = Object.values(s.cities).filter((c) => c.owner === f).length;
  let target = 0, months = 6;
  switch (kind) {
    case 'conquer': target = cities >= 8 ? 2 : 1; months = 6 + target * 2; break;
    case 'recruit': target = rint(s, 2, 3); months = 6; break;
    case 'loyalty': target = Math.min(90, Math.max(60, Math.round(now / 5) * 5 + 10)); months = 5; break;
    case 'troops': target = Math.round((now * 1.25 + 4000) / 1000) * 1000; months = 6; break;
    case 'wealth': target = Math.round((now * 1.4 + 1500) / 500) * 500; months = 6; break;
    case 'food': target = Math.round((now * 1.3 + 6000) / 1000) * 1000; months = 7; break;
  }
  let y = s.year, m = s.month + months;
  while (m > 12) { m -= 12; y++; }
  const rich = kind === 'conquer' ? 2 : 1;
  return { kind, target, base: now, until: [y, m], gold: rint(s, 6, 10) * 100 * rich, food: chance(s, 0.5) ? rint(s, 2, 4) * 1000 * rich : 0 };
}

/** 달마다: 이룬 목표는 상을 주고 바꾸며, 기한이 지난 목표는 새로 낸다 */
export function goalTick(s: GameState) {
  s.goals = s.goals ?? {};
  for (const fac of s.factions) {
    if (!fac.alive || !fac.human) { delete s.goals[fac.idx]; continue; }
    const list = s.goals[fac.idx] ?? [];
    const keep: Goal[] = [];
    for (const g of list) {
      const [now, tgt] = goalProgress(s, fac.idx, g);
      if (now >= tgt) {
        const cap = s.cities[fac.capital];
        if (cap && cap.owner === fac.idx) { cap.gold += g.gold; cap.food += g.food; }
        log(s, `천명을 이루었다 — ${GOAL_TEXT[g.kind](g)}. 수도 창고에 금 ${g.gold.toLocaleString('ko-KR')}${g.food ? `·군량 ${g.food.toLocaleString('ko-KR')}` : ''}이 들어왔다.`, 'event', fac.idx);
        continue;
      }
      if (monthsLeft(s, g) < 0) {
        log(s, `천명을 놓쳤다 — ${GOAL_TEXT[g.kind](g)}.`, 'info', fac.idx);
        continue;
      }
      keep.push(g);
    }
    while (keep.length < 2) keep.push(newGoal(s, fac.idx, keep.map((g) => g.kind)));
    s.goals[fac.idx] = keep;
  }
}
