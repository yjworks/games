import { CITY_BY_ID, roadKind } from '../data/cities';
import type { CityId, Stats, TraitId } from '../data/types';
import { autoAllot } from './commands';
import { INT, LEAD, WAR, nameOf, statsOf, traitsOf, troopCap, worth } from './officers';
import { chance, clamp, rint, rnd, rrange, type RngHolder } from './rng';
import type { AttackOrder, GameState } from './state';
import { jo } from './josa';

/* ───────────── 자료형 ───────────── */

export type TileType = 'plain' | 'forest' | 'hill' | 'mountain' | 'water' | 'bridge' | 'wall' | 'gate' | 'inner' | 'keep' | 'breach';

export interface Tile { t: TileType; hp: number; fire: number }

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
}

export type Weather = '맑음' | '흐림' | '비' | '강풍';

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
  log: string[];
  /** 마지막 일기토 기록(연출용) */
  duel: DuelResult | null;
  human: [boolean, boolean];
  over: null | { winner: 0 | 1; reason: string };
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

function toCube(q: number, r: number): [number, number, number] {
  const x = q - (r - (r & 1)) / 2;
  const z = r;
  return [x, -x - z, z];
}

export function dist(a: [number, number], b: [number, number]): number {
  const [ax, ay, az] = toCube(a[0], a[1]);
  const [bx, by, bz] = toCube(b[0], b[1]);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

export const tileAt = (bs: BattleState, q: number, r: number) => bs.tiles[r * bs.W + q];
export const unitAt = (bs: BattleState, q: number, r: number) =>
  bs.units.find((u) => !u.gone && u.q === q && u.r === r) ?? null;

export const TILE_NAMES: Record<TileType, string> = {
  plain: '평지', forest: '숲', hill: '구릉', mountain: '산', water: '물', bridge: '다리',
  wall: '성벽', gate: '성문', inner: '성내', keep: '본진', breach: '무너진 성벽',
};

const DEF_MOD: Record<TileType, number> = {
  plain: 1, forest: 1.15, hill: 1.2, mountain: 1.3, water: 0.85, bridge: 0.9,
  wall: 1, gate: 1, inner: 1.2, keep: 1.3, breach: 1.05,
};

export function moveCost(bs: BattleState, u: Unit, q: number, r: number): number {
  const t = tileAt(bs, q, r);
  if (t.fire > 0) return Infinity;
  switch (t.t) {
    case 'plain': case 'inner': case 'keep': case 'bridge': return 1;
    case 'breach': return 2;
    case 'forest': case 'hill': return 2;
    case 'mountain': return 3;
    case 'water': return bs.naval ? (u.traits.includes('수군') ? 1 : 2) : u.traits.includes('수군') ? 2 : 3;
    case 'gate': return u.side === 1 && t.hp > 0 ? 1 : Infinity;
    case 'wall': return Infinity;
  }
}

/* ───────────── 전장 만들기 ───────────── */

export function createBattle(s: GameState, order: AttackOrder): BattleState {
  const city = s.cities[order.to];
  const cd = CITY_BY_ID[order.to];
  const naval = roadKind(order.from, order.to) === 'w';
  const W = 15, H = 11;
  const bs: BattleState = {
    rng: Math.floor(rnd(s) * 2 ** 31) | 0,
    attacker: order.faction,
    defender: city.owner,
    from: order.from,
    to: order.to,
    naval,
    W, H,
    tiles: [],
    units: [],
    day: 1,
    maxDay: MAX_DAY,
    side: 0,
    weather: '맑음',
    wind: 0,
    food: order.food,
    defFood: city.food,
    keep: [11, 5],
    log: [],
    duel: null,
    human: [s.factions[order.faction]?.human ?? false, city.owner >= 0 ? s.factions[city.owner]?.human ?? false : false],
    over: null,
  };
  bs.weather = pickWeather(bs, s.month);
  bs.wind = rint(bs, 0, 5);

  /* 지형 */
  for (let r = 0; r < H; r++) {
    for (let q = 0; q < W; q++) {
      const x = rnd(bs);
      let t: TileType = 'plain';
      switch (cd.land) {
        case 'plain': t = x < 0.14 ? 'forest' : x < 0.19 ? 'hill' : 'plain'; break;
        case 'hill': t = x < 0.18 ? 'forest' : x < 0.4 ? 'hill' : x < 0.45 ? 'mountain' : 'plain'; break;
        case 'mountain': t = x < 0.22 ? 'forest' : x < 0.36 ? 'hill' : x < 0.62 ? 'mountain' : 'plain'; break;
        case 'river': t = x < 0.12 ? 'forest' : x < 0.17 ? 'hill' : 'plain'; break;
        case 'marsh': t = x < 0.24 ? 'water' : x < 0.36 ? 'forest' : 'plain'; break;
      }
      bs.tiles.push({ t, hp: 0, fire: 0 });
    }
  }
  /* 강: 세로로 흐르는 물줄기와 다리 두 개 */
  if (cd.land === 'river' || naval) {
    let col = rint(bs, 5, 6);
    const bridges = naval ? [] : [rint(bs, 1, 3), rint(bs, 6, 9)];
    for (let r = 0; r < H; r++) {
      const width = naval ? 4 : 1;
      for (let k = 0; k < width; k++) {
        const q = col + k - (naval ? 1 : 0);
        if (q >= 0 && q < W) tileAt(bs, q, r).t = bridges.includes(r) ? 'bridge' : 'water';
      }
      if (rnd(bs) < 0.3) col = clamp(col + (rnd(bs) < 0.5 ? -1 : 1), 4, 7);
    }
  }
  /* 성: 본진 둘레 1칸은 성내, 2칸은 성벽(서쪽에 성문 둘) */
  const [kq, kr] = bs.keep;
  const wallHp = 300 + city.wall * 12;
  const gateHp = 200 + city.wall * 8;
  for (let r = 0; r < H; r++) {
    for (let q = 0; q < W; q++) {
      const d = dist([q, r], [kq, kr]);
      const tile = tileAt(bs, q, r);
      if (d === 0) { tile.t = 'keep'; }
      else if (d === 1) { tile.t = 'inner'; }
      else if (d === 2) { tile.t = 'wall'; tile.hp = wallHp; }
      else if (d === 3 && (tile.t === 'water' || tile.t === 'mountain')) tile.t = 'plain';
    }
  }
  for (const [gq, gr] of [[kq - 2, kr - 1], [kq - 2, kr + 1], [kq, kr - 2], [kq, kr + 2]] as [number, number][]) {
    if (gq >= 0 && gr >= 0 && gq < W && gr < H && tileAt(bs, gq, gr).t === 'wall') {
      tileAt(bs, gq, gr).t = 'gate';
      tileAt(bs, gq, gr).hp = gateHp;
    }
  }
  /* 공격 측 출발 칸은 평지로 */
  for (let r = 0; r < H; r++) for (let q = 0; q < 2; q++) {
    const t = tileAt(bs, q, r);
    if (t.t !== 'water' || !naval) t.t = q === 0 && t.t === 'water' ? 'plain' : t.t === 'mountain' ? 'plain' : t.t;
  }

  /* 공격 부대 */
  let uid = 1;
  const atkSlots: [number, number][] = [];
  for (let q = 0; q < 3; q++) for (let r = 0; r < H; r++) atkSlots.push([q, r]);
  atkSlots.sort((a, b) => a[0] - b[0] || Math.abs(a[1] - 5) - Math.abs(b[1] - 5));
  order.officers.forEach((id, i) => {
    const [q, r] = atkSlots[i];
    if (tileAt(bs, q, r).t === 'water' && !naval) tileAt(bs, q, r).t = 'plain';
    bs.units.push(makeUnit(s, uid++, id, 0, order.faction, q, r, order.troops[i], s.cities[order.from].training, s.cities[order.from].morale, i === 0));
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
  const defSlots: [number, number][] = [[kq, kr], ...neighbors(bs, kq, kr)];
  const outer: [number, number][] = [];
  for (let r = 0; r < H; r++) for (let q = 0; q < W; q++) if (dist([q, r], [kq, kr]) === 3) outer.push([q, r]);
  outer.sort((a, b) => b[0] - a[0]);
  let slot = 0;
  const nextSlot = (): [number, number] => (slot < defSlots.length ? defSlots[slot++] : outer[(slot++ - defSlots.length) % outer.length]);
  ids.forEach((id, i) => {
    if (allot[i] <= 0 && rest <= 0) return;
    let n = allot[i];
    if (n <= 0) { n = Math.min(rest, troopCap(s, id)); rest -= n; }
    const [q, r] = nextSlot();
    bs.units.push(makeUnit(s, uid++, id, 1, city.owner, q, r, n, city.training, city.morale, lead?.id === id));
  });
  for (let g = 0; g < 4 && rest >= 100; g++) {
    const n = g === 3 ? rest : Math.min(rest, 5000);
    rest -= n;
    const [q, r] = nextSlot();
    bs.units.push(makeUnit(s, uid++, null, 1, city.owner, q, r, n, city.training, city.morale, !lead && g === 0));
  }

  /* 내응: 약속한 장수는 그 자리에서 돌아선다 */
  for (const u of bs.units) {
    if (!u.officer) continue;
    const o = s.officers[u.officer];
    const enemy = u.side === 0 ? bs.defender : bs.attacker;
    if (o.turncoat >= 0 && o.turncoat === enemy && !u.commander) {
      u.side = u.side === 0 ? 1 : 0;
      u.faction = enemy;
      u.commander = false;
      bs.log.push(`${jo(u.name, '이가')} 약속대로 창끝을 돌렸다!`);
    }
  }
  bs.log.push(`${CITY_BY_ID[order.to].name} 공방전 — ${bs.weather}${naval ? ' · 수상전' : ''}`);
  return bs;
}

function makeUnit(s: GameState, uid: number, officer: string | null, side: 0 | 1, faction: number, q: number, r: number,
  troops: number, training: number, morale: number, commander: boolean): Unit {
  const stats = officer ? statsOf(s, officer) : GARRISON;
  const traits = officer ? traitsOf(s, officer) : [];
  const items = officer ? s.officers[officer].items : [];
  let move = 4 + (traits.includes('기병') ? 1 : 0);
  for (const it of items) move += it === 'chitu' ? 2 : it === 'dilu' || it === 'jueying' ? 1 : 0;
  return {
    uid, officer, name: officer ? nameOf(officer) : '수비대', side, faction, q, r,
    troops, maxTroops: troops, morale, training, stats, traits, move,
    moved: false, acted: false, confused: 0, commander, gone: null,
  };
}

function pickWeather(bs: RngHolder, month: number): Weather {
  const x = rnd(bs);
  const wet = month >= 5 && month <= 8;
  if (x < (wet ? 0.25 : 0.1)) return '비';
  if (x < (wet ? 0.45 : 0.35)) return '흐림';
  if (x < (wet ? 0.55 : 0.5)) return '강풍';
  return '맑음';
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
  let m = DEF_MOD[t.t];
  if (t.t === 'water' && u.traits.includes('수군')) m = 1.15;
  if ((t.t === 'inner' || t.t === 'keep') && u.traits.includes('수비')) m *= 1.2;
  return (u.stats[LEAD] * 0.6 + u.stats[INT] * 0.15 + u.stats[WAR] * 0.25) * (0.6 + u.training / 250) * m;
}

function attackMult(bs: BattleState, a: Unit, d: Unit, ranged: boolean) {
  let m = 1;
  const ta = tileAt(bs, a.q, a.r).t;
  if (!ranged && a.traits.includes('기병') && (ta === 'plain' || ta === 'breach')) m *= 1.2;
  if (!ranged && a.traits.includes('돌격')) m *= 1.15;
  if (ta === 'water' && a.traits.includes('수군')) m *= 1.3;
  if (ranged) m *= a.traits.includes('궁병') ? 0.85 : 0.6;
  if (!ranged && d.traits.includes('매복')) {
    const td = tileAt(bs, d.q, d.r).t;
    if (td === 'forest' || td === 'mountain') m *= 0.85;
  }
  return m;
}

function canShoot(bs: BattleState, u: Unit) {
  const t = tileAt(bs, u.q, u.r).t;
  return u.traits.includes('궁병') || (u.side === 1 && (t === 'inner' || t === 'keep'));
}

export interface Target { kind: 'unit' | 'tile'; q: number; r: number; ranged: boolean }

export function attackTargets(bs: BattleState, u: Unit): Target[] {
  if (u.acted || u.gone || u.confused > 0) return [];
  const out: Target[] = [];
  const shoot = canShoot(bs, u);
  for (const e of bs.units) {
    if (e.gone || e.side === u.side) continue;
    const d = dist([u.q, u.r], [e.q, e.r]);
    if (d === 1) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: false });
    else if (d === 2 && shoot) out.push({ kind: 'unit', q: e.q, r: e.r, ranged: true });
  }
  if (u.side === 0) {
    for (const [nq, nr] of neighbors(bs, u.q, u.r)) {
      const t = tileAt(bs, nq, nr);
      if ((t.t === 'wall' || t.t === 'gate') && t.hp > 0) out.push({ kind: 'tile', q: nq, r: nr, ranged: false });
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
    const back = Math.round(damage(bs, target, a, false) * 0.4);
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
  if ((t.t !== 'wall' && t.t !== 'gate') || t.hp <= 0) return '';
  const dmg = Math.round(a.troops * 0.03 * (atkPower(a) / 60) * rrange(bs, 0.85, 1.15) + 25);
  t.hp = Math.max(0, t.hp - dmg);
  let text = `${a.name} → ${TILE_NAMES[t.t]}: −${dmg}`;
  if (t.hp === 0) { text += ` — ${jo(TILE_NAMES[t.t], "이가")} 무너졌다!`; t.t = 'breach'; }
  a.acted = true; a.moved = true;
  bs.log.push(text);
  return text;
}

function hurt(bs: BattleState, u: Unit, dmg: number) {
  u.troops = Math.max(0, u.troops - dmg);
  u.morale = clamp(u.morale - Math.round((dmg / Math.max(1, u.troops + dmg)) * 55) - 1, 0, 100);
  if (u.troops <= 0) { u.gone = 'destroyed'; bs.log.push(`${u.name} 부대가 무너졌다.`); }
  else if (u.morale <= 0) { u.gone = 'routed'; bs.log.push(`${u.name} 부대가 사기를 잃고 달아났다.`); }
}

/* ───────────── 계략 ───────────── */

export function fireChance(bs: BattleState, u: Unit, q: number, r: number): number {
  const t = tileAt(bs, q, r);
  if (dist([u.q, u.r], [q, r]) > 2 || t.fire > 0) return 0;
  if (t.t === 'water' || t.t === 'wall' || t.t === 'gate' || t.t === 'bridge' || t.t === 'mountain') return 0;
  if (bs.weather === '비') return 0;
  let p = (u.stats[INT] - 25) / 100 + (u.traits.includes('화계') ? 0.25 : 0);
  if (t.t === 'forest') p += 0.15;
  if (t.t === 'inner' || t.t === 'keep') p -= 0.1;
  if (bs.weather === '강풍') p += 0.12;
  if (bs.weather === '흐림') p -= 0.05;
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
      if (nt.fire > 0 || ['water', 'wall', 'gate', 'bridge', 'mountain', 'breach'].includes(nt.t)) continue;
      let p = nt.t === 'forest' ? 0.35 : nt.t === 'plain' || nt.t === 'hill' ? 0.15 : 0.08;
      if (dir === bs.wind) p += bs.weather === '강풍' ? 0.4 : 0.2;
      if (chance(bs, p)) ignite(bs, n[0], n[1]);
    }
  }
  /* 군량 */
  const atkTroops = alive(bs, 0).reduce((a, u) => a + u.troops, 0);
  const defTroops = alive(bs, 1).reduce((a, u) => a + u.troops, 0);
  bs.food -= Math.ceil(atkTroops * 0.004);
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
  /* 사기 회복(의술) */
  for (const u of bs.units) {
    if (u.gone) continue;
    if (u.traits.includes('의술')) u.troops = Math.min(u.maxTroops, u.troops + Math.round(u.maxTroops * 0.03));
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

/** 성벽을 넘는 비용까지 셈한 본진까지의 거리 지도 */
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
      const c = t.t === 'wall' ? 7 + t.hp / 200 : t.t === 'gate' ? 4 + t.hp / 200 : t.t === 'mountain' ? 3 : t.t === 'water' ? (bs.naval ? 1 : 3) : t.t === 'forest' || t.t === 'hill' || t.t === 'breach' ? 2 : 1;
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
export function aiUnit(bs: BattleState, u: Unit, keepCache?: number[]) {
  if (bs.over || u.gone || u.acted) return;
  if (u.confused > 0) { doWait(bs, u); return; }
  const enemies = alive(bs, u.side === 0 ? 1 : 0);
  if (!enemies.length) return;

  /* 크게 꺾인 부대는 물러난다(총대장 제외) */
  if (!u.commander && u.troops < u.maxTroops * 0.15 && u.morale < 35 && chance(bs, 0.5)) { doRetreat(bs, u); return; }

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

  /* 움직일 칸 고르기: 공격할 수 있는 적이 있는 칸 중 가장 이득인 곳 */
  let bestMove: { k: number; score: number; target?: Unit; tile?: [number, number]; ranged?: boolean } | null = null;
  const [kq, kr] = bs.keep;
  for (const [k] of reach) {
    const q = k % bs.W, r = Math.floor(k / bs.W);
    const t = tileAt(bs, q, r);
    /* 수비군은 성 밖으로 나가지 않는다(성이 있고 성 안에 있을 때) */
    const inside = (tt: TileType) => tt === 'inner' || tt === 'keep';
    if (u.side === 1 && inside(tileAt(bs, u.q, u.r).t) && !inside(t.t)) continue;
    if (u.side === 0 && q === kq && r === kr) { bestMove = { k, score: 1e9 }; break; }
    let score = 0;
    let target: Unit | undefined;
    let ranged = false;
    for (const e of enemies) {
      const d = dist([q, r], [e.q, e.r]);
      const shoot = u.traits.includes('궁병') || (u.side === 1 && inside(t.t));
      if (d === 1 || (d === 2 && shoot)) {
        const rg = d === 2;
        let v = Math.min(e.troops, expected(bs, u, e, rg)) * (e.commander ? 1.6 : 1);
        if (!rg) v -= expected(bs, e, u, false) * 0.4;
        if (v > score) { score = v; target = e; ranged = rg; }
      }
    }
    let tile: [number, number] | undefined;
    if (!target && u.side === 0) {
      for (const [nq, nr] of neighbors(bs, q, r)) {
        const nt = tileAt(bs, nq, nr);
        if ((nt.t === 'gate' || nt.t === 'wall') && nt.hp > 0) {
          const v = 150 + (nt.t === 'gate' ? 80 : 0) - nt.hp / 20;
          if (v > score) { score = v; tile = [nq, nr]; }
        }
      }
    }
    if (keepD) score += 400 - keepD[k] * 12;
    else score += 80 - Math.min(...enemies.map((e) => dist([q, r], [e.q, e.r]))) * 6 + DEF_MOD[t.t] * 30;
    if (t.fire > 0) score -= 1000;
    if (!bestMove || score > bestMove.score) bestMove = { k, score, target, tile, ranged };
  }
  if (bestMove) {
    const q = bestMove.k % bs.W, r = Math.floor(bestMove.k / bs.W);
    if (q !== u.q || r !== u.r) moveUnit(bs, u, q, r);
    if (bs.over) return;
    if (bestMove.target && !bestMove.target.gone) { attackUnit(bs, u, bestMove.target, !!bestMove.ranged); return; }
    if (bestMove.tile) { attackTile(bs, u, bestMove.tile[0], bestMove.tile[1]); return; }
  }
  /* 이동 뒤에라도 칠 수 있으면 친다 */
  const ts = attackTargets(bs, u).filter((t) => t.kind === 'unit');
  if (ts.length) {
    const t = ts[0];
    const e = unitAt(bs, t.q, t.r)!;
    attackUnit(bs, u, e, t.ranged);
    return;
  }
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
  /* 본진에서 가까운(공격 측) / 적에게 가까운 부대부터 */
  const units = alive(bs, side).filter((u) => !u.acted);
  const keepD = side === 0 ? keepDistance(bs) : undefined;
  for (const u of units) { if (bs.over) return; aiUnit(bs, u, keepD); }
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
}
