import { describe, expect, it } from 'vitest';
import { genDecisions, resolveDecision } from '../src/games/samguk/engine/decisions';
import { newGame } from '../src/games/samguk/engine/setup';

describe('천하삼분 결단', () => {
  it('사람 세력에게만 결단이 올라오고, 고르면 사라지며 결과가 남는다', () => {
    let seen = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame('s200', ['caocao'], undefined, seed);
      genDecisions(s);
      const me = s.factions.find((f) => f.ruler === 'caocao')!.idx;
      for (const d of s.decisions ?? []) {
        expect(d.f).toBe(me);
        expect(d.options.length).toBeGreaterThanOrEqual(2);
        seen++;
        const c = s.cities[d.city];
        c.gold = 5000; c.food = 20000; c.troops = 20000;
        const r = resolveDecision(s, d.id, d.options.length - 1);
        expect(r.msg.length).toBeGreaterThan(0);
        expect((s.decisions ?? []).some((x) => x.id === d.id)).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('컴퓨터끼리의 게임에서는 결단이 없다', () => {
    const s = newGame('s200', [], undefined, 4);
    genDecisions(s);
    expect(s.decisions?.length ?? 0).toBe(0);
  });

  it('도적 토벌은 병력을 쓰고 민심을 올린다', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = newGame('s208', ['liubei'], undefined, seed);
      genDecisions(s);
      const d = (s.decisions ?? []).find((x) => x.kind === 'bandit');
      if (!d) continue;
      const c = s.cities[d.city];
      c.troops = 10000; c.loyalty = 50;
      const r = resolveDecision(s, d.id, 0);
      expect(r.ok).toBe(true);
      expect(c.troops).toBeLessThan(10000);
      expect(c.loyalty).toBe(56);
      return;
    }
    throw new Error('도적 결단이 한 번도 나오지 않았다');
  });
});
