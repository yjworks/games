import { CITY_BY_ID, NEIGHBORS } from '../data/cities';
import { OFFICER_DEF } from '../data/officers';
import type { CityId } from '../data/types';
import { aiCaptives, aiCities, aiTurn } from './ai';
import { type BattleState, autoResolve, createBattle, runUntilHuman } from './battle';
import { joinFaction, log, nearestOwnCity, releaseOfficer } from './commands';
import { deathText, runEvents } from './events';
import { CHA, bonded, def, factionName, historicalKey, nameOf, stat } from './officers';
import { chance, clamp, pick, rint, rnd, shuffle } from './rng';
import { agriCap, cityName, pickGovernor, updateRank } from './setup';
import type { AttackOrder, City, GameState, Officer } from './state';
import { checkFaction, officerDies, rulerCaptured } from './world';
import { jo } from './josa';

export const INCOME_MULT = { easy: 0.85, normal: 1, hard: 1.2 } as const;

/** 플레이어의 입력이 필요할 때까지(사람 차례·직접 지휘 전투) 게임을 진행한다 */
export function advance(s: GameState, maxMonths = 1200) {
  let months = 0;
  for (let guard = 0; guard < 100000; guard++) {
    if (s.over || s.battle) return;
    if (s.attacks.length) { processAttack(s, s.attacks.shift()!); continue; }
    if (s.turn >= s.order.length) {
      if (months++ >= maxMonths) return;
      nextMonth(s);
      if (s.over) return;
      continue;
    }
    const f = s.factions[s.order[s.turn]];
    if (!f.alive || f.done) { s.turn++; continue; }
    if (f.human) return;
    aiTurn(s, f.idx);
    f.done = true;
    s.turn++;
  }
}

/** 지금 명령을 내리는 사람 세력 */
export function currentHuman(s: GameState): number {
  if (s.over || s.turn >= s.order.length) return -1;
  const f = s.factions[s.order[s.turn]];
  return f && f.alive && f.human && !f.done ? f.idx : -1;
}

/** 사람 세력의 한 달을 끝낸다 — 위임한 도시는 태수가 처리 */
export function endTurn(s: GameState) {
  const f = currentHuman(s);
  if (f < 0) return;
  aiCities(s, f, true);
  s.factions[f].done = true;
  s.turn++;
  advance(s);
}

/* ───────────── 전투 처리 ───────────── */

function processAttack(s: GameState, order: AttackOrder) {
  const target = s.cities[order.to];
  const from = s.cities[order.from];
  /* 그 사이 상황이 바뀌었으면(이미 점령, 동맹 등) 군사를 되돌린다 */
  const stillValid = s.factions[order.faction]?.alive && target.owner !== order.faction
    && order.officers.some((id) => s.officers[id].status === 'serving' && s.officers[id].faction === order.faction);
  if (!stillValid) {
    const back = from.owner === order.faction ? from : null;
    if (back) { back.troops += order.troops.reduce((a, b) => a + b, 0); back.food += order.food; }
    return;
  }
  const bs = createBattle(s, order);
  log(s, `${jo(factionName(s, order.faction), '이가')} ${cityName(order.from)}에서 ${target.owner >= 0 ? `${factionName(s, target.owner)}의 ` : '공백지 '}${jo(cityName(order.to), '을를')} 공격했습니다.`, 'war', order.faction);
  const humanInvolved = bs.human[0] || bs.human[1];
  if (humanInvolved && s.options.manualBattle) {
    runUntilHuman(bs);
    if (!bs.over) { s.battle = bs; return; }
  } else {
    autoResolve(bs);
  }
  applyBattle(s, bs);
}

/** 사람이 지휘하던 전투가 끝났을 때 */
export function finishBattle(s: GameState) {
  const bs = s.battle;
  if (!bs) return;
  if (!bs.over) autoResolve(bs);
  s.battle = null;
  applyBattle(s, bs);
  advance(s);
}

export interface BattleReport { title: string; lines: string[]; winner: number }

export function applyBattle(s: GameState, bs: BattleState): BattleReport {
  const win = bs.over!.winner;
  const atkF = bs.attacker;
  const defF = bs.defender;
  const city = s.cities[bs.to];
  const lines: string[] = [bs.over!.reason];
  const sideF = (side: 0 | 1) => (side === 0 ? atkF : defF);

  /* 도시 소유 변경 */
  const oldGold = city.gold, oldFood = city.food;
  if (win === 0) {
    city.owner = atkF;
    city.gold = Math.round(oldGold * 0.5);
    city.food = Math.round(oldFood * 0.5) + bs.food;
    city.loyalty = clamp(city.loyalty - 10, 0, 100);
    city.training = s.cities[bs.from].training;
    city.morale = 60;
    city.troops = 0;
    city.delegated = !s.factions[atkF].human;
    city.governor = null;
  } else {
    city.food = Math.max(0, bs.defFood);
    city.troops = 0;
  }
  const atkHome: CityId | null = win === 0 ? bs.to : s.cities[bs.from].owner === atkF ? bs.from : nearestOwnCity(s, bs.from, atkF);
  const defHome: CityId | null = win === 1 ? bs.to : defF >= 0 ? nearestOwnCity(s, bs.to, defF) : null;
  if (win === 1 && atkHome) s.cities[atkHome].food += bs.food;

  const homeOf = (side: 0 | 1) => (side === 0 ? atkHome : defHome);
  const captured: Officer[] = [];

  const capture = (o: Officer, by: number, at: CityId | null) => {
    if (by < 0 || !at) { flee(o, o.faction); return; }
    const wasRuler = s.factions[o.faction]?.ruler === o.id && o.status === 'serving';
    o.status = 'captive';
    o.captor = by;
    o.city = at;
    o.turncoat = -1;
    o.acted = false;
    captured.push(o);
    lines.push(`${nameOf(o.id)} 포로`);
    if (wasRuler) rulerCaptured(s, o.faction);
  };
  const flee = (o: Officer, f: number) => {
    const home = f >= 0 && s.factions[f]?.alive ? (s.cities[bs.to].owner === f ? bs.to : nearestOwnCity(s, bs.to, f)) : null;
    if (home) { o.city = home; o.status = 'serving'; return; }
    const wasRuler = f >= 0 && s.factions[f]?.ruler === o.id;
    o.status = 'free'; o.faction = -1; o.found = true;
    o.city = pick(s, NEIGHBORS[bs.to]).to;
    if (wasRuler) checkFaction(s, f);
  };

  let atkTroops = 0, defTroops = 0;
  for (const u of bs.units) {
    const f = sideF(u.side);
    const back = u.gone === null || u.gone === 'retreated' || u.gone === 'routed' ? u.troops : 0;
    if (u.side === 0) atkTroops += back; else defTroops += back;
    if (!u.officer) continue;
    const o = s.officers[u.officer];
    if (o.status === 'dead') continue;
    /* 내응한 장수는 새 주인에게 */
    if (o.faction !== f && f >= 0) {
      joinFaction(s, o, f, homeOf(u.side) ?? bs.to);
      o.status = 'serving';
      lines.push(`${nameOf(o.id)} 귀순`);
    }
    const enemyF = sideF(u.side === 0 ? 1 : 0);
    const enemyAt = homeOf(u.side === 0 ? 1 : 0) ?? bs.to;
    const lost = u.side !== win;
    if (u.gone === 'killed') { officerDies(s, o, '전사', bs.to); lines.push(`${nameOf(o.id)} 전사`); continue; }
    if (u.gone === 'captured') { capture(o, enemyF, enemyAt); continue; }
    if (u.gone === 'destroyed') {
      const x = rnd(s);
      if (x < 0.05) { officerDies(s, o, '전사', bs.to); lines.push(`${nameOf(o.id)} 전사`); continue; }
      if (x < 0.35) { capture(o, enemyF, enemyAt); continue; }
    }
    if (lost && u.side === 1 && u.gone === null && chance(s, 0.3)) { capture(o, enemyF, enemyAt); continue; }
    o.merit += lost ? 10 : u.commander ? 90 : 45;
    const home = homeOf(u.side);
    if (home && s.cities[home].owner === o.faction) { o.city = home; o.status = 'serving'; }
    else flee(o, o.faction);
  }

  /* 성 안에 남아 있던(출전하지 않은) 수비 장수 */
  if (win === 0 && defF >= 0) {
    for (const o of Object.values(s.officers)) {
      if (o.status !== 'serving' || o.faction !== defF || o.city !== bs.to) continue;
      if (chance(s, 0.35)) capture(o, atkF, bs.to); else flee(o, defF);
    }
    /* 성 안의 포로는 풀려난다 */
    for (const o of Object.values(s.officers)) {
      if (o.status === 'captive' && o.city === bs.to && o.captor === defF) {
        if (o.faction === atkF) { o.status = 'serving'; o.captor = -1; } else releaseOfficer(s, o);
      }
    }
  }

  /* 병력 귀환 */
  if (win === 0) {
    city.troops = atkTroops;
    if (defHome && defF >= 0) s.cities[defHome].troops += Math.round(defTroops * 0.5);
  } else {
    city.troops = defTroops;
    if (atkHome) s.cities[atkHome].troops += atkTroops;
  }

  for (const c of [bs.from, bs.to, atkHome, defHome]) if (c) pickGovernor(s, c);
  if (defF >= 0) checkFaction(s, defF);
  checkFaction(s, atkF);
  updateRank(s, atkF);

  const title = win === 0
    ? `${jo(factionName(s, atkF), '이가')} ${jo(cityName(bs.to), '을를')} 점령했습니다.`
    : `${jo(defF >= 0 ? `${cityName(bs.to)}의 ${factionName(s, defF)}` : `${cityName(bs.to)} 수비대`, '이가')} 공격을 막아 냈습니다.`;
  log(s, `${title} (${lines.join(', ')})`, 'war', win === 0 ? atkF : defF >= 0 ? defF : atkF);
  /* 사람에게는 포로 처우를 맡기고, 컴퓨터는 바로 처리한다 */
  const captor = win === 0 ? atkF : defF;
  if (captor >= 0 && !s.factions[captor].human && captured.length) aiCaptives(s, captor);
  checkOver(s);
  return { title, lines, winner: win };
}

/* ───────────── 달 넘기기 ───────────── */

export function nextMonth(s: GameState) {
  s.month++;
  if (s.month > 12) { s.month = 1; s.year++; }
  s.news = s.news.slice(-60);
  for (const o of Object.values(s.officers)) o.acted = false;
  for (const f of s.factions) f.done = false;

  economy(s);
  disasters(s);
  diplomacyTick(s);
  peopleTick(s);
  runEvents(s);
  for (const f of s.factions) if (f.alive) checkFaction(s, f.idx);
  if (s.emperor >= 0 && !s.factions[s.emperor]?.alive) s.emperor = -1;
  checkOver(s);
  s.order = shuffle(s, s.factions.filter((f) => f.alive).map((f) => f.idx));
  s.turn = 0;
}

function economy(s: GameState) {
  const m = s.month;
  for (const c of Object.values(s.cities) as City[]) {
    c.traded = false;
    if (c.owner < 0) {
      /* 공백지는 수비대가 조금씩 다시 모인다 */
      const cap = Math.round(c.pop * 0.004 / 100) * 100 + 500;
      if (c.troops < cap) c.troops = Math.min(cap, c.troops + 200);
      continue;
    }
    const f = s.factions[c.owner];
    const mult = f.human ? 1 : INCOME_MULT[s.options.difficulty];
    const rate = 0.4 + c.loyalty / 250;
    c.gold += Math.round(c.comm * rate * 0.12 * mult);
    const staff = Object.values(s.officers).filter((o) => o.status === 'serving' && o.city === c.id).length;
    /* 봉록: 장수 1명당 금 1, 병사 1,000명당 금 1 */
    const pay = staff + Math.round(c.troops / 1000);
    if (c.gold >= pay) c.gold -= pay;
    else {
      c.gold = 0;
      const lost = Math.round(c.troops * 0.03);
      c.troops -= lost;
      c.morale = clamp(c.morale - 5, 0, 100);
    }
    c.food -= Math.ceil(c.troops * 0.01);
    if (c.food < 0) {
      c.food = 0;
      const lost = Math.round(c.troops * 0.1);
      c.troops -= lost;
      c.morale = clamp(c.morale - 10, 0, 100);
      if (lost > 0) log(s, `${cityName(c.id)}에 군량이 떨어져 병사 ${lost}명이 흩어졌습니다.`, 'disaster', c.owner);
    }
    if (m === 7) c.food += Math.round(c.agri * rate * 10 * mult);
    if (m === 1) {
      const base = CITY_BY_ID[c.id].pop * 10000;
      const g = 1 + (c.loyalty - 40) / 1500 + (c.agri / agriCap(c)) * 0.006;
      c.pop = Math.round(Math.min(base * 1.6, Math.max(base * 0.3, c.pop * g)));
    }
    c.morale += c.morale < 60 ? 1 : c.morale > 75 ? -1 : 0;
    if (c.loyalty > 75 && m % 3 === 0) c.loyalty--;
  }
  const season = [0, 55, 58, 62, 64, 62, 58, 40, 38, 42, 48, 52, 54][m];
  s.foodPrice = clamp(season + rint(s, -4, 4), 25, 90);
}

function disasters(s: GameState) {
  const m = s.month;
  for (const c of Object.values(s.cities) as City[]) {
    if (c.pop <= 0) continue;
    const own = c.owner;
    if (m >= 5 && m <= 8 && chance(s, 0.006)) {
      c.agri = Math.round(c.agri * 0.85);
      c.food = Math.round(c.food * 0.8);
      log(s, `${cityName(c.id)}에 메뚜기 떼가 덮쳤습니다.`, 'disaster', own >= 0 ? own : undefined);
    }
    if (m >= 6 && m <= 8 && chance(s, (100 - c.flood) / 6000)) {
      c.pop = Math.round(c.pop * 0.97);
      c.agri = Math.round(c.agri * 0.9);
      c.wall = Math.max(0, c.wall - 5);
      log(s, `${cityName(c.id)}에 홍수가 났습니다.`, 'disaster', own >= 0 ? own : undefined);
    }
    if (chance(s, 0.0015)) {
      c.pop = Math.round(c.pop * 0.95);
      c.troops = Math.round(c.troops * 0.92);
      log(s, `${cityName(c.id)}에 역병이 돌았습니다.`, 'disaster', own >= 0 ? own : undefined);
    }
    if (m === 7 && own >= 0 && chance(s, 0.03)) {
      c.food += Math.round(c.agri * 3);
      log(s, `${cityName(c.id)}에 풍년이 들었습니다.`, 'info', own);
    }
  }
}

function diplomacyTick(s: GameState) {
  for (const f of s.factions) {
    if (!f.alive) continue;
    for (const k of Object.keys(f.ally)) {
      const b = Number(k);
      f.ally[b]--;
      if (f.ally[b] <= 0 || !s.factions[b]?.alive) {
        delete f.ally[b];
        if (s.factions[b]?.alive && f.idx < b) log(s, `${jo(factionName(s, f.idx), '과와')} ${factionName(s, b)}의 동맹이 끝났습니다.`, 'diplo', f.idx);
      }
    }
    for (const k of Object.keys(f.rel)) {
      const b = Number(k);
      if (f.idx < b) {
        const v = f.rel[b];
        const nv = v > 50 ? v - 1 : v < 50 && s.month % 2 === 0 ? v + 1 : v;
        f.rel[b] = nv;
        s.factions[b].rel[f.idx] = nv;
      }
    }
  }
}

function peopleTick(s: GameState) {
  const y = s.year, m = s.month;
  for (const o of Object.values(s.officers)) {
    if (o.status === 'dead') continue;
    const d = OFFICER_DEF[o.id];
    /* 사망 */
    if (o.status !== 'hidden' && (o.dieYear < y || (o.dieYear === y && o.dieMonth <= m))) {
      officerDies(s, o, o.status === 'captive' ? '옥사' : deathText(s, o.id, '병사', d.died));
      continue;
    }
    if (o.status === 'hidden') {
      if (o.dieYear < y) { o.status = 'dead'; continue; }
      if (o.appear <= y && (o.appear < y || m === 1 || m === s.startMonth)) appear(s, o);
      continue;
    }
    if (o.status === 'free') {
      if (m === 1 && chance(s, 0.15)) { o.city = pick(s, NEIGHBORS[o.city!]).to; o.found = false; }
      continue;
    }
    if (o.status === 'captive') {
      if (chance(s, 0.03)) {
        log(s, `포로 ${jo(nameOf(o.id), '이가')} 탈출했습니다.`, 'person', o.captor);
        releaseOfficer(s, o);
      }
      continue;
    }
    /* 충성 변동과 이탈 */
    const f = s.factions[o.faction];
    if (!f || f.ruler === o.id) continue;
    const target = 50 + d.gi * 4 + (bonded(o.id, f.ruler) ? 20 : 0) + (stat(s, f.ruler, CHA) - 60) / 4 + (s.emperor === f.idx ? 5 : 0) - d.amb;
    if (rnd(s) < 0.5) o.loyalty = clamp(o.loyalty + Math.sign(target - o.loyalty), 0, 100);
    if (o.loyalty < 30 && chance(s, ((30 - o.loyalty) / 250) * (0.4 + d.amb / 8))) desert(s, o);
  }
}

function appear(s: GameState, o: Officer) {
  const d = def(o.id);
  let key = historicalKey(d, s.year);
  if (key === 'jin' && s.year < 265) key = 'cao';
  const f = s.factions.find((x) => x.alive && x.key === key && key !== 'none');
  if (f) {
    const home = s.cities[d.home].owner === f.idx ? d.home : f.capital;
    o.status = 'serving';
    o.faction = f.idx;
    o.city = home;
    o.found = true;
    o.loyalty = clamp(65 + d.gi * 3, 0, 100);
    o.merit = 0;
    pickGovernor(s, home);
    log(s, `${jo(nameOf(o.id), '이가')} ${factionName(s, f.idx)}에 출사했습니다.`, 'person', f.idx);
  } else {
    o.status = 'free';
    o.city = d.home;
    o.found = false;
  }
}

/** 충성이 바닥난 장수 — 야망이 크고 도시를 맡았다면 독립, 아니면 떠난다 */
function desert(s: GameState, o: Officer) {
  const d = def(o.id);
  const f = s.factions[o.faction];
  const cityId = o.city!;
  const c = s.cities[cityId];
  const owned = (Object.values(s.cities) as City[]).filter((x) => x.owner === f.idx).length;
  if (c.governor === o.id && d.amb >= 8 && d.stats[0] >= 65 && cityId !== f.capital && owned >= 3) {
    const idx = s.factions.length;
    s.factions.push({
      idx, key: 'none', ruler: o.id, advisor: null, capital: cityId,
      color: `hsl(${rint(s, 0, 359)} 45% 55%)`, alive: true, human: false,
      rel: {}, ally: {}, rank: 0, done: true,
    });
    for (const g of s.factions) if (g.idx !== idx) { g.rel[idx] = 30; s.factions[idx].rel[g.idx] = 30; }
    s.factions[idx].rel[f.idx] = 5; f.rel[idx] = 5;
    c.owner = idx;
    o.faction = idx;
    o.loyalty = 100;
    for (const x of Object.values(s.officers)) {
      if (x.status !== 'serving' || x.faction !== f.idx || x.city !== cityId || x.id === o.id) continue;
      if (x.loyalty < 55 || bonded(x.id, o.id)) { x.faction = idx; x.loyalty = 60; }
      else { const dest = nearestOwnCity(s, cityId, f.idx); if (dest) x.city = dest; }
    }
    if (f.ruler && s.officers[f.ruler].city === cityId) { /* 군주가 있는 도시에서는 일어나지 않는다 */ }
    pickGovernor(s, cityId);
    log(s, `${cityName(cityId)}의 ${jo(nameOf(o.id), '이가')} ${factionName(s, f.idx)}에 반기를 들고 독립했습니다!`, 'war', f.idx);
    return;
  }
  o.status = 'free';
  o.faction = -1;
  o.found = true;
  if (c.governor === o.id) pickGovernor(s, cityId);
  if (f.advisor === o.id) f.advisor = null;
  log(s, `${jo(nameOf(o.id), '이가')} ${jo(factionName(s, f.idx), '을를')} 떠났습니다.`, 'person', f.idx);
}

export function checkOver(s: GameState) {
  if (s.over) return;
  const alive = s.factions.filter((f) => f.alive);
  const humans = s.factions.filter((f) => f.human);
  if (alive.length === 1) { s.over = { winner: alive[0].idx, year: s.year, month: s.month }; return; }
  if (humans.length && !humans.some((f) => f.alive)) s.over = { lost: true, year: s.year, month: s.month };
}

/** 전체 세력 요약(일람·AI 공용) */
export function factionSummary(s: GameState, f: number) {
  let cities = 0, troops = 0, gold = 0, food = 0, pop = 0;
  for (const c of Object.values(s.cities) as City[]) {
    if (c.owner !== f) continue;
    cities++; troops += c.troops; gold += c.gold; food += c.food; pop += c.pop;
  }
  const officers = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f).length;
  return { cities, troops, gold, food, pop, officers };
}
