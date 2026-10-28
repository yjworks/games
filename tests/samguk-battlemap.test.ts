import { describe, expect, it } from 'vitest';
import { CITIES, NEIGHBORS } from '../src/games/samguk/data/cities';
import { BATTLE_MAPS } from '../src/games/samguk/data/battlemaps';
import { buildMap, entryTiles, entryVector, hexDist, hexLine } from '../src/games/samguk/engine/battlemap';
import { neighbors } from '../src/games/samguk/engine/battle';
import type { CityId } from '../src/games/samguk/data/types';
import { createBattle, floodZone, endSide, alive, canFlood, doFlood, tileAt } from '../src/games/samguk/engine/battle';
import { autoAllot } from '../src/games/samguk/engine/commands';
import { newGame } from '../src/games/samguk/engine/setup';

/** 험산만 막힌 것으로 보고(성벽·관문은 깨면 지나간다) 본진까지 닿는지 */
function reachesKeep(id: CityId, from: [number, number]) {
  const m = buildMap(id);
  const seen = new Set([from[1] * m.W + from[0]]);
  const q: [number, number][] = [from];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === m.keep[0] && y === m.keep[1]) return true;
    for (const [nx, ny] of neighbors(m, x, y)) {
      const k = ny * m.W + nx;
      if (seen.has(k) || m.tiles[k].t === 'peak') continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
}

describe('천하삼분 전장', () => {
  it('도시마다 전장이 하나씩 있다', () => {
    for (const c of CITIES) expect(BATTLE_MAPS[c.id], c.id).toBeDefined();
    expect(Object.keys(BATTLE_MAPS).length).toBe(CITIES.length);
  });

  it('육각 선은 끝점을 잇고 칸이 끊기지 않는다', () => {
    const line = hexLine([0, 0], [10, 7]);
    expect(line[0]).toEqual([0, 0]);
    expect(line[line.length - 1]).toEqual([10, 7]);
    for (let i = 1; i < line.length; i++) expect(hexDist(line[i - 1], line[i])).toBe(1);
  });

  for (const c of CITIES) {
    it(`${c.name}: 성벽·성문·본진이 있고, 모든 이웃에서 들어와 본진까지 닿는다`, () => {
      const m = buildMap(c.id);
      const count = (t: string) => m.tiles.filter((x) => x.t === t).length;
      expect(count('keep')).toBe(1);
      expect(count('gate'), 'gates').toBeGreaterThanOrEqual(2);
      expect(count('wall')).toBeGreaterThan(4);
      for (const n of NEIGHBORS[c.id]) {
        const slots = entryTiles(m, entryVector(n.to, c.id), 13, n.kind === 'w', new Set());
        expect(slots.length, `${c.id}←${n.to}`).toBe(13);
        for (const p of slots) {
          expect(hexDist(p, m.keep), `${c.id}←${n.to} ${p}`).toBeGreaterThan(m.radius + 1);
          expect(reachesKeep(c.id, p), `${c.id}←${n.to} ${p} 갇힘`).toBe(true);
        }
      }
    });
  }

  it('하비 수공: 제방에서 둑을 트면 성안까지 잠기고 성벽이 깎인다', () => {
    const g = newGame('s200', [], undefined, 9);
    const cao = g.factions.find((f) => f.ruler === 'caocao')!;
    const team = Object.values(g.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx).slice(0, 4).map((o) => o.id);
    const bs = createBattle(g, { faction: cao.idx, from: 'xiaopei', to: 'xiapi', officers: team, troops: autoAllot(g, team, 12000), food: 9000, gold: 0 });
    const zone = floodZone(bs);
    const [kq, kr] = bs.keep;
    expect(zone.has(kr * bs.W + kq)).toBe(true);
    const u = alive(bs, 0)[0];
    const dam = bs.tiles.findIndex((t) => t.t === 'dam');
    u.q = dam % bs.W; u.r = Math.floor(dam / bs.W);
    expect(canFlood(bs, u)).toBe(true);
    bs.rng = 1;
    u.stats[2] = 100;
    let tries = 0;
    while (!bs.floodUsed && tries++ < 20) { u.acted = false; doFlood(bs, u); }
    expect(bs.floodUsed).toBe(true);
    const wallsBefore = bs.tiles.filter((t) => t.t === 'wall' || t.t === 'gate').reduce((a, t) => a + t.hp, 0);
    endSide(bs); endSide(bs);
    const wallsAfter = bs.tiles.filter((t) => t.t === 'wall' || t.t === 'gate').reduce((a, t) => a + t.hp, 0);
    expect(wallsAfter).toBeLessThan(wallsBefore);
    expect(tileAt(bs, kq, kr).flood).toBeGreaterThan(0);
  });

  it('이웃 아군 도시에서 원군이 정해진 날 도착한다', () => {
    const g = newGame('s200', [], undefined, 10);
    const cao = g.factions.find((f) => f.ruler === 'caocao')!;
    const ys = g.factions.find((f) => f.ruler === 'yuanshao')!;
    expect(g.cities.nanpi.owner).toBe(ys.idx);
    g.cities.nanpi.troops = 30000;
    const team = Object.values(g.officers).filter((o) => o.status === 'serving' && o.faction === cao.idx).slice(0, 3).map((o) => o.id);
    const bs = createBattle(g, { faction: cao.idx, from: 'puyang', to: 'ye', officers: team, troops: autoAllot(g, team, 12000), food: 9000, gold: 0 });
    expect(bs.reinforce.length).toBeGreaterThan(0);
    const rf = bs.reinforce[0];
    expect(g.cities[rf.from].troops).toBeLessThan(30000 + 1);
    const ids = rf.units.map((u) => u.uid);
    for (let i = 0; i < 10 && bs.reinforce.length && !bs.over; i++) endSide(bs);
    expect(bs.units.some((u) => ids.includes(u.uid))).toBe(true);
  });

  it('관문 쪽에서 오면 수비 장수가 관을 지킨다', () => {
    const g = newGame('s228', [], undefined, 4);
    const shu = g.factions.find((f) => f.ruler === 'liushan')!;
    const wei = g.factions.find((f) => f.ruler === 'caorui')!;
    /* 위가 한중을 쳐들어올 때 장안(북) 쪽에서 오면 야곡을 지킨다 */
    const team = Object.values(g.officers).filter((o) => o.status === 'serving' && o.faction === wei.idx).slice(0, 4).map((o) => o.id);
    const bs = createBattle(g, { faction: wei.idx, from: 'changan', to: 'hanzhong', officers: team, troops: autoAllot(g, team, 15000), food: 9000, gold: 0 });
    expect(g.cities.hanzhong.owner).toBe(shu.idx);
    const guards = bs.units.filter((u) => u.guard);
    expect(guards.length).toBeGreaterThan(0);
    for (const u of guards) expect(tileAt(bs, u.guard![0], u.guard![1]).t).toBe('pass');
  });
});
