import { describe, expect, it } from 'vitest';
import { createBattle, reachable, attackUnit, attackTile, tileAt, type BattleState, type Unit } from '../src/games/samguk/engine/battle';
import { attack, autoAllot } from '../src/games/samguk/engine/commands';
import { newGame } from '../src/games/samguk/engine/setup';
import { KINDS, KIND_LIST, autoKind, kindAllowed, kindCost } from '../src/games/samguk/engine/units';
import type { GameState } from '../src/games/samguk/engine/state';

function battle(seed = 3): { s: GameState; bs: BattleState } {
  const s = newGame('s200', [], undefined, seed);
  const cao = s.factions.find((f) => f.ruler === 'caocao')!;
  const team = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx).slice(0, 4).map((o) => o.id);
  const bs = createBattle(s, { faction: cao.idx, from: 'puyang', to: 'ye', officers: team, troops: autoAllot(s, team, 16000), food: 9000, gold: 0 });
  return { s, bs };
}

/** 같은 조건에서 a가 d를 친 피해(난수 고정) */
function hit(bs: BattleState, a: Unit, d: Unit): number {
  const before = d.troops;
  a.acted = false; a.moved = false; bs.over = null; bs.rng = 12345;
  attackUnit(bs, a, d, false);
  const dmg = before - d.troops;
  d.troops = before; d.gone = null; d.morale = 80;
  a.troops = a.maxTroops; a.gone = null; a.morale = 80;
  return dmg;
}

describe('천하삼분 병종', () => {
  it('병종 표가 일곱 가지이고 값이 정상이다', () => {
    expect(KIND_LIST.length).toBe(7);
    for (const k of KIND_LIST) { expect(KINDS[k].move).toBeGreaterThan(0); expect(KINDS[k].def).toBeGreaterThan(0); }
  });

  it('편성 조건: 기병은 말 산지, 수군은 물가', () => {
    const s = newGame('s208', [], undefined, 1);
    const someone = Object.values(s.officers).find((o) => o.status === 'serving' && !(OFF(s, o.id).includes('기병')))!.id;
    expect(kindAllowed(s, 'ye', someone, '기병').ok).toBe(true);
    expect(kindAllowed(s, 'chengdu', someone, '기병').ok).toBe(false);
    expect(kindAllowed(s, 'anding', someone, '수군').ok).toBe(false);
    expect(kindAllowed(s, 'jiangling', someone, '수군').ok).toBe(true);
    expect(kindCost('chengdu', '기병', 2000)).toBeGreaterThan(kindCost('ye', '기병', 2000));
    for (const o of Object.values(s.officers).filter((x) => x.status === 'serving').slice(0, 80)) {
      const k = autoKind(s, o.city!, o.id, false);
      expect(kindAllowed(s, o.city!, o.id, k).ok, `${o.id} ${k}`).toBe(true);
    }
  });

  it('창병은 기병을 보병보다 세게 친다', () => {
    const { bs } = battle();
    const [a, b] = bs.units.filter((u) => u.side === 0);
    const d = bs.units.find((u) => u.side === 1)!;
    d.kind = '기병';
    a.q = d.q - 1; a.r = d.r; b.q = d.q + 1; b.r = d.r;
    b.stats = [...a.stats]; b.troops = a.troops; b.maxTroops = a.maxTroops; b.training = a.training; b.traits = [];
    a.traits = [];
    a.kind = '보병'; const inf = hit(bs, a, d);
    a.kind = '창병'; const pike = hit(bs, a, d);
    expect(pike).toBeGreaterThan(inf);
  });

  it('기병은 궁병을 짓밟고, 궁병은 붙으면 약하다', () => {
    const { bs } = battle(4);
    const a = bs.units.find((u) => u.side === 0)!;
    const d = bs.units.find((u) => u.side === 1)!;
    a.traits = [];
    d.kind = '궁병';
    a.kind = '보병'; const inf = hit(bs, a, d);
    a.kind = '기병'; const cav = hit(bs, a, d);
    expect(cav).toBeGreaterThan(inf);
  });

  it('공성병기는 성벽에 보병의 세 배 가까이 피해를 준다', () => {
    const { bs } = battle(5);
    const a = bs.units.find((u) => u.side === 0)!;
    const wall = bs.tiles.findIndex((t) => t.t === 'wall');
    const q = wall % bs.W, r = Math.floor(wall / bs.W);
    const hp0 = tileAt(bs, q, r).hp;
    a.kind = '보병'; a.acted = false; bs.rng = 7;
    attackTile(bs, a, q, r);
    const inf = hp0 - tileAt(bs, q, r).hp;
    tileAt(bs, q, r).hp = hp0;
    a.kind = '공성'; a.acted = false; bs.rng = 7;
    attackTile(bs, a, q, r);
    const siege = hp0 - tileAt(bs, q, r).hp;
    expect(siege).toBeGreaterThan(inf * 2.4);
  });

  it('기병은 트인 땅에서 더 멀리, 수군은 물 위에서 빠르다', () => {
    const { bs } = battle(6);
    const u = bs.units.find((x) => x.side === 0)!;
    for (const t of bs.tiles) { t.t = 'plain'; t.hp = 0; }
    bs.units = [u];
    u.q = 9; u.r = 6; u.moved = false; u.acted = false;
    u.kind = '보병'; u.move = KINDS.보병.move;
    const inf = reachable(bs, u).size;
    u.kind = '기병'; u.move = KINDS.기병.move;
    const cav = reachable(bs, u).size;
    expect(cav).toBeGreaterThan(inf);
    for (const t of bs.tiles) t.t = 'water';
    u.kind = '보병'; u.move = 4;
    const swim = reachable(bs, u).size;
    u.kind = '수군';
    const sail = reachable(bs, u).size;
    expect(sail).toBeGreaterThan(swim);
  });

  it('출진 명령이 병종 조건·정원·비용을 지킨다', () => {
    const s = newGame('s208', ['liubei'], undefined, 2);
    const lb = s.factions.find((f) => f.ruler === 'liubei')!;
    const c = s.cities.xinye;
    c.troops = 20000; c.gold = 5000; c.food = 20000;
    const team = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === lb.idx && o.city === 'xinye').slice(0, 2).map((o) => o.id);
    expect(team.length).toBe(2);
    const target = 'wan';
    const tr = autoAllot(s, team, 8000);
    const noHorse = team.find((id) => !OFF(s, id).includes('기병'));
    if (noHorse) {
      const idx = team.indexOf(noHorse);
      const kinds = team.map(() => '보병' as const) as ('보병' | '기병')[];
      kinds[idx] = '기병';
      expect(attack(s, 'xinye', target, team, tr, 3000, kinds).ok).toBe(false);
    }
    const big = team.map(() => 5000);
    expect(attack(s, 'xinye', target, team, big, 3000, ['공성', '보병']).ok).toBe(false);
    const gold0 = c.gold;
    const r = attack(s, 'xinye', target, team, [3000, 3000], 3000, ['공성', '창병']);
    expect(r.ok).toBe(true);
    expect(c.gold).toBe(gold0 - kindCost('xinye', '공성', 3000) - kindCost('xinye', '창병', 3000));
    const order = s.attacks[s.attacks.length - 1];
    const bs = createBattle(s, order);
    expect(bs.units.filter((u) => u.side === 0).map((u) => u.kind)).toEqual(['공성', '창병']);
  });
});

import { traitsOf } from '../src/games/samguk/engine/officers';
function OFF(s: GameState, id: string) { return traitsOf(s, id); }
