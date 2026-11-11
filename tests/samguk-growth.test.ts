import { describe, expect, it } from 'vitest';
import { OFFICER_DEF } from '../src/games/samguk/data/officers';
import { attackUnit, autoResolve, comboHelpers, createBattle, type BattleState, type Unit } from '../src/games/samguk/engine/battle';
import { autoAllot, develop } from '../src/games/samguk/engine/commands';
import { GROW_MAX, gainXp, gainXpAll } from '../src/games/samguk/engine/growth';
import { POL, WAR, statsOf } from '../src/games/samguk/engine/officers';
import { newGame } from '../src/games/samguk/engine/setup';
import { shoutLine, type ShoutKind } from '../src/games/samguk/engine/shouts';
import { finishBattle } from '../src/games/samguk/engine/turn';

function battle(seed = 3): BattleState {
  const s = newGame('s200', [], undefined, seed);
  const cao = s.factions.find((f) => f.ruler === 'caocao')!;
  const team = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx).slice(0, 4).map((o) => o.id);
  return createBattle(s, { faction: cao.idx, from: 'puyang', to: 'ye', officers: team, troops: autoAllot(s, team, 16000), food: 9000, gold: 0 });
}

/** 들판에 공격 부대 a, 과녁 d, 그 곁의 도우미 h만 남긴다 */
function field(bs: BattleState): [Unit, Unit, Unit] {
  for (const t of bs.tiles) { t.t = 'plain'; t.hp = 0; t.fire = 0; t.flood = 0; }
  const atk = bs.units.filter((u) => u.side === 0);
  const a = atk[0], h = atk[1];
  const d = bs.units.find((u) => u.side === 1)!;
  bs.units = [a, h, d];
  for (const u of bs.units) { u.acted = false; u.moved = false; u.confused = 0; u.guard = undefined; u.kind = '보병'; u.troops = 6000; u.maxTroops = 6000; u.morale = 80; }
  a.q = 8; a.r = 6; d.q = 9; d.r = 6; h.q = 9; h.r = 5;
  bs.weather = '맑음';
  return [a, d, h];
}

describe('천하삼분 장수 성장', () => {
  it('경험 100마다 능력 +1, 한계는 +10과 100', () => {
    const s = newGame('s200', [], undefined, 1);
    const o = s.officers.xunyu;
    const base = OFFICER_DEF.xunyu.stats[POL];
    let ups = 0;
    for (let i = 0; i < 200; i++) if (gainXp(o, POL, 50)) ups++;
    expect(o.grow![POL]).toBe(Math.min(GROW_MAX, 100 - base));
    expect(ups).toBe(o.grow![POL]);
    expect(statsOf(s, 'xunyu')[POL]).toBeLessThanOrEqual(100);
    expect(statsOf(s, 'xunyu')[POL]).toBe(base + o.grow![POL]);
  });

  it('능력이 낮은 장수가 더 빨리 자란다', () => {
    const s = newGame('s200', [], undefined, 1);
    const weak = Object.values(s.officers).find((o) => OFFICER_DEF[o.id].stats[WAR] < 50)!;
    const strong = Object.values(s.officers).find((o) => OFFICER_DEF[o.id].stats[WAR] >= 85 && OFFICER_DEF[o.id].stats[WAR] < 90)!;
    gainXpAll(weak, [0, 300, 0, 0, 0]);
    gainXpAll(strong, [0, 300, 0, 0, 0]);
    expect(weak.grow![WAR]).toBeGreaterThan(strong.grow![WAR]);
  });

  it('내정 명령을 하면 그 능력의 경험이 쌓인다', () => {
    const s = newGame('s200', [], undefined, 2);
    const cao = s.factions.find((f) => f.ruler === 'caocao')!;
    const cap = s.cities[cao.capital];
    cap.gold = 99999; cap.agri = 0;
    const o = Object.values(s.officers).find((x) => x.status === 'serving' && x.faction === cao.idx && x.city === cao.capital)!;
    const r = develop(s, cap.id, o.id, 'agri');
    expect(r.ok).toBe(true);
    expect(o.xp![POL]).toBeGreaterThan(0);
  });

  it('전투에서 쌓은 경험이 끝나고 장수에게 간다', () => {
    const bs = battle(5);
    const s = newGame('s200', [], undefined, 5);
    bs.units.filter((u) => u.side === 0 && u.officer).forEach((u) => { u.xp = [0, 400, 0, 0, 0]; });
    autoResolve(bs);
    s.battle = bs;
    const ids = bs.units.filter((u) => u.side === 0 && u.officer && !u.gone).map((u) => u.officer!);
    finishBattle(s);
    const grown = ids.filter((id) => (s.officers[id].grow?.[WAR] ?? 0) > 0 || OFFICER_DEF[id].stats[WAR] >= 100);
    expect(grown.length).toBeGreaterThan(0);
  });
});

describe('천하삼분 협공', () => {
  it('곁에 아군이 있으면 협공이 터지고, 반격도 행동도 쓰지 않는다', () => {
    let combos = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const bs = battle(seed);
      const [a, d, h] = field(bs);
      h.stats = [90, 95, 60, 60, 60];
      h.acted = false;
      bs.rng = seed * 31;
      attackUnit(bs, a, d, false);
      if (bs.log.some((l) => l.startsWith(`${h.name} → ${d.name}: 협공 −`))) combos++;
      expect(h.acted).toBe(false);
    }
    expect(combos).toBeGreaterThan(5);
  });

  it('인연 장수는 거의 늘 협공한다', () => {
    let combos = 0, n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const bs = battle(seed);
      const [a, d, h] = field(bs);
      a.officer = 'liubei'; h.officer = 'guanyu'; a.name = '유비'; h.name = '관우';
      expect(comboHelpers(bs, a, d)[0].bond).toBe(true);
      bs.rng = seed * 17;
      attackUnit(bs, a, d, false);
      n++;
      if (bs.log.some((l) => l.startsWith('관우 → ') && l.includes('(인연)'))) combos++;
    }
    expect(combos / n).toBeGreaterThan(0.6);
  });

  it('곁에 아무도 없으면 협공이 없다', () => {
    const bs = battle(4);
    const [a, d, h] = field(bs);
    h.q = 1; h.r = 1;
    attackUnit(bs, a, d, false);
    expect(bs.log.some((l) => l.includes('협공'))).toBe(false);
  });
});

describe('천하삼분 전장 대사', () => {
  it('모든 장수·상황에 대사가 있고 seed가 같으면 같은 말', () => {
    const kinds: ShoutKind[] = ['open', 'tactic', 'combo', 'bond', 'rout', 'win'];
    for (const id of ['zhangfei', 'xunyu', 'liubei', Object.keys(OFFICER_DEF)[50]]) {
      for (const k of kinds) {
        const t = shoutLine(id, k, 7);
        expect(t.length).toBeGreaterThan(1);
        expect(shoutLine(id, k, 7)).toBe(t);
      }
    }
  });
});
