import { CITY_BY_ID, NEIGHBORS } from '../data/cities';
import type { CityId } from '../data/types';
import { INT, LEAD, WAR, stat, traitsOf } from './officers';
import type { GameState } from './state';

/**
 * 병종. 이동·공격·방어·사거리가 다르고 서로 상성이 있다.
 * 창병은 기병을 막고, 기병은 활·노 부대를 짓밟고, 궁병·노병은 떨어져서 쏘며, 공성병기는 성벽을 부순다.
 */
export type UnitKind = '보병' | '창병' | '기병' | '궁병' | '노병' | '수군' | '공성';

export interface KindInfo {
  name: UnitKind;
  hanja: string;
  /** 기본 이동력 */
  move: number;
  /** 근접 공격·방어 배율 */
  atk: number;
  def: number;
  /** 사격 사거리(0이면 사격 없음)와 사격 배율 */
  range: number;
  shot: number;
  /** 1,000명당 금(편성 비용). 공성은 부대 하나에 붙는 고정 비용 */
  cost: number;
  /** 부대 병력 상한(공성병기) */
  cap?: number;
  desc: string;
}

export const KINDS: Record<UnitKind, KindInfo> = {
  보병: { name: '보병', hanja: '步', move: 4, atk: 1, def: 1, range: 0, shot: 0, cost: 0,
    desc: '칼과 방패. 어느 땅에서나 고르게 싸우고 숲·구릉·성안에서 버틴다.' },
  창병: { name: '창병', hanja: '槍', move: 4, atk: 0.95, def: 1.12, range: 0, shot: 0, cost: 20,
    desc: '긴 창의 밀집대. 기병에게 강하고(공격·반격 ×1.5) 방어가 두텁다.' },
  기병: { name: '기병', hanja: '騎', move: 6, atk: 1.1, def: 0.95, range: 0, shot: 0, cost: 60,
    desc: '빠르고 돌파력이 크다. 평지·길에서 더 세고 궁병·노병을 짓밟지만, 숲·산·늪·성안에서는 둔하다. 말 산지에서만 편성.' },
  궁병: { name: '궁병', hanja: '弓', move: 4, atk: 0.7, def: 0.85, range: 2, shot: 1, cost: 20,
    desc: '두 칸 밖을 쏜다. 붙으면 약하다.' },
  노병: { name: '노병', hanja: '弩', move: 3, atk: 0.7, def: 0.9, range: 2, shot: 1.3, cost: 50,
    desc: '쇠뇌. 느리지만 사격이 가장 아프다. 높은 곳이나 성안에서 3칸까지 쏜다.' },
  수군: { name: '수군', hanja: '水', move: 4, atk: 0.9, def: 0.9, range: 0, shot: 0, cost: 30,
    desc: '배를 탄 군사. 물 위에서 빠르고 강하지만(×1.4) 뭍에서는 약하다. 강·수로에 닿은 도시에서만 편성.' },
  공성: { name: '공성', hanja: '車', move: 3, atk: 0.4, def: 0.7, range: 0, shot: 0, cost: 300, cap: 3000,
    desc: '충차·투석기. 성벽·성문·관문에 세 배 피해를 주고 두 칸 밖에서도 친다. 부대와 싸우면 약하고 숲·산·늪을 못 지난다.' },
};

export const KIND_LIST: UnitKind[] = ['보병', '창병', '기병', '궁병', '노병', '수군', '공성'];

/** 말이 나는 주(州) — 북방·서방 */
const HORSE_ZHOU = new Set(['유주', '기주', '병주', '사례', '옹주', '양주(涼)']);

export const horseLand = (city: CityId) => HORSE_ZHOU.has(CITY_BY_ID[city].zhou);
export const waterSide = (city: CityId) =>
  NEIGHBORS[city].some((n) => n.kind !== 'l') || ['river', 'marsh'].includes(CITY_BY_ID[city].land);

/** 이 도시에서 이 장수가 편성할 수 있는 병종과 못 하는 까닭 */
export function kindAllowed(s: GameState, city: CityId, officerId: string, kind: UnitKind): { ok: boolean; why?: string } {
  if (kind === '기병' && !horseLand(city) && !traitsOf(s, officerId).includes('기병')) return { ok: false, why: '말 산지(북방·서방) 도시나 기병 특기 장수만' };
  if (kind === '수군' && !waterSide(city)) return { ok: false, why: '강·수로에 닿은 도시만' };
  return { ok: true };
}

/** 편성 비용(금) — 말 산지 밖에서 꾸리는 기병은 군마 값이 두 배 */
export function kindCost(city: CityId, kind: UnitKind, troops: number): number {
  const k = KINDS[kind];
  if (kind === '공성') return k.cost;
  const mult = kind === '기병' && !horseLand(city) ? 2 : kind === '기병' ? 0.5 : 1;
  return Math.round((troops / 1000) * k.cost * mult);
}

/** 기본 병종 — 특기와 능력치, 출발 도시로 고른다 */
export function autoKind(s: GameState, city: CityId, officerId: string, naval: boolean): UnitKind {
  const tr = traitsOf(s, officerId);
  const ok = (k: UnitKind) => kindAllowed(s, city, officerId, k).ok;
  if (naval && (tr.includes('수군') || stat(s, officerId, LEAD) >= 70) && ok('수군')) return '수군';
  if (tr.includes('기병') && ok('기병')) return '기병';
  if (tr.includes('궁병')) return '궁병';
  if (tr.includes('수군') && ok('수군') && naval) return '수군';
  const war = stat(s, officerId, WAR), int = stat(s, officerId, INT), lead = stat(s, officerId, LEAD);
  if (war >= 78 && ok('기병') && horseLand(city)) return '기병';
  if (int > war + 10) return lead >= 60 ? '노병' : '궁병';
  if (war >= 70) return '창병';
  return '보병';
}

/** 부대 종류 기호(부대 그림·목록용) */
export const kindOf = (k: UnitKind | undefined): KindInfo => KINDS[k ?? '보병'];
