import type { CityId, FactionKey } from '../data/types';
import type { BattleState } from './battle';

export type Difficulty = 'easy' | 'normal' | 'hard';
export type Lifespan = 'history' | 'fiction';

export interface Options {
  difficulty: Difficulty;
  lifespan: Lifespan;
  /** 플레이어가 낀 전투를 직접 지휘할지 */
  manualBattle: boolean;
}

export type OfficerStatus = 'hidden' | 'free' | 'serving' | 'captive' | 'dead';

export interface Officer {
  id: string;
  status: OfficerStatus;
  /** 섬기는(포로라면 원래 섬기던) 세력 번호. 재야·미등장은 -1 */
  faction: number;
  /** 있는 도시. 미등장·사망은 null */
  city: CityId | null;
  loyalty: number;
  merit: number;
  /** 이번 달 행동을 마쳤는지 */
  acted: boolean;
  /** 등장 연도 */
  appear: number;
  /** 이 게임에서 정해진 사망 연·월 */
  dieYear: number;
  dieMonth: number;
  /** 재야일 때 플레이어·AI가 찾아냈는지 */
  found: boolean;
  /** 포로로 잡고 있는 세력 */
  captor: number;
  /** 내응을 약속한 세력 */
  turncoat: number;
  items: string[];
}

export interface City {
  id: CityId;
  owner: number; // -1 = 공백지
  gold: number;
  food: number;
  /** 인구(명) */
  pop: number;
  agri: number;
  comm: number;
  /** 치수 0~100 */
  flood: number;
  /** 성벽 0~100 */
  wall: number;
  /** 민심 0~100 */
  loyalty: number;
  troops: number;
  /** 훈련 0~100 */
  training: number;
  /** 사기 0~100 */
  morale: number;
  governor: string | null;
  delegated: boolean;
  /** 이번 달 상인과 거래했는지 */
  traded: boolean;
}

export interface Faction {
  idx: number;
  key: FactionKey;
  ruler: string;
  advisor: string | null;
  capital: CityId;
  color: string;
  alive: boolean;
  human: boolean;
  /** 다른 세력과의 우호 0~100 */
  rel: Record<number, number>;
  /** 동맹 남은 달 수 */
  ally: Record<number, number>;
  /** 칭호 단계 (0 태수 … 5 황제) */
  rank: number;
  /** 이 세력이 이번 달 명령을 끝냈는지 */
  done: boolean;
}

export interface LogEntry {
  y: number;
  m: number;
  text: string;
  kind: 'info' | 'war' | 'event' | 'death' | 'person' | 'diplo' | 'disaster';
  /** 관련 세력(이 세력 플레이어에게 강조) */
  f?: number;
}

/** 출진·공격 대기열 */
export interface AttackOrder {
  faction: number;
  from: CityId;
  to: CityId;
  officers: string[];
  troops: number[];
  /** 장수별 병종(없으면 자동) */
  kinds?: import('./units').UnitKind[];
  food: number;
  gold: number;
}

export interface GameState {
  version: number;
  scenarioId: string;
  seed: number;
  rng: number;
  year: number;
  month: number;
  options: Options;
  factions: Faction[];
  cities: Record<CityId, City>;
  officers: Record<string, Officer>;
  /** 보물 위치 */
  items: Record<string, { holder?: string; city?: CityId }>;
  /** 천자를 모신 세력 (-1 없음) */
  emperor: number;
  hanAlive: boolean;
  /** 한 번만 일어나는 사건 */
  fired: string[];
  log: LogEntry[];
  /** 이번 달 세력 순서와 현재 차례 */
  order: number[];
  turn: number;
  /** 컴퓨터·플레이어가 낸 공격 대기열 */
  attacks: AttackOrder[];
  /** 최근 출진 기록(지도에 진군 화살표로 그린다). 옛 저장에는 없을 수 있다 */
  marches?: { y: number; m: number; f: number; from: CityId; to: CityId }[];
  /** 이달 사람 세력에게 올라온 결단(청원·사건). 옛 저장에는 없을 수 있다 */
  decisions?: import('./decisions').Decision[];
  /** 사람 세력별 천명(단기 목표). 옛 저장에는 없을 수 있다 */
  goals?: Record<number, import('./goals').Goal[]>;
  /** 지휘를 기다리는 전투 */
  battle: BattleState | null;
  /** 이번 달 보고 — 플레이어가 확인하면 비운다 */
  news: LogEntry[];
  /** 쌀 100 의 금 시세 */
  foodPrice: number;
  over: null | { winner: number; year: number; month: number } | { lost: true; year: number; month: number };
  /** 시작 연월(소요 기간 계산) */
  startYear: number;
  startMonth: number;
}

export const SAVE_VERSION = 1;
