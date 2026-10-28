import { NEIGHBORS } from '../data/cities';
import { ITEM_BY_ID } from '../data/items';
import { OFFICER_DEF } from '../data/officers';
import type { CityId } from '../data/types';
import {
  CHA, INT, LEAD, POL, WAR, bonded, def, factionName, hasTrait, historicalKey, nameOf, officersIn, servedKey, stat,
  troopCap,
} from './officers';
import { chance, clamp, rint, rrange } from './rng';
import { agriCap, cityName, commCap, pickGovernor, updateRank } from './setup';
import type { City, GameState, LogEntry, Officer } from './state';
import { jo } from './josa';
import { KINDS, kindAllowed, kindCost, type UnitKind } from './units';

export interface Result { ok: boolean; msg: string }
const ok = (msg: string): Result => ({ ok: true, msg });
const fail = (msg: string): Result => ({ ok: false, msg });

export const COST = { develop: 50, reward: 100 };

export function log(s: GameState, text: string, kind: LogEntry['kind'] = 'info', f?: number) {
  const e: LogEntry = { y: s.year, m: s.month, text, kind, f };
  s.log.push(e);
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
  s.news.push(e);
  if (s.news.length > 120) s.news.splice(0, s.news.length - 120);
}

/** 명령을 낼 수 있는 장수인가 */
function ready(s: GameState, officerId: string, cityId?: CityId): Officer | null {
  const o = s.officers[officerId];
  if (!o || o.status !== 'serving' || o.acted) return null;
  if (cityId && o.city !== cityId) return null;
  return o;
}

function own(s: GameState, cityId: CityId, f: number): City | null {
  const c = s.cities[cityId];
  return c && c.owner === f ? c : null;
}

/** 마지막으로 명령을 수행한 장수(화면에서 보고하는 사람) */
export const lastActor: { id: string | null } = { id: null };

function done(_s: GameState, o: Officer, merit: number) {
  lastActor.id = o.id;
  o.acted = true;
  o.merit += merit;
}

/* ───────────── 내정 ───────────── */

export type DevKind = 'agri' | 'comm' | 'flood' | 'wall';
export const DEV_NAMES: Record<DevKind, string> = { agri: '개간', comm: '상업', flood: '치수', wall: '성벽' };

export function develop(s: GameState, cityId: CityId, officerId: string, kind: DevKind): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = own(s, cityId, o.faction);
  if (!c) return fail('아군 도시가 아닙니다.');
  if (c.gold < COST.develop) return fail(`금이 ${COST.develop} 필요합니다.`);
  const pol = stat(s, o.id, POL);
  const lead = stat(s, o.id, LEAD);
  let gain = 0;
  if (kind === 'agri' || kind === 'comm') {
    const cap = kind === 'agri' ? agriCap(c) : commCap(c);
    const cur = c[kind];
    if (cur >= cap) return fail('이미 한계까지 개발했습니다.');
    const mult = (kind === 'agri' && hasTrait(s, o.id, '둔전')) || (kind === 'comm' && hasTrait(s, o.id, '상재')) ? 1.5 : 1;
    gain = Math.max(2, Math.round((pol * 0.45 + 6) * mult * rrange(s, 0.85, 1.15) * (1 - (cur / cap) * 0.5)));
    c[kind] = Math.min(cap, cur + gain);
  } else if (kind === 'flood') {
    if (c.flood >= 100) return fail('치수가 이미 완벽합니다.');
    gain = Math.max(1, Math.round((pol * 0.12 + 3) * rrange(s, 0.85, 1.15)));
    c.flood = Math.min(100, c.flood + gain);
  } else {
    if (c.wall >= 100) return fail('성벽이 이미 완벽합니다.');
    const mult = hasTrait(s, o.id, '축성') ? 1.5 : 1;
    gain = Math.max(1, Math.round((pol * 0.07 + lead * 0.04 + 2.5) * mult * rrange(s, 0.85, 1.15)));
    c.wall = Math.min(100, c.wall + gain);
  }
  c.gold -= COST.develop;
  done(s, o, 8 + Math.round(gain / 4));
  return ok(`${nameOf(o.id)}의 ${DEV_NAMES[kind]}: +${gain}`);
}

export function reliefCost(c: City) {
  return Math.round(c.pop / 10000 * 25 + 200);
}

export function relief(s: GameState, cityId: CityId, officerId: string): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = own(s, cityId, o.faction);
  if (!c) return fail('아군 도시가 아닙니다.');
  const cost = reliefCost(c);
  if (c.food < cost) return fail(`군량이 ${cost} 필요합니다.`);
  if (c.loyalty >= 100) return fail('민심이 이미 가득합니다.');
  const mult = hasTrait(s, o.id, '인덕') ? 1.4 : 1;
  const gain = Math.max(1, Math.round((stat(s, o.id, CHA) * 0.1 + 4) * mult));
  c.food -= cost;
  c.loyalty = Math.min(100, c.loyalty + gain);
  done(s, o, 10);
  return ok(`${jo(nameOf(o.id), '이가')} 군량 ${cost}을 풀었습니다. 민심 +${gain}`);
}

/* ───────────── 군사 ───────────── */

export function draftMax(s: GameState, c: City, officerId: string): number {
  const cha = stat(s, officerId, CHA);
  const base = (cha * 40 + 1500) * (hasTrait(s, officerId, '명성') ? 1.4 : 1);
  return Math.max(0, Math.floor(Math.min(base, c.pop * 0.04, c.gold * 10) / 100) * 100);
}

export function draft(s: GameState, cityId: CityId, officerId: string, amount: number): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = own(s, cityId, o.faction);
  if (!c) return fail('아군 도시가 아닙니다.');
  const max = draftMax(s, c, o.id);
  const n = Math.floor(Math.min(amount, max) / 100) * 100;
  if (n <= 0) return fail('징병할 수 있는 인원이 없습니다(금·인구 부족).');
  const total = c.troops + n;
  c.training = Math.round((c.training * c.troops + 10 * n) / total);
  c.morale = Math.round((c.morale * c.troops + 50 * n) / total);
  c.troops = total;
  c.pop -= n;
  c.gold -= Math.ceil(n / 10);
  c.loyalty = clamp(c.loyalty - Math.max(1, Math.round(n / 800)), 0, 100);
  done(s, o, 6 + Math.round(n / 500));
  return ok(`${jo(nameOf(o.id), '이가')} ${n.toLocaleString()}명을 모았습니다.`);
}

export function train(s: GameState, cityId: CityId, officerId: string): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = own(s, cityId, o.faction);
  if (!c) return fail('아군 도시가 아닙니다.');
  if (c.troops <= 0) return fail('훈련할 병사가 없습니다.');
  if (c.training >= 100) return fail('훈련이 이미 최고입니다.');
  const gain = Math.max(1, Math.round((stat(s, o.id, LEAD) * 0.2 + 4) * (1 - c.training / 130) * rrange(s, 0.9, 1.1)));
  c.training = Math.min(100, c.training + gain);
  c.morale = Math.min(100, c.morale + 3);
  done(s, o, 8);
  return ok(`${nameOf(o.id)}의 훈련: 훈련 +${gain}`);
}

/* ───────────── 인사 ───────────── */

export function search(s: GameState, cityId: CityId, officerId: string): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = own(s, cityId, o.faction);
  if (!c) return fail('아군 도시가 아닙니다.');
  const int = stat(s, o.id, INT);
  const cha = stat(s, o.id, CHA);
  done(s, o, 6);
  const hidden = Object.values(s.officers).filter((x) => x.status === 'free' && x.city === cityId && !x.found);
  if (hidden.length && chance(s, 0.4 + int / 300 + cha / 400)) {
    const t = hidden[rint(s, 0, hidden.length - 1)];
    t.found = true;
    return ok(`${jo(nameOf(o.id), '이가')} 재야의 인재 ${jo(nameOf(t.id), '을를')} 찾아냈습니다.`);
  }
  const item = Object.entries(s.items).find(([, p]) => p.city === cityId && !p.holder);
  if (item && chance(s, 0.15 + int / 400)) {
    const f = s.factions[o.faction];
    giveItem(s, item[0], f.ruler);
    return ok(`${jo(nameOf(o.id), '이가')} 보물 「${ITEM_BY_ID[item[0]].name}」 하나를 찾아 군주에게 바쳤습니다.`);
  }
  if (chance(s, 0.35)) {
    if (chance(s, 0.5)) { const g = rint(s, 30, 120); c.gold += g; return ok(`${jo(nameOf(o.id), '이가')} 금 ${g}을 얻었습니다.`); }
    const fd = rint(s, 300, 1200); c.food += fd; return ok(`${jo(nameOf(o.id), '이가')} 군량 ${fd}을 얻었습니다.`);
  }
  return ok(`${jo(nameOf(o.id), '이가')} 둘러보았으나 별다른 것을 찾지 못했습니다.`);
}

export function giveItem(s: GameState, itemId: string, to: string) {
  const p = s.items[itemId];
  if (p?.holder) {
    const prev = s.officers[p.holder];
    if (prev) prev.items = prev.items.filter((x) => x !== itemId);
  }
  s.items[itemId] = { holder: to };
  const o = s.officers[to];
  if (o && !o.items.includes(itemId)) o.items.push(itemId);
}

/** 등용 성공 확률 */
export function recruitChance(s: GameState, recruiterId: string, targetId: string): number {
  const r = s.officers[recruiterId];
  const t = s.officers[targetId];
  if (!r || !t || r.faction < 0) return 0;
  const f = s.factions[r.faction];
  const td = def(targetId);
  if (t.status === 'serving' && s.factions[t.faction]?.ruler === targetId) return 0;
  const cha = stat(s, recruiterId, CHA);
  const rulerCha = stat(s, f.ruler, CHA);
  const bond = bonded(recruiterId, targetId) || bonded(f.ruler, targetId);
  const served = servedKey(td, f.key);
  const talk = hasTrait(s, recruiterId, '구변') ? 0.12 : 0;
  if (t.status === 'free') {
    let p = 0.22 + (cha - 50) / 130 + (rulerCha - 50) / 300 + talk - td.amb * 0.015;
    if (bond) p += 0.4;
    if (served) p += 0.25;
    if (td.home === OFFICER_DEF[recruiterId]?.home) p += 0.05;
    if (s.emperor === r.faction) p += 0.08;
    if (hasTrait(s, f.ruler, '명성')) p += 0.05;
    const hk = historicalKey(td, s.year);
    if (hk !== 'none' && hk !== f.key && s.factions.some((x) => x.alive && x.key === hk)) p -= 0.15;
    return clamp(p, 0.03, 0.95);
  }
  if (t.status === 'serving') {
    let p = (100 - t.loyalty) / 140 + (cha - 60) / 220 + talk * 0.7 - td.gi * 0.045;
    if (bond) p += 0.3;
    if (served) p += 0.08;
    return clamp(p, 0, 0.85);
  }
  return 0;
}

export function recruit(s: GameState, cityId: CityId, officerId: string, targetId: string): Result {
  const o = ready(s, officerId, cityId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const t = s.officers[targetId];
  if (!t) return fail('대상이 없습니다.');
  if (t.status === 'free' && (t.city !== cityId || !t.found)) return fail('이 도시에서 찾은 재야 인재만 등용할 수 있습니다.');
  if (t.status === 'serving' && t.faction === o.faction) return fail('이미 아군입니다.');
  if (t.status !== 'free' && t.status !== 'serving') return fail('등용할 수 없는 상대입니다.');
  const p = recruitChance(s, o.id, t.id);
  done(s, o, 10);
  if (!chance(s, p)) {
    if (t.status === 'serving') t.loyalty = Math.min(100, t.loyalty + 2);
    return fail(`${jo(nameOf(t.id), '이가')} ${nameOf(o.id)}의 권유를 거절했습니다.`);
  }
  const prevCity = t.city;
  const prevFaction = t.faction;
  joinFaction(s, t, o.faction, cityId);
  o.merit += 30;
  if (prevFaction >= 0 && prevCity) {
    pickGovernor(s, prevCity);
    log(s, `${factionName(s, prevFaction)}의 ${jo(nameOf(t.id), '이가')} ${factionName(s, o.faction)}에 귀순했습니다.`, 'person', o.faction);
  }
  return ok(`${jo(nameOf(t.id), '이가')} ${nameOf(o.id)}의 설득에 응해 출사했습니다!`);
}

export function joinFaction(s: GameState, t: Officer, f: number, cityId: CityId) {
  const d = def(t.id);
  t.status = 'serving';
  t.faction = f;
  t.city = cityId;
  t.found = true;
  t.captor = -1;
  t.turncoat = -1;
  t.acted = true;
  const bond = bonded(s.factions[f].ruler, t.id);
  t.loyalty = clamp(48 + d.gi * 3 + (bond ? 20 : 0), 0, 100);
  pickGovernor(s, cityId);
}

export function moveOfficer(s: GameState, officerId: string, to: CityId): Result {
  const o = ready(s, officerId);
  if (!o || !o.city) return fail('움직일 수 있는 장수가 아닙니다.');
  if (!own(s, to, o.faction)) return fail('아군 도시로만 이동할 수 있습니다.');
  if (o.city === to) return fail('이미 그 도시에 있습니다.');
  if (!connected(s, o.city, to, o.faction)) return fail('아군 땅으로 이어진 도시가 아닙니다.');
  const from = o.city;
  o.city = to;
  done(s, o, 2);
  pickGovernor(s, from);
  pickGovernor(s, to);
  return ok(`${jo(nameOf(o.id), '이가')} ${jo(cityName(to), '로')} 이동했습니다.`);
}

/** 아군 도시만 밟고 갈 수 있는가 */
export function connected(s: GameState, a: CityId, b: CityId, f: number): boolean {
  const seen = new Set<CityId>([a]);
  const q: CityId[] = [a];
  while (q.length) {
    const c = q.shift()!;
    if (c === b) return true;
    for (const n of NEIGHBORS[c]) {
      if (seen.has(n.to) || s.cities[n.to].owner !== f) continue;
      seen.add(n.to);
      q.push(n.to);
    }
  }
  return false;
}

export function reward(s: GameState, f: number, targetId: string, itemId?: string): Result {
  const t = s.officers[targetId];
  if (!t || t.status !== 'serving' || t.faction !== f || !t.city) return fail('아군 장수가 아닙니다.');
  if (s.factions[f].ruler === targetId) return fail('군주에게는 포상할 수 없습니다.');
  const d = def(targetId);
  if (itemId) {
    const p = s.items[itemId];
    const holder = p?.holder ? s.officers[p.holder] : null;
    if (!holder || holder.faction !== f || holder.status !== 'serving') return fail('아군이 가진 보물이 아닙니다.');
    if (holder.id === targetId) return fail('이미 가지고 있습니다.');
    giveItem(s, itemId, targetId);
    const g = 15 + Math.round(ITEM_BY_ID[itemId].value / 100);
    t.loyalty = Math.min(100, t.loyalty + g);
    return ok(`${nameOf(targetId)}에게 보물 「${ITEM_BY_ID[itemId].name}」 하사 — 충성 +${g}`);
  }
  const c = s.cities[t.city];
  if (c.gold < COST.reward) return fail(`${cityName(c.id)}에 금이 ${COST.reward} 필요합니다.`);
  if (t.loyalty >= 100) return fail('충성이 이미 가득합니다.');
  c.gold -= COST.reward;
  const g = Math.max(2, Math.round(rrange(s, 6, 12) * (1 - d.amb * 0.045)));
  t.loyalty = Math.min(100, t.loyalty + g);
  return ok(`${nameOf(targetId)}에게 금 ${COST.reward}을 내렸습니다. 충성 +${g}`);
}

export function captiveChance(s: GameState, f: number, captiveId: string): number {
  const t = s.officers[captiveId];
  if (!t || t.status !== 'captive') return 0;
  const d = def(captiveId);
  const fac = s.factions[f];
  const oldAlive = t.faction >= 0 && s.factions[t.faction]?.alive;
  if (oldAlive && s.factions[t.faction].ruler === captiveId) return 0.02;
  let p = 0.25 + (stat(s, fac.ruler, CHA) - 60) / 150 + (100 - t.loyalty) / 220 - d.gi * 0.035;
  if (!oldAlive) p += 0.3;
  if (servedKey(d, fac.key)) p += 0.2;
  if (bonded(fac.ruler, captiveId)) p += 0.4;
  return clamp(p, 0.02, 0.95);
}

export function treatCaptive(s: GameState, f: number, captiveId: string, how: 'recruit' | 'release' | 'execute'): Result {
  const t = s.officers[captiveId];
  if (!t || t.status !== 'captive' || t.captor !== f) return fail('잡고 있는 포로가 아닙니다.');
  const city = t.city!;
  if (how === 'recruit') {
    if (t.acted) return fail('이번 달에는 이미 설득했습니다.');
    t.acted = true;
    if (chance(s, captiveChance(s, f, captiveId))) {
      joinFaction(s, t, f, city);
      return ok(`${jo(nameOf(captiveId), '이가')} 항복하고 출사했습니다.`);
    }
    return fail(`${jo(nameOf(captiveId), '이가')} 굽히지 않았습니다.`);
  }
  if (how === 'release') {
    releaseOfficer(s, t);
    const old = t.faction;
    if (old >= 0) addRel(s, f, old, 8);
    return ok(`${jo(nameOf(captiveId), '을를')} 풀어 주었습니다.`);
  }
  executeOfficer(s, t, f);
  return ok(`${jo(nameOf(captiveId), '을를')} 처형했습니다.`);
}

export function releaseOfficer(s: GameState, t: Officer) {
  t.captor = -1;
  const old = t.faction;
  if (old >= 0 && s.factions[old]?.alive) {
    const dest = nearestOwnCity(s, t.city!, old);
    if (dest) { t.status = 'serving'; t.city = dest; pickGovernor(s, dest); return; }
  }
  t.status = 'free';
  t.faction = -1;
  t.found = true;
}

export function executeOfficer(s: GameState, t: Officer, by: number) {
  const old = t.faction;
  const cha = def(t.id).stats[CHA];
  t.status = 'dead';
  t.city = null;
  t.captor = -1;
  dropItems(s, t);
  if (old >= 0) addRel(s, by, old, -30);
  for (const o of Object.values(s.officers)) {
    if (o.status !== 'serving' || o.faction !== by) continue;
    if (bonded(o.id, t.id)) o.loyalty = clamp(o.loyalty - 20, 0, 100);
    else if (cha >= 80) o.loyalty = clamp(o.loyalty - 2, 0, 100);
  }
  log(s, `${jo(factionName(s, by), '이가')} ${jo(nameOf(t.id), '을를')} 처형했습니다.`, 'death', by);
}

/** 죽거나 사라질 때 보물은 그 도시에 떨어진다 */
export function dropItems(s: GameState, o: Officer, where?: CityId) {
  const city = where ?? o.city ?? def(o.id).home;
  for (const it of o.items) s.items[it] = { city };
  o.items = [];
}

export function nearestOwnCity(s: GameState, from: CityId, f: number): CityId | null {
  const seen = new Set<CityId>([from]);
  const q: CityId[] = [from];
  while (q.length) {
    const c = q.shift()!;
    if (s.cities[c].owner === f) return c;
    for (const n of NEIGHBORS[c]) if (!seen.has(n.to)) { seen.add(n.to); q.push(n.to); }
  }
  return null;
}

export function appointGovernor(s: GameState, cityId: CityId, officerId: string): Result {
  const c = s.cities[cityId];
  const o = s.officers[officerId];
  if (!o || o.status !== 'serving' || o.faction !== c.owner || o.city !== cityId) return fail('이 도시의 아군 장수가 아닙니다.');
  const ruler = s.factions[c.owner].ruler;
  if (officersIn(s, cityId, c.owner).some((x) => x.id === ruler) && officerId !== ruler) return fail('군주가 있는 도시는 군주가 직접 다스립니다.');
  c.governor = officerId;
  return ok(`${jo(nameOf(officerId), '을를')} ${cityName(cityId)} 태수로 임명했습니다.`);
}

export function appointAdvisor(s: GameState, f: number, officerId: string | null): Result {
  const fac = s.factions[f];
  if (officerId === null) { fac.advisor = null; return ok('군사를 해임했습니다.'); }
  const o = s.officers[officerId];
  if (!o || o.status !== 'serving' || o.faction !== f) return fail('아군 장수가 아닙니다.');
  if (fac.ruler === officerId) return fail('군주는 군사를 겸할 수 없습니다.');
  fac.advisor = officerId;
  return ok(`${jo(nameOf(officerId), '을를')} 군사로 삼았습니다.`);
}

/* ───────────── 수송·거래 ───────────── */

export function transport(s: GameState, from: CityId, officerId: string, to: CityId, gold: number, food: number, troops: number): Result {
  const o = ready(s, officerId, from);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const a = own(s, from, o.faction);
  const b = own(s, to, o.faction);
  if (!a || !b) return fail('아군 도시끼리만 수송할 수 있습니다.');
  if (!NEIGHBORS[from].some((n) => n.to === to)) return fail('이웃한 도시로만 수송할 수 있습니다.');
  gold = clamp(Math.floor(gold), 0, a.gold);
  food = clamp(Math.floor(food), 0, a.food);
  troops = clamp(Math.floor(troops / 100) * 100, 0, a.troops);
  if (gold + food + troops <= 0) return fail('보낼 것이 없습니다.');
  a.gold -= gold; b.gold += gold;
  a.food -= food; b.food += food;
  if (troops > 0) {
    const tot = b.troops + troops;
    b.training = Math.round((b.training * b.troops + a.training * troops) / tot);
    b.morale = Math.round((b.morale * b.troops + a.morale * troops) / tot);
    b.troops = tot;
    a.troops -= troops;
  }
  o.city = to;
  done(s, o, 4);
  pickGovernor(s, from);
  pickGovernor(s, to);
  const parts = [gold && `금 ${gold}`, food && `군량 ${food}`, troops && `병력 ${troops}`].filter(Boolean).join(' · ');
  return ok(`${jo(nameOf(o.id), '이가')} ${jo(cityName(to), '로')} ${jo(parts, '을를')} 옮겼습니다.`);
}

/** 거래 시세: 쌀 100 당 금 */
export function buyPrice(s: GameState) { return Math.round(s.foodPrice * 1.1); }
export function sellPrice(s: GameState) { return Math.round(s.foodPrice * 0.9); }

export function trade(s: GameState, cityId: CityId, f: number, buy: boolean, amount: number): Result {
  const c = own(s, cityId, f);
  if (!c) return fail('아군 도시가 아닙니다.');
  if (c.traded) return fail('이번 달에는 이미 상인과 거래했습니다.');
  const lots = Math.floor(amount / 100);
  if (lots <= 0) return fail('100 단위로 거래합니다.');
  if (buy) {
    const cost = lots * buyPrice(s);
    if (cost > c.gold) return fail('금이 모자랍니다.');
    c.gold -= cost; c.food += lots * 100;
    c.traded = true;
    return ok(`군량 ${lots * 100}을 금 ${cost}에 샀습니다.`);
  }
  if (lots * 100 > c.food) return fail('군량이 모자랍니다.');
  const gain = lots * sellPrice(s);
  c.food -= lots * 100; c.gold += gain;
  c.traded = true;
  return ok(`군량 ${lots * 100}을 금 ${gain}에 팔았습니다.`);
}

/* ───────────── 외교 ───────────── */

export function addRel(s: GameState, a: number, b: number, d: number) {
  if (a < 0 || b < 0 || a === b) return;
  const v = clamp((s.factions[a].rel[b] ?? 50) + d, 0, 100);
  s.factions[a].rel[b] = v;
  s.factions[b].rel[a] = v;
}

export function allied(s: GameState, a: number, b: number) {
  return a >= 0 && b >= 0 && (s.factions[a].ally[b] ?? 0) > 0;
}

export function factionPower(s: GameState, f: number) {
  let troops = 0, cities = 0;
  for (const c of Object.values(s.cities) as City[]) if (c.owner === f) { troops += c.troops; cities++; }
  const off = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f).length;
  return troops + cities * 3000 + off * 800;
}

export function goodwill(s: GameState, f: number, envoyId: string, target: number, gold: number): Result {
  const o = ready(s, envoyId);
  if (!o || o.faction !== f || !o.city) return fail('움직일 수 있는 장수가 아닙니다.');
  const t = s.factions[target];
  if (!t?.alive || target === f) return fail('대상 세력이 없습니다.');
  const c = s.cities[o.city];
  gold = Math.floor(Math.min(gold, c.gold));
  if (gold < 50) return fail('금을 50 이상 보내야 합니다.');
  c.gold -= gold;
  const g = Math.max(1, Math.round((gold / 14) * (0.6 + (stat(s, o.id, POL) + stat(s, o.id, CHA)) / 250) * (hasTrait(s, o.id, '외교') ? 1.3 : 1)));
  addRel(s, f, target, g);
  done(s, o, 10);
  return ok(`${jo(nameOf(o.id), '이가')} ${factionName(s, target)}에 금 ${gold}을 보냈습니다. 우호 +${g} (${s.factions[f].rel[target]})`);
}

export function allianceChance(s: GameState, f: number, envoyId: string, target: number) {
  const rel = s.factions[f].rel[target] ?? 50;
  if (rel < 55) return 0;
  if (s.factions[target].human) return 1;
  let p = (rel - 45) / 55 + (stat(s, envoyId, CHA) - 60) / 200 + (hasTrait(s, envoyId, '외교') ? 0.1 : 0);
  /* 강대국이 이웃이면 약자끼리 손잡기 쉽다 */
  const mine = factionPower(s, f), theirs = factionPower(s, target);
  if (mine > theirs * 2) p -= 0.1;
  return clamp(p, 0, 0.95);
}

export function proposeAlliance(s: GameState, f: number, envoyId: string, target: number): Result {
  const o = ready(s, envoyId);
  if (!o || o.faction !== f) return fail('움직일 수 있는 장수가 아닙니다.');
  if (!s.factions[target]?.alive || target === f) return fail('대상 세력이 없습니다.');
  if (allied(s, f, target)) return fail('이미 동맹입니다.');
  const p = allianceChance(s, f, envoyId, target);
  if (p <= 0) return fail('우호가 55 이상이어야 동맹을 청할 수 있습니다.');
  done(s, o, 15);
  if (!chance(s, p)) { addRel(s, f, target, -5); return fail(`${jo(factionName(s, target), '이가')} 동맹을 거절했습니다.`); }
  setAlliance(s, f, target, 12);
  log(s, `${jo(factionName(s, f), '과와')} ${jo(factionName(s, target), '이가')} 동맹을 맺었습니다.`, 'diplo', f);
  return ok(`${jo(factionName(s, target), '과와')} 1년 동맹을 맺었습니다.`);
}

export function setAlliance(s: GameState, a: number, b: number, months: number) {
  s.factions[a].ally[b] = months;
  s.factions[b].ally[a] = months;
  addRel(s, a, b, Math.max(0, 75 - (s.factions[a].rel[b] ?? 50)));
}

export function surrenderChance(s: GameState, f: number, envoyId: string, target: number) {
  const t = s.factions[target];
  if (!t?.alive || t.human) return 0;
  const ratio = factionPower(s, f) / Math.max(1, factionPower(s, target));
  if (ratio < 3) return 0;
  const td = def(t.ruler);
  const p = 0.06 + (ratio - 3) * 0.04 + (stat(s, envoyId, CHA) - 60) / 250 - td.amb * 0.025 + ((s.factions[f].rel[target] ?? 50) - 50) / 200;
  return clamp(p, 0, 0.6);
}

export function demandSurrender(s: GameState, f: number, envoyId: string, target: number): Result {
  const o = ready(s, envoyId);
  if (!o || o.faction !== f) return fail('움직일 수 있는 장수가 아닙니다.');
  const p = surrenderChance(s, f, envoyId, target);
  if (p <= 0) return fail('세력 차이가 세 배는 되어야 항복을 권할 수 있습니다.');
  done(s, o, 15);
  if (!chance(s, p)) { addRel(s, f, target, -10); return fail(`${jo(factionName(s, target), '이가')} 항복 권고를 일축했습니다.`); }
  const name = factionName(s, target);
  absorbFaction(s, target, f);
  log(s, `${jo(name, '이가')} ${factionName(s, f)}에 항복했습니다.`, 'war', f);
  return ok(`${jo(name, '이가')} 항복했습니다!`);
}

/** 세력 하나를 통째로 다른 세력에 넘긴다 */
export function absorbFaction(s: GameState, from: number, to: number) {
  for (const c of Object.values(s.cities) as City[]) if (c.owner === from) { c.owner = to; c.delegated = true; }
  for (const o of Object.values(s.officers)) {
    if (o.status === 'serving' && o.faction === from) { o.faction = to; o.loyalty = clamp(45 + def(o.id).gi * 3, 0, 100); }
    if (o.status === 'captive' && o.captor === from) o.captor = to;
  }
  if (s.emperor === from) s.emperor = to;
  s.factions[from].alive = false;
  for (const c of Object.values(s.cities) as City[]) if (c.owner === to) pickGovernor(s, c.id);
  updateRank(s, to);
}

/* ───────────── 계략 ───────────── */

function adjacentTo(s: GameState, f: number, cityId: CityId) {
  return NEIGHBORS[cityId].some((n) => s.cities[n.to].owner === f);
}

export function rumorChance(s: GameState, officerId: string, target: CityId) {
  const c = s.cities[target];
  const gInt = c.governor ? stat(s, c.governor, INT) : 40;
  let p = 0.35 + (stat(s, officerId, INT) - gInt) / 140 + (hasTrait(s, officerId, '신산') ? 0.15 : 0);
  const adv = c.owner >= 0 ? s.factions[c.owner].advisor : null;
  if (adv && stat(s, adv, INT) >= 90) p -= 0.12;
  return clamp(p, 0.05, 0.9);
}

export function rumor(s: GameState, officerId: string, target: CityId): Result {
  const o = ready(s, officerId);
  if (!o || !o.city) return fail('움직일 수 있는 장수가 아닙니다.');
  const c = s.cities[target];
  if (c.owner === o.faction || c.owner < 0) return fail('적 도시를 골라야 합니다.');
  if (!adjacentTo(s, o.faction, target)) return fail('아군 도시와 맞닿은 적 도시만 노릴 수 있습니다.');
  done(s, o, 10);
  if (!chance(s, rumorChance(s, o.id, target))) return fail(`${cityName(target)}에 퍼뜨린 소문이 먹히지 않았습니다.`);
  const d = rint(s, 6, 14);
  c.loyalty = clamp(c.loyalty - d, 0, 100);
  c.morale = clamp(c.morale - Math.round(d / 2), 0, 100);
  return ok(`${cityName(target)}에 유언비어가 퍼졌습니다. 민심 −${d}`);
}

export function discordChance(s: GameState, officerId: string, targetId: string) {
  const t = s.officers[targetId];
  if (!t || t.status !== 'serving') return 0;
  if (s.factions[t.faction]?.ruler === targetId) return 0;
  const p = 0.4 + (stat(s, officerId, INT) - stat(s, targetId, INT)) / 110 + (hasTrait(s, officerId, '신산') ? 0.15 : 0) - def(targetId).gi * 0.03;
  return clamp(p, 0.03, 0.9);
}

export function discord(s: GameState, officerId: string, targetId: string): Result {
  const o = ready(s, officerId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const t = s.officers[targetId];
  if (!t || t.status !== 'serving' || t.faction === o.faction) return fail('적 장수를 골라야 합니다.');
  done(s, o, 10);
  if (!chance(s, discordChance(s, o.id, targetId))) return fail(`${jo(nameOf(targetId), '은는')} 이간에 넘어가지 않았습니다.`);
  const d = rint(s, 8, 18);
  t.loyalty = clamp(t.loyalty - d, 0, 100);
  return ok(`${jo(nameOf(targetId), '과와')} 주군 사이를 벌려 놓았습니다. 충성 −${d}`);
}

export function betrayChance(s: GameState, officerId: string, targetId: string) {
  const t = s.officers[targetId];
  if (!t || t.status !== 'serving') return 0;
  if (s.factions[t.faction]?.ruler === targetId || t.loyalty >= 70) return 0;
  let p = (70 - t.loyalty) / 90 + (stat(s, officerId, INT) - stat(s, targetId, INT)) / 200 - def(targetId).gi * 0.04;
  if (bonded(officerId, targetId)) p += 0.2;
  return clamp(p, 0, 0.85);
}

export function betray(s: GameState, officerId: string, targetId: string): Result {
  const o = ready(s, officerId);
  if (!o) return fail('움직일 수 있는 장수가 아닙니다.');
  const t = s.officers[targetId];
  if (!t || t.status !== 'serving' || t.faction === o.faction) return fail('적 장수를 골라야 합니다.');
  const p = betrayChance(s, o.id, targetId);
  if (p <= 0) return fail(`${jo(nameOf(targetId), '은는')} 충성이 너무 높아 내응을 권할 수 없습니다.`);
  done(s, o, 12);
  if (!chance(s, p)) { t.loyalty = Math.min(100, t.loyalty + 5); return fail(`${jo(nameOf(targetId), '이가')} 내응 제의를 거절했습니다.`); }
  t.turncoat = o.faction;
  return ok(`${jo(nameOf(targetId), '이가')} 싸움이 벌어지면 우리 편에 서기로 약속했습니다.`);
}

/* ───────────── 출진 ───────────── */

export function attack(s: GameState, from: CityId, to: CityId, officerIds: string[], troops: number[], food: number, kinds?: UnitKind[]): Result {
  const c = s.cities[from];
  const f = c.owner;
  if (f < 0) return fail('아군 도시가 아닙니다.');
  const nb = NEIGHBORS[from].find((n) => n.to === to);
  if (!nb) return fail('이웃한 도시만 공격할 수 있습니다.');
  const t = s.cities[to];
  if (t.owner === f) return fail('아군 도시입니다.');
  if (allied(s, f, t.owner)) return fail('동맹 세력의 도시입니다.');
  if (officerIds.length === 0 || officerIds.length > 10) return fail('장수 1~10명을 골라야 합니다.');
  let total = 0;
  for (let i = 0; i < officerIds.length; i++) {
    const o = ready(s, officerIds[i], from);
    if (!o || o.faction !== f) return fail(`${jo(nameOf(officerIds[i]), '은는')} 출진할 수 없습니다.`);
    const n = Math.floor((troops[i] ?? 0) / 100) * 100;
    if (n < 100) return fail(`${nameOf(o.id)}에게 병력을 100 이상 주어야 합니다.`);
    if (n > troopCap(s, o.id)) return fail(`${jo(nameOf(o.id), '이가')} 거느릴 수 있는 병력은 ${troopCap(s, o.id)}입니다.`);
    total += n;
  }
  if (total > c.troops) return fail('도시 병력이 모자랍니다.');
  /* 병종: 편성 조건과 비용 */
  let cost = 0;
  if (kinds) {
    if (kinds.length !== officerIds.length) return fail('병종 수가 맞지 않습니다.');
    for (let i = 0; i < kinds.length; i++) {
      const k = kinds[i];
      const al = kindAllowed(s, from, officerIds[i], k);
      if (!al.ok) return fail(`${k}: ${al.why}`);
      if (k === '공성' && nb.kind === 'w') return fail('수로로는 공성병기를 실어 갈 수 없습니다.');
      const cap = KINDS[k].cap;
      if (cap && troops[i] > cap) return fail(`${k} 부대는 ${cap.toLocaleString()}명까지입니다.`);
      cost += kindCost(from, k, troops[i]);
    }
    if (cost > c.gold) return fail(`병종 편성에 금 ${cost}이 필요합니다.`);
  }
  food = Math.floor(Math.min(food, c.food));
  if (food < total * 0.05) return fail(`군량을 적어도 ${Math.ceil(total * 0.05)} 가져가야 합니다.`);
  c.troops -= total;
  c.food -= food;
  c.gold -= cost;
  for (const id of officerIds) done(s, s.officers[id], 0);
  s.attacks.push({ faction: f, from, to, officers: [...officerIds], troops: officerIds.map((_, i) => Math.floor(troops[i] / 100) * 100), kinds: kinds ? [...kinds] : undefined, food, gold: 0 });
  /* 동맹을 깨고 친 것은 아니지만, 공격받은 쪽과는 사이가 나빠진다 */
  if (t.owner >= 0) addRel(s, f, t.owner, -15);
  return ok(`${cityName(from)}에서 ${jo(cityName(to), '로')} 출진합니다.`);
}

/** 출진할 때 장수별 기본 병력 배분 — 통솔 비율로, 각자 상한까지 */
export function autoAllot(s: GameState, ids: string[], pool: number): number[] {
  const caps = ids.map((id) => troopCap(s, id));
  const weights = ids.map((id) => stat(s, id, LEAD) + stat(s, id, WAR) / 2);
  const out = ids.map(() => 0);
  let left = Math.floor(pool / 100) * 100;
  for (let pass = 0; pass < 4 && left >= 100; pass++) {
    const open = ids.map((_, i) => i).filter((i) => out[i] < caps[i]);
    const wsum = open.reduce((a, i) => a + weights[i], 0);
    if (!open.length || wsum <= 0) break;
    let used = 0;
    for (const i of open) {
      const want = Math.floor((left * weights[i]) / wsum / 100) * 100;
      const add = Math.min(want, caps[i] - out[i]);
      out[i] += add;
      used += add;
    }
    left -= used;
    if (used === 0) break;
  }
  return out;
}
