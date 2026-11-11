import { describe, it, expect } from 'vitest';
import { newGame, TOTAL_TURNS } from '../src/games/growup/engine';
import { Flow, goto, press, screenModel, settle } from '../src/games/growup/flow';
import { makeQuiz, makeWordQuiz, riasec, topRiasec, careersForType, nearMisses, careerNeeds, yearTips } from '../src/games/growup/edu';
import { CAREERS, careerById } from '../src/games/growup/careers';
import { piboFace, packRows, PIBO_W, PIBO_H } from '../src/games/growup/pibo';
import { PRESETS, presetGrid, resizeGrid, floodFill, blankGrid } from '../src/games/growup/pixelart';
import { GameState } from '../src/games/growup/types';
import { ACT_TOPIC, READINGS, TOPIC_INFO, certBonus, levelNeed, makeExam, pickReading, questionsOf, quizFrom, readingsOf, topicOf, trackById, trackOfTopic } from '../src/games/growup/reading';
import { PLACES } from '../src/games/growup/data';
import { doActivity, answerQuiz, answerExam, examDue } from '../src/games/growup/engine';

const make = (seed = 1) => newGame({ name: '하늘', look: { hair: 0, style: 0 }, mode: 'classic', seed, now: 0 });

function rnd(seed: number) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

/** 버튼만 눌러서 한 판 — 파이브레인처럼 화면 모델만 보고 고른다 */
function playByButtons(seed: number) {
  let game: GameState = make(seed);
  let flow: Flow = settle(game);
  const r = rnd(seed);
  const seen = new Set<string>();
  for (let guard = 0; guard < 5000 && flow.s !== 'ending'; guard++) {
    const m = screenModel(flow, game);
    seen.add(m.kind);
    expect(m.choices.length).toBeLessThanOrEqual(4);
    let b: 1 | 2 | 3 | 4 | 'back';
    if (m.anyKey || !m.choices.length) b = 1;
    else if (m.back && !m.choices.some((c) => c.enabled)) b = 'back'; // 돈이 없거나 다 잠겼으면 돌아간다
    else {
      const ok = m.choices.map((c, i) => (c.enabled ? i : -1)).filter((i) => i >= 0);
      /* 지치면 집에서 쉰다(장소 ①, 활동 ①) */
      const tired = game.fatigue > 65 || game.stress > 65;
      if (tired && (flow.s === 'town' || (flow.s === 'district' && flow.district === 'home') || (flow.s === 'place' && flow.place === 'room'))) b = 1;
      else b = ((ok.length ? ok[Math.floor(r() * ok.length)] : 0) + 1) as 1 | 2 | 3 | 4;
    }
    const step = press(flow, game, b);
    flow = step.flow;
    game = step.game;
  }
  return { flow, game, seen };
}

describe('흐름 — 버튼만으로', () => {
  it('어느 화면이든 버튼은 4개 이하, 버튼만으로 졸업·엔딩까지 간다', () => {
    for (const seed of [1, 2, 3, 7, 11]) {
      const { flow, game, seen } = playByButtons(seed);
      expect(flow.s).toBe('ending');
      expect(game.turn).toBe(TOTAL_TURNS);
      expect(game.ending).not.toBeNull();
      expect(game.history).toHaveLength(12);
      for (const k of ['town', 'district', 'place', 'month', 'result', 'review', 'graduation']) expect(seen.has(k)).toBe(true);
    }
  });

  it('장소에서 뒤로 가면 마을로, 잠긴 활동은 고를 수 없다', () => {
    const g = make();
    let st = press({ s: 'town' }, g, 2);
    expect(st.flow).toEqual({ s: 'district', district: 'school' });
    /* 동아리방(중1부터)은 아직 공사 중 */
    expect(press(st.flow, st.game, 3).toast).toBeTruthy();
    st = press(st.flow, st.game, 1);
    expect(st.flow).toEqual({ s: 'place', place: 'classroom' });
    expect(press(st.flow, st.game, 'back').flow).toEqual({ s: 'district', district: 'school' });
    st = press(st.flow, st.game, 4); // 학예회 무대 — 잠김
    expect(st.flow.s).toBe('place');
    expect(st.toast).toBeTruthy();
  });

  it('화면에서 장소를 바로 누르면 구역을 거치지 않는다', () => {
    const g = make();
    expect(goto({ s: 'town' }, g, 'library').flow).toEqual({ s: 'place', place: 'library' });
    expect(goto({ s: 'town' }, g, 'maker').toast).toBeTruthy();
  });

  it('한 달을 하면 4주 기록이 나오고, 아무 버튼이나 누르면 결과로 간다', () => {
    const g = make();
    const a = press({ s: 'place', place: 'classroom' }, g, 1);
    expect(a.flow.s).toBe('month');
    if (a.flow.s !== 'month') return;
    expect(a.flow.report.weeks).toHaveLength(4);
    expect(screenModel(a.flow, a.game).lines).toHaveLength(4);
    expect(press(a.flow, a.game, 3).flow.s).toBe('result');
  });

  it('학년이 끝나면 돌아보기를 해야 다음으로 간다', () => {
    const g = { ...make(), turn: 11 };
    const a = press({ s: 'place', place: 'room' }, g, 1);
    const res = press(a.flow, a.game, 1);
    expect(res.game.reviewPending).toBe(true);
    const next = press(res.flow, res.game, 1);
    expect(next.flow.s).toBe('review');
    const m = screenModel(next.flow, next.game);
    expect(m.choices.length).toBeGreaterThan(0);
    const done = press(next.flow, next.game, 1);
    expect(done.game.reviewPending).toBe(false);
    expect(done.game.history[0].favorite).toBeTruthy();
  });
});

describe('교육 장치', () => {
  it('퀴즈 보기는 4개, 서로 다르고, 정답이 들어 있다', () => {
    const g = make();
    const r = rnd(5);
    for (let i = 0; i < 300; i++) {
      const q = makeQuiz(g, r);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      const c = careerById(q.careerId!)!;
      if (q.kind === 'job') expect(q.options[q.answer]).toBe(c.title);
      if (q.kind === 'subject') expect(c.subjects).toContain(q.options[q.answer]);
    }
  });

  it('흥미 유형은 0~100, 관심 분야를 따라간다', () => {
    const g = { ...make(), fields: { ...make().fields, art: 80, music: 60 } };
    const r = riasec(g);
    for (const v of Object.values(r)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect(topRiasec(g)[0]).toBe('A');
    expect(careersForType(['A', 'E']).every((c) => c.riasec.includes('A'))).toBe(true);
  });

  it('모든 직업에 흥미 유형과 관련 과목이 있다(쉼표 제외)', () => {
    for (const c of CAREERS) {
      if (c.id === 'gap') continue;
      expect(c.riasec.length).toBe(2);
      expect(c.subjects.length).toBeGreaterThan(0);
    }
  });

  it('모자란 것을 알려 준다', () => {
    const g = { ...make(), fields: { ...make().fields, med: 20 } };
    const needs = careerNeeds(g, careerById('doctor')!);
    expect(needs.some((n) => n.includes('병원'))).toBe(true);
    expect(nearMisses(g).length).toBeGreaterThanOrEqual(0);
  });

  it('돌아보기 조언 — 아팠으면 쉬라고, 돈을 더 썼으면 돌아보라고', () => {
    const tips = yearTips({ income: 5, spend: 9, acts: {}, places: { room: 3 }, rests: 0, greats: 0, fails: 0, sick: 2, quizRight: 0, quizTotal: 0 }, make());
    expect(tips.some((t) => t.includes('아파서'))).toBe(true);
    expect(tips.some((t) => t.includes('쓴 돈'))).toBe(true);
  });
});

describe('파이보 얼굴', () => {
  it('128×64 한 장, 표정마다 다르다', () => {
    const faces = (['normal', 'happy', 'tired', 'sad', 'sick'] as const).map((e) => piboFace(e));
    for (const f of faces) {
      expect(f.length).toBe(PIBO_W * PIBO_H);
      expect(f.some((v) => v === 1)).toBe(true);
      expect(packRows(f).length).toBe(1024);
    }
    const keys = new Set(faces.map((f) => f.join('')));
    expect(keys.size).toBe(5);
  });
});

describe('픽셀 초상', () => {
  it('프리셋은 16×16, 표정마다 다르다', () => {
    for (const p of PRESETS) {
      const n = presetGrid(p, 'normal');
      expect(n.px).toHaveLength(256);
      expect(presetGrid(p, 'happy').px.join()).not.toBe(n.px.join());
    }
  });
  it('크기를 바꾸면 그림을 그대로 확대한다', () => {
    const g = presetGrid(PRESETS[0]);
    const big = resizeGrid(g, 32);
    expect(big.px).toHaveLength(1024);
    expect(big.px[0]).toBe(g.px[0]);
    expect(big.px[(8 * 2) * 32 + 8 * 2]).toBe(g.px[8 * 16 + 8]);
  });
  it('채우기는 이어진 칸만 칠한다', () => {
    const g = blankGrid(4);
    g.px[5] = '#000000'; g.px[6] = '#000000'; g.px[9] = '#000000'; g.px[10] = '#000000';
    const f = floodFill(g, 0, 0, '#ff0000');
    expect(f.px.filter((c) => c === '#ff0000')).toHaveLength(12);
  });
});

describe('읽을거리 · 인증', () => {
  it('id가 겹치지 않고, 모든 읽을거리로 보기 4개짜리 문제를 낼 수 있다', () => {
    const ids = READINGS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rr = rnd(3);
    for (const r of READINGS) {
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.body || r.rows).toBeTruthy();
      expect(questionsOf(r).length, r.id).toBeGreaterThan(0);
      for (let i = 0; i < 6; i++) {
        const q = quizFrom(r, rr)!;
        expect(q, r.id).not.toBeNull();
        expect(new Set(q.options).size, r.id).toBe(4);
        expect(questionsOf(r).some((x) => x.question === q.question && x.answer === q.options[q.answer]), r.id).toBe(true);
      }
    }
  });

  it('모든 활동에 배울 분야가 있고, 분야마다 인증이 있다', () => {
    for (const p of PLACES) for (const st of p.stages) for (const a of st.acts) {
      expect(ACT_TOPIC[a.id], a.id).toBeTruthy();
      expect(readingsOf(topicOf(a.id)).length, a.id).toBeGreaterThanOrEqual(6);
    }
    for (const t of Object.keys(TOPIC_INFO)) expect(trackOfTopic(t as never), t).toBeTruthy();
  });

  it('한 달 4주 동안 주마다 하나씩 배운다', () => {
    const r = doActivity(make(), 'lang', 'hanja');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.weeks!.map((w) => w.bite)).toEqual(['hj-num', 'id-two-birds', 'hj-week1', 'id-three-days']);
    expect(r.state.read).toHaveLength(4);
    expect(r.report.learned).toHaveLength(4);
  });

  it('어학원 낱말은 쉬운 것부터 차례로, 다 배우면 복습으로 나온다', () => {
    const read: string[] = [];
    for (let i = 0; i < 60; i++) {
      const r = pickReading(read, 'english', () => 0.3);
      expect(r.topic).toBe('english');
      if (!read.includes(r.id)) read.push(r.id);
    }
    expect(read[0]).toBe('en-hello');
    expect(read.length).toBe(readingsOf('english').length);
  });

  it('배운 것 퀴즈는 배운 것에서 나온다', () => {
    const rr = rnd(9);
    expect(makeWordQuiz(make(), rr)).toBeNull();
    const q = makeWordQuiz({ ...make(), read: ['id-two-birds'] }, rr)!;
    expect(q.readingId).toBe('id-two-birds');
    const a = answerQuiz({ ...make(), quiz: q }, q.answer);
    expect(a.ok && a.correct).toBe(true);
  });

  it('충분히 배우면 학기 말(7월·12월)에 인증 시험이 생기고, 5문제 중 4문제를 맞히면 인증을 딴다', () => {
    const t = trackById('sport')!;
    const all = readingsOf('sport').map((r) => r.id);
    const g0 = { ...make(), turn: 4 }; // 초1 7월
    expect(examDue({ ...g0, read: all.slice(0, levelNeed(t, 1) - 1) })).toBeNull();
    expect(examDue({ ...g0, turn: 3, read: all })).toBeNull(); // 6월에는 시험이 없다
    const g = { ...g0, read: all };
    expect(examDue(g)).toEqual({ track: 'sport', level: 1 });
    const qs = makeExam(all, t, rnd(4));
    expect(qs).toHaveLength(5);
    let s: GameState = { ...g, exam: { track: 'sport', level: 1, qs, i: 0, right: 0 } };
    for (let i = 0; i < 5; i++) {
      const r = answerExam(s, i === 0 ? (qs[0].answer + 1) % 4 : qs[i].answer);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.done).toBe(i === 4);
      s = r.state;
      if (r.done) expect(r.passed).toBe(true);
    }
    expect(s.certs).toEqual({ sport: 1 });
    expect(s.exam).toBeNull();
    expect(settle(s)).toEqual({ s: 'town' });
    expect(examDue(s)).toBeNull(); // 중급은 중학생부터
    expect(examDue({ ...s, turn: 76 })).toEqual({ track: 'sport', level: 2 }); // 중1 7월
  });

  it('떨어지면 벌점 없이 다음 시험 기간에 다시 본다', () => {
    const t = trackById('econ')!;
    const all = readingsOf('economy').map((r) => r.id);
    const qs = makeExam(all, t, rnd(5));
    let s: GameState = { ...make(), turn: 4, read: all, exam: { track: 'econ', level: 1, qs, i: 0, right: 0 } };
    const before = { ...s.stats };
    for (let i = 0; i < qs.length; i++) { const r = answerExam(s, (qs[i].answer + 1) % 4); if (r.ok) s = r.state; }
    expect(s.certs ?? {}).toEqual({});
    expect(s.stats).toEqual(before);
    expect(examDue(s)).toBeNull();
    expect(examDue({ ...s, turn: 9 })).toEqual({ track: 'econ', level: 1 }); // 초1 12월
  });

  it('인증은 이어진 진로에 점수를 더한다(많아야 4)', () => {
    expect(certBonus({ cook: 1 }, 'food')).toBe(2);
    expect(certBonus({ cook: 3, care: 3 }, 'food')).toBe(4);
    expect(certBonus({ cook: 3 }, 'it')).toBe(0);
    expect(certBonus(undefined, 'food')).toBe(0);
  });

  it('학교급에 맞는 것만 나오고, 한 분야를 다 배우면 가까운 분야로 이어진다', () => {
    const elem = readingsOf('history').filter((r) => (r.stage ?? 0) === 0).map((r) => r.id);
    expect(readingsOf('history').some((r) => (r.stage ?? 0) > 0)).toBe(true);
    for (let i = 0; i < 30; i++) expect(pickReading([], 'class', Math.random, 0).stage ?? 0).toBe(0);
    const near = pickReading(elem, 'class', () => 0.1, 0);
    expect(['writing', 'study']).toContain(near.topic);
  });

  it('이미 배운 것을 다시 보면 복습으로 표시된다', () => {
    const all = readingsOf('hanja').map((r) => r.id);
    const r = doActivity({ ...make(), read: all }, 'lang', 'hanja');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.report.weeks!.every((w) => w.review)).toBe(true);
  });
});
