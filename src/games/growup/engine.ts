import { TOTAL_TURNS, calendar, whenLabel } from './calendar';
import { CAREERS, Career, careerById } from './careers';
import { ALLOWANCE, FIELD_KEYS, FIELD_LABEL, STAT_KEYS, placeById } from './data';
import { EVENTS, GameEvent, eventById } from './events';
import {
  Activity, Award, CareerScore, Delta, Effect, ExamResult, FieldKey, Four, GameState, Look, Mode,
  Outcome, Place, PlaceId, PlaceStage, StatKey, TurnReport,
} from './types';

export { TOTAL_TURNS };

/* ── 키우기 모드: 4시간마다 행동 1번, 최대 4번까지 모인다 ── */
export const CHARGE_MS = 4 * 60 * 60 * 1000;
export const MAX_TOKENS = 4;
/** 이만큼 안 들르면 보고 싶어 한다 */
export const MISS_MS = 24 * 60 * 60 * 1000;

/** 사건이 나올 확률(정해진 사건 제외) */
const EVENT_CHANCE = 0.3;
/** 같은 사건이 다시 나오기까지의 최소 간격(달) */
const EVENT_COOLDOWN = 14;

/* ── 난수 (mulberry32). 상태를 GameState.rng 에 담아 저장·재현이 된다 ── */
function next(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

/* ── 한국어 조사 ── */
function hasBatchim(word: string): boolean {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return false;
  return (ch - 0xac00) % 28 !== 0;
}
const PAIRS: Record<string, [string, string]> = {
  이가: ['이', '가'], 은는: ['은', '는'], 을를: ['을', '를'], 와과: ['과', '와'], 아야: ['아', '야'],
};
/** "{name:이가}" 같은 자리에 이름과 맞는 조사를 넣는다 */
export function fill(text: string, name: string): string {
  return text.replace(/\{name(?::(이가|은는|을를|와과|아야))?\}/g, (_m, p?: string) => {
    if (!p) return name;
    const [withB, without] = PAIRS[p];
    return name + (hasBatchim(name) ? withB : without);
  });
}

/* ── 새 게임 ── */
export interface NewGameOpts {
  name: string;
  look: Look;
  mode: Mode;
  seed?: number;
  now?: number;
}

const zeroStats = (v: number): Record<StatKey, number> =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Record<StatKey, number>;

export function newGame({ name, look, mode, seed, now = Date.now() }: NewGameOpts): GameState {
  const s: GameState = {
    v: 2,
    name: name.trim() || '하늘',
    look,
    mode,
    turn: 0,
    rng: (seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0,
    stats: zeroStats(8),
    fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, 0])) as Record<FieldKey, number>,
    fatigue: 10,
    mood: 60,
    stress: 10,
    money: 2,
    bold: 0,
    visits: {},
    stageVisits: {},
    flags: [],
    awards: [],
    sick: false,
    pending: null,
    eventSeen: {},
    yearStart: zeroStats(8),
    lastExam: null,
    counseledAt: -1,
    tokens: MAX_TOKENS,
    tokenAt: now,
    lastSeen: now,
    ending: null,
  };
  /* 타고난 기질 — 능력치 두어 개가 조금 높게 시작한다 */
  for (let i = 0; i < 3; i++) {
    const k = STAT_KEYS[Math.floor(next(s) * STAT_KEYS.length)];
    s.stats[k] += 3;
  }
  s.yearStart = { ...s.stats };
  return s;
}

/* ── 장소와 활동 — 장소는 늘 4곳, 활동은 학교급마다 4개 ── */
export function placeStage(s: GameState, p: Place): PlaceStage {
  return p.stages[calendar(s.turn).stage];
}

export function actsOf(s: GameState, p: Place): Four<Activity> {
  return placeStage(s, p).acts;
}

export interface ActStatus {
  ok: boolean;
  locked: boolean;
  reason?: string;
}

export function actStatus(s: GameState, p: Place, a: Activity): ActStatus {
  if (a.lock) {
    const v = s.stageVisits[p.id] ?? 0;
    const lacks: string[] = [];
    if (v < a.lock.visits) lacks.push(`단골도 ${v}/${a.lock.visits}`);
    if (a.lock.stat && s.stats[a.lock.stat] < (a.lock.min ?? 0)) {
      lacks.push(`${statLabel(a.lock.stat)} ${a.lock.min} 이상`);
    }
    if (a.lock.bold !== undefined && s.bold < a.lock.bold) lacks.push('도전 성향이 더 강해야');
    if (lacks.length) return { ok: false, locked: true, reason: lacks.join(' · ') };
  }
  if (a.cost && s.money < a.cost) return { ok: false, locked: false, reason: `용돈 ${a.cost}만원 필요` };
  return { ok: true, locked: false };
}

const STAT_NAMES: Record<StatKey, string> = {
  know: '지식', logic: '논리', create: '창의', express: '표현', body: '체력', craft: '손재주', social: '사교',
};
const statLabel = (k: StatKey) => STAT_NAMES[k];

/** 대성공·실패 확률 */
export function odds(s: GameState, a: Activity): { great: number; fail: number } {
  if (a.safe) return { great: 0, fail: 0 };
  const diff = a.diff ?? 0;
  const main = a.main ? s.stats[a.main] : 40;
  let fail = 0.1 + diff * 0.06 - (main / 100) * 0.18
    + (Math.max(0, s.fatigue - 55) / 100) * 0.9
    + (Math.max(0, s.stress - 55) / 100) * 0.7
    - ((s.mood - 50) / 100) * 0.15;
  let great = 0.1 + (main / 100) * 0.2 + ((s.mood - 50) / 100) * 0.25
    - (Math.max(0, s.fatigue - 50) / 100) * 0.3 - diff * 0.02;
  fail = clamp(fail, 0.03, 0.75);
  great = clamp(great, 0.02, 0.45);
  if (great + fail > 0.95) great = 0.95 - fail;
  return { great, fail };
}

const MULT: Record<Outcome, number> = { great: 1.6, ok: 1, fail: 0.35 };

/** 활동이 적어 둔 수치를 실제로 얼마나 올릴지. 12년(144달)에 맞춘 값 */
const STAT_SCALE = 0.55;
const FIELD_SCALE = 0.6;

/** 능력치는 높을수록 덜 오른다 */
const growth = (cur: number) => Math.max(0.15, 1 - cur / 110);

function applyEffect(s: GameState, e: Effect, mult = 1) {
  for (const [k, v] of Object.entries(e.stats ?? {}) as [StatKey, number][]) {
    const gain = v > 0 ? v * STAT_SCALE * mult * growth(s.stats[k]) : v;
    s.stats[k] = clamp(s.stats[k] + gain, 0, 100);
  }
  for (const [k, v] of Object.entries(e.fields ?? {}) as [FieldKey, number][]) {
    s.fields[k] = clamp(s.fields[k] + (v > 0 ? v * FIELD_SCALE * mult : v), 0, 100);
  }
  if (e.money) s.money = Math.max(0, s.money + (e.money > 0 ? Math.round(e.money * mult) : e.money));
  if (e.fatigue) s.fatigue += e.fatigue;
  if (e.stress) s.stress += e.stress;
  if (e.mood) s.mood += e.mood;
  if (e.bold) s.bold += e.bold;
  clampCond(s);
}

function clampCond(s: GameState) {
  s.fatigue = clamp(s.fatigue, 0, 100);
  s.stress = clamp(s.stress, 0, 100);
  s.mood = clamp(s.mood, 0, 100);
  s.bold = clamp(s.bold, -100, 100);
}

/** 관심도가 가장 높은 분야들 */
export function topFields(s: GameState, n = 3): { field: FieldKey; value: number }[] {
  return FIELD_KEYS.map((field) => ({ field, value: s.fields[field] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

/* ── 한 달 진행 ── */
interface Snap {
  stats: Record<StatKey, number>;
  fields: Record<FieldKey, number>;
  fatigue: number; mood: number; stress: number; money: number; bold: number;
}
const snap = (s: GameState): Snap => ({
  stats: { ...s.stats }, fields: { ...s.fields },
  fatigue: s.fatigue, mood: s.mood, stress: s.stress, money: s.money, bold: s.bold,
});

export function diff(a: Snap, b: Snap): Delta {
  const d: Delta = {
    stats: {}, fields: {},
    fatigue: b.fatigue - a.fatigue, mood: b.mood - a.mood, stress: b.stress - a.stress,
    money: b.money - a.money, bold: b.bold - a.bold,
  };
  for (const k of STAT_KEYS) {
    const v = b.stats[k] - a.stats[k];
    if (Math.abs(v) >= 0.05) d.stats[k] = v;
  }
  for (const k of FIELD_KEYS) {
    const v = b.fields[k] - a.fields[k];
    if (Math.abs(v) >= 0.05) d.fields[k] = v;
  }
  return d;
}

export type ActResult =
  | { ok: true; state: GameState; report: TurnReport }
  | { ok: false; reason: string };

function blocked(s: GameState): string | null {
  if (s.ending) return '이미 끝난 이야기예요';
  if (s.turn >= TOTAL_TURNS) return '졸업했어요';
  if (s.pending) return '먼저 일어난 일을 골라 주세요';
  if (s.mode === 'raise' && s.tokens <= 0) return '행동력이 다시 찰 때까지 기다려요';
  return null;
}

export function doActivity(prev: GameState, placeId: PlaceId, actId: string): ActResult {
  const why = blocked(prev);
  if (why) return { ok: false, reason: why };
  if (prev.sick) return { ok: false, reason: '아파서 이번 달은 쉬어야 해요' };
  const place = placeById(placeId);
  const act = place ? actsOf(prev, place).find((a) => a.id === actId) : undefined;
  if (!place || !act) return { ok: false, reason: '지금은 할 수 없는 활동이에요' };
  const st = actStatus(prev, place, act);
  if (!st.ok) return { ok: false, reason: st.reason ?? '지금은 할 수 없어요' };

  const s = clone(prev);
  const before = snap(s);
  const when = whenLabel(s.turn);
  const grade = calendar(s.turn).gradeLabel;
  const lines: string[] = [];

  if (act.cost) s.money -= act.cost;

  /* 결과 판정 */
  const o = odds(s, act);
  const r = next(s);
  const outcome: Outcome = act.safe ? 'ok' : r < o.fail ? 'fail' : r < o.fail + o.great ? 'great' : 'ok';
  const mult = MULT[outcome];
  applyEffect(s, act, mult);
  if (outcome === 'great') s.mood = clamp(s.mood + 6, 0, 100);
  if (outcome === 'fail') { s.stress = clamp(s.stress + 6, 0, 100); s.mood = clamp(s.mood - 6, 0, 100); }

  /* 특수 활동 */
  let counsel: TurnReport['counsel'];
  if (act.special === 'topField') {
    const top = topFields(s, 1)[0];
    s.fields[top.field] = clamp(s.fields[top.field] + 10 * mult, 0, 100);
    lines.push(`${FIELD_LABEL[top.field]} 현장을 직접 겪어 봤다.`);
  } else if (act.special === 'randomField') {
    const f = FIELD_KEYS[Math.floor(next(s) * FIELD_KEYS.length)];
    s.fields[f] = clamp(s.fields[f] + 6 * mult, 0, 100);
    lines.push(`오늘의 체험은 ${FIELD_LABEL[f]}! 생각보다 재밌었다.`);
  } else if (act.special === 'counsel') {
    s.counseledAt = s.turn;
    counsel = topFields(s, 3);
  }

  if (act.flag && outcome !== 'fail' && !s.flags.includes(act.flag)) s.flags.push(act.flag);

  /* 대회 */
  let award: Award | undefined;
  if (act.contest) {
    award = { name: act.name, field: act.contest, rank: outcome, grade };
    s.awards.push(award);
    lines.push(outcome === 'great' ? '🏆 대상을 받았다!' : outcome === 'ok' ? '🥈 입상했다!' : '참가에 의의를 뒀다.');
  }

  /* 단골도 — 잠긴 활동은 이번 학교급에서 간 횟수로 연다 */
  s.visits[placeId] = (s.visits[placeId] ?? 0) + 1;
  const v = (s.stageVisits[placeId] ?? 0) + 1;
  s.stageVisits[placeId] = v;
  const lockAct = actsOf(s, place).find((a) => a.lock && a.lock.visits === v);
  if (lockAct) {
    const now = actStatus(s, place, lockAct);
    lines.push(now.ok ? `${place.name} 단골이 됐다! 이제 “${lockAct.name}”도 할 수 있다.`
      : `${place.name} 단골이 됐다! “${lockAct.name}” 조건: ${now.reason}`);
  }

  const report = endMonth(s, lines);
  return {
    ok: true,
    state: s,
    report: {
      when, place: placeId, act: actId, outcome,
      delta: diff(before, snap(s)),
      lines,
      counsel,
      award,
      ...report,
    },
  };
}

/** 아픈 달 — 쉬기만 할 수 있다 */
export function restSick(prev: GameState): ActResult {
  const why = blocked(prev);
  if (why) return { ok: false, reason: why };
  if (!prev.sick) return { ok: false, reason: '아프지 않아요' };
  const s = clone(prev);
  const before = snap(s);
  const when = whenLabel(s.turn);
  s.sick = false;
  s.fatigue = clamp(s.fatigue - 45, 0, 100);
  s.stress = clamp(s.stress - 20, 0, 100);
  s.mood = clamp(s.mood - 5, 0, 100);
  const lines = ['한 달 동안 앓아누웠다. 무리하지 말자.'];
  const rest = endMonth(s, lines);
  return { ok: true, state: s, report: { when, outcome: 'sick', delta: diff(before, snap(s)), lines, ...rest } };
}

/** 활동 뒤 학교생활·용돈·시험·사건을 처리하고 다음 달로 넘긴다 */
function endMonth(s: GameState, lines: string[]): Pick<TurnReport, 'exam' | 'yearEnd'> {
  const cal = calendar(s.turn);
  const out: Pick<TurnReport, 'exam' | 'yearEnd'> = {};

  /* 학교생활 */
  if (cal.vacation) {
    s.fatigue -= 8; s.stress -= 6;
  } else {
    s.fatigue += 4; s.stress += 3;
    s.stats.know = clamp(s.stats.know + 0.25 * growth(s.stats.know), 0, 100);
    s.stats.social = clamp(s.stats.social + 0.2 * growth(s.stats.social), 0, 100);
  }
  /* 기분은 천천히 제자리로, 스트레스가 높으면 가라앉는다 */
  s.mood += (55 - s.mood) * 0.1;
  if (s.stress >= 70) s.mood -= 4;
  clampCond(s);

  s.money += ALLOWANCE[cal.stage];

  /* 시험 — 초4부터 7월·12월 */
  if (cal.grade >= 3 && (cal.month === 7 || cal.month === 12)) {
    const exam = takeExam(s, cal.gradeLabel);
    s.lastExam = exam;
    out.exam = exam;
    if (exam.score >= 80) { s.mood += 10; }
    else if (exam.score >= 60) { s.mood += 4; }
    else if (exam.score < 40) { s.stress += 6; s.mood -= 4; }
    clampCond(s);
  }

  /* 학년 마무리 */
  if (cal.yearEnd) {
    const delta: Partial<Record<StatKey, number>> = {};
    for (const k of STAT_KEYS) {
      const d = s.stats[k] - s.yearStart[k];
      if (d >= 0.5) delta[k] = d;
    }
    out.yearEnd = { grade: cal.gradeLabel, delta };
    s.yearStart = { ...s.stats };
  }

  /* 아플 수도 있다 */
  if (s.fatigue >= 95 || s.stress >= 95) s.sick = true;
  else if ((s.fatigue >= 85 || s.stress >= 85) && next(s) < 0.5) s.sick = true;
  if (s.sick) lines.push('몸이 으슬으슬하다… 다음 달은 쉬어야 할 것 같다.');

  s.turn += 1;
  if (s.mode === 'raise') s.tokens = Math.max(0, s.tokens - 1);

  /* 중1·고1 — 장소마다 할 수 있는 일이 바뀌고, 단골도는 새로 쌓는다 */
  if (s.turn < TOTAL_TURNS && calendar(s.turn).stage !== cal.stage) {
    s.stageVisits = {};
    const who = calendar(s.turn).stage === 1 ? '중학생' : '고등학생';
    lines.push(`${who}이 됐다! 장소마다 할 수 있는 일이 바뀌었다.`);
  }

  /* 다음 달 사건 */
  if (s.turn < TOTAL_TURNS && !s.sick) s.pending = pickEvent(s);
  return out;
}

function takeExam(s: GameState, grade: string): ExamResult {
  const base = s.stats.know * 0.5 + s.stats.logic * 0.3 + s.stats.express * 0.2;
  const score = clamp(Math.round(base * 1.15 + (next(s) * 16 - 8) - Math.max(0, s.stress - 50) * 0.2), 0, 100);
  const label = score >= 80 ? '최상위권' : score >= 60 ? '우수' : score >= 40 ? '보통' : '분발 필요';
  return { grade, score, label };
}

function pickEvent(s: GameState): string | null {
  const cal = calendar(s.turn);
  const fixed = EVENTS.find((e) => e.fixed?.(s, cal));
  if (fixed) { s.eventSeen[fixed.id] = s.turn; return fixed.id; }
  if (next(s) >= EVENT_CHANCE) return null;
  const pool = EVENTS.filter((e) => e.when?.(s, cal)
    && (s.eventSeen[e.id] === undefined || s.turn - s.eventSeen[e.id] >= (e.cooldown ?? EVENT_COOLDOWN)));
  if (!pool.length) return null;
  const total = pool.reduce((t, e) => t + (e.weight ?? 1), 0);
  let r = next(s) * total;
  for (const e of pool) {
    r -= e.weight ?? 1;
    if (r <= 0) { s.eventSeen[e.id] = s.turn; return e.id; }
  }
  const last = pool[pool.length - 1];
  s.eventSeen[last.id] = s.turn;
  return last.id;
}

export function pendingEvent(s: GameState): GameEvent | null {
  return s.pending ? eventById(s.pending) ?? null : null;
}

export type EventResult =
  | { ok: true; state: GameState; text: string; delta: Delta }
  | { ok: false; reason: string };

export function resolveEvent(prev: GameState, optIdx: number): EventResult {
  const ev = pendingEvent(prev);
  if (!ev) return { ok: false, reason: '고를 일이 없어요' };
  const opt = ev.options[optIdx];
  if (!opt) return { ok: false, reason: '없는 선택지예요' };
  if (opt.need && prev.money < opt.need) return { ok: false, reason: `용돈 ${opt.need}만원 필요` };
  const s = clone(prev);
  const before = snap(s);
  applyEffect(s, opt);
  if (opt.special === 'topField') {
    const top = topFields(s, 1)[0];
    s.fields[top.field] = clamp(s.fields[top.field] + 6, 0, 100);
  }
  s.pending = null;
  const text = opt.special === 'talk' ? talkLine(s) : fill(opt.result, s.name);
  return { ok: true, state: s, text, delta: diff(before, snap(s)) };
}

/** 이야기 들어 주기 — 지금 관심사를 슬쩍 알려 준다 */
export function talkLine(s: GameState): string {
  const [top] = topFields(s, 1);
  if (top.value < 8) return '“아직 뭐가 제일 좋은지 모르겠어. 이것저것 해 보고 싶어!”';
  if (s.stress >= 70) return '“요즘 좀 힘들어… 하루쯤 푹 쉬고 싶어.”';
  const say: Record<FieldKey, string> = {
    it: '“컴퓨터로 뭔가 만드는 게 제일 재밌어!”',
    eng: '“기계가 어떻게 움직이는지 궁금해. 직접 만들어 보고 싶어!”',
    sci: '“세상은 왜 이렇게 생겼을까? 알아내고 싶은 게 너무 많아.”',
    med: '“아픈 사람을 도와주면 마음이 뿌듯해.”',
    art: '“그림 그릴 때는 시간 가는 줄 몰라!”',
    music: '“무대에 서면 심장이 쿵쾅거려. 그게 좋아!”',
    write: '“내 이야기를 사람들한테 들려주고 싶어.”',
    food: '“내가 만든 걸 누가 맛있게 먹으면 그렇게 좋더라.”',
    sport: '“땀 흘리고 나면 기분이 끝내줘!”',
    biz: '“어떻게 하면 물건이 잘 팔릴까? 그런 게 궁금해.”',
    edu: '“누구한테 뭘 알려 줄 때가 제일 신나.”',
  };
  return say[top.field];
}

/* ── 키우기 모드 ── */
export interface WakeResult { state: GameState; gained: number; missed: boolean }

/** 지난 시간만큼 행동력을 채운다. 오래 비웠으면 기분이 조금 가라앉는다 */
export function accrue(prev: GameState, now: number): WakeResult {
  if (prev.mode !== 'raise') return { state: prev, gained: 0, missed: false };
  const s = clone(prev);
  let gained = 0;
  if (s.tokens >= MAX_TOKENS) {
    s.tokenAt = now;
  } else {
    const n = Math.floor(Math.max(0, now - s.tokenAt) / CHARGE_MS);
    if (n > 0) {
      gained = Math.min(n, MAX_TOKENS - s.tokens);
      s.tokens += gained;
      s.tokenAt = s.tokens >= MAX_TOKENS ? now : s.tokenAt + n * CHARGE_MS;
    }
  }
  const missed = now - s.lastSeen >= MISS_MS && !s.ending;
  if (missed) { s.mood = clamp(s.mood - 10, 0, 100); }
  s.lastSeen = now;
  return { state: s, gained, missed };
}

/** 다음 행동력이 차기까지 남은 시간(ms). 가득이면 0 */
export function nextChargeIn(s: GameState, now: number): number {
  if (s.mode !== 'raise' || s.tokens >= MAX_TOKENS) return 0;
  return Math.max(0, s.tokenAt + CHARGE_MS - now);
}

/** 키우기 모드에서 한 번에 키우기로 — 되돌릴 수 없다 */
export function toClassic(prev: GameState): GameState {
  const s = clone(prev);
  s.mode = 'classic';
  return s;
}

/* ── 진로 판정 ── */
/** 등급 문턱 — 한 분야를 꾸준히 판 아이가 3등급에 닿도록 맞췄다 */
export const TIER3 = 80;
export const TIER2 = 62;

function statScore(s: GameState, c: Career): number {
  let t = 0;
  for (const [k, w] of Object.entries(c.weights) as [StatKey, number][]) t += s.stats[k] * w;
  return t;
}

function awardBonus(s: GameState, field: FieldKey | null): number {
  let b = 0;
  for (const a of s.awards) {
    if (field && a.field !== field) continue;
    b += a.rank === 'great' ? 6 : a.rank === 'ok' ? 3 : 0;
  }
  return Math.min(field ? 12 : 8, b);
}

/** 한 직업의 점수. 문턱을 넘지 못하면 null */
export function scoreCareer(s: GameState, c: Career): CareerScore | null {
  if (c.id === 'gap') return null;
  if (c.id === 'allround') {
    if (STAT_KEYS.some((k) => s.stats[k] < 70)) return null;
  }
  if (c.field && s.fields[c.field] < c.minField) return null;
  if (c.field2 && s.fields[c.field2] < (c.minField2 ?? 0)) return null;
  if (c.boldMin !== undefined && s.bold < c.boldMin) return null;
  if (c.boldMax !== undefined && s.bold > c.boldMax) return null;
  if (c.money !== undefined && s.money < c.money) return null;
  const st = statScore(s, c);
  if (st < 30) return null;
  if (c.id === 'civil' && s.stats.know < 60) return null;
  if (c.id === 'athlete' && s.stats.body < 60) return null;

  const fieldPart = c.field ? s.fields[c.field] : clamp(40 - s.bold, 0, 80);
  let score = st * 0.65 + fieldPart * 0.35 + awardBonus(s, c.field);
  if (c.kind === '창업' && s.flags.includes('mentor')) score += 4;
  score = Math.round(clamp(score, 0, 100));
  const tier: 1 | 2 | 3 = score >= TIER3 ? 3 : score >= TIER2 ? 2 : 1;
  return { careerId: c.id, score, tier };
}

/** 졸업 때 고를 수 있는 진로 — 많아야 세 개. 너무 지쳤으면 쉼표뿐이다 */
export function candidates(s: GameState): CareerScore[] {
  if (s.stress >= 85) return [{ careerId: 'gap', score: 0, tier: 1 }];
  const list = CAREERS.map((c) => scoreCareer(s, c)).filter((x): x is CareerScore => !!x)
    .sort((a, b) => b.score - a.score);
  /* 숨은 엔딩은 자리를 하나 보장한다 */
  const all = list.find((x) => x.careerId === 'allround');
  const top = list.filter((x) => x.careerId !== 'allround').slice(0, all ? 2 : 3);
  if (all) top.unshift(all);
  if (!top.length) return [{ careerId: 'gap', score: 0, tier: 2 }];
  return top;
}

export function finish(prev: GameState, careerId: string): { ok: true; state: GameState } | { ok: false; reason: string } {
  if (prev.turn < TOTAL_TURNS) return { ok: false, reason: '아직 졸업 전이에요' };
  if (prev.ending) return { ok: false, reason: '이미 정해졌어요' };
  const pick = candidates(prev).find((c) => c.careerId === careerId);
  if (!pick || !careerById(careerId)) return { ok: false, reason: '고를 수 없는 진로예요' };
  const s = clone(prev);
  s.ending = { careerId, tier: pick.tier, score: pick.score };
  return { ok: true, state: s };
}

/* ── 화면용 ── */
export type Expression = 'happy' | 'normal' | 'tired' | 'sad' | 'sick';

export function expression(s: GameState): Expression {
  if (s.sick) return 'sick';
  if (s.fatigue >= 75) return 'tired';
  if (s.stress >= 70 || s.mood < 30) return 'sad';
  if (s.mood >= 68) return 'happy';
  return 'normal';
}

/** 말풍선 한마디 */
export function bubble(s: GameState): string {
  if (s.turn >= TOTAL_TURNS) return '드디어 졸업이야!';
  const e = expression(s);
  if (e === 'sick') return '으… 머리가 지끈지끈해.';
  if (e === 'tired') return '너무 피곤해… 좀 쉬고 싶어.';
  if (e === 'sad') return s.stress >= 70 ? '요즘 마음이 무거워.' : '기운이 없어…';
  const c = calendar(s.turn);
  if (c.vacation) return '방학이다! 뭐 하고 놀까?';
  if (e === 'happy') return ['오늘은 뭐든 잘될 것 같아!', '어디 갈까? 신난다!', '기분 최고!'][s.turn % 3];
  return ['이번 달은 뭘 해 볼까?', '어디로 갈지 골라 줘!', '오늘도 힘내 보자.'][s.turn % 3];
}

/** 허브 "이어하기" 요약 */
export function progressLabel(s: GameState): string {
  if (s.ending) return `${s.name} · ${careerById(s.ending.careerId)?.title ?? '졸업'}`;
  if (s.turn >= TOTAL_TURNS) return `${s.name} · 졸업 · 진로 선택 중`;
  return `${s.name} · ${whenLabel(s.turn)}`;
}

export const ALL_STATS = STAT_KEYS;
