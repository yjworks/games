import { CITIES, CITY_BY_ID } from '../data/cities';
import { OFFICERS, OFFICER_DEF } from '../data/officers';
import { initialItemPlacement } from '../data/items';
import { FACTION_COLORS, SCENARIOS, type ScenarioDef } from '../data/scenarios';
import type { CityId, FactionKey } from '../data/types';
import { appearYear, historicalKey, worth } from './officers';
import { clamp, rint, rnd, shuffle } from './rng';
import { SAVE_VERSION, type City, type Faction, type GameState, type Officer, type Options } from './state';

/** 인구(만)에 따른 개발 상한 */
export const agriCap = (c: City) => Math.round((c.pop / 10000) * 8 + 200);
export const commCap = (c: City) => Math.round((c.pop / 10000) * 7 + 200);

export const DEFAULT_OPTIONS: Options = { difficulty: 'normal', lifespan: 'history', manualBattle: true };

/** 시나리오의 그해 계통 → 그 계통 세력 번호 */
function factionForKey(factions: Faction[], key: FactionKey, year: number): number {
  let k = key;
  if (k === 'han' && year >= 189 && year <= 192) k = 'dong';
  if (k === 'jin') k = year < 265 ? 'cao' : 'jin';
  if (k === 'none' || k === 'han') return -1;
  const f = factions.find((x) => x.key === k && x.alive);
  return f ? f.idx : -1;
}

export function newGame(scenarioId: string, humanRulers: string[], options: Options = DEFAULT_OPTIONS, seed?: number): GameState {
  const sc: ScenarioDef | undefined = SCENARIOS.find((x) => x.id === scenarioId);
  if (!sc) throw new Error(`시나리오 없음: ${scenarioId}`);
  const s0 = seed ?? (Math.floor(Math.random() * 2 ** 31) | 0);
  const s: GameState = {
    version: SAVE_VERSION,
    scenarioId,
    seed: s0,
    rng: s0,
    year: sc.year,
    month: sc.month,
    options: { ...options },
    factions: [],
    cities: {} as Record<CityId, City>,
    officers: {},
    items: {},
    emperor: -1,
    hanAlive: sc.hanAlive,
    fired: [],
    log: [],
    order: [],
    turn: 0,
    attacks: [],
    battle: null,
    news: [],
    foodPrice: 50,
    over: null,
    startYear: sc.year,
    startMonth: sc.month,
  };

  /* 세력 */
  const owner: Partial<Record<CityId, { f: number; power: number }>> = {};
  for (const sf of sc.factions) {
    if (!OFFICER_DEF[sf.ruler]) continue; // 군주 데이터가 없으면 세력도 없다
    const idx = s.factions.length;
    s.factions.push({
      idx,
      key: sf.key,
      ruler: sf.ruler,
      advisor: null,
      capital: sf.capital,
      color: FACTION_COLORS[sf.key],
      alive: true,
      human: humanRulers.includes(sf.ruler),
      rel: {},
      ally: {},
      rank: 0,
      done: false,
    });
    for (const c of sf.cities) owner[c] = { f: idx, power: sf.power ?? 1 };
  }
  for (const a of s.factions) for (const b of s.factions) if (a !== b) a.rel[b.idx] = 50;
  s.emperor = sc.emperor ? s.factions.find((f) => f.key === sc.emperor)?.idx ?? -1 : -1;

  /* 도시 */
  for (const cd of CITIES) {
    const o = owner[cd.id];
    const popMan = cd.pop;
    const power = o?.power ?? 0.35;
    const isCap = o ? s.factions[o.f].capital === cd.id : false;
    const c: City = {
      id: cd.id,
      owner: o ? o.f : -1,
      gold: Math.round(200 + popMan * 9 * power + (isCap ? 400 : 0)),
      food: Math.round(2500 + popMan * 110 * power + (isCap ? 3000 : 0)),
      pop: popMan * 10000,
      agri: 0,
      comm: 0,
      flood: rint(s, 25, 55),
      wall: isCap ? rint(s, 65, 80) : rint(s, 30, 60),
      loyalty: rint(s, 45, 70),
      troops: Math.round((popMan * 140 * power + (o ? 2500 : 600) + (isCap ? 4000 : 0)) / 100) * 100,
      training: o ? rint(s, 40, 65) : rint(s, 25, 45),
      morale: o ? 65 : 50,
      governor: null,
      delegated: false,
      traded: false,
    };
    c.agri = Math.round(agriCap(c) * (0.35 + rnd(s) * 0.25));
    c.comm = Math.round(commCap(c) * (0.3 + rnd(s) * 0.25));
    s.cities[cd.id] = c;
  }

  /* 장수 */
  const y = sc.year;
  const m = sc.month;
  const rulerOf = new Map(s.factions.map((f) => [f.ruler, f.idx]));
  for (const d of OFFICERS) {
    const appear = appearYear(d);
    let dieYear = d.died;
    if (options.lifespan === 'fiction') {
      const span = d.died - d.born;
      dieYear = d.died + (span < 55 ? rint(s, 0, 12) : rint(s, 0, 4));
    }
    const o: Officer = {
      id: d.id,
      status: 'hidden',
      faction: -1,
      city: null,
      loyalty: 0,
      merit: 0,
      acted: false,
      appear,
      dieYear,
      dieMonth: rint(s, 1, 12),
      found: false,
      captor: -1,
      turncoat: -1,
      items: [],
    };
    s.officers[d.id] = o;
    /* 시나리오 군주는 그해에 죽더라도 시작 달보다 뒤에 죽는다 */
    if (rulerOf.has(d.id) && dieYear === y && o.dieMonth <= m) o.dieMonth = Math.min(12, m + rint(s, 1, 3));
    const dead = dieYear < y || (dieYear === y && o.dieMonth < m);
    if (dead) { o.status = 'dead'; continue; }
    const isRuler = rulerOf.has(d.id);
    if (appear > y && !isRuler) continue;
    const key = sc.overrides?.[d.id] ?? historicalKey(d, y);
    const f = isRuler ? rulerOf.get(d.id)! : factionForKey(s.factions, key, y);
    if (f >= 0) {
      o.status = 'serving';
      o.faction = f;
    } else {
      o.status = 'free';
      o.city = d.home;
    }
  }

  /* 세력 안 배치 */
  for (const f of s.factions) placeFaction(s, f);
  for (const o of Object.values(s.officers)) {
    if (o.status !== 'serving') continue;
    const d = OFFICER_DEF[o.id];
    const age = y - d.born;
    o.merit = clamp((age - 18) * 30 + Math.round(worth(s, o.id) * 3), 0, 3000);
  }

  /* 보물 */
  const place = initialItemPlacement(y);
  for (const [id, p] of Object.entries(place)) {
    const holder = p.holder ? s.officers[p.holder] : undefined;
    if (holder && (holder.status === 'serving' || holder.status === 'free')) {
      holder.items.push(id);
      s.items[id] = { holder: holder.id };
    } else {
      const fallback = p.city ?? (holder ? OFFICER_DEF[holder.id].home : undefined);
      if (fallback) s.items[id] = { city: fallback };
    }
  }

  for (const f of s.factions) updateRank(s, f.idx);
  s.order = shuffle(s, s.factions.map((f) => f.idx));
  s.turn = 0;
  s.log.push({ y, m, kind: 'event', text: `${y}년 ${m}월, 「${sc.name}」 — ${sc.desc[0]}` });
  return s;
}

/** 세력 장수를 도시에 고르게 나누고 태수를 정한다 */
export function placeFaction(s: GameState, f: Faction) {
  const cities = (Object.values(s.cities) as City[]).filter((c) => c.owner === f.idx).map((c) => c.id);
  if (cities.length === 0) return;
  if (!cities.includes(f.capital)) f.capital = cities[0];
  const members = Object.values(s.officers)
    .filter((o) => o.status === 'serving' && o.faction === f.idx && o.city === null)
    .sort((a, b) => worth(s, b.id) - worth(s, a.id));
  const count: Record<string, number> = Object.fromEntries(cities.map((c) => [c, 0]));
  for (const o of members) {
    const d = OFFICER_DEF[o.id];
    let city: CityId;
    if (o.id === f.ruler) city = f.capital;
    else if (cities.includes(d.home) && count[d.home] < 4) city = d.home;
    else {
      city = cities.reduce((best, c) => {
        const wc = count[c] * (c === f.capital ? 0.6 : 1);
        const wb = count[best] * (best === f.capital ? 0.6 : 1);
        return wc < wb ? c : best;
      }, cities[0]);
    }
    o.city = city;
    count[city]++;
    const bondRuler = d.bonds?.includes(f.ruler) || OFFICER_DEF[f.ruler]?.bonds?.includes(o.id) || d.father === f.ruler;
    o.loyalty = o.id === f.ruler ? 100 : clamp(58 + d.gi * 3 + (bondRuler ? 15 : 0) + rint(s, 0, 8), 0, 100);
  }
  for (const c of cities) pickGovernor(s, c);
}

export function pickGovernor(s: GameState, cityId: CityId) {
  const c = s.cities[cityId];
  if (c.owner < 0) { c.governor = null; return; }
  const f = s.factions[c.owner];
  const here = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === c.owner && o.city === cityId);
  if (here.length === 0) { c.governor = null; return; }
  if (here.some((o) => o.id === f.ruler)) { c.governor = f.ruler; return; }
  if (c.governor && here.some((o) => o.id === c.governor)) return;
  here.sort((a, b) => worth(s, b.id) - worth(s, a.id));
  c.governor = here[0].id;
}

/** 칭호 단계: 도시 수와 천자·한 황실에 따라 */
export const RANK_TITLES = ['태수', '자사', '주목', '공', '왕', '황제'];
export function updateRank(s: GameState, f: number) {
  const fac = s.factions[f];
  const n = (Object.values(s.cities) as City[]).filter((c) => c.owner === f).length;
  let r = n >= 18 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : n >= 2 ? 1 : 0;
  if (fac.rank === 5) r = 5; // 칭제는 되돌리지 않는다
  fac.rank = Math.max(r, Math.min(fac.rank, 4));
}

export function cityName(id: CityId) {
  return CITY_BY_ID[id]?.name ?? id;
}
