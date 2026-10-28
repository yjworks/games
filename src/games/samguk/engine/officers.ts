import { OFFICER_DEF } from '../data/officers';
import { ITEM_BY_ID } from '../data/items';
import type { FactionKey, OfficerDef, Stats, TraitId } from '../data/types';
import type { GameState, Officer } from './state';

export const STAT_NAMES = ['통솔', '무력', '지력', '정치', '매력'] as const;
export const LEAD = 0, WAR = 1, INT = 2, POL = 3, CHA = 4;

export function def(id: string): OfficerDef {
  const d = OFFICER_DEF[id];
  if (!d) throw new Error(`알 수 없는 인물: ${id}`);
  return d;
}

export function nameOf(id: string | null | undefined): string {
  if (!id) return '—';
  return OFFICER_DEF[id]?.name ?? id;
}

/** 보물 보정을 더한 능력치 */
export function statsOf(s: GameState, id: string): Stats {
  const base = def(id).stats;
  const o = s.officers[id];
  const out = [...base] as Stats;
  if (o) {
    for (const it of o.items) {
      const item = ITEM_BY_ID[it];
      if (!item) continue;
      for (let i = 0; i < 5; i++) out[i] = Math.min(100, out[i] + item.bonus[i]);
    }
  }
  return out;
}

export function stat(s: GameState, id: string, k: number): number {
  return statsOf(s, id)[k];
}

export function traitsOf(s: GameState, id: string): TraitId[] {
  const t = new Set(def(id).traits);
  const o = s.officers[id];
  if (o) for (const it of o.items) { const tr = ITEM_BY_ID[it]?.trait; if (tr) t.add(tr); }
  return [...t];
}

export function hasTrait(s: GameState, id: string, t: TraitId): boolean {
  return traitsOf(s, id).includes(t);
}

export function ageOf(s: GameState, id: string): number {
  return s.year - def(id).born;
}

/** 역사상 그해의 소속 계통 */
export function historicalKey(d: OfficerDef, year: number): FactionKey {
  let k: FactionKey = 'none';
  for (const [y, key] of d.svc) {
    if (y <= year) k = key;
    else break;
  }
  return k;
}

/** 이 인물이 살면서 한 번이라도 속했던 계통인가 */
export function servedKey(d: OfficerDef, key: FactionKey): boolean {
  return d.svc.some(([, k]) => k === key);
}

/** 등장 연도 — 이력 첫 해, 없으면 생년+16 */
export function appearYear(d: OfficerDef): number {
  const first = d.svc[0]?.[0];
  const byAge = d.born + 16;
  return first !== undefined ? Math.min(Math.max(first, d.born + 12), byAge + 14) : byAge;
}

/** 두 인물 사이 인연(부자·형제·의형제·인연 목록) */
export function bonded(a: string, b: string): boolean {
  const da = OFFICER_DEF[a];
  const db = OFFICER_DEF[b];
  if (!da || !db) return false;
  if (da.father === b || db.father === a) return true;
  if (da.father && da.father === db.father) return true;
  return !!(da.bonds?.includes(b) || db.bonds?.includes(a));
}

/** 세력 장수 목록 */
export function officersOf(s: GameState, f: number): Officer[] {
  return Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f);
}

export function officersIn(s: GameState, city: string, f?: number): Officer[] {
  return Object.values(s.officers).filter(
    (o) => o.city === city && o.status === 'serving' && (f === undefined || o.faction === f),
  );
}

/** 재야(발견 여부 무관) */
export function freeIn(s: GameState, city: string): Officer[] {
  return Object.values(s.officers).filter((o) => o.city === city && o.status === 'free');
}

export function captivesOf(s: GameState, f: number): Officer[] {
  return Object.values(s.officers).filter((o) => o.status === 'captive' && o.captor === f);
}

/** 계급 — 공적에 따라 0~6 */
export const RANKS = ['종사', '교위', '중랑장', '편장군', '잡호장군', '정호장군', '대장군'];
const RANK_MERIT = [0, 100, 300, 700, 1300, 2200, 3500];
export function rankOf(o: Officer): number {
  let r = 0;
  for (let i = 0; i < RANK_MERIT.length; i++) if (o.merit >= RANK_MERIT[i]) r = i;
  return r;
}

/** 부대 하나가 거느릴 수 있는 병력 */
export function troopCap(s: GameState, id: string): number {
  const o = s.officers[id];
  const lead = stat(s, id, LEAD);
  const isRuler = o && o.faction >= 0 && s.factions[o.faction]?.ruler === id;
  return Math.round((2000 + lead * 60 + (o ? rankOf(o) * 1000 : 0) + (isRuler ? 4000 : 0)) / 100) * 100;
}

/** 장수 평가값(정렬·AI 판단용) */
export function worth(s: GameState, id: string): number {
  const [l, w, i, p, c] = statsOf(s, id);
  return Math.max(l + w, l + i, i + p) + c * 0.3;
}

export function factionName(s: GameState, f: number): string {
  if (f < 0) return '공백지';
  const fac = s.factions[f];
  return fac ? `${nameOf(fac.ruler)}군` : '?';
}
