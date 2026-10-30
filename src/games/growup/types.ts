/** 능력치 7가지 — 화면에 그대로 보인다 */
export type StatKey = 'know' | 'logic' | 'create' | 'express' | 'body' | 'craft' | 'social';

/** 관심 분야 — 숨은 값. 진로 판정의 핵심이다 */
export type FieldKey =
  | 'it' | 'eng' | 'sci' | 'med' | 'art' | 'music' | 'write' | 'food' | 'sport' | 'biz' | 'edu';

export type PlaceId =
  | 'home' | 'park' | 'library' | 'academy' | 'kitchen' | 'culture' | 'market'
  | 'maker' | 'welfare' | 'media' | 'parttime' | 'career';

/** 0 초등 · 1 중등 · 2 고등 */
export type Stage = 0 | 1 | 2;

export type Outcome = 'great' | 'ok' | 'fail';

export type Mode = 'classic' | 'raise';

/** 활동·사건이 남기는 변화 */
export interface Effect {
  stats?: Partial<Record<StatKey, number>>;
  fields?: Partial<Record<FieldKey, number>>;
  fatigue?: number;
  mood?: number;
  stress?: number;
  money?: number;
  /** 성향: + 도전 / - 신중 */
  bold?: number;
}

export interface Activity extends Effect {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** 성공 판정에 쓰는 능력치. 없으면 기본값 */
  main?: StatKey;
  /** 난이도 0~3 */
  diff?: number;
  /** 실패가 없는 활동(쉬기 등) */
  safe?: boolean;
  /** 미리 내는 돈(만원) */
  cost?: number;
  /** 잠긴 활동 — 단골도와 능력치 조건 */
  lock?: { visits: number; stat?: StatKey; min?: number; bold?: number };
  /** 대회형 활동 — 결과가 이력에 남는다 */
  contest?: FieldKey;
  /** 성공하면 세우는 깃발 */
  flag?: string;
  /** 특수 처리 */
  special?: 'topField' | 'randomField' | 'counsel';
}

export interface Place {
  id: PlaceId;
  name: string;
  emoji: string;
  desc: string;
  /** 열리는 학년(0=초1 … 11=고3) */
  from: number;
  color: string;
  acts: [Activity, Activity, Activity, Activity];
}

export interface Look {
  /** 머리색 번호 */
  hair: number;
  /** 0 짧은 머리 · 1 긴 머리 · 2 묶은 머리 */
  style: number;
}

export interface Award {
  name: string;
  field: FieldKey;
  /** 대상 · 입상 · 참가 */
  rank: Outcome;
  grade: string;
}

export interface ExamResult {
  grade: string;
  score: number;
  label: string;
}

export interface Ending {
  careerId: string;
  tier: 1 | 2 | 3;
  score: number;
}

export interface GameState {
  v: 1;
  name: string;
  look: Look;
  mode: Mode;
  /** 0 = 초1 3월, 144 = 졸업 */
  turn: number;
  rng: number;
  stats: Record<StatKey, number>;
  fields: Record<FieldKey, number>;
  fatigue: number;
  mood: number;
  stress: number;
  money: number;
  bold: number;
  visits: Partial<Record<PlaceId, number>>;
  flags: string[];
  awards: Award[];
  /** 아파서 이번 달은 쉬어야 한다 */
  sick: boolean;
  /** 이번 달 돌보기를 했는지 */
  cared: boolean;
  /** 고르기를 기다리는 사건 id */
  pending: string | null;
  /** 사건 id → 마지막으로 나온 턴 */
  eventSeen: Record<string, number>;
  /** 학년이 시작될 때 능력치 (연말 정산용) */
  yearStart: Record<StatKey, number>;
  lastExam: ExamResult | null;
  /** 진로 상담을 받은 턴 (-1 = 아직) */
  counseledAt: number;
  /** 키우기 모드: 남은 행동 수와 마지막 충전 시각 */
  tokens: number;
  tokenAt: number;
  lastSeen: number;
  ending: Ending | null;
}

/** 한 달 동안 바뀐 값 */
export interface Delta {
  stats: Partial<Record<StatKey, number>>;
  fields: Partial<Record<FieldKey, number>>;
  fatigue: number;
  mood: number;
  stress: number;
  money: number;
  bold: number;
}

export interface TurnReport {
  /** 활동한 달의 라벨 (예: 초3 5월) */
  when: string;
  place?: PlaceId;
  act?: string;
  outcome: Outcome | 'sick';
  delta: Delta;
  lines: string[];
  exam?: ExamResult;
  award?: Award;
  /** 학년이 끝났으면 그 학년과 능력치 변화 */
  yearEnd?: { grade: string; delta: Partial<Record<StatKey, number>> };
  /** 진로 상담 결과 */
  counsel?: { field: FieldKey; value: number }[];
}

export interface CareerScore {
  careerId: string;
  score: number;
  tier: 1 | 2 | 3;
}
