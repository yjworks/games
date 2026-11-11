import { describe, expect, it } from 'vitest';
import { newGame } from '../src/games/samguk/engine/setup';
import { nextMonth } from '../src/games/samguk/engine/turn';

describe('천하삼분 시나리오·공백지', () => {
  it('208년 7월(적벽대전 전야): 9월 형주 항복 전이라 유표 밑에 유종·유기·채모·괴월·황충이 있다', () => {
    const s = newGame('s208', [], undefined, 1);
    const biao = s.factions.find((f) => f.ruler === 'liubiao')!;
    for (const id of ['liucong', 'liuqi', 'caimao', 'kuaiyue', 'huangzhong', 'wenpin']) {
      expect(s.officers[id].faction, id).toBe(biao.idx);
    }
    const n = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === biao.idx).length;
    expect(n).toBeGreaterThan(20);
  });

  it('주인을 잃은 도시의 대군은 몇 해 안에 흩어져 다시 차지할 수 있게 된다', () => {
    const s = newGame('s200', [], undefined, 2);
    const c = Object.values(s.cities).find((x) => x.owner >= 0)!;
    c.owner = -1;
    c.troops = 60000;
    for (let i = 0; i < 24; i++) nextMonth(s);
    /* 인구에 맞는 수비대(수천) 수준까지 줄어든다. 그새 누가 차지했어도 된다 */
    expect(c.owner < 0 ? c.troops : 0).toBeLessThan(6000);
  });
});
