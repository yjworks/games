import { describe, expect, it } from 'vitest';
import { attackUnit, autoResolve, createBattle, doTactic, TACTICS, tacticChance, tacticTargets, tileAt, type BattleState, type Unit } from '../src/games/samguk/engine/battle';
import { autoAllot } from '../src/games/samguk/engine/commands';
import { newGame } from '../src/games/samguk/engine/setup';
import { KIND_LIST } from '../src/games/samguk/engine/units';

function battle(seed = 3): BattleState {
  const s = newGame('s200', [], undefined, seed);
  const cao = s.factions.find((f) => f.ruler === 'caocao')!;
  const team = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx).slice(0, 4).map((o) => o.id);
  return createBattle(s, { faction: cao.idx, from: 'puyang', to: 'ye', officers: team, troops: autoAllot(s, team, 16000), food: 9000, gold: 0 });
}

/** 들판 한가운데 두 부대만 남긴다 */
function duel(bs: BattleState, kindA: Unit['kind'], gap = 1): [Unit, Unit] {
  for (const t of bs.tiles) { t.t = 'plain'; t.hp = 0; t.fire = 0; t.flood = 0; }
  const a = bs.units.find((u) => u.side === 0)!;
  const d = bs.units.find((u) => u.side === 1)!;
  bs.units = [a, d];
  a.kind = kindA; a.q = 8; a.r = 6; a.acted = false; a.moved = false; a.confused = 0;
  d.q = 8 + gap; d.r = 6; d.confused = 0; d.guard = undefined;
  a.stats = [90, 95, 90, 70, 70];
  bs.weather = '맑음';
  return [a, d];
}

describe('천하삼분 전법', () => {
  it('병종 일곱 모두 전법이 있다', () => {
    for (const k of KIND_LIST) expect(TACTICS[k].name.length).toBeGreaterThan(0);
  });

  it('보병 돌파는 보통 공격보다 세고 반격이 없다', () => {
    let tactic = 0, normal = 0, back = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const bs = battle(seed);
      const [a, d] = duel(bs, '보병');
      bs.rng = seed * 99;
      const t0 = d.troops, a0 = a.troops;
      const line = doTactic(bs, a, d.q, d.r);
      if (/막혔다/.test(line)) continue;
      tactic += t0 - d.troops;
      back += a0 - a.troops;
      const bs2 = battle(seed);
      const [a2, d2] = duel(bs2, '보병');
      bs2.rng = seed * 99;
      const t1 = d2.troops;
      attackUnit(bs2, a2, d2, false);
      normal += t1 - d2.troops;
    }
    expect(tactic).toBeGreaterThan(normal * 1.3);
    expect(back).toBe(0);
  });

  it('기병 돌격은 두 칸 밖에서 달려들어 적을 밀어낸다', () => {
    let pushed = 0, tried = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const bs = battle(seed);
      const [a, d] = duel(bs, '기병', 2);
      expect(tacticTargets(bs, a).some((t) => t.q === d.q && t.r === d.r)).toBe(true);
      bs.rng = seed * 7;
      const before = d.q;
      const line = doTactic(bs, a, d.q, d.r);
      tried++;
      if (/막혔다/.test(line)) continue;
      expect(a.q).toBe(9);
      if (d.q !== before) pushed++;
    }
    expect(tried).toBe(30);
    expect(pushed).toBeGreaterThan(5);
  });

  it('투석은 성벽에 큰 피해를 준다', () => {
    const bs = battle(5);
    const a = bs.units.find((u) => u.side === 0)!;
    a.kind = '공성';
    const wall = bs.tiles.findIndex((t) => t.t === 'wall');
    const q = wall % bs.W, r = Math.floor(wall / bs.W);
    a.q = Math.max(0, q - 2); a.r = r; a.acted = false;
    const ts = tacticTargets(bs, a);
    const t = ts.find((x) => x.kind === 'tile');
    expect(t).toBeTruthy();
    const hp0 = tileAt(bs, t!.q, t!.r).hp;
    for (let i = 0; i < 20 && tileAt(bs, t!.q, t!.r).hp === hp0; i++) { a.acted = false; bs.rng = i * 31 + 1; doTactic(bs, a, t!.q, t!.r); }
    expect(tileAt(bs, t!.q, t!.r).hp).toBeLessThan(hp0);
  });

  it('성공률은 0~1 사이이고 비가 오면 궁병 전법이 어렵다', () => {
    const bs = battle(2);
    const [a, d] = duel(bs, '궁병', 2);
    const clear = tacticChance(bs, a, d.q, d.r);
    bs.weather = '비';
    const rain = tacticChance(bs, a, d.q, d.r);
    expect(clear).toBeGreaterThan(rain);
    expect(clear).toBeLessThanOrEqual(0.92);
    expect(rain).toBeGreaterThanOrEqual(0.08);
  });

  it('AI끼리 싸워도 전법을 쓰며 끝까지 간다', () => {
    let used = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const bs = battle(seed);
      autoResolve(bs);
      expect(bs.over).toBeTruthy();
      used += bs.log.filter((l) => /전법/.test(l)).length;
    }
    expect(used).toBeGreaterThan(0);
  });
});
