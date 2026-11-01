import { TOTAL_TURNS, calendar } from './calendar';
import { careerById } from './careers';
import { PLACES, placeById } from './data';
import {
  Expression, actStatus, actsOf, answerQuiz, candidates, doActivity, expression, fill, findAct, finish,
  pendingEvent, placeStage, reflect, resolveEvent, restSick,
} from './engine';
import type { Button } from './input';
import { Delta, GameState, PlaceId, Stage, TurnReport } from './types';

/**
 * 진행 흐름 — 화면과 상관없는 상태 기계.
 * 웹 화면, 파이브레인(240×320), 파이보(128×64)가 모두 같은 흐름을 쓴다:
 *   상태(Flow) + 버튼(①~④·뒤로) → 다음 상태.  화면은 screenModel() 로 그린다.
 *
 * 한 달:  town(장소) → place(활동) → month(4주 진행) → result
 *         → [review(학년 돌아보기)] → [quiz | event → eventResult] → town …
 * 졸업:   graduation(진로 고르기) → ending
 */
export type Flow =
  | { s: 'town' }
  | { s: 'place'; place: PlaceId }
  | { s: 'month'; report: TurnReport }
  | { s: 'result'; report: TurnReport }
  | { s: 'review' }
  | { s: 'quiz' }
  | { s: 'event' }
  | { s: 'eventResult'; title: string; emoji: string; text: string; delta?: Delta; correct?: boolean }
  | { s: 'graduation' }
  | { s: 'ending' };

/** 화면이 해야 할 일(효과음·연출) — 흐름 자체는 바꾸지 않는다 */
export type Fx =
  | { kind: 'month'; report: TurnReport }
  | { kind: 'choice'; good: boolean }
  | { kind: 'quiz'; correct: boolean }
  | { kind: 'finish'; careerId: string }
  | { kind: 'newGame' }
  | { kind: 'dex' };

export interface Step { flow: Flow; game: GameState; fx?: Fx; toast?: string }

/** 잠시 머무는 화면이 끝났을 때 갈 곳 */
export function settle(g: GameState): Flow {
  if (g.ending) return { s: 'ending' };
  if (g.reviewPending) return { s: 'review' };
  if (g.quiz) return { s: 'quiz' };
  if (g.pending) return { s: 'event' };
  if (g.turn >= TOTAL_TURNS) return { s: 'graduation' };
  return { s: 'town' };
}

const same = (flow: Flow, game: GameState, toast?: string): Step => ({ flow, game, toast });

export function press(flow: Flow, game: GameState, b: Button): Step {
  const n = b === 'back' ? 0 : b;
  switch (flow.s) {
    case 'town': {
      if (b === 'back') return same(flow, game);
      if (game.sick) {
        const r = restSick(game);
        return r.ok ? { flow: { s: 'month', report: r.report }, game: r.state, fx: { kind: 'month', report: r.report } } : same(flow, game, r.reason);
      }
      if (game.mode === 'raise' && game.tokens <= 0) return same(flow, game, '⚡ 행동력이 차면 다시 움직일 수 있어요');
      return same({ s: 'place', place: PLACES[n - 1].id }, game);
    }
    case 'place': {
      if (b === 'back') return same({ s: 'town' }, game);
      const place = placeById(flow.place)!;
      const act = actsOf(game, place)[n - 1];
      const st = actStatus(game, place, act);
      if (!st.ok) return same(flow, game, st.reason);
      const r = doActivity(game, flow.place, act.id);
      if (!r.ok) return same(flow, game, r.reason);
      return { flow: { s: 'month', report: r.report }, game: r.state, fx: { kind: 'month', report: r.report } };
    }
    case 'month':
      return same({ s: 'result', report: flow.report }, game);
    case 'result':
    case 'eventResult':
      return same(settle(game), game);
    case 'review': {
      if (b === 'back') return same(flow, game);
      const r = reflect(game, n - 1);
      if (!r.ok) return same(flow, game);
      return { flow: { s: 'eventResult', title: '한 해 돌아보기', emoji: '📔', text: r.text }, game: r.state, fx: { kind: 'choice', good: true } };
    }
    case 'quiz': {
      if (b === 'back') return same(flow, game);
      const r = answerQuiz(game, n - 1);
      if (!r.ok) return same(flow, game, r.reason);
      return {
        flow: { s: 'eventResult', title: r.correct ? '정답!' : '오답', emoji: r.correct ? '⭕' : '❌', text: r.text, delta: r.delta, correct: r.correct },
        game: r.state, fx: { kind: 'quiz', correct: r.correct },
      };
    }
    case 'event': {
      if (b === 'back') return same(flow, game);
      const ev = pendingEvent(game);
      if (!ev || !ev.options[n - 1]) return same(flow, game);
      const r = resolveEvent(game, n - 1);
      if (!r.ok) return same(flow, game, r.reason);
      return {
        flow: { s: 'eventResult', title: fill(ev.title, game.name), emoji: ev.emoji, text: r.text, delta: r.delta },
        game: r.state, fx: { kind: 'choice', good: r.delta.mood > 0 },
      };
    }
    case 'graduation': {
      if (b === 'back') return same(flow, game);
      const c = candidates(game)[n - 1];
      if (!c) return same(flow, game);
      const r = finish(game, c.careerId);
      if (!r.ok) return same(flow, game, r.reason);
      return { flow: { s: 'ending' }, game: r.state, fx: { kind: 'finish', careerId: c.careerId } };
    }
    case 'ending':
      if (b === 1) return { flow, game, fx: { kind: 'newGame' } };
      if (b === 2) return { flow, game, fx: { kind: 'dex' } };
      return same(flow, game);
  }
}

/* ── 화면 모델 — 기기 화면이 그리는 최소한의 정보 ── */
export interface Choice { label: string; emoji?: string; enabled: boolean; note?: string }

export interface ScreenModel {
  kind: Flow['s'];
  title: string;
  /** 본문 몇 줄 */
  lines: string[];
  /** 버튼 ①~④ — 많아야 4개. 결과 화면처럼 "아무 버튼"이면 빈 배열 + anyKey */
  choices: Choice[];
  anyKey: boolean;
  back: boolean;
  /** 초상 — 학교급과 표정 */
  portrait: { stage: Stage; expr: Expression };
  hud: { when: string; money: number; fatigue: number; stress: number; mood: number };
}

const OUT = { great: '대성공!', ok: '잘 해냈어요', fail: '아쉬워요', sick: '푹 쉬었어요' } as const;

export function screenModel(flow: Flow, g: GameState): ScreenModel {
  const cal = calendar(Math.min(g.turn, TOTAL_TURNS - 1));
  const base = {
    kind: flow.s,
    portrait: { stage: cal.stage, expr: expression(g) },
    hud: { when: g.turn >= TOTAL_TURNS ? '졸업' : `${cal.gradeLabel} ${cal.month}월`, money: g.money, fatigue: Math.round(g.fatigue), stress: Math.round(g.stress), mood: Math.round(g.mood) },
    anyKey: false,
    back: false,
  };
  switch (flow.s) {
    case 'town':
      if (g.sick) return { ...base, title: '아파요', lines: ['너무 무리했어요. 이번 달은 쉬어요.'], choices: [], anyKey: true };
      return {
        ...base, title: '어디로 갈까요?', lines: [],
        choices: PLACES.map((p) => ({ label: placeStage(g, p).label, emoji: p.emoji, enabled: true })),
      };
    case 'place': {
      const p = placeById(flow.place)!;
      return {
        ...base, title: placeStage(g, p).label, lines: [placeStage(g, p).desc], back: true,
        choices: actsOf(g, p).map((a) => {
          const st = actStatus(g, p, a);
          return { label: a.name, emoji: st.locked ? '🔒' : a.emoji, enabled: st.ok, note: st.ok ? undefined : st.reason };
        }),
      };
    }
    case 'month':
      return {
        ...base, title: flow.report.when, anyKey: true, choices: [],
        lines: (flow.report.weeks ?? []).map((w, i) => `${i + 1}주 ${w.outcome === 'great' ? '★' : w.outcome === 'fail' ? '✗' : '·'} ${w.text}`),
      };
    case 'result': {
      const act = flow.report.act ? findAct(flow.report.act) : undefined;
      return { ...base, title: OUT[flow.report.outcome], lines: [act ? `${act.emoji} ${act.name}` : '', ...flow.report.lines].filter(Boolean), choices: [], anyKey: true };
    }
    case 'review': {
      const y = g.history[g.history.length - 1];
      return {
        ...base, title: `${y.grade} 돌아보기`, lines: ['올해 가장 즐거웠던 일은?', ...y.tips],
        choices: y.choices.map((id) => { const a = findAct(id); return { label: a?.name ?? id, emoji: a?.emoji, enabled: true }; }),
      };
    }
    case 'quiz': {
      const q = g.quiz!;
      return { ...base, title: '직업 퀴즈', lines: [q.question], choices: q.options.map((o) => ({ label: o, enabled: true })) };
    }
    case 'event': {
      const ev = pendingEvent(g)!;
      return {
        ...base, title: fill(ev.title, g.name), lines: [fill(ev.text, g.name)],
        choices: ev.options.map((o) => ({ label: o.label, enabled: !o.need || g.money >= o.need, note: o.need ? `용돈 ${o.need}만원` : undefined })),
      };
    }
    case 'eventResult':
      return { ...base, title: flow.title, lines: [flow.text], choices: [], anyKey: true };
    case 'graduation':
      return {
        ...base, title: '졸업! 어떤 길로 갈까요?', lines: [],
        choices: candidates(g).map((c) => { const j = careerById(c.careerId)!; return { label: j.title, emoji: j.emoji, enabled: true, note: '★'.repeat(c.tier) }; }),
      };
    case 'ending': {
      const j = careerById(g.ending!.careerId)!;
      return {
        ...base, title: j.title, lines: [j.epilogue[g.ending!.tier - 1]],
        choices: [{ label: '새로 키우기', enabled: true }, { label: '엔딩 도감', enabled: true }],
      };
    }
  }
}
