/** 능력치 7가지 — 화면에 그대로 보인다 */
export type StatKey = 'know' | 'logic' | 'create' | 'express' | 'body' | 'craft' | 'social';

/** 관심 분야 — 숨은 값. 진로 판정의 핵심이다 */
export type FieldKey =
  | 'it' | 'eng' | 'sci' | 'med' | 'art' | 'music' | 'write' | 'food' | 'sport' | 'biz' | 'edu';

export type FriendId = 'minjun' | 'seoyeon' | 'doyun' | 'haeun';

/** 구역 4개 — 버튼 ①~④에 하나씩. 구역마다 장소가 2~4곳 */
export type DistrictId = 'home' | 'school' | 'town' | 'city';

export type PlaceId =
  | 'room' | 'kitchen' | 'lang'
  | 'classroom' | 'field' | 'club' | 'counsel'
  | 'library' | 'park' | 'market' | 'welfare'
  | 'academy' | 'maker' | 'media' | 'parttime';

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
  /** 잠긴 활동 — 이번 학교급에서의 단골도와 능력치 조건 */
  lock?: { visits: number; stat?: StatKey; min?: number; bold?: number };
  /** 대회형 활동 — 결과가 이력에 남는다 */
  contest?: FieldKey;
  /** 성공하면 세우는 깃발 */
  flag?: string;
  /** 특수 처리 */
  special?: 'topField' | 'randomField' | 'counsel';
}

export type Four<T> = [T, T, T, T];

export interface Place {
  id: PlaceId;
  district: DistrictId;
  name: string;
  emoji: string;
  color: string;
  /** 열리는 학년(0=초1 … 11=고3). 그 전에는 마을에 공사 중으로 보인다 */
  from: number;
  /** 학교급별 이름·설명·활동 4개 */
  stages: [PlaceStage, PlaceStage, PlaceStage];
}

export interface District {
  id: DistrictId;
  name: string;
  emoji: string;
  color: string;
  places: PlaceId[];
}

export interface PlaceStage {
  /** 이 학교급에서 부르는 이름 (예: 방과후 교실 → 학원·공방 → 진로체험센터) */
  label: string;
  desc: string;
  acts: Four<Activity>;
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

/** 학년 하나 동안 모으는 기록 — 돌아보기와 진로 리포트의 재료 */
export interface YearStats {
  /** 들어온 돈·나간 돈(만원) — 용돈 기입장 */
  income: number;
  spend: number;
  /** 활동 id → 횟수 */
  acts: Record<string, number>;
  places: Partial<Record<PlaceId, number>>;
  rests: number;
  greats: number;
  fails: number;
  sick: number;
  quizRight: number;
  quizTotal: number;
}

export interface YearSummary extends YearStats {
  grade: string;
  /** 학년 끝에 남은 돈 */
  money: number;
  exam: number | null;
  /** 돌아보기 조언 */
  tips: string[];
  /** 돌아보기 질문 “올해 가장 즐거웠던 일은?”의 보기(활동 id)와 고른 답 */
  choices: string[];
  favorite: string | null;
}

/** 직업 퀴즈 — 보기 4개, 버튼 ①~④로 답한다 */
export interface Quiz {
  /** 직업 퀴즈의 직업(낱말 퀴즈는 비어 있다) */
  careerId?: string;
  /** 낱말 퀴즈 — 읽었던 읽을거리 id */
  readingId?: string;
  kind: 'job' | 'field' | 'subject' | 'word';
  question: string;
  options: [string, string, string, string];
  answer: number;
}

/** 한 달을 4주로 — 주마다 결과가 따로 난다 */
export interface WeekLog {
  outcome: Outcome;
  text: string;
  /** 이번 주에 배운 것(읽을거리 id) */
  bite?: string;
  /** 이미 배운 것을 다시 본 주(복습) */
  review?: boolean;
}

/** 진행 중인 인증 시험 */
export interface ExamState {
  track: string;
  level: number;
  qs: Quiz[];
  /** 지금 문제 번호와 맞힌 수 */
  i: number;
  right: number;
}

export interface GameState {
  v: 4;
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
  /** 12년 동안 장소별로 간 횟수 */
  visits: Partial<Record<PlaceId, number>>;
  /** 이번 학교급(초·중·고)에서 간 횟수 — 잠긴 활동은 이걸로 연다 */
  stageVisits: Partial<Record<PlaceId, number>>;
  flags: string[];
  awards: Award[];
  /** 친구별 친밀도 0~100 */
  friends: Record<FriendId, number>;
  /** 올해 기록과 지난 학년들의 요약 */
  year: YearStats;
  history: YearSummary[];
  /** 학년이 끝나 돌아보기 질문에 답해야 한다 */
  reviewPending: boolean;
  /** 답을 기다리는 직업 퀴즈 */
  quiz: Quiz | null;
  /** 퀴즈·체험으로 알게 된 직업 */
  known: string[];
  /** 배운 것(읽을거리 id, 배운 순서) — 예전 저장에는 없다 */
  read?: string[];
  /** 딴 인증: 인증 id → 단계(1~3) */
  certs?: Record<string, number>;
  /** 인증 시험에 떨어진 턴 — 몇 달 뒤 다시 볼 수 있다 */
  examFail?: Record<string, number>;
  /** 보고 있는 인증 시험 */
  exam?: ExamState | null;
  /** 아파서 이번 달은 쉬어야 한다 */
  sick: boolean;
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
  /** 4주 동안의 기록 */
  weeks?: WeekLog[];
  /** 학년이 끝났으면 그 학년과 능력치 변화, 한 해 요약 */
  yearEnd?: { grade: string; delta: Partial<Record<StatKey, number>>; summary: YearSummary };
  /** 진로 상담 결과 */
  counsel?: { field: FieldKey; value: number }[];
  /** 이번 달에 배운 것(읽을거리 id) */
  learned?: string[];
}

export interface CareerScore {
  careerId: string;
  score: number;
  tier: 1 | 2 | 3;
}
