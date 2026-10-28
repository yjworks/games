import { describe, expect, it } from 'vitest';
import { CITIES, NEIGHBORS, ROADS } from '../src/games/samguk/data/cities';
import { OFFICERS } from '../src/games/samguk/data/officers';
import { SCENARIOS } from '../src/games/samguk/data/scenarios';
import { ITEMS, initialItemPlacement } from '../src/games/samguk/data/items';
import { createBattle, autoResolve, dist, neighbors, reachable, attackTargets, fightDuel } from '../src/games/samguk/engine/battle';
import { attack, develop, draft, recruit, recruitChance, train, autoAllot } from '../src/games/samguk/engine/commands';
import { historicalKey, troopCap } from '../src/games/samguk/engine/officers';
import { newGame } from '../src/games/samguk/engine/setup';
import type { GameState } from '../src/games/samguk/engine/state';
import { advance, applyBattle, currentHuman, endTurn } from '../src/games/samguk/engine/turn';

const CITY_IDS = new Set(CITIES.map((c) => c.id));

function invariants(s: GameState) {
  for (const c of Object.values(s.cities)) {
    expect(c.gold).toBeGreaterThanOrEqual(0);
    expect(c.food).toBeGreaterThanOrEqual(0);
    expect(c.troops).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(c.troops)).toBe(true);
    if (c.owner >= 0) expect(s.factions[c.owner].alive).toBe(true);
  }
  for (const o of Object.values(s.officers)) {
    if (o.status === 'serving') {
      expect(o.city).not.toBeNull();
      expect(s.factions[o.faction].alive).toBe(true);
      expect(s.cities[o.city!].owner).toBe(o.faction);
    }
    if (o.status === 'dead' || o.status === 'hidden') expect(o.city).toBeNull();
  }
  for (const f of s.factions) {
    if (!f.alive) continue;
    expect(s.officers[f.ruler].status).toBe('serving');
    expect(s.officers[f.ruler].faction).toBe(f.idx);
  }
}

describe('천하삼분 데이터', () => {
  it('인물 500명 이상, id 중복 없음, 도시·연도 정상', () => {
    expect(OFFICERS.length).toBeGreaterThanOrEqual(500);
    const ids = new Set<string>();
    for (const o of OFFICERS) {
      expect(ids.has(o.id), o.id).toBe(false);
      ids.add(o.id);
      expect(CITY_IDS.has(o.home), `${o.id} home`).toBe(true);
      expect(o.died, o.id).toBeGreaterThan(o.born);
      expect(o.stats.every((v) => v >= 1 && v <= 100), o.id).toBe(true);
      for (let i = 1; i < o.svc.length; i++) expect(o.svc[i][0], o.id).toBeGreaterThanOrEqual(o.svc[i - 1][0]);
      expect(o.bio.length, o.id).toBeGreaterThan(10);
    }
  });

  it('길은 양쪽 도시가 모두 있고 모든 도시가 이어져 있다', () => {
    for (const [a, b] of ROADS) { expect(CITY_IDS.has(a)).toBe(true); expect(CITY_IDS.has(b)).toBe(true); }
    const seen = new Set([CITIES[0].id]);
    const q = [CITIES[0].id];
    while (q.length) for (const n of NEIGHBORS[q.shift()!]) if (!seen.has(n.to)) { seen.add(n.to); q.push(n.to); }
    expect(seen.size).toBe(CITIES.length);
  });

  it('시나리오 군주·도시가 데이터에 있고 도시가 겹치지 않는다', () => {
    const ids = new Set(OFFICERS.map((o) => o.id));
    for (const sc of SCENARIOS) {
      const used = new Set<string>();
      for (const f of sc.factions) {
        expect(ids.has(f.ruler), `${sc.id} ${f.ruler}`).toBe(true);
        expect(f.cities).toContain(f.capital);
        for (const c of f.cities) { expect(used.has(c), `${sc.id} ${c}`).toBe(false); used.add(c); expect(CITY_IDS.has(c)).toBe(true); }
      }
    }
  });

  it('보물 배치는 있는 인물·도시만 가리킨다', () => {
    const ids = new Set(OFFICERS.map((o) => o.id));
    for (const y of [190, 200, 228]) {
      const p = initialItemPlacement(y);
      expect(Object.keys(p).sort()).toEqual(ITEMS.map((i) => i.id).sort());
      for (const v of Object.values(p)) {
        if (v.holder) expect(ids.has(v.holder)).toBe(true);
        if (v.city) expect(CITY_IDS.has(v.city)).toBe(true);
      }
    }
  });

  it('역사 소속 이력은 연도에 따라 바뀐다', () => {
    const lb = OFFICERS.find((o) => o.id === 'liubei')!;
    expect(historicalKey(lb, 230)).toBe('liubei');
    const cc = OFFICERS.find((o) => o.id === 'caocao')!;
    expect(historicalKey(cc, 200)).toBe('cao');
  });
});

describe('천하삼분 시작 배치', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.year} ${sc.name}: 군주는 자기 수도에, 죽은 사람·미등장 인물은 없다`, () => {
      const s = newGame(sc.id, [], undefined, 7);
      invariants(s);
      for (const f of s.factions) {
        const r = s.officers[f.ruler];
        expect(r.city).toBe(f.capital);
      }
      for (const o of OFFICERS) {
        const st = s.officers[o.id];
        if (o.died < sc.year) expect(st.status, o.id).toBe('dead');
        if (st.status === 'serving') expect(o.born, o.id).toBeLessThanOrEqual(sc.year - 8);
      }
      const serving = Object.values(s.officers).filter((o) => o.status === 'serving').length;
      expect(serving).toBeGreaterThan(sc.factions.length * 2);
    });
  }

  it('삼국정립(215): 관우는 유비군, 손권은 오군 수도에', () => {
    const s = newGame('s215', [], undefined, 3);
    const lb = s.factions.find((f) => f.ruler === 'liubei')!;
    expect(s.officers.guanyu.faction).toBe(lb.idx);
    expect(s.officers.zhugeliang.faction).toBe(lb.idx);
    const wu = s.factions.find((f) => f.ruler === 'sunquan')!;
    expect(s.officers.sunquan.city).toBe(wu.capital);
  });
});

describe('천하삼분 명령', () => {
  it('개간·징병·훈련은 정해진 범위로 움직이고 장수를 쓴다', () => {
    const s = newGame('s190', ['caocao'], undefined, 11);
    advance(s);
    const f = currentHuman(s);
    expect(f).toBeGreaterThanOrEqual(0);
    const city = s.factions[f].capital;
    const c = s.cities[city];
    c.gold = 2000;
    const before = c.agri;
    const r = develop(s, city, 'caocao', 'agri');
    expect(r.ok).toBe(true);
    expect(c.agri).toBeGreaterThan(before);
    expect(develop(s, city, 'caocao', 'agri').ok).toBe(false); // 한 달에 한 번
    const other = Object.values(s.officers).find((o) => o.status === 'serving' && o.faction === f && o.city === city && !o.acted)!;
    const t0 = c.troops;
    expect(draft(s, city, other.id, 1000).ok).toBe(true);
    expect(c.troops).toBe(t0 + 1000);
    const third = Object.values(s.officers).find((o) => o.status === 'serving' && o.faction === f && o.city === city && !o.acted);
    if (third) { const tr = c.training; train(s, city, third.id); expect(c.training).toBeGreaterThanOrEqual(tr); }
  });

  it('등용 확률은 0~1, 군주는 등용할 수 없다', () => {
    const s = newGame('s200', ['liubei'], undefined, 5);
    expect(recruitChance(s, 'liubei', 'caocao')).toBe(0);
    for (const o of Object.values(s.officers).slice(0, 200)) {
      const p = recruitChance(s, 'liubei', o.id);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(recruit(s, 'xiapi', 'liubei', 'caocao').ok).toBe(false);
  });

  it('병력 배분은 상한과 총량을 넘지 않는다', () => {
    const s = newGame('s190', [], undefined, 1);
    const ids = ['caocao', 'xiahoudun', 'caoren'].filter((id) => s.officers[id]);
    const a = autoAllot(s, ids, 25000);
    expect(a.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(25000);
    ids.forEach((id, i) => expect(a[i]).toBeLessThanOrEqual(troopCap(s, id)));
  });
});

describe('천하삼분 전투', () => {
  it('육각 칸 거리와 이웃', () => {
    const bs = { W: 15, H: 11 };
    expect(dist([3, 3], [3, 3])).toBe(0);
    for (const [q, r] of neighbors(bs, 5, 5)) expect(dist([5, 5], [q, r])).toBe(1);
    for (const [q, r] of neighbors(bs, 6, 4)) expect(dist([6, 4], [q, r])).toBe(1);
    expect(neighbors(bs, 0, 0).length).toBeLessThan(6);
  });

  it('압도적인 병력은 성을 빼앗고, 결과가 도시에 반영된다', () => {
    const s = newGame('s190', [], undefined, 21);
    const cao = s.factions.find((f) => f.ruler === 'caocao')!;
    const from = s.cities.chenliu;
    from.troops = 60000; from.training = 95; from.morale = 95; from.food = 30000;
    const target = s.cities.xuchang; // 공백지
    expect(target.owner).toBe(-1);
    const team = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx && o.city === 'chenliu').slice(0, 5).map((o) => o.id);
    const troops = autoAllot(s, team, 40000);
    const r = attack(s, 'chenliu', 'xuchang', team, troops, 8000);
    expect(r.ok).toBe(true);
    const order = s.attacks.shift()!;
    const bs = createBattle(s, order);
    const u = bs.units.find((x) => x.side === 0)!;
    expect(reachable(bs, u).size).toBeGreaterThan(1);
    expect(attackTargets(bs, u)).toBeDefined();
    autoResolve(bs);
    expect(bs.over).not.toBeNull();
    const rep = applyBattle(s, bs);
    expect(rep.winner).toBe(0);
    expect(target.owner).toBe(cao.idx);
    invariants(s);
  });

  it('일기토는 승패가 나거나 비긴다', () => {
    const rng = { rng: 99 };
    const mk = (name: string, war: number, side: 0 | 1) => ({
      uid: 1, officer: name, name, side, faction: 0, q: 0, r: 0, troops: 1000, maxTroops: 1000, morale: 80, training: 80,
      stats: [80, war, 50, 50, 50] as [number, number, number, number, number], traits: [], move: 4, moved: false, acted: false,
      confused: 0, commander: false, gone: null,
    });
    let strongWins = 0;
    for (let i = 0; i < 200; i++) {
      const r = fightDuel(rng, mk('a', 98, 0), mk('b', 55, 1));
      expect([0, 1, -1]).toContain(r.winner);
      if (r.winner === 0) strongWins++;
    }
    expect(strongWins).toBeGreaterThan(120);
  });
});

describe('천하삼분 자동 진행', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.year} ${sc.name}: 컴퓨터끼리 15년을 돌려도 상태가 무너지지 않는다`, () => {
      const s = newGame(sc.id, [], { difficulty: 'normal', lifespan: 'history', manualBattle: false }, 1234);
      for (let m = 0; m < 180 && !s.over; m++) {
        advance(s, 1);
        invariants(s);
      }
      expect(s.year).toBeGreaterThanOrEqual(sc.year + (s.over ? 0 : 14));
    }, 60_000);
  }

  it('사람 세력은 차례를 기다리고, 턴을 넘기면 다음 달로 간다', () => {
    const s = newGame('s208', ['liubei'], { difficulty: 'normal', lifespan: 'history', manualBattle: false }, 77);
    advance(s);
    const f = currentHuman(s);
    expect(s.factions[f].ruler).toBe('liubei');
    const m0 = s.year * 12 + s.month;
    for (let i = 0; i < 24 && !s.over; i++) { endTurn(s); invariants(s); }
    expect(s.year * 12 + s.month).toBeGreaterThan(m0);
  }, 60_000);

  it('저장한 상태를 JSON으로 왕복해도 같다', () => {
    const s = newGame('s196', ['caocao'], undefined, 42);
    advance(s);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(copy).toEqual(s);
    endTurn(copy);
    endTurn(s);
    expect(copy.year * 12 + copy.month).toBe(s.year * 12 + s.month);
    expect(copy.rng).toBe(s.rng);
  });
});
