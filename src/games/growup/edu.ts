import { CAREERS, Career, Riasec, careerById } from './careers';
import { FIELD_LABEL, PLACES, STAT_LABEL } from './data';
import { FieldKey, GameState, Quiz, StatKey, YearStats } from './types';

/**
 * 교육 장치 — 게임 규칙이 아니라 "배운 것을 보여 주는" 쪽.
 *  · 자기 이해: 진로흥미 유형(RIASEC), 학년 돌아보기
 *  · 직업 세계 이해: 직업 퀴즈, 직업 카드(하는 일·되는 길·관련 과목)
 *  · 진로 탐색·설계: 진로 리포트(어울리는 직업, 조금만 더 했다면 닿았을 직업과 모자란 것)
 *  · 자기 관리·경제: 피로/스트레스 관리 조언, 용돈 기입장
 * 모두 순수 함수 — 엔진과 화면 어디서든 부른다.
 */

/* ── 진로흥미 6유형 ── */
export const RIASEC_KEYS: Riasec[] = ['R', 'I', 'A', 'S', 'E', 'C'];

export const RIASEC_INFO: Record<Riasec, { name: string; desc: string }> = {
  R: { name: '현실형', desc: '몸과 손, 도구와 기계로 직접 만들고 움직이는 것을 좋아해요.' },
  I: { name: '탐구형', desc: '왜 그런지 궁금해하고, 관찰하고 실험해서 알아내는 것을 좋아해요.' },
  A: { name: '예술형', desc: '그림·음악·글처럼 나만의 방식으로 표현하는 것을 좋아해요.' },
  S: { name: '사회형', desc: '사람을 돕고 가르치고 함께하는 것을 좋아해요.' },
  E: { name: '진취형', desc: '앞장서서 이끌고 설득하고 새 일을 벌이는 것을 좋아해요.' },
  C: { name: '관습형', desc: '계획을 세우고 꼼꼼하게 정리하며 차근차근 해내는 것을 좋아해요.' },
};

/**
 * 관심 분야·능력치·성향을 6유형 점수(0~100)로 옮긴다.
 * 게임 속 간이 계산이다 — 실제 진로흥미검사(예: 커리어넷)를 대신하지 않는다.
 */
export function riasec(s: GameState): Record<Riasec, number> {
  const f = s.fields;
  const st = s.stats;
  const raw: Record<Riasec, number> = {
    R: f.eng + f.sport + f.food * 0.5 + st.body * 0.3 + st.craft * 0.3,
    I: f.sci + f.it + f.med * 0.5 + st.logic * 0.4,
    A: f.art + f.music + f.write,
    S: f.edu + f.med + st.social * 0.4,
    E: f.biz * 1.5 + Math.max(0, s.bold) * 0.6 + st.social * 0.2,
    C: st.know * 0.5 + st.logic * 0.2 + Math.max(0, -s.bold) * 0.8 + Math.min(40, s.money * 0.2),
  };
  const max = Math.max(1, ...Object.values(raw));
  return Object.fromEntries(RIASEC_KEYS.map((k) => [k, Math.round((raw[k] / max) * 100)])) as Record<Riasec, number>;
}

/** 가장 높은 두 유형 */
export function topRiasec(s: GameState): [Riasec, Riasec] {
  const r = riasec(s);
  const sorted = [...RIASEC_KEYS].sort((a, b) => r[b] - r[a]);
  return [sorted[0], sorted[1]];
}

/** 유형이 맞는 직업 — 주 유형이 같으면 2점, 부 유형까지 맞으면 3점 */
export function careersForType(code: [Riasec, Riasec], n = 4): Career[] {
  return CAREERS.filter((c) => c.riasec.length)
    .map((c) => ({ c, score: (c.riasec[0] === code[0] ? 2 : c.riasec.includes(code[0]) ? 1 : 0) + (c.riasec.includes(code[1]) ? 1 : 0) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.c);
}

/* ── 직업 퀴즈 — 게임에 들어 있는 직업 카드에서 문제를 만든다(사실 정보는 카드 내용 그대로) ── */
const QUIZ_POOL = () => CAREERS.filter((c) => c.field !== null || c.id === 'civil').filter((c) => c.id !== 'gap' && c.id !== 'allround');

const SUBJECT_GROUPS = [
  ['과학', '물리', '화학', '생명과학', '보건'],
  ['사회', '한국사', '윤리', '경제'],
];

function pickOthers(rand: () => number, pool: string[], avoid: string, n: number): string[] {
  const out: string[] = [];
  const left = pool.filter((x) => x !== avoid);
  while (out.length < n && left.length) {
    const i = Math.floor(rand() * left.length);
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

function shuffleIn(rand: () => number, answer: string, others: string[]): { options: [string, string, string, string]; answer: number } {
  const at = Math.floor(rand() * 4);
  const opts = [...others];
  opts.splice(at, 0, answer);
  return { options: opts.slice(0, 4) as [string, string, string, string], answer: at };
}

/** 퀴즈 하나 — 아직 모르는 직업을 먼저 낸다 */
export function makeQuiz(s: GameState, rand: () => number): Quiz {
  const pool = QUIZ_POOL();
  const fresh = pool.filter((c) => !s.known.includes(c.id));
  const from = fresh.length ? fresh : pool;
  const c = from[Math.floor(rand() * from.length)];
  const kind = (['job', 'field', 'subject'] as const)[Math.floor(rand() * 3)];

  if (kind === 'job' || (kind === 'field' && !c.field)) {
    /* 헷갈리지 않게 오답은 다른 분야 직업에서 */
    const titles = pool.filter((x) => x.field !== c.field).map((x) => x.title);
    const { options, answer } = shuffleIn(rand, c.title, pickOthers(rand, titles, c.title, 3));
    return { careerId: c.id, kind: 'job', question: `“${c.info.split('.')[0]}.” — 이 일을 하는 직업은?`, options, answer };
  }
  if (kind === 'field' && c.field) {
    const labels = (Object.keys(FIELD_LABEL) as FieldKey[]).filter((k) => k !== c.field2).map((k) => FIELD_LABEL[k]);
    const { options, answer } = shuffleIn(rand, FIELD_LABEL[c.field], pickOthers(rand, labels, FIELD_LABEL[c.field], 3));
    return { careerId: c.id, kind: 'field', question: `${c.emoji} ${c.title}에 가장 가까운 관심 분야는?`, options, answer };
  }
  /* 관련 과목 — 정답은 그 직업 과목 중 하나, 오답은 그 직업과 겹치지 않는 과목 */
  const subj = c.subjects[0];
  /* 겹쳐 보이는 과목(과학·물리 등)은 같은 묶음으로 보고 오답에서 뺀다 */
  const group = SUBJECT_GROUPS.find((g) => c.subjects.some((x) => g.includes(x))) ?? [];
  const all = [...new Set(CAREERS.flatMap((x) => x.subjects))]
    .filter((x) => !c.subjects.includes(x) && !group.includes(x) && x !== '가르칠 교과');
  const { options, answer } = shuffleIn(rand, subj, pickOthers(rand, all, subj, 3));
  return { careerId: c.id, kind: 'subject', question: `${c.emoji} ${c.title}에게 특히 도움이 되는 과목은?`, options, answer };
}

/** 퀴즈 풀이 — 맞든 틀리든 직업 카드를 보여 준다 */
export function quizExplain(q: Quiz): string {
  const c = careerById(q.careerId)!;
  return `${c.emoji} ${c.title} — ${c.info} 관련 과목: ${c.subjects.join('·')}.`;
}

/** '논리예요' / '지식이에요' */
function ieyo(word: string): string {
  const ch = word.charCodeAt(word.length - 1);
  const batchim = ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 !== 0;
  return word + (batchim ? '이에요' : '예요');
}

/* ── 학년 돌아보기 — 숫자에서 조언 두세 개를 고른다 ── */
export function yearTips(y: YearStats, s: GameState): string[] {
  const tips: { p: number; t: string }[] = [];
  const months = Object.values(y.places).reduce((a, b) => a + (b ?? 0), 0) + y.sick;
  if (y.sick > 0) tips.push({ p: 10, t: `아파서 ${y.sick}달을 쉬었어요. 피로나 스트레스가 70을 넘기 전에 미리 쉬면 아프지 않아요.` });
  if (y.fails >= 4) tips.push({ p: 8, t: `실패가 ${y.fails}번 있었어요. 지치고 스트레스가 높을 때는 실패가 많아져요 — 컨디션 관리도 실력이에요.` });
  if (y.rests === 0 && months >= 10) tips.push({ p: 6, t: '한 해 동안 한 번도 쉬지 않았어요. 쉬는 것도 계획의 일부예요.' });
  const top = Object.entries(y.places).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  if (top && (top[1] ?? 0) >= 9) {
    const name = PLACES.find((p) => p.id === top[0])?.name ?? top[0];
    tips.push({ p: 5, t: `거의 ${name}에만 있었어요. 다른 곳에 가 보면 몰랐던 관심사를 찾을 수도 있어요.` });
  }
  const kinds = Object.keys(y.places).length;
  if (kinds === 4) tips.push({ p: 3, t: '네 장소를 골고루 다녀 봤어요. 여러 경험이 나를 아는 데 도움이 돼요.' });
  if (y.spend > y.income) tips.push({ p: 7, t: `들어온 돈(${y.income}만원)보다 쓴 돈(${y.spend}만원)이 많았어요. 꼭 필요한 데 썼는지 돌아봐요.` });
  else if (y.income - y.spend >= 8) tips.push({ p: 4, t: `${y.income - y.spend}만원을 모았어요. 모은 돈은 나중에 창업 같은 큰 꿈의 밑천이 돼요.` });
  if (y.greats >= 4) tips.push({ p: 4, t: `대성공이 ${y.greats}번! 기분이 좋을 때 더 잘 해내요.` });
  if (y.quizTotal > 0) tips.push({ p: 2, t: `직업 퀴즈 ${y.quizTotal}문제 중 ${y.quizRight}문제를 맞혔어요.` });
  const weak = (Object.entries(s.stats) as [StatKey, number][]).sort((a, b) => a[1] - b[1])[0];
  if (!tips.length) tips.push({ p: 1, t: `가장 덜 자란 능력은 ${ieyo(STAT_LABEL[weak[0]])}. 관련 활동을 가끔 섞어 보세요.` });
  return tips.sort((a, b) => b.p - a.p).slice(0, 3).map((x) => x.t);
}

/* ── 진로 리포트 — 닿지 못한 직업과 모자랐던 것 ── */
export interface Gap { careerId: string; needs: string[] }

/** 이 직업 문턱에 무엇이 모자란지(이미 닿았으면 빈 배열) */
export function careerNeeds(s: GameState, c: Career): string[] {
  const needs: string[] = [];
  if (c.field && s.fields[c.field] < c.minField) needs.push(`${FIELD_LABEL[c.field]} 관심 ${Math.ceil(c.minField - s.fields[c.field])} 더`);
  if (c.field2 && s.fields[c.field2] < (c.minField2 ?? 0)) needs.push(`${FIELD_LABEL[c.field2]} 관심 ${Math.ceil((c.minField2 ?? 0) - s.fields[c.field2])} 더`);
  if (c.boldMin !== undefined && s.bold < c.boldMin) needs.push('도전하는 경험 더(대회·판매·창업 캠프)');
  if (c.boldMax !== undefined && s.bold > c.boldMax) needs.push('신중하게 준비하는 습관 더');
  if (c.money !== undefined && s.money < c.money) needs.push(`모은 돈 ${c.money - s.money}만원 더`);
  let st = 0;
  for (const [k, w] of Object.entries(c.weights) as [StatKey, number][]) st += s.stats[k] * w;
  if (st < 30) {
    const main = (Object.entries(c.weights) as [StatKey, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => STAT_LABEL[k]);
    needs.push(`${main.join('·')} 능력 더`);
  }
  if (c.id === 'civil' && s.stats.know < 60) needs.push(`지식 ${Math.ceil(60 - s.stats.know)} 더`);
  if (c.id === 'athlete' && s.stats.body < 60) needs.push(`체력 ${Math.ceil(60 - s.stats.body)} 더`);
  return needs;
}

/** 조금만 더 했으면 닿았을 직업 — 모자란 게 적은 순 */
export function nearMisses(s: GameState, n = 2): Gap[] {
  return CAREERS.filter((c) => c.id !== 'gap' && c.id !== 'allround')
    .map((c) => ({ careerId: c.id, needs: careerNeeds(s, c), interest: c.field ? s.fields[c.field] : 0 }))
    .filter((x) => x.needs.length > 0 && x.needs.length <= 2 && x.interest >= 8)
    .sort((a, b) => a.needs.length - b.needs.length || b.interest - a.interest)
    .slice(0, n)
    .map(({ careerId, needs }) => ({ careerId, needs }));
}
