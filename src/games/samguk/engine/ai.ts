import { NEIGHBORS } from '../data/cities';
import type { CityId } from '../data/types';
import {
  allied, appointAdvisor, attack, autoAllot, captiveChance, develop, draft, draftMax, factionPower, goodwill,
  moveOfficer, proposeAlliance, recruit, recruitChance, relief, reliefCost, reward, search, train, transport,
  treatCaptive, demandSurrender, surrenderChance, rumor, rumorChance, trade, buyPrice,
} from './commands';
import { CHA, INT, LEAD, POL, WAR, captivesOf, def, officersIn, stat, troopCap, worth } from './officers';
import { chance, rnd } from './rng';
import { agriCap, commCap } from './setup';
import type { City, GameState, Officer } from './state';

const ATTACK_RATIO = { easy: 1.4, normal: 1.2, hard: 1.05 } as const;

export function aiTurn(s: GameState, f: number) {
  const fac = s.factions[f];
  if (!fac.alive) return;
  if (!fac.advisor) {
    const best = officersIn_all(s, f).filter((o) => o.id !== fac.ruler).sort((a, b) => stat(s, b.id, INT) - stat(s, a.id, INT))[0];
    if (best && stat(s, best.id, INT) >= 70) appointAdvisor(s, f, best.id);
  }
  aiCaptives(s, f);
  aiMilitary(s, f);
  aiCities(s, f, false);
  aiRewards(s, f);
  if (chance(s, 0.15)) aiDiplomacy(s, f);
}

function officersIn_all(s: GameState, f: number) {
  return Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f);
}

function ownCities(s: GameState, f: number): City[] {
  return (Object.values(s.cities) as City[]).filter((c) => c.owner === f);
}

/** 적대 이웃 도시(동맹 제외) */
function hostileNeighbors(s: GameState, c: City): City[] {
  return NEIGHBORS[c.id].map((n) => s.cities[n.to]).filter((x) => x.owner !== c.owner && !allied(s, c.owner, x.owner));
}

function threat(s: GameState, c: City) {
  return hostileNeighbors(s, c).reduce((a, x) => a + x.troops * (x.owner < 0 ? 0.2 : 1), 0);
}

const free = (s: GameState, cityId: CityId, f: number) => officersIn(s, cityId, f).filter((o) => !o.acted);

function best(s: GameState, list: Officer[], k: number): Officer | undefined {
  return [...list].sort((a, b) => stat(s, b.id, k) - stat(s, a.id, k))[0];
}

/* ───────────── 도시 내정 ───────────── */

export function aiCities(s: GameState, f: number, delegatedOnly: boolean) {
  for (const c of ownCities(s, f)) {
    if (delegatedOnly && !c.delegated) continue;
    aiCity(s, f, c);
  }
}

function aiCity(s: GameState, f: number, c: City) {
  /* 상인: 군량이 석 달 치도 안 되면 사고, 넘치면 판다 */
  const upkeep = Math.ceil(c.troops * 0.01);
  if (!c.traded && c.food < upkeep * 4 && c.gold > 300) {
    trade(s, c.id, f, true, Math.floor(Math.min(c.gold - 200, upkeep * 8 / 100 * buyPrice(s)) / buyPrice(s)) * 100);
  } else if (!c.traded && c.food > upkeep * 30 + 20000 && c.gold < 300) {
    trade(s, c.id, f, false, Math.floor((c.food - upkeep * 20) / 200) * 100);
  }
  const frontier = hostileNeighbors(s, c).some((x) => x.owner >= 0);
  const th = threat(s, c);
  const reserve = frontier ? 60 : 120;
  const staff = officersIn(s, c.id, f);
  const talents = Object.values(s.officers).filter((o) => o.status === 'free' && o.city === c.id);
  for (let step = 0; step < 12; step++) {
    const pool = staff.filter((o) => !o.acted && o.status === 'serving' && o.city === c.id);
    if (!pool.length) return;
    /* 1. 재야 인재 */
    const talent = talents.find((o) => o.status === 'free' && o.found && o.city === c.id);
    if (talent) {
      const r = [...pool].sort((a, b) => recruitChance(s, b.id, talent.id) - recruitChance(s, a.id, talent.id))[0];
      if (recruitChance(s, r.id, talent.id) > 0.15) { recruit(s, c.id, r.id, talent.id); continue; }
    }
    /* 2. 민심 */
    if (c.loyalty < 40 && c.food > reliefCost(c) * 3) { relief(s, c.id, best(s, pool, CHA)!.id); continue; }
    /* 3. 국경 방비 */
    if (frontier) {
      const want = Math.min(60000, Math.max(th * 0.85, 4000 + c.pop / 10000 * 60));
      const drafter = best(s, pool, CHA)!;
      if (c.troops < want && c.gold > 120 && draftMax(s, c, drafter.id) >= 500 && c.loyalty > 35) {
        draft(s, c.id, drafter.id, Math.min(draftMax(s, c, drafter.id), want - c.troops + 1000));
        continue;
      }
      if (c.training < 80 && c.troops > 1000) { train(s, c.id, best(s, pool, LEAD)!.id); continue; }
      if (c.wall < 70 && c.gold > reserve + 50) { develop(s, c.id, best(s, pool, POL)!.id, 'wall'); continue; }
    }
    /* 4. 개발 */
    if (c.gold > reserve + 50) {
      const pol = best(s, pool, POL)!;
      const ra = c.agri / agriCap(c), rc = c.comm / commCap(c);
      if (c.flood < 35 && rnd(s) < 0.5) { develop(s, c.id, pol.id, 'flood'); continue; }
      if (ra < 0.98 || rc < 0.98) { develop(s, c.id, pol.id, ra <= rc ? 'agri' : 'comm'); continue; }
      if (c.wall < 90) { develop(s, c.id, pol.id, 'wall'); continue; }
    }
    /* 5. 남는 손 — 훈련·탐색·징병 */
    const o = pool[0];
    if (c.training < 90 && c.troops > 500) { train(s, c.id, best(s, pool, LEAD)!.id); continue; }
    if (rnd(s) < 0.5) { search(s, c.id, best(s, pool, INT)!.id); continue; }
    if (c.gold > 300 && c.troops < 15000 && c.loyalty > 50) { draft(s, c.id, best(s, pool, CHA)!.id, 2000); continue; }
    o.acted = true; // 쉰다
  }
}

/* ───────────── 군사 ───────────── */

function aiMilitary(s: GameState, f: number) {
  const fac = s.factions[f];
  const cities = ownCities(s, f);
  /* 국경까지의 거리 */
  const distTo: Record<string, number> = {};
  const q: CityId[] = [];
  for (const c of cities) if (hostileNeighbors(s, c).some((x) => x.owner >= 0) || hostileNeighbors(s, c).length) { distTo[c.id] = 0; q.push(c.id); }
  while (q.length) {
    const id = q.shift()!;
    for (const n of NEIGHBORS[id]) {
      if (s.cities[n.to].owner !== f || distTo[n.to] !== undefined) continue;
      distTo[n.to] = distTo[id] + 1;
      q.push(n.to);
    }
  }

  /* 공격 */
  const ratio = ATTACK_RATIO[s.options.difficulty] * (0.9 + (10 - def(fac.ruler).amb) * 0.03);
  let attacks = 0;
  const targeted = new Set<CityId>();
  const order = [...cities].sort((a, b) => b.troops - a.troops);
  for (const c of order) {
    if (attacks >= 3) break;
    const hostile = hostileNeighbors(s, c);
    if (!hostile.length) continue;
    const avail = free(s, c.id, f).sort((a, b) => stat(s, b.id, LEAD) + stat(s, b.id, WAR) - stat(s, a.id, LEAD) - stat(s, a.id, WAR));
    if (avail.length === 0) continue;
    const allThreat = hostile.reduce((a, x) => a + (x.owner >= 0 ? x.troops : 0), 0);
    let pick: { t: City; score: number; pool: number } | null = null;
    for (const t of hostile) {
      if (targeted.has(t.id)) continue;
      const otherThreat = allThreat - (t.owner >= 0 ? t.troops : 0);
      const pool = c.troops - Math.max(1500, Math.round(otherThreat * 0.3));
      if (pool < 3000) continue;
      const defOff = t.owner >= 0 ? officersIn(s, t.id, t.owner) : [];
      const defense = t.troops * (1 + t.wall / 250) + defOff.reduce((a, o) => a + worth(s, o.id) * 5, 0) + 500;
      const leaders = avail.slice(0, 10);
      const cap = leaders.reduce((a, o) => a + troopCap(s, o.id), 0);
      const force = Math.min(pool, cap) * (1 + leaders.slice(0, 3).reduce((a, o) => a + stat(s, o.id, LEAD), 0) / 600);
      const r = force / defense;
      if (r < ratio) continue;
      const score = r + (t.owner < 0 ? 0.3 : 0) + (t.id === s.factions[t.owner]?.capital ? 0.2 : 0) + t.pop / 2_000_000;
      if (!pick || score > pick.score) pick = { t, score, pool };
    }
    if (!pick) continue;
    /* 도시를 비우지 않도록 장수 한 명은 남긴다 */
    const stay = officersIn(s, c.id, f).length - avail.length > 0 ? 0 : 1;
    const team = avail.slice(0, Math.max(1, Math.min(10, avail.length - stay)));
    if (team.length === 0 || (stay && avail.length < 2)) continue;
    const troops = autoAllot(s, team.map((o) => o.id), pick.pool);
    const total = troops.reduce((a, b) => a + b, 0);
    const food = Math.min(c.food - 500, Math.ceil(total * 0.004 * 35));
    if (food < total * 0.05) continue;
    const res = attack(s, c.id, pick.t.id, team.map((o) => o.id), troops, food);
    if (res.ok) { attacks++; targeted.add(pick.t.id); }
  }

  /* 후방 → 전방 수송 */
  for (const c of cities) {
    const d = distTo[c.id];
    if (d === undefined || d === 0) continue;
    const next = NEIGHBORS[c.id].map((n) => n.to).filter((id) => distTo[id] !== undefined && distTo[id] < d)[0];
    if (!next) continue;
    const avail = free(s, c.id, f);
    if (!avail.length) continue;
    const staff = officersIn(s, c.id, f).length;
    const keepT = 1500;
    if (c.troops > keepT + 2000 || (c.gold > 600 && c.food > 6000)) {
      const carrier = avail.length > 1 || staff > 1 ? avail.sort((a, b) => worth(s, a.id) - worth(s, b.id))[0] : null;
      if (carrier) {
        transport(s, c.id, carrier.id, next, Math.max(0, c.gold - 300), Math.max(0, c.food - 5000), Math.max(0, c.troops - keepT));
        continue;
      }
    }
    /* 장수도 앞으로 */
    if (staff > 2) {
      const mover = free(s, c.id, f).filter((o) => o.id !== fac.ruler).sort((a, b) => stat(s, b.id, LEAD) + stat(s, b.id, WAR) - stat(s, a.id, LEAD) - stat(s, a.id, WAR))[0];
      if (mover) moveOfficer(s, mover.id, next);
    }
  }
  /* 장수가 없는 도시에 한 명씩 */
  for (const c of cities) {
    if (officersIn(s, c.id, f).length > 0) continue;
    const donor = NEIGHBORS[c.id].map((n) => s.cities[n.to]).find((x) => x.owner === f && free(s, x.id, f).length > 1);
    if (donor) {
      const mover = free(s, donor.id, f).filter((o) => o.id !== fac.ruler).sort((a, b) => worth(s, a.id) - worth(s, b.id))[0];
      if (mover) moveOfficer(s, mover.id, c.id);
    }
  }
}

/* ───────────── 포로·포상·외교 ───────────── */

export function aiCaptives(s: GameState, f: number) {
  const fac = s.factions[f];
  for (const o of captivesOf(s, f)) {
    if (o.acted) continue;
    const p = captiveChance(s, f, o.id);
    if (p >= 0.08) {
      const r = treatCaptive(s, f, o.id, 'recruit');
      if (r.ok) continue;
    }
    const d = def(fac.ruler);
    const x = rnd(s);
    const cruel = d.gi <= 4 && d.amb >= 8;
    if (x < (cruel ? 0.25 : 0.08)) treatCaptive(s, f, o.id, 'execute');
    else if (x < 0.55) treatCaptive(s, f, o.id, 'release');
  }
}

function aiRewards(s: GameState, f: number) {
  let n = 0;
  const list = officersIn_all(s, f).filter((o) => o.loyalty < 65 && o.id !== s.factions[f].ruler).sort((a, b) => a.loyalty - b.loyalty);
  for (const o of list) {
    if (n >= 3) break;
    if (o.city && s.cities[o.city].gold > 350) { if (reward(s, f, o.id).ok) n++; }
  }
}

function aiDiplomacy(s: GameState, f: number) {
  const mine = factionPower(s, f);
  const neighbors = new Set<number>();
  for (const c of ownCities(s, f)) for (const n of NEIGHBORS[c.id]) { const o = s.cities[n.to].owner; if (o >= 0 && o !== f) neighbors.add(o); }
  if (!neighbors.size) return;
  const list = [...neighbors].map((g) => ({ g, p: factionPower(s, g) })).sort((a, b) => b.p - a.p);
  const envoy = officersIn_all(s, f).filter((o) => !o.acted).sort((a, b) => stat(s, b.id, CHA) + stat(s, b.id, POL) - stat(s, a.id, CHA) - stat(s, a.id, POL))[0];
  if (!envoy) return;
  /* 약한 이웃에게 항복 권고 */
  const weak = list[list.length - 1];
  if (!s.factions[weak.g].human && surrenderChance(s, f, envoy.id, weak.g) > 0.15 && chance(s, 0.5)) {
    demandSurrender(s, f, envoy.id, weak.g);
    return;
  }
  /* 강대국이 있으면 다른 이웃과 손잡는다 */
  const top = list[0];
  if (top.p > mine * 1.8) {
    const partner = list.find((x) => x.g !== top.g && !s.factions[x.g].human && !allied(s, f, x.g));
    if (!partner) return;
    const rel = s.factions[f].rel[partner.g] ?? 50;
    if (rel >= 60) { proposeAlliance(s, f, envoy.id, partner.g); return; }
    const c = s.cities[envoy.city!];
    if (c.gold > 500) goodwill(s, f, envoy.id, partner.g, 250);
    return;
  }
  /* 아니면 이웃 적을 흔든다 */
  const enemyCity = ownCities(s, f).flatMap((c) => hostileNeighbors(s, c)).find((x) => x.owner >= 0);
  if (enemyCity && stat(s, envoy.id, INT) >= 70 && rumorChance(s, envoy.id, enemyCity.id) > 0.45) rumor(s, envoy.id, enemyCity.id);
}
