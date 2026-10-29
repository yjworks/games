import { CITY_BY_ID, NEIGHBORS, roadKind } from '../data/cities';
import type { CityId, Stats, TraitId } from '../data/types';
import {
  type MapLabel, type Tile, type TileType, buildMap, centerXY, compassName, entryTiles, entryVector, hexDist, hexLine,
} from './battlemap';
import { allied, autoAllot } from './commands';
import { KINDS, autoKind, kindOf, type UnitKind } from './units';
import { jo } from './josa';
import { INT, LEAD, WAR, nameOf, statsOf, traitsOf, troopCap, worth } from './officers';
import { chance, clamp, rint, rnd, rrange, type RngHolder } from './rng';
import type { AttackOrder, GameState } from './state';

export type { Tile, TileType } from './battlemap';

/* ───────────── 자료형 ───────────── */

export type Fate = 'routed' | 'retreated' | 'captured' | 'killed' | 'destroyed';

export interface Unit {
  uid: number;
  officer: string | null;
  name: string;
  side: 0 | 1;
  faction: number;
  q: number;
  r: number;
  troops: number;
  maxTroops: number;
  morale: number;
  training: number;
  stats: Stats;
  traits: TraitId[];
  move: number;
  moved: boolean;
  acted: boolean;
  confused: number;
  commander: boolean;
  gone: Fate | null;
  /** 병종 */
  kind: UnitKind;
  /** 원군이면 돌아갈 도시 */
  home?: CityId;
  /** 지키는 자리(관문 수비) — 적이 붙기 전에는 이 둘레를 떠나지 않는다 */
  guard?: [number, number];
}

/** 아직 도착하지 않은 원군 */
export interface Reinforcement {
  side: 0 | 1;
  faction: number;
  from: CityId;
  day: number;
  units: Unit[];
}

export type Weather = '맑음' | '흐림' | '비' | '강풍' | '안개';

export interface BattleState extends RngHolder {
  attacker: number;
  defender: number;
  from: CityId;
  to: CityId;
  naval: boolean;
  W: number;
  H: number;
  tiles: Tile[];
  units: Unit[];
  day: number;
  maxDay: number;
  side: 0 | 1;
  weather: Weather;
  /** 바람이 부는 방향(이웃 칸 순서 0~5) */
  wind: number;
  food: number;
  defFood: number;
  keep: [number, number];
  /** 성벽까지의 거리와 성 규모 */
  radius: number;
  size: 'large' | 'medium' | 'small';
  labels: MapLabel[];
  note: string;
  /** 공격군이 들어온 방향(동·서남 …) */
  entry: string;
  reinforce: Reinforcement[];
  floodUsed: boolean;
  log: string[];
  /** 마지막 일기토 기록(연출용) */
  duel: DuelResult | null;
  human: [boolean, boolean];
  over: null | { winner: 0 | 1; reason: string };
  /** 방금 터진 필살 전법(장수 컷인 연출용, 화면이 보고 지운다) */
  flash?: { officer: string; tactic: string } | null;
}

export interface DuelResult {
  a: string;
  b: string;
  lines: string[];
  winner: 0 | 1 | -1;
  /** 진 장수의 결말 */
  outcome: 'killed' | 'captured' | 'fled' | 'draw';
}

export const MAX_DAY = 30;
const GARRISON: Stats = [45, 45, 30, 30, 30];

/* ───────────── 육각 칸 (odd-r 오프셋) ───────────── */

const DIRS_EVEN: [number, number][] = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const DIRS_ODD: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

export function neighbors(bs: { W: number; H: number }, q: number, r: number): [number, number][] {
  const dirs = r % 2 === 0 ? DIRS_EVEN : DIRS_ODD;
  const out: [number, number][] = [];
  for (const [dq, dr] of dirs) {
    const nq = q + dq, nr = r + dr;
    if (nq >= 0 && nq < bs.W && nr >= 0 && nr < bs.H) out.push([nq, nr]);
  }
  return out;
}

/** 방향 번호 순서의 이웃(바람 번짐용) — 지도 밖이면 null */
function neighborDir(bs: BattleState, q: number, r: number, dir: number): [number, number] | null {
  const [dq, dr] = (r % 2 === 0 ? DIRS_EVEN : DIRS_ODD)[dir];
  const nq = q + dq, nr = r + dr;
  return nq >= 0 && nq < bs.W && nr >= 0 && nr < bs.H ? [nq, nr] : null;
}

export const dist = (a: [number, number], b: [number, number]) => hexDist(a, b);

export const tileAt = (bs: { W: number; tiles: Tile[] }, q: number, r: number) => bs.tiles[r * bs.W + q];
export const unitAt = (bs: BattleState, q: number, r: number) =>
  bs.units.find((u) => !u.gone && u.q === q && u.r === r) ?? null;

export const TILE_NAMES: Record<TileType, string> = {
  plain: '평지', road: '길', forest: '숲', hill: '구릉', mountain: '산', peak: '험산', marsh: '늪', water: '물', ford: '여울',
  bridge: '다리', village: '촌락', dam: '제방', wall: '성벽', gate: '성문', pass: '관문', inner: '성내', keep: '본진',
  breach: '무너진 성벽',
};

const DEF_MOD: Record<TileType, number> = {
  plain: 1, road: 0.95, forest: 1.15, hill: 1.2, mountain: 1.3, peak: 1.3, marsh: 0.9, water: 0.85, ford: 0.85, bridge: 0.9,
  village: 1.15, dam: 1.1, wall: 1, gate: 1, pass: 1, inner: 1.2, keep: 1.3, breach: 1.05,
};

const HIGH: TileType[] = ['hill', 'mountain'];
const LOW: TileType[] = ['plain', 'road', 'marsh', 'ford', 'bridge', 'village', 'water'];
const BURNABLE: TileType[] = ['plain', 'road', 'forest', 'hill', 'village', 'inner', 'keep'];
const FLOODABLE: TileType[] = ['plain', 'road', 'forest', 'marsh', 'ford', 'village', 'inner', 'keep', 'breach', 'bridge'];
const isBarrier = (t: TileType) => t === 'wall' || t === 'gate' || t === 'pass';

export function moveCost(bs: BattleState, u: Unit, q: number, r: number): number {
  const t = tileAt(bs, q, r);
  if (t.fire > 0) return Infinity;
  const wet = t.flood > 0 ? 2 : 0;
  const k = u.kind ?? '보병';
  const engine = k === '공성';
  const horse = k === '기병';
  switch (t.t) {
    case 'road': case 'bridge': return 0.5 + wet;
    case 'plain': case 'inner': case 'keep': case 'village': case 'dam': return 1 + wet;
    case 'breach': return (engine ? 3 : 2) + wet;
    case 'forest': case 'hill': case 'marsh': return engine ? Infinity : (horse ? 3 : 2) + wet;
    case 'ford': return (engine ? 3 : 2) + wet;
    case 'mountain': return engine ? Infinity : horse ? 5 : 3;
    case 'water':
      if (k === '수군') return 1;
      if (engine) return Infinity;
      return bs.naval ? (u.traits.includes('수군') ? 1 : 2) : u.traits.includes('수군') ? 2 : horse ? 4 : 3;
    case 'gate': case 'pass': return u.side === 1 && t.hp > 0 ? 1 : Infinity;
    case 'wall': case 'peak': return Infinity;
  }
}

/* ───────────── 전장 만들기 ───────────── */

export function createBattle(s: GameState, order: AttackOrder): BattleState {
  const city = s.cities[order.to];
  const naval = roadKind(order.from, order.to) === 'w';
  const map = buildMap(order.to);
  const v = entryVector(order.from, order.to);
  const bs: BattleState = {
    rng: Math.floor(rnd(s) * 2 ** 31) | 0,
    attacker: order.faction,
    defender: city.owner,
    from: order.from,
    to: order.to,
    naval,
    W: map.W,
    H: map.H,
    tiles: map.tiles,
    units: [],
    day: 1,
    maxDay: MAX_DAY,
    side: 0,
    weather: '맑음',
    wind: 0,
    food: order.food,
    defFood: city.food,
    keep: map.keep,
    radius: map.radius,
    size: map.size,
    labels: map.labels,
    note: map.note,
    entry: compassName(v),
    reinforce: [],
    floodUsed: false,
    log: [],
    duel: null,
    human: [s.factions[order.faction]?.human ?? false, city.owner >= 0 ? s.factions[city.owner]?.human ?? false : false],
    over: null,
  };
  bs.weather = pickWeather(bs, s.month);
  bs.wind = rint(bs, 0, 5);

  /* 성벽·성문·관문 내구: 성 규모와 도시 성벽 수치 */
  const mult = map.size === 'large' ? 1.6 : map.size === 'small' ? 0.75 : 1.1;
  for (const t of bs.tiles) {
    if (t.t === 'wall') t.hp = Math.round((300 + city.wall * 12) * mult);
    else if (t.t === 'gate') t.hp = Math.round((200 + city.wall * 8) * mult);
    else if (t.t === 'pass') t.hp = 450 + city.wall * 5;
    if (t.hp) t.max = t.hp;
  }

  /* 공격 부대 — 출발 도시 쪽 가장자리에서 */
  let uid = 1;
  const taken = new Set<number>();
  const slots = entryTiles(bs, v, order.officers.length, naval, taken);
  order.officers.forEach((id, i) => {
    const [q, r] = slots[i] ?? slots[slots.length - 1];
    taken.add(r * bs.W + q);
    const kind = order.kinds?.[i] ?? autoKind(s, order.from, id, naval);
    bs.units.push(makeUnit(s, uid++, id, 0, order.faction, q, r, order.troops[i], s.cities[order.from].training, s.cities[order.from].morale, i === 0, kind));
  });

  /* 방어 부대: 장수에게 병력을 나눠 주고 남는 병력은 수비대로 */
  const defenders = city.owner >= 0
    ? Object.values(s.officers)
      .filter((o) => o.status === 'serving' && o.faction === city.owner && o.city === order.to)
      .sort((a, b) => worth(s, b.id) - worth(s, a.id))
      .slice(0, 10)
    : [];
  const ruler = city.owner >= 0 ? s.factions[city.owner].ruler : null;
  const lead = defenders.find((o) => o.id === ruler) ?? defenders.find((o) => o.id === city.governor) ?? defenders[0];
  const ids = defenders.map((o) => o.id);
  const allot = autoAllot(s, ids, city.troops);
  let rest = city.troops - allot.reduce((a, b) => a + b, 0);
  /* 본진·성내는 공격군 쪽부터 채우고, 넘치면 성 밖 바로 둘레 */
  const [kq, kr] = bs.keep;
  const [cx, cy] = centerXY(kq, kr);
  const proj = (q: number, r: number) => { const [x, y] = centerXY(q, r); return (x - cx) * v[0] + (y - cy) * v[1]; };
  const inner: [number, number][] = [];
  const outer: [number, number][] = [];
  for (let r = 0; r < bs.H; r++) for (let q = 0; q < bs.W; q++) {
    const d = dist([q, r], [kq, kr]);
    const t = tileAt(bs, q, r).t;
    if (d < bs.radius) inner.push([q, r]);
    else if (d === bs.radius + 1 && !['water', 'mountain', 'peak'].includes(t)) outer.push([q, r]);
  }
  inner.sort((a, b) => dist(a, [kq, kr]) - dist(b, [kq, kr]) || proj(b[0], b[1]) - proj(a[0], a[1]));
  outer.sort((a, b) => proj(a[0], a[1]) - proj(b[0], b[1]));
  const defSlots = [...inner, ...outer];
  let slot = 0;
  const nextSlot = (): [number, number] => defSlots[Math.min(slot++, defSlots.length - 1)];

  /* 공격군 쪽에 관문이 있으면 무력이 높은 장수가 관을 지킨다 */
  const passes: [number, number][] = [];
  for (let r = 0; r < bs.H; r++) for (let q = 0; q < bs.W; q++) if (tileAt(bs, q, r).t === 'pass') passes.push([q, r]);
  const towardAttacker = passes
    .filter(([q, r]) => proj(q, r) > bs.radius * 0.866 && hexDist([q, r], [kq, kr]) >= bs.radius + 1)
    .sort((a, b) => proj(b[0], b[1]) - proj(a[0], a[1]));
  const guardIds = new Set<string>();
  if (towardAttacker.length && ids.length >= 3) {
    const [pq, pr] = towardAttacker[0];
    const behind = neighbors(bs, pq, pr)
      .filter(([q, r]) => proj(q, r) < proj(pq, pr) && !['mountain', 'peak', 'water', 'wall', 'gate', 'pass'].includes(tileAt(bs, q, r).t))
      .slice(0, 2);
    const fighters = [...ids].filter((id) => id !== lead?.id).sort((a, b) => statsOf(s, b)[WAR] + statsOf(s, b)[LEAD] - statsOf(s, a)[WAR] - statsOf(s, a)[LEAD]);
    behind.forEach(([q, r], i) => {
      const id = fighters[i];
      if (!id) return;
      const k = ids.indexOf(id);
      /* 관문 수비대는 성 병력의 2할까지만 — 나머지는 성을 지킨다 */
      const share = Math.floor((city.troops * 0.2) / 100) * 100;
      const want = Math.min(allot[k] || Math.min(rest, troopCap(s, id)), Math.max(1000, share));
      const u = makeUnit(s, uid++, id, 1, city.owner, q, r, want, city.training, city.morale, false, defKind(s, order.to, id));
      if (allot[k]) rest += allot[k] - want; else rest -= want;
      if (u.troops < 100) return;
      u.guard = [pq, pr];
      bs.units.push(u);
      guardIds.add(id);
    });
  }
  ids.forEach((id, i) => {
    if (guardIds.has(id)) return;
    if (allot[i] <= 0 && rest <= 0) return;
    let n = allot[i];
    if (n <= 0) { n = Math.min(rest, troopCap(s, id)); rest -= n; }
    const [q, r] = nextSlot();
    bs.units.push(makeUnit(s, uid++, id, 1, city.owner, q, r, n, city.training, city.morale, lead?.id === id, defKind(s, order.to, id)));
  });
  for (let g = 0; g < 4 && rest >= 100; g++) {
    const n = g === 3 ? rest : Math.min(rest, 5000);
    rest -= n;
    const [q, r] = nextSlot();
    bs.units.push(makeUnit(s, uid++, null, 1, city.owner, q, r, n, city.training, city.morale, !lead && g === 0, g % 2 === 0 ? '궁병' : '창병'));
  }

  /* 원군: 수비 측은 이웃 아군·동맹 도시에서, 공격 측은 이웃 동맹 도시에서 */
  if (city.owner >= 0) uid = planReinforcement(s, bs, 1, uid);
  uid = planReinforcement(s, bs, 0, uid);

  /* 내응: 약속한 장수는 그 자리에서 돌아선다 */
  for (const u of bs.units) {
    if (!u.officer) continue;
    const o = s.officers[u.officer];
    const enemy = u.side === 0 ? bs.defender : bs.attacker;
    if (o.turncoat >= 0 && o.turncoat === enemy && !u.commander) {
      u.side = u.side === 0 ? 1 : 0;
      u.faction = enemy;
      u.commander = false;
      u.guard = undefined;
      bs.log.push(`${jo(u.name, '이가')} 약속대로 창끝을 돌렸다!`);
    }
  }
  const sizeName = { large: '대성', medium: '성', small: '소성' }[bs.size];
  bs.log.push(`${CITY_BY_ID[order.to].name} ${sizeName} 공방전 — 공격군은 ${bs.entry}쪽에서 진입 · ${bs.weather}${naval ? ' · 수로' : ''}`);
  return bs;
}

/** 이웃 도시에서 원군을 보낼지 정한다. 다음 부대 번호를 돌려준다 */
function planReinforcement(s: GameState, bs: BattleState, side: 0 | 1, uid0: number): number {
  const main = side === 0 ? bs.attacker : bs.defender;
  let uid = uid0;
  if (main < 0) return uid;
  const cands = NEIGHBORS[bs.to]
    .map((n) => s.cities[n.to])
    .filter((c) => c.id !== bs.from && c.owner >= 0
      && (side === 1 ? c.owner === main || allied(s, c.owner, main) : allied(s, c.owner, main) && c.owner !== bs.defender))
    .filter((c) => c.troops >= 4000)
    .sort((a, b) => b.troops - a.troops);
  const c = cands[0];
  if (!c) return uid;
  const staff = Object.values(s.officers)
    .filter((o) => o.status === 'serving' && o.faction === c.owner && o.city === c.id && s.factions[c.owner].ruler !== o.id)
    .sort((a, b) => statsOf(s, b.id)[LEAD] + statsOf(s, b.id)[WAR] - statsOf(s, a.id)[LEAD] - statsOf(s, a.id)[WAR]);
  if (staff.length < 2) return uid;
  const team = staff.slice(0, Math.min(3, staff.length - 1)).map((o) => o.id);
  const pool = Math.floor((c.troops * 0.35) / 100) * 100;
  const troops = autoAllot(s, team, pool);
  const total = troops.reduce((a, b) => a + b, 0);
  if (total < 1000) return uid;
  c.troops -= total;
  const day = 2 + (roadKind(c.id, bs.to) === 'w' ? 1 : 0) + rint(bs, 0, 1);
  const units = team.map((id, i) => {
    const u = makeUnit(s, uid++, id, side, c.owner, -1, -1, troops[i], c.training, c.morale, false, autoKind(s, c.id, id, roadKind(c.id, bs.to) === 'w'));
    u.home = c.id;
    u.gone = 'retreated'; // 도착 전에는 전장에 없다
    return u;
  }).filter((u) => u.troops >= 100);
  bs.reinforce.push({ side, faction: c.owner, from: c.id, day, units });
  const who = c.owner === main ? '' : `동맹 ${nameOf(s.factions[c.owner].ruler)}군의 `;
  bs.log.push(`${CITY_BY_ID[c.id].name}에서 ${who}원군 ${units.length}부대(${total.toLocaleString()}명)가 ${day}일째 도착할 예정이다.`);
  return uid;
}

function makeUnit(s: GameState, uid: number, officer: string | null, side: 0 | 1, faction: number, q: number, r: number,
  troops: number, training: number, morale: number, commander: boolean, kind: UnitKind = '보병'): Unit {
  const stats = officer ? statsOf(s, officer) : GARRISON;
  const traits = officer ? traitsOf(s, officer) : [];
  const items = officer ? s.officers[officer].items : [];
  let move = KINDS[kind].move + (traits.includes('기병') && kind === '기병' ? 1 : 0);
  /* 명마는 말을 탄 장수에게 — 기병이면 온전히, 아니면 장수 혼자라 절반 */
  for (const it of items) {
    const bonus = it === 'chitu' ? 2 : it === 'dilu' || it === 'jueying' ? 1 : 0;
    move += kind === '기병' ? bonus : Math.floor(bonus / 2);
  }
  return {
    uid, officer, name: officer ? nameOf(officer) : '수비대', side, faction, q, r,
    troops, maxTroops: troops, morale, training, stats, traits, move,
    moved: false, acted: false, confused: 0, commander, gone: null, kind,
  };
}

/** 수비 장수의 병종 — 성을 지키므로 공성·수군은 쓰지 않는다 */
function defKind(s: GameState, city: CityId, id: string): UnitKind {
  const k = autoKind(s, city, id, false);
  return k === '수군' || k === '공성' ? '보병' : k;
}

function pickWeather(bs: RngHolder, month: number): Weather {
  const x = rnd(bs);
  const wet = month >= 5 && month <= 8;
  const mist = month === 3 || month === 4 || month === 10 || month === 11;
  if (x < (wet ? 0.25 : 0.1)) return '비';
  if (mist && x < 0.2) return '안개';
  if (x < (wet ? 0.45 : 0.35)) return '흐림';
  if (x < (wet ? 0.55 : 0.5)) return '강풍';
  return '맑음';
}

/** 아직 도착하지 않은 원군 부대(전투가 끝나면 그대로 돌아간다) */
export function pendingUnits(bs: BattleState): Unit[] {
  return bs.reinforce.flatMap((r) => r.units);
}

function arrive(bs: BattleState, side: 0 | 1) {
  for (const rf of [...bs.reinforce]) {
    if (rf.side !== side || rf.day > bs.day) continue;
    const taken = new Set(bs.units.filter((u) => !u.gone).map((u) => u.r * bs.W + u.q));
    const v = entryVector(rf.from, bs.to);
    const slots = entryTiles(bs, v, rf.units.length, roadKind(rf.from, bs.to) === 'w', taken);
    const came: Unit[] = [];
    rf.units.forEach((u, i) => {
      const p = slots[i];
      if (!p) return;
      u.q = p[0]; u.r = p[1]; u.gone = null;
      bs.units.push(u);
      came.push(u);
    });
    rf.units = rf.units.filter((u) => !came.includes(u));
    if (!rf.units.length) bs.reinforce = bs.reinforce.filter((x) => x !== rf);
    if (came.length) bs.log.push(`${bs.day}일째 — ${CITY_BY_ID[rf.from].name}의 원군 ${jo(came.map((u) => u.name).join('·'), '이가')} 도착했다!`);
  }
}

/* ───────────── 이동 ───────────── */

function zoc(bs: BattleState, u: Unit, q: number, r: number): boolean {
  return neighbors(bs, q, r).some(([nq, nr]) => {
    const e = unitAt(bs, nq, nr);
    return e && e.side !== u.side;
  });
}

/** 갈 수 있는 칸과 비용 */
export function reachable(bs: BattleState, u: Unit): Map<number, number> {
  const out = new Map<number, number>();
  if (u.moved || u.acted || u.gone || u.confused > 0) return out;
  const key = (q: number, r: number) => r * bs.W + q;
  out.set(key(u.q, u.r), 0);
  const frontier: [number, number, number][] = [[u.q, u.r, 0]];
  while (frontier.length) {
    frontier.sort((a, b) => a[2] - b[2]);
    const [q, r, c] = frontier.shift()!;
    if (c > 0 && zoc(bs, u, q, r)) continue; // 적과 맞닿으면 멈춘다
    for (const [nq, nr] of neighbors(bs, q, r)) {
      const cost = moveCost(bs, u, nq, nr);
      const nc = c + cost;
      if (nc > u.move) continue;
      const other = unitAt(bs, nq, nr);
      if (other && other.side !== u.side) continue;
      const k = key(nq, nr);
      if ((out.get(k) ?? Infinity) <= nc) continue;
      out.set(k, nc);
      frontier.push([nq, nr, nc]);
    }
  }
  /* 아군이 있는 칸에는 멈출 수 없다 */
  for (const k of [...out.keys()]) {
    const q = k % bs.W, r = Math.floor(k / bs.W);
    const other = unitAt(bs, q, r);
    if (other && other !== u) out.delete(k);
  }
  return out;
}

export function moveUnit(bs: BattleState, u: Unit, q: number, r: number): boolean {
  if (bs.over) return false;
  const reach = reachable(bs, u);
  if (!reach.has(r * bs.W + q)) return false;
  u.q = q; u.r = r; u.moved = true;
  checkEnd(bs);
  return true;
}

/* ───────────── 공격 ───────────── */

function atkPower(u: Unit) {
  return (u.stats[LEAD] * 0.55 + u.stats[WAR] * 0.45) * (0.6 + u.training / 250) * (0.6 + u.morale / 250);
}
function defPower(bs: BattleState, u: Unit) {
  const t = tileAt(bs, u.q, u.r);
  const inCastle = t.t === 'inner' || t.t === 'keep';
  /* 성안에서는 병종의 방어 약점이 없다(성가퀴 뒤에 선다). 기병은 성안에서 오히려 둔하다 */
  let m = DEF_MOD[t.t] * (inCastle ? Math.max(1, kindOf(u.kind).def) * (u.kind === '기병' ? 0.9 : 1) : kindOf(u.kind).def);
  if (u.kind === '수군') m *= t.t === 'water' ? 1.35 : 0.9;
  if (t.t === 'water' && u.traits.includes('수군')) m = 1.15;
  if ((t.t === 'inner' || t.t === 'keep') && u.traits.includes('수비')) m *= 1.2;
  if (t.flood > 0) m *= 0.85;
  return (u.stats[LEAD] * 0.6 + u.stats[INT] * 0.15 + u.stats[WAR] * 0.25) * (0.6 + u.training / 250) * m;
}

function attackMult(bs: BattleState, a: Unit, d: Unit, ranged: boolean) {
  let m = 1;
  const ta = tileAt(bs, a.q, a.r).t;
  const td = tileAt(bs, d.q, d.r).t;
  const ka = kindOf(a.kind);
  const open = ta === 'plain' || ta === 'road' || ta === 'breach';
  /* 병종: 근접은 공격 배율, 사격은 사격 배율(궁·노가 아니면 성루에서 쏘는 정도) */
  if (ranged) m *= ka.range ? ka.shot * (a.traits.includes('궁병') ? 1.15 : 1) : a.traits.includes('궁병') ? 0.85 : 0.6;
  else m *= ka.range && (ta === 'inner' || ta === 'keep') ? 1 : ka.atk;
  /* 상성 */
  if (!ranged && a.kind === '창병' && d.kind === '기병') m *= 1.5;
  if (!ranged && a.kind === '기병') {
    if (d.kind === '궁병' || d.kind === '노병' || d.kind === '공성') m *= 1.3;
    if (open) m *= 1.1;
    if (['forest', 'marsh', 'mountain', 'inner', 'keep'].includes(td)) m *= 0.8;
    if (a.traits.includes('기병')) m *= 1.05;
  }
  if (a.kind === '수군') m *= ta === 'water' ? 1.4 : 0.8;
  if (!ranged && a.traits.includes('돌격')) m *= 1.15;
  if (ta === 'water' && a.traits.includes('수군')) m *= 1.15;
  /* 높은 곳에서 낮은 곳을 치면 유리하다 */
  if (HIGH.includes(ta) && LOW.includes(td)) m *= 1.15;
  if (!ranged && d.traits.includes('매복') && (td === 'forest' || td === 'mountain')) m *= 0.85;
  return m;
}

/** 사격 사거리(0이면 못 쏜다). 궁병은 2칸, 성안 수비군은 성루에서 성벽 밖까지(대성 3칸) */
export function shootRange(bs: BattleState, u: Unit, at?: TileType): number {
  if (bs.weather === '안개') return 0;
  const t = at ?? tileAt(bs, u.q, u.r).t;
  const k = kindOf(u.kind);
  let own = k.range;
  if (own && u.kind === '노병' && ['hill', 'mountain', 'inner', 'keep', 'dam'].includes(t)) own = 3;
  if (own && u.traits.includes('궁병')) own += 1;
  if (!own && u.traits.includes('궁병') && u.kind !== '공성') own = 2;
  const tower = u.side === 1 && (t === 'inner' || t === 'keep') ? bs.radius : 0;
  return Math.max(own, tower);
}

export interface Target { kind: 'unit' | 'tile'; q: number; r: number; ranged: boolean }

export function attackTargets(bs: BattleState, u: Unit): Target[] {
  if (u.acted || u.gone || u.confused > 0) return [];
  const out: Target[] = [];
  const range = shootRange(bs, u);
  for (const e of bs.units) {
    if (e.gone || e.side === u.side) continue;
    const d = dist([u.q, u.r], [e.q, e.r]);
    if (d === 1) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: false });
    else if (d >= 2 && d <= range) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: true });
  }
  if (u.side === 0) {
    /* 공성병기는 두 칸 밖의 성벽도 친다(투석) */
    const reach = u.kind === '공성' ? 2 : 1;
    for (let r = Math.max(0, u.r - reach); r <= Math.min(bs.H - 1, u.r + reach); r++) {
      for (let q = Math.max(0, u.q - reach - 1); q <= Math.min(bs.W - 1, u.q + reach + 1); q++) {
        const d = dist([u.q, u.r], [q, r]);
        if (d < 1 || d > reach) continue;
        const t = tileAt(bs, q, r);
        if (isBarrier(t.t) && t.hp > 0) out.push({ kind: 'tile', q, r, ranged: d > 1 });
      }
    }
  }
  return out;
}

function damage(bs: BattleState, a: Unit, d: Unit, ranged: boolean) {
  const ratio = atkPower(a) / Math.max(1, defPower(bs, d));
  const base = a.troops * 0.085 * ratio * attackMult(bs, a, d, ranged) * rrange(bs, 0.85, 1.15) + 20;
  return Math.max(10, Math.round(Math.min(base, d.troops)));
}

export function attackUnit(bs: BattleState, a: Unit, target: Unit, ranged: boolean): string {
  if (bs.over || a.acted) return '';
  const dmg = damage(bs, a, target, ranged);
  hurt(bs, target, dmg);
  let text = `${a.name} → ${target.name}: ${ranged ? '사격' : '공격'} −${dmg}`;
  if (!ranged && !target.gone && target.confused === 0) {
    const pike = target.kind === '창병' && a.kind === '기병' ? 1.5 : 1;
    const tt = tileAt(bs, target.q, target.r).t;
    const weak = kindOf(target.kind).range && tt !== 'inner' && tt !== 'keep' ? 0.6 : 1;
    const back = Math.round(damage(bs, target, a, false) * 0.4 * pike * weak);
    hurt(bs, a, back);
    text += ` (반격 −${back})`;
  }
  a.morale = Math.min(100, a.morale + 1);
  a.acted = true; a.moved = true;
  bs.log.push(text);
  checkEnd(bs);
  return text;
}

export function attackTile(bs: BattleState, a: Unit, q: number, r: number): string {
  if (bs.over || a.acted) return '';
  const t = tileAt(bs, q, r);
  if (!isBarrier(t.t) || t.hp <= 0) return '';
  const siege = a.kind === '공성' ? 3 : a.kind === '기병' ? 0.7 : 1;
  const dmg = Math.round((a.troops * 0.03 * (atkPower(a) / 60) * siege + 25) * rrange(bs, 0.85, 1.15));
  const name = TILE_NAMES[t.t];
  t.hp = Math.max(0, t.hp - dmg);
  let text = `${a.name} → ${name}: −${dmg}`;
  if (t.hp === 0) { breakBarrier(bs, q, r); text += ` — ${jo(name, '이가')} 무너졌다!`; }
  a.acted = true; a.moved = true;
  bs.log.push(text);
  return text;
}

function breakBarrier(bs: BattleState, q: number, r: number) {
  const t = tileAt(bs, q, r);
  t.hp = 0;
  t.t = t.t === 'pass' ? 'road' : 'breach';
  /* 관문을 지키던 부대는 지킬 곳을 잃는다 */
  for (const u of bs.units) if (u.guard && u.guard[0] === q && u.guard[1] === r) u.guard = undefined;
}

function hurt(bs: BattleState, u: Unit, dmg: number) {
  u.troops = Math.max(0, u.troops - dmg);
  u.morale = clamp(u.morale - Math.round((dmg / Math.max(1, u.troops + dmg)) * 55) - 1, 0, 100);
  if (u.troops <= 0) { u.gone = 'destroyed'; bs.log.push(`${u.name} 부대가 무너졌다.`); }
  else if (u.morale <= 0) { u.gone = 'routed'; bs.log.push(`${u.name} 부대가 사기를 잃고 달아났다.`); }
}

/* ───────────── 계략: 화계·혼란 ───────────── */

export function fireChance(bs: BattleState, u: Unit, q: number, r: number): number {
  const t = tileAt(bs, q, r);
  if (dist([u.q, u.r], [q, r]) > 2 || t.fire > 0 || t.flood > 0) return 0;
  if (!BURNABLE.includes(t.t)) return 0;
  if (bs.weather === '비') return 0;
  let p = (u.stats[INT] - 25) / 100 + (u.traits.includes('화계') ? 0.25 : 0);
  if (t.t === 'forest') p += 0.15;
  if (t.t === 'village') p += 0.05;
  if (t.t === 'inner' || t.t === 'keep') p -= 0.1;
  if (bs.weather === '강풍') p += 0.12;
  if (bs.weather === '흐림') p -= 0.05;
  if (bs.weather === '안개') p -= 0.1;
  const e = unitAt(bs, q, r);
  if (e) p -= e.stats[INT] * 0.003 + (e.traits.includes('신산') ? 0.15 : 0);
  return clamp(p, 0, 0.92);
}

export function doFire(bs: BattleState, u: Unit, q: number, r: number): string {
  if (bs.over || u.acted) return '';
  const p = fireChance(bs, u, q, r);
  u.acted = true; u.moved = true;
  if (!chance(bs, p)) { const t = `${u.name}의 화계가 실패했다.`; bs.log.push(t); return t; }
  ignite(bs, q, r);
  const t = `${u.name}의 화계! 불길이 치솟았다.`;
  bs.log.push(t);
  checkEnd(bs);
  return t;
}

function ignite(bs: BattleState, q: number, r: number) {
  const tile = tileAt(bs, q, r);
  tile.fire = tile.t === 'forest' ? 3 : 2;
  const e = unitAt(bs, q, r);
  if (e) burn(bs, e);
}

function burn(bs: BattleState, u: Unit) {
  const dmg = Math.round(u.troops * 0.14 + 60);
  bs.log.push(`${u.name} 부대가 불길에 휩싸였다 −${Math.min(dmg, u.troops)}`);
  u.morale = Math.max(0, u.morale - 8);
  hurt(bs, u, dmg);
}

export function confuseChance(_bs: BattleState, u: Unit, e: Unit): number {
  if (dist([u.q, u.r], [e.q, e.r]) > 2) return 0;
  const p = 0.25 + (u.stats[INT] - e.stats[INT]) / 100 + (u.traits.includes('혼란') ? 0.2 : 0) - (e.traits.includes('신산') ? 0.2 : 0);
  return clamp(p, 0.03, 0.9);
}

export function doConfuse(bs: BattleState, u: Unit, e: Unit): string {
  if (bs.over || u.acted) return '';
  u.acted = true; u.moved = true;
  if (!chance(bs, confuseChance(bs, u, e))) { const t = `${jo(e.name, '은는')} 혼란에 빠지지 않았다.`; bs.log.push(t); return t; }
  e.confused = 2;
  const t = `${u.name}의 계략! ${e.name} 부대가 혼란에 빠졌다.`;
  bs.log.push(t);
  return t;
}

/* ───────────── 전법 — 병종마다 하나씩 있는 특수 공격 ───────────── */

export interface TacticDef {
  name: string;
  hanja: string;
  /** 성공률에 쓰는 능력치 */
  stat: typeof LEAD | typeof WAR | typeof INT;
  desc: string;
}

export const TACTICS: Record<UnitKind, TacticDef> = {
  보병: { name: '돌파', hanja: '突破', stat: WAR, desc: '맞닿은 적을 1.6배로 치고 반격을 받지 않는다. 적 사기 −6.' },
  창병: { name: '관통', hanja: '貫通', stat: WAR, desc: '긴 창으로 맞닿은 적과 그 뒤의 적까지 꿰뚫는다(1.3배·0.9배).' },
  기병: { name: '돌격', hanja: '突擊', stat: WAR, desc: '두 칸 안의 적에게 달려들어 1.8배로 치고 한 칸 밀어낸다. 반격 없음, 적 사기 −10. 숲·산·늪을 지나지 못한다.' },
  궁병: { name: '난사', hanja: '亂射', stat: LEAD, desc: '과녁과 그 둘레 적 모두에게 화살비를 퍼붓는다(1배·0.6배).' },
  노병: { name: '연노', hanja: '連弩', stat: LEAD, desc: '쇠뇌를 두 번 잇달아 쏜다(0.9배씩), 적 사기 −8.' },
  수군: { name: '화선', hanja: '火船', stat: INT, desc: '물 위에서 불붙인 배를 띄워 두 칸 안의 적을 불태운다(1.2배 + 불).' },
  공성: { name: '투석', hanja: '投石', stat: LEAD, desc: '세 칸 밖까지 돌을 날린다. 성벽·성문에 4배, 부대에는 1.1배와 둘레 0.5배.' },
};

const NO_CHARGE: TileType[] = ['forest', 'marsh', 'mountain', 'peak', 'water', 'ford', 'wall', 'gate', 'pass', 'hill'];

/** 전법을 쓸 수 있는 칸 */
export function tacticTargets(bs: BattleState, u: Unit): Target[] {
  if (u.acted || u.gone || u.confused > 0) return [];
  const out: Target[] = [];
  const foes = bs.units.filter((e) => !e.gone && e.side !== u.side);
  const d = (e: Unit) => dist([u.q, u.r], [e.q, e.r]);
  switch (u.kind) {
    case '보병': case '창병':
      for (const e of foes) if (d(e) === 1) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: false });
      break;
    case '기병':
      for (const e of foes) {
        if (d(e) === 1) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: false });
        else if (d(e) === 2 && chargeSpot(bs, u, e)) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: false });
      }
      break;
    case '궁병': case '노병': {
      const range = shootRange(bs, u);
      for (const e of foes) if (d(e) >= 2 && d(e) <= range) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: true });
      break;
    }
    case '수군': {
      const on = tileAt(bs, u.q, u.r).t;
      if (on !== 'water' && on !== 'ford' && on !== 'bridge') break;
      for (const e of foes) if (d(e) <= 2) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: d(e) > 1 });
      break;
    }
    case '공성':
      for (const e of foes) if (d(e) >= 2 && d(e) <= 3) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: true });
      if (u.side === 0) {
        bs.tiles.forEach((t, i) => {
          if (!isBarrier(t.t) || t.hp <= 0) return;
          const q = i % bs.W, r = Math.floor(i / bs.W);
          const dd = dist([u.q, u.r], [q, r]);
          if (dd >= 1 && dd <= 3) out.push({ kind: 'tile', q, r, ranged: dd > 1 });
        });
      }
      break;
  }
  return out;
}

/** 기병 돌격 — 적과 사이의 빈 칸(트인 땅)으로 달려든다 */
function chargeSpot(bs: BattleState, u: Unit, e: Unit): [number, number] | null {
  if (NO_CHARGE.includes(tileAt(bs, u.q, u.r).t) && tileAt(bs, u.q, u.r).t !== 'hill') return null;
  const line = hexLine([u.q, u.r], [e.q, e.r]);
  if (line.length !== 3) return null;
  const [q, r] = line[1];
  const t = tileAt(bs, q, r);
  if (NO_CHARGE.includes(t.t) || t.fire > 0 || unitAt(bs, q, r)) return null;
  return [q, r];
}

/** 맞은 쪽 뒤 칸(때린 쪽에서 멀어지는 이웃 가운데 가장 곧은 칸) */
function behind(bs: BattleState, from: [number, number], at: [number, number]): [number, number] | null {
  const [ax, ay] = centerXY(from[0], from[1]);
  const [bx, by] = centerXY(at[0], at[1]);
  const vx = bx - ax, vy = by - ay;
  let best: [number, number] | null = null, bestDot = 0.5;
  for (const [q, r] of neighbors(bs, at[0], at[1])) {
    const [cx, cy] = centerXY(q, r);
    const wx = cx - bx, wy = cy - by;
    const dot = (vx * wx + vy * wy) / (Math.hypot(vx, vy) * Math.hypot(wx, wy) || 1);
    if (dot > bestDot) { bestDot = dot; best = [q, r]; }
  }
  return best;
}

export function tacticChance(bs: BattleState, u: Unit, q: number, r: number): number {
  const def = TACTICS[u.kind];
  if (!tacticTargets(bs, u).some((t) => t.q === q && t.r === r)) return 0;
  const e = unitAt(bs, q, r);
  let p = 0.3 + (u.stats[def.stat] - 55) / 100 * 1.1 + (u.morale - 60) / 400;
  if (e) p -= (e.stats[def.stat === INT ? INT : LEAD] - 50) / 250;
  if (e && e.confused > 0) p += 0.2;
  if ((u.kind === '궁병' || u.kind === '노병') && (bs.weather === '비' || bs.weather === '강풍')) p -= 0.15;
  if (u.kind === '수군' && bs.weather === '비') p -= 0.3;
  if (u.kind === '수군' && bs.weather === '강풍') p += 0.1;
  if (u.kind === '기병' && u.traits.includes('기병')) p += 0.1;
  if ((u.kind === '보병' || u.kind === '기병' || u.kind === '창병') && u.traits.includes('돌격')) p += 0.08;
  if ((u.kind === '궁병' || u.kind === '노병') && u.traits.includes('궁병')) p += 0.1;
  if (u.kind === '수군' && (u.traits.includes('수군') || u.traits.includes('화계'))) p += 0.1;
  return clamp(p, 0.08, 0.92);
}

/** 전법을 쓴다. 실패하면 차례만 쓰고 사기가 조금 떨어진다 */
export function doTactic(bs: BattleState, u: Unit, q: number, r: number): string {
  if (bs.over || u.acted) return '';
  const def = TACTICS[u.kind];
  const p = tacticChance(bs, u, q, r);
  if (p <= 0) return '';
  u.acted = true; u.moved = true;
  if (!chance(bs, p)) {
    u.morale = Math.max(0, u.morale - 3);
    const t = `${u.name}의 ${jo(def.name, '이가')} 막혔다.`;
    bs.log.push(t);
    return t;
  }
  /* 필살 — 이름난 장수는 가끔 크게 터뜨린다 */
  const s = u.stats[def.stat];
  const crit = !!u.officer && s >= 88 && chance(bs, s >= 95 ? 0.35 : 0.22);
  const k = crit ? 1.35 : 1;
  if (crit) bs.flash = { officer: u.officer!, tactic: def.name };
  const head = `${u.name}의 ${def.name}${crit ? '! 필살' : '!'}`;
  const hit = (e: Unit, mult: number, ranged: boolean) => {
    const dmg = Math.max(10, Math.round(Math.min(e.troops, damage(bs, u, e, ranged) * mult * k)));
    hurt(bs, e, dmg);
    return dmg;
  };
  const lines: string[] = [];
  const e = unitAt(bs, q, r);
  switch (u.kind) {
    case '보병':
      if (e) { lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1.6, false)}`); e.morale = Math.max(0, e.morale - 6); }
      break;
    case '창병':
      if (e) {
        lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1.3, false)}`);
        const b = behind(bs, [u.q, u.r], [q, r]);
        const e2 = b && unitAt(bs, b[0], b[1]);
        if (e2 && e2.side !== u.side) lines.push(`${u.name} → ${e2.name}: 전법 −${hit(e2, 0.9, false)}`);
      }
      break;
    case '기병':
      if (e) {
        if (dist([u.q, u.r], [q, r]) === 2) {
          const spot = chargeSpot(bs, u, e);
          if (spot) { u.q = spot[0]; u.r = spot[1]; }
        }
        lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1.8, false)}`);
        e.morale = Math.max(0, e.morale - 10);
        if (!e.gone && !e.guard) {
          const b = behind(bs, [u.q, u.r], [q, r]);
          if (b && !unitAt(bs, b[0], b[1]) && Number.isFinite(moveCost(bs, e, b[0], b[1])) && !isBarrier(tileAt(bs, b[0], b[1]).t)) {
            e.q = b[0]; e.r = b[1];
            lines.push(`${jo(e.name, '이가')} 밀려났다.`);
          }
        }
      }
      break;
    case '궁병':
      if (e) {
        lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1, true)}`);
        for (const [nq, nr] of neighbors(bs, q, r)) {
          const o = unitAt(bs, nq, nr);
          if (o && o.side !== u.side) lines.push(`${u.name} → ${o.name}: 전법 −${hit(o, 0.6, true)}`);
        }
      }
      break;
    case '노병':
      if (e) {
        const a1 = hit(e, 0.9, true);
        const a2 = e.gone ? 0 : hit(e, 0.9, true);
        lines.push(`${head} → ${e.name}: 전법 −${a1 + a2}`);
        e.morale = Math.max(0, e.morale - 8);
      }
      break;
    case '수군':
      if (e) {
        lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1.2, dist([u.q, u.r], [q, r]) > 1)}`);
        const t = tileAt(bs, q, r);
        if (!e.gone && t.flood === 0) { t.fire = Math.max(t.fire, 2); lines.push(`${e.name} 부대 둘레에 불길이 치솟았다.`); }
      }
      break;
    case '공성': {
      const t = tileAt(bs, q, r);
      if (isBarrier(t.t) && t.hp > 0) {
        const dmg = Math.round((u.troops * 0.03 * (atkPower(u) / 60) * 4 * k + 30) * rrange(bs, 0.85, 1.15));
        t.hp = Math.max(0, t.hp - dmg);
        const name = TILE_NAMES[t.t];
        let line = `${head} → ${name}: 전법 −${dmg}`;
        if (t.hp === 0) { breakBarrier(bs, q, r); line += ` — ${jo(name, '이가')} 무너졌다!`; }
        lines.push(line);
      } else if (e) {
        lines.push(`${head} → ${e.name}: 전법 −${hit(e, 1.1, true)}`);
        for (const [nq, nr] of neighbors(bs, q, r)) {
          const o = unitAt(bs, nq, nr);
          if (o && o.side !== u.side) lines.push(`${u.name} → ${o.name}: 전법 −${hit(o, 0.5, true)}`);
        }
      }
      break;
    }
  }
  u.morale = Math.min(100, u.morale + 4);
  bs.log.push(...lines);
  checkEnd(bs);
  return lines[0] ?? head;
}

/** AI: 전법이 보통 공격보다 낫다면 쓴다 */
function aiTactic(bs: BattleState, u: Unit): boolean {
  const ts = tacticTargets(bs, u);
  if (!ts.length) return false;
  let best: { q: number; r: number; v: number } | null = null;
  for (const t of ts) {
    const p = tacticChance(bs, u, t.q, t.r);
    if (p < 0.5) continue;
    const e = unitAt(bs, t.q, t.r);
    const v = e ? p * Math.min(e.troops, expected(bs, u, e, t.ranged)) * (e.commander ? 1.4 : 1) : p * 260;
    if (!best || v > best.v) best = { q: t.q, r: t.r, v };
  }
  if (!best) return false;
  const plain = attackTargets(bs, u).filter((t) => t.kind === 'unit')
    .map((t) => { const e = unitAt(bs, t.q, t.r)!; return Math.min(e.troops, expected(bs, u, e, t.ranged)); });
  const normal = plain.length ? Math.max(...plain) : 0;
  if (best.v * 1.25 < normal) return false;
  doTactic(bs, u, best.q, best.r);
  return true;
}

/* ───────────── 계략: 수공 ───────────── */

/** 둑을 터뜨리면 잠기는 칸: 강물에서 3칸 안의 낮은 땅 */
export function floodZone(bs: BattleState): Set<number> {
  const zone = new Set<number>();
  const depth = new Map<number, number>();
  const q0: number[] = [];
  bs.tiles.forEach((t, i) => { if (t.t === 'water') { depth.set(i, 0); q0.push(i); } });
  while (q0.length) {
    const i = q0.shift()!;
    const d = depth.get(i)!;
    if (d >= 3) continue;
    const q = i % bs.W, r = Math.floor(i / bs.W);
    for (const [nq, nr] of neighbors(bs, q, r)) {
      const k = nr * bs.W + nq;
      if (depth.has(k)) continue;
      const t = bs.tiles[k].t;
      /* 물은 성벽을 넘어 성안으로 스민다(성벽 칸 자체는 잠기지 않는다) */
      if (isBarrier(t)) { depth.set(k, d + 1); q0.push(k); continue; }
      if (!FLOODABLE.includes(t)) continue;
      depth.set(k, d + 1);
      zone.add(k);
      q0.push(k);
    }
  }
  return zone;
}

export function canFlood(bs: BattleState, u: Unit): boolean {
  return !bs.floodUsed && !u.acted && !u.gone && u.side === 0 && tileAt(bs, u.q, u.r).t === 'dam';
}

export function floodChance(bs: BattleState, u: Unit): number {
  if (!canFlood(bs, u)) return 0;
  const p = (u.stats[INT] - 15) / 100 + (bs.weather === '비' ? 0.2 : 0) + (u.traits.includes('신산') ? 0.1 : 0);
  return clamp(p, 0.1, 0.9);
}

export function doFlood(bs: BattleState, u: Unit): string {
  if (!canFlood(bs, u)) return '';
  const p = floodChance(bs, u);
  u.acted = true; u.moved = true;
  if (!chance(bs, p)) { const t = `${jo(u.name, '이가')} 둑을 트려 했으나 물길이 열리지 않았다.`; bs.log.push(t); return t; }
  bs.floodUsed = true;
  const days = bs.weather === '비' ? 6 : 4;
  for (const k of floodZone(bs)) bs.tiles[k].flood = days;
  const t = `${u.name}의 수공! 둑이 터져 물이 성으로 밀려든다.`;
  bs.log.push(t);
  return t;
}

/* ───────────── 일기토 ───────────── */

export function duelRefuse(e: Unit, u: Unit): number {
  if (!e.officer || !u.officer) return 1;
  if (e.stats[WAR] >= u.stats[WAR] - 5) return 0.05;
  return e.stats[INT] >= 60 ? 0.75 : 0.35;
}

export function doDuel(bs: BattleState, u: Unit, e: Unit): DuelResult | null {
  if (bs.over || u.acted || !u.officer || !e.officer || dist([u.q, u.r], [e.q, e.r]) !== 1) return null;
  u.acted = true; u.moved = true;
  if (chance(bs, duelRefuse(e, u))) {
    const text = `${jo(e.name, '이가')} 일기토를 피했다. ${u.name} 쪽 사기가 오른다.`;
    u.morale = Math.min(100, u.morale + 6);
    e.morale = Math.max(0, e.morale - 6);
    bs.log.push(text);
    bs.duel = { a: u.name, b: e.name, lines: [text], winner: -1, outcome: 'draw' };
    return bs.duel;
  }
  const res = fightDuel(bs, u, e);
  bs.duel = res;
  bs.log.push(...res.lines.slice(-2));
  if (res.winner >= 0) {
    const loser = res.winner === 0 ? e : u;
    const winner = res.winner === 0 ? u : e;
    winner.morale = Math.min(100, winner.morale + 15);
    if (res.outcome === 'killed') { loser.gone = 'killed'; }
    else if (res.outcome === 'captured') { loser.gone = 'captured'; }
    else { loser.morale = Math.max(0, loser.morale - 45); loser.troops = Math.round(loser.troops * 0.8); if (loser.morale <= 0) loser.gone = 'routed'; }
  }
  checkEnd(bs);
  return res;
}

const DUEL_WORDS = ['창을 내지른다', '칼을 휘두른다', '말을 몰아 부딪친다', '빈틈을 노린다', '힘껏 내려친다'];

export function fightDuel(rng: RngHolder, a: Unit, b: Unit): DuelResult {
  const lines: string[] = [`${jo(a.name, '과와')} ${b.name}의 일기토!`];
  let ha = 100, hb = 100;
  const pa = a.stats[WAR] + (a.traits.includes('일기') ? 8 : 0);
  const pb = b.stats[WAR] + (b.traits.includes('일기') ? 8 : 0);
  for (let round = 1; round <= 10 && ha > 0 && hb > 0; round++) {
    const aFirst = rnd(rng) < pa / (pa + pb);
    const [x, y, px, py] = aFirst ? [a, b, pa, pb] : [b, a, pb, pa];
    const hit = rnd(rng) < 0.5 + (px - py) / 80;
    const word = DUEL_WORDS[rint(rng, 0, DUEL_WORDS.length - 1)];
    if (hit) {
      const d = Math.round(rrange(rng, 10, 24) * (px / 85) * (1 + Math.max(0, px - py) / 60));
      if (y === a) ha -= d; else hb -= d;
      lines.push(`${round}합 — ${jo(x.name, '이가')} ${word}. ${y.name} 휘청!`);
    } else {
      lines.push(`${round}합 — ${jo(x.name, '이가')} ${word}. ${jo(y.name, '이가')} 막아 낸다.`);
    }
  }
  if (ha > 0 && hb > 0) {
    lines.push('승부가 나지 않은 채 두 장수가 물러났다.');
    return { a: a.name, b: b.name, lines, winner: -1, outcome: 'draw' };
  }
  const winner: 0 | 1 = hb <= 0 ? 0 : 1;
  const w = winner === 0 ? a : b;
  const l = winner === 0 ? b : a;
  const x = rnd(rng);
  const outcome = x < 0.12 ? 'killed' : x < 0.35 ? 'captured' : 'fled';
  lines.push(outcome === 'killed' ? `${jo(w.name, '이가')} ${jo(l.name, '을를')} 베었다!` : outcome === 'captured' ? `${jo(w.name, '이가')} ${jo(l.name, '을를')} 사로잡았다!` : `${jo(l.name, '이가')} 상처를 입고 달아났다.`);
  return { a: a.name, b: b.name, lines, winner, outcome };
}

/* ───────────── 대기·퇴각 ───────────── */

export function doWait(_bs: BattleState, u: Unit) {
  u.acted = true; u.moved = true;
}

export function doRetreat(bs: BattleState, u: Unit): string {
  if (bs.over) return '';
  u.gone = 'retreated';
  u.troops = Math.round(u.troops * 0.85);
  const t = `${u.name} 부대가 물러났다.`;
  bs.log.push(t);
  checkEnd(bs);
  return t;
}

/* ───────────── 차례·하루 ───────────── */

export function alive(bs: BattleState, side: 0 | 1) {
  return bs.units.filter((u) => !u.gone && u.side === side);
}

export function checkEnd(bs: BattleState) {
  if (bs.over) return;
  const atk = alive(bs, 0);
  const def = alive(bs, 1);
  const [kq, kr] = bs.keep;
  const onKeep = unitAt(bs, kq, kr);
  if (onKeep && onKeep.side === 0) { bs.over = { winner: 0, reason: `${jo(onKeep.name, '이가')} 본진을 점령했다!` }; return; }
  if (def.length === 0) { bs.over = { winner: 0, reason: '수비군이 모두 물러났다.' }; return; }
  if (atk.length === 0) { bs.over = { winner: 1, reason: '공격군이 모두 물러났다.' }; return; }
  const cmd = bs.units.find((u) => u.side === 0 && u.commander);
  if (cmd && cmd.gone) { bs.over = { winner: 1, reason: `총대장 ${jo(cmd.name, '을를')} 잃어 공격군이 무너졌다.` }; return; }
}

/** 지금 차례인 진영의 남은 부대를 끝내고 다음으로 넘긴다 */
export function endSide(bs: BattleState) {
  if (bs.over) return;
  for (const u of alive(bs, bs.side)) { u.acted = true; u.moved = true; }
  if (bs.side === 0) {
    bs.side = 1;
    startSide(bs, 1);
  } else {
    endDay(bs);
    if (bs.over) return;
    bs.side = 0;
    startSide(bs, 0);
  }
}

function startSide(bs: BattleState, side: 0 | 1) {
  arrive(bs, side);
  for (const u of alive(bs, side)) {
    u.moved = false;
    u.acted = false;
    if (u.confused > 0) { u.confused--; u.moved = true; u.acted = true; }
  }
}

function endDay(bs: BattleState) {
  /* 불: 타고 있는 칸의 부대 피해, 번짐, 꺼짐 */
  const burning: [number, number][] = [];
  for (let r = 0; r < bs.H; r++) for (let q = 0; q < bs.W; q++) if (tileAt(bs, q, r).fire > 0) burning.push([q, r]);
  for (const [q, r] of burning) {
    const u = unitAt(bs, q, r);
    if (u) burn(bs, u);
    const t = tileAt(bs, q, r);
    t.fire = bs.weather === '비' ? 0 : t.fire - 1;
    if (bs.weather === '비') continue;
    for (let dir = 0; dir < 6; dir++) {
      const n = neighborDir(bs, q, r, dir);
      if (!n) continue;
      const nt = tileAt(bs, n[0], n[1]);
      if (nt.fire > 0 || nt.flood > 0 || !BURNABLE.includes(nt.t)) continue;
      let p = nt.t === 'forest' ? 0.35 : nt.t === 'village' ? 0.25 : nt.t === 'plain' || nt.t === 'hill' || nt.t === 'road' ? 0.15 : 0.08;
      if (dir === bs.wind) p += bs.weather === '강풍' ? 0.4 : 0.2;
      if (chance(bs, p)) ignite(bs, n[0], n[1]);
    }
  }
  /* 물: 잠긴 칸의 부대 피해, 젖은 성벽이 무너진다 */
  let flooded = false;
  for (let r = 0; r < bs.H; r++) for (let q = 0; q < bs.W; q++) {
    const t = tileAt(bs, q, r);
    if (t.flood <= 0) continue;
    flooded = true;
    const u = unitAt(bs, q, r);
    if (u) {
      u.morale = Math.max(0, u.morale - 6);
      hurt(bs, u, Math.round(u.troops * 0.08 + 30));
    }
    for (const [nq, nr] of neighbors(bs, q, r)) {
      const w = tileAt(bs, nq, nr);
      if (isBarrier(w.t) && w.hp > 0) {
        const name = TILE_NAMES[w.t];
        w.hp = Math.max(0, w.hp - Math.round(w.hp * 0.12 + 15));
        if (w.hp === 0) { breakBarrier(bs, nq, nr); bs.log.push(`물에 젖은 ${jo(name, '이가')} 무너졌다.`); }
      }
    }
    t.flood = bs.weather === '비' ? t.flood : t.flood - 1;
  }
  if (flooded) bs.log.push(`${bs.day}일째 — 물이 차오른 곳의 부대가 허우적거린다.`);
  /* 군량 */
  const atkTroops = alive(bs, 0).reduce((a, u) => a + u.troops, 0);
  const defTroops = alive(bs, 1).reduce((a, u) => a + u.troops, 0);
  bs.food -= Math.ceil(atkTroops * 0.004);
  /* 촌락: 머문 부대는 병력·사기를 조금 회복하고, 공격군은 군량을 얻는다 */
  for (const u of bs.units) {
    if (u.gone) continue;
    const t = tileAt(bs, u.q, u.r);
    if (t.t === 'village' && t.fire <= 0 && t.flood <= 0) {
      u.troops = Math.min(u.maxTroops, u.troops + Math.round(u.maxTroops * 0.02));
      u.morale = Math.min(100, u.morale + 4);
      if (u.side === 0) bs.food += 150;
    }
    if (u.traits.includes('의술')) u.troops = Math.min(u.maxTroops, u.troops + Math.round(u.maxTroops * 0.03));
  }
  if (bs.food < 0) {
    bs.food = 0;
    bs.log.push('공격군의 군량이 바닥났다! 병사들이 동요한다.');
    for (const u of alive(bs, 0)) { u.morale = Math.max(0, u.morale - 12); if (u.morale <= 0) u.gone = 'routed'; }
  }
  if (bs.defender >= 0) {
    bs.defFood -= Math.ceil(defTroops * 0.004);
    if (bs.defFood < 0) {
      bs.defFood = 0;
      for (const u of alive(bs, 1)) { u.morale = Math.max(0, u.morale - 10); if (u.morale <= 0) u.gone = 'routed'; }
    }
  }
  checkEnd(bs);
  if (bs.over) return;
  bs.day++;
  if (bs.day > bs.maxDay) { bs.over = { winner: 1, reason: `${bs.maxDay}일을 버텨 냈다.` }; return; }
  if (rnd(bs) < 0.3) {
    const before = bs.weather;
    bs.weather = pickWeather(bs, 6);
    if (before !== bs.weather) bs.log.push(`${bs.day}일째 — 날씨가 ${jo(bs.weather, '로')} 바뀌었다.`);
  }
  if (rnd(bs) < 0.2) bs.wind = rint(bs, 0, 5);
}

/* ───────────── 전투 AI ───────────── */

/** 성벽·관문을 넘는 비용까지 셈한 본진까지의 거리 지도 */
function keepDistance(bs: BattleState): number[] {
  const d = new Array(bs.W * bs.H).fill(Infinity);
  const [kq, kr] = bs.keep;
  const q0: [number, number][] = [[kq, kr]];
  d[kr * bs.W + kq] = 0;
  while (q0.length) {
    q0.sort((a, b) => d[a[1] * bs.W + a[0]] - d[b[1] * bs.W + b[0]]);
    const [q, r] = q0.shift()!;
    const base = d[r * bs.W + q];
    for (const [nq, nr] of neighbors(bs, q, r)) {
      const t = tileAt(bs, nq, nr);
      if (t.t === 'peak') continue;
      const c = t.t === 'wall' ? 7 + t.hp / 200
        : t.t === 'gate' || t.t === 'pass' ? 4 + t.hp / 200
          : t.t === 'mountain' ? 3 : t.t === 'water' ? (bs.naval ? 1 : 3)
            : t.t === 'road' || t.t === 'bridge' ? 0.6
              : ['forest', 'hill', 'breach', 'marsh', 'ford'].includes(t.t) ? 2 : 1;
      const k = nr * bs.W + nq;
      if (base + c < d[k]) { d[k] = base + c; q0.push([nq, nr]); }
    }
  }
  return d;
}

function expected(bs: BattleState, a: Unit, d: Unit, ranged: boolean) {
  const ratio = atkPower(a) / Math.max(1, defPower(bs, d));
  return a.troops * 0.085 * ratio * attackMult(bs, a, d, ranged) + 20;
}

/** 한 부대의 행동을 AI가 정한다 */
export function aiUnit(bs: BattleState, u: Unit, keepCache?: number[], zoneCache?: Set<number>) {
  if (bs.over || u.gone || u.acted) return;
  if (u.confused > 0) { doWait(bs, u); return; }
  const enemies = alive(bs, u.side === 0 ? 1 : 0);
  if (!enemies.length) return;

  /* 크게 꺾인 부대는 물러난다(총대장 제외) */
  if (!u.commander && u.troops < u.maxTroops * 0.15 && u.morale < 35 && chance(bs, 0.5)) { doRetreat(bs, u); return; }

  /* 수공: 제방에 서 있고 적이 물길 둘레에 모여 있으면 둑을 튼다 */
  const zone = u.side === 0 && !bs.floodUsed && u.stats[INT] >= 55 ? zoneCache ?? null : null;
  const floodWorth = () => {
    if (!zone) return false;
    const hit = enemies.filter((e) => zone.has(e.r * bs.W + e.q)).length;
    const mine = alive(bs, u.side).filter((x) => zone.has(x.r * bs.W + x.q)).length;
    return hit >= 2 && hit > mine;
  };
  if (canFlood(bs, u) && floodChance(bs, u) >= 0.35 && floodWorth()) { doFlood(bs, u); return; }

  /* 무력이 압도하면 일기토 */
  if (u.officer && u.stats[WAR] >= 85) {
    const foe = enemies.find((e) => e.officer && dist([u.q, u.r], [e.q, e.r]) === 1 && e.stats[WAR] < u.stats[WAR] - 12);
    if (foe && chance(bs, 0.35)) { doDuel(bs, u, foe); return; }
  }

  /* 화계: 지력이 높고 아군이 휘말리지 않을 때 */
  if (u.stats[INT] >= 72 && bs.weather !== '비' && chance(bs, 0.6)) {
    let best: [number, number, number] | null = null;
    for (const e of enemies) {
      if (dist([u.q, u.r], [e.q, e.r]) > 2) continue;
      if (neighbors(bs, e.q, e.r).some(([q, r]) => { const f = unitAt(bs, q, r); return f && f.side === u.side; })) continue;
      const p = fireChance(bs, u, e.q, e.r);
      const v = p * (e.troops * 0.14 + 60);
      if (p >= 0.45 && (!best || v > best[2])) best = [e.q, e.r, v];
    }
    if (best && best[2] > expectedBest(bs, u, enemies) * 0.8) { doFire(bs, u, best[0], best[1]); return; }
  }

  const reach = reachable(bs, u);
  const keepD = u.side === 0 ? keepCache ?? keepDistance(bs) : null;
  const wantDam = !!zone && floodWorth();

  /* 움직일 칸 고르기: 공격할 수 있는 적이 있는 칸 중 가장 이득인 곳 */
  let bestMove: { k: number; score: number; target?: Unit; tile?: [number, number]; ranged?: boolean } | null = null;
  const [kq, kr] = bs.keep;
  const insideCastle = (tt: TileType) => tt === 'inner' || tt === 'keep';
  /* 본진을 지키는 부대는 자리를 뜨지 않고, 본진이 비면 가장 가까운 수비 부대가 들어간다 */
  const onKeep = u.side === 1 && u.q === kq && u.r === kr;
  const keepEmpty = !unitAt(bs, kq, kr);
  for (const [k] of reach) {
    const q = k % bs.W, r = Math.floor(k / bs.W);
    const t = tileAt(bs, q, r);
    /* 수비군은 성 밖으로 나가지 않는다(성 안에 있을 때). 관문 수비는 관 둘레를 지킨다 */
    if (u.side === 1 && insideCastle(tileAt(bs, u.q, u.r).t) && !insideCastle(t.t)) continue;
    if (u.guard && dist([q, r], u.guard) > 1) continue;
    if (onKeep && (q !== kq || r !== kr)) continue;
    if (u.side === 0 && q === kq && r === kr) { bestMove = { k, score: 1e9 }; break; }
    let score = 0;
    let target: Unit | undefined;
    let ranged = false;
    const range = shootRange(bs, u, t.t);
    for (const e of enemies) {
      const d = dist([q, r], [e.q, e.r]);
      if (d === 1 || (d >= 2 && d <= range)) {
        const rg = d >= 2;
        let v = Math.min(e.troops, expected(bs, u, e, rg)) * (e.commander ? 1.6 : 1);
        if (!rg) v -= expected(bs, e, u, false) * 0.4;
        if (v > score) { score = v; target = e; ranged = rg; }
      }
    }
    let tile: [number, number] | undefined;
    const siege = u.kind === '공성';
    if ((!target || siege) && u.side === 0) {
      const reachW = siege ? 2 : 1;
      for (let rr = Math.max(0, r - reachW); rr <= Math.min(bs.H - 1, r + reachW); rr++) {
        for (let qq = Math.max(0, q - reachW - 1); qq <= Math.min(bs.W - 1, q + reachW + 1); qq++) {
          const dd = dist([q, r], [qq, rr]);
          if (dd < 1 || dd > reachW) continue;
          const nt = tileAt(bs, qq, rr);
          if (!isBarrier(nt.t) || nt.hp <= 0) continue;
          const v = (150 + (nt.t === 'gate' || nt.t === 'pass' ? 80 : 0) - nt.hp / 20) * (siege ? 3 : u.kind === '기병' ? 0.6 : 1);
          if (v > score) { score = v; tile = [qq, rr]; target = undefined; }
        }
      }
    }
    /* 병종별 자리 잡기: 궁·노는 붙지 않고 쏠 자리, 공성은 적과 떨어진 자리 */
    const adjEnemy = enemies.some((e) => dist([q, r], [e.q, e.r]) === 1);
    if (kindOf(u.kind).range && !insideCastle(t.t)) score += (ranged ? 120 : 0) - (adjEnemy ? 150 : 0);
    if (siege && adjEnemy) score -= 220;
    if (u.kind === '기병' && ['forest', 'marsh', 'mountain'].includes(t.t)) score -= 60;
    if (keepD) score += 400 - keepD[k] * 12;
    else score += 80 - Math.min(...enemies.map((e) => dist([q, r], [e.q, e.r]))) * 6 + DEF_MOD[t.t] * 30;
    if (wantDam && t.t === 'dam') score += 400; // 수공 자리를 노린다
    if (u.side === 1 && keepEmpty && q === kq && r === kr) score += 600;
    /* 총대장은 적의 칼끝과 성벽 화살이 닿는 곳을 피한다 */
    if (u.commander && u.side === 0 && alive(bs, 0).length > 2) {
      const threats = enemies.filter((e) => e.confused === 0 && dist([q, r], [e.q, e.r]) <= 2).length;
      score -= threats * 90 + (tile ? 100 : 0);
    }
    if (t.fire > 0) score -= 1000;
    if (t.flood > 0) score -= 120;
    if (!bestMove || score > bestMove.score) bestMove = { k, score, target, tile, ranged };
  }
  if (bestMove) {
    const q = bestMove.k % bs.W, r = Math.floor(bestMove.k / bs.W);
    if (q !== u.q || r !== u.r) moveUnit(bs, u, q, r);
    if (bs.over) return;
    if (canFlood(bs, u) && floodChance(bs, u) >= 0.35 && floodWorth()) { doFlood(bs, u); return; }
    if (aiTactic(bs, u)) return;
    if (bestMove.target && !bestMove.target.gone) { attackUnit(bs, u, bestMove.target, !!bestMove.ranged); return; }
    if (bestMove.tile) { attackTile(bs, u, bestMove.tile[0], bestMove.tile[1]); return; }
  }
  /* 이동 뒤에라도 칠 수 있으면 친다 */
  if (aiTactic(bs, u)) return;
  const ts = attackTargets(bs, u);
  const unitT = ts.find((t) => t.kind === 'unit');
  if (unitT) { attackUnit(bs, u, unitAt(bs, unitT.q, unitT.r)!, unitT.ranged); return; }
  const wallT = ts.find((t) => t.kind === 'tile');
  if (wallT) { attackTile(bs, u, wallT.q, wallT.r); return; }
  doWait(bs, u);
}

function expectedBest(bs: BattleState, u: Unit, enemies: Unit[]) {
  let best = 0;
  for (const e of enemies) if (dist([u.q, u.r], [e.q, e.r]) <= u.move) best = Math.max(best, Math.min(e.troops, expected(bs, u, e, false)));
  return best;
}

/** 한 진영의 남은 부대를 모두 AI로 움직이고 차례를 넘긴다 */
export function aiSide(bs: BattleState) {
  const side = bs.side;
  const units = alive(bs, side).filter((u) => !u.acted);
  const keepD = side === 0 ? keepDistance(bs) : undefined;
  const zone = side === 0 && !bs.floodUsed && bs.tiles.some((t) => t.t === 'dam') ? floodZone(bs) : undefined;
  for (const u of units) { if (bs.over) return; aiUnit(bs, u, keepD, zone); }
  if (!bs.over) endSide(bs);
}

/** 사람이 지휘하지 않는 차례는 모두 AI로 돌린다. 사람 차례가 오거나 끝나면 멈춘다 */
export function runUntilHuman(bs: BattleState) {
  let guard = 0;
  while (!bs.over && !bs.human[bs.side] && guard++ < 200) aiSide(bs);
}

/** 끝날 때까지 모두 AI로(위임 전투) */
export function autoResolve(bs: BattleState) {
  let guard = 0;
  while (!bs.over && guard++ < 200) aiSide(bs);
  if (!bs.over) bs.over = { winner: 1, reason: '승부가 나지 않았다.' };
  bs.duel = null;
}
