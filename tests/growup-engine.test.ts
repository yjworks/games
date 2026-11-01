import { describe, it, expect } from 'vitest';
import {
  CHARGE_MS, MAX_TOKENS, MISS_MS, TOTAL_TURNS, accrue, answerQuiz, placeOpen, reflect, actStatus, actsOf, candidates, doActivity, fill, finish,
  newGame, pendingEvent, resolveEvent, restSick, scoreCareer, topFields,
} from '../src/games/growup/engine';
import { calendar } from '../src/games/growup/calendar';
import { CAREERS, careerById } from '../src/games/growup/careers';
import { EVENTS } from '../src/games/growup/events';
import { DISTRICTS, PLACES, placeById } from '../src/games/growup/data';
import { GameState, Mode, PlaceId } from '../src/games/growup/types';

const make = (mode: Mode = 'classic', seed = 1, now = 0) =>
  newGame({ name: '하늘', look: { hair: 0, style: 0 }, mode, seed, now });

/** 돌아보기·퀴즈·사건이 있으면 첫 보기로 넘긴다 */
function settle(s: GameState): GameState {
  if (s.reviewPending) { const r = reflect(s, 0); if (!r.ok) throw new Error(r.reason); s = r.state; }
  if (s.quiz) { const r = answerQuiz(s, 0); if (!r.ok) throw new Error(r.reason); s = r.state; }
  while (s.pending) {
    const ev = pendingEvent(s)!;
    const i = ev.options.findIndex((o) => !o.need || s.money >= o.need);
    const r = resolveEvent(s, i);
    if (!r.ok) throw new Error(r.reason);
    s = r.state;
  }
  return s;
}

function step(s: GameState, place: PlaceId, act: string): GameState {
  s = settle(s);
  if (s.sick) { const r = restSick(s); if (!r.ok) throw new Error(r.reason); return r.state; }
  const r = doActivity(s, place, act);
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

function rnd(seed: number) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 2 ** 32; };
}

/** 계획한 활동을 돌아가며 하고, 지치면 쉰다 */
function play(seed: number, plan: [PlaceId, string][]): GameState {
  let s = make('classic', seed);
  let i = 0;
  while (s.turn < TOTAL_TURNS) {
    s = settle(s);
    if (s.sick) { s = step(s, 'room', 'rest'); continue; }
    if (s.fatigue >= 65 || s.stress >= 65) { s = step(s, 'room', 'rest'); continue; }
    const ok = plan.filter(([p, a]) => {
      const pl = placeById(p)!;
      const act = actsOf(s, pl).find((x) => x.id === a);
      return placeOpen(s, pl) && !!act && actStatus(s, pl, act).ok;
    });
    const [p, a] = ok.length ? ok[i++ % ok.length] : ['classroom', 'class'] as [PlaceId, string];
    s = step(s, p, a);
  }
  return settle(s);
}

describe('달력', () => {
  it('초1 3월에서 시작해 고3 2월에 끝난다', () => {
    expect(calendar(0)).toMatchObject({ gradeLabel: '초1', month: 3, stage: 0, vacation: false });
    expect(calendar(5)).toMatchObject({ month: 8, vacation: true });
    expect(calendar(10)).toMatchObject({ month: 1, vacation: true });
    expect(calendar(11)).toMatchObject({ month: 2, yearEnd: true, gradeLabel: '초1' });
    expect(calendar(12).gradeLabel).toBe('초2');
    expect(calendar(72)).toMatchObject({ gradeLabel: '중1', stage: 1 });
    expect(calendar(108)).toMatchObject({ gradeLabel: '고1', stage: 2 });
    expect(calendar(TOTAL_TURNS - 1)).toMatchObject({ gradeLabel: '고3', month: 2 });
  });
});

describe('조사', () => {
  it('받침에 맞는 조사를 붙인다', () => {
    expect(fill('{name:이가} 웃는다', '하늘')).toBe('하늘이 웃는다');
    expect(fill('{name:이가} 웃는다', '지우')).toBe('지우가 웃는다');
    expect(fill('{name:은는}·{name:을를}·{name:와과}', '민준')).toBe('민준은·민준을·민준과');
    expect(fill('{name}', 'Kim')).toBe('Kim');
  });
});

describe('새 게임', () => {
  it('같은 씨앗이면 같은 아이가 나온다', () => {
    expect(make('classic', 7)).toEqual(make('classic', 7));
  });
  it('장소 14곳이 구역 4개에 나뉘고, 구역마다 많아야 4곳·장소마다 활동 4개 — 버튼 4개로 다 고를 수 있다', () => {
    expect(PLACES).toHaveLength(14);
    expect(DISTRICTS).toHaveLength(4);
    expect(DISTRICTS.flatMap((d) => d.places).sort()).toEqual(PLACES.map((p) => p.id).sort());
    for (const d of DISTRICTS) {
      expect(d.places.length).toBeLessThanOrEqual(4);
      for (const id of d.places) expect(placeById(id)!.district).toBe(d.id);
    }
    /* 처음부터 열린 곳이 구역마다 하나 이상 */
    for (const d of DISTRICTS) expect(d.places.some((id) => placeById(id)!.from === 0)).toBe(true);
    for (const p of PLACES) {
      expect(p.stages).toHaveLength(3);
      for (const st of p.stages) expect(st.acts).toHaveLength(4);
    }
  });
  it('같은 장소에서 활동 id가 겹치지 않는다', () => {
    for (const p of PLACES) for (const st of p.stages) {
      expect(new Set(st.acts.map((a) => a.id)).size).toBe(4);
    }
  });
  it('학교급이 바뀌면 같은 장소의 활동도 바뀐다', () => {
    const center = placeById('classroom')!;
    const early = actsOf(make(), center).map((a) => a.id);
    const mid = actsOf({ ...make(), turn: 72 }, center).map((a) => a.id);
    expect(early).not.toEqual(mid);
  });
  it('다른 학교급의 활동은 할 수 없다', () => {
    expect(doActivity(make(), 'classroom', 'lab').ok).toBe(false);
    expect(doActivity({ ...make(), turn: 72 }, 'classroom', 'lab').ok).toBe(true);
  });
  it('아직 안 열린 장소는 갈 수 없다(공사 중)', () => {
    expect(doActivity(make(), 'maker', 'robot').ok).toBe(false);
    expect(doActivity({ ...make(), turn: 72, money: 10 }, 'maker', 'robot').ok).toBe(true);
    expect(doActivity({ ...make(), turn: 48 }, 'market', 'watch').ok).toBe(true);
    expect(doActivity({ ...make(), turn: 47 }, 'market', 'watch').ok).toBe(false);
  });
});

describe('한 달 진행', () => {
  it('활동하면 능력치가 오르고 다음 달로 넘어간다', () => {
    const s = make();
    const r = doActivity(s, 'room', 'homework');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(1);
    expect(r.state.stats.know).toBeGreaterThan(s.stats.know);
    expect(r.state.visits.room).toBe(1);
    expect(r.state.stageVisits.room).toBe(1);
    expect(r.report.when).toBe('초1 3월');
  });

  it('수업료는 미리 내고, 모자라면 못 간다', () => {
    const s = { ...make(), money: 1 };
    const r = doActivity(s, 'academy', 'coding');
    expect(r.ok).toBe(false);
    const ok = doActivity({ ...s, money: 5 }, 'academy', 'coding');
    expect(ok.ok && ok.report.delta.money).toBe(-2 + 1); // 수업료 2 - 용돈 1
  });

  it('잠긴 활동은 이번 학교급에서 단골이 되어야 열린다', () => {
    let s = { ...make(), stats: { ...make().stats, body: 40 } };
    const field = placeById('field')!;
    const sportsday = actsOf(s, field)[3];
    expect(actStatus(s, field, sportsday).locked).toBe(true);
    for (let i = 0; i < 6; i++) { s = step(s, 'field', 'run'); s = { ...settle(s), fatigue: 10, stress: 10, sick: false }; }
    s = settle(s);
    expect(actStatus(s, field, sportsday).ok).toBe(true);
    expect(doActivity(s, 'field', 'sportsday').ok).toBe(true);
  });

  it('중학생이 되면 단골도를 새로 쌓는다', () => {
    const s = { ...make(), turn: 71, stageVisits: { library: 20 }, visits: { library: 20 } };
    const r = doActivity(s, 'library', 'novel');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.stageVisits).toEqual({});
    expect(r.state.visits.library).toBe(21);
    expect(r.report.lines.some((l) => l.includes('중학생'))).toBe(true);
  });

  it('고를 일이 남아 있으면 다음 달로 못 간다', () => {
    const s = { ...make(), pending: 'friend' };
    expect(doActivity(s, 'room', 'rest').ok).toBe(false);
    const r = resolveEvent(s, 0);
    expect(r.ok && r.state.pending).toBe(null);
  });

  it('돈이 필요한 선택지는 돈이 없으면 못 고른다', () => {
    const s = { ...make(), pending: 'phone', money: 0 };
    expect(resolveEvent(s, 1).ok).toBe(false);
    expect(resolveEvent(s, 0).ok).toBe(true);
  });

  it('너무 지치면 아프고, 아픈 달은 쉬기만 할 수 있다', () => {
    const s = { ...make(), fatigue: 100 };
    const r = doActivity(s, 'field', 'soccer');
    expect(r.ok && r.state.sick).toBe(true);
    if (!r.ok) return;
    const t = settle(r.state);
    expect(doActivity(t, 'room', 'rest').ok).toBe(false);
    const rest = restSick(t);
    expect(rest.ok).toBe(true);
    if (!rest.ok) return;
    expect(rest.state.sick).toBe(false);
    expect(rest.state.fatigue).toBeLessThan(t.fatigue);
    expect(rest.state.turn).toBe(t.turn + 1);
  });

  it('초4부터 7월과 12월에 시험을 본다', () => {
    const s = { ...make(), turn: 36 + 4 }; // 초4 7월
    const r = doActivity(s, 'room', 'rest');
    expect(r.ok && r.report.exam?.grade).toBe('초4');
    const early = doActivity({ ...make(), turn: 4 }, 'room', 'rest'); // 초1 7월
    expect(early.ok && early.report.exam).toBeUndefined();
  });

  it('2월이 끝나면 학년 정산이 나온다', () => {
    const r = doActivity({ ...make(), turn: 11 }, 'room', 'homework');
    expect(r.ok && r.report.yearEnd?.grade).toBe('초1');
  });

  it('중1 3월과 고1 3월에는 동아리를 고른다', () => {
    const mid = doActivity({ ...make(), turn: 71 }, 'room', 'rest');
    expect(mid.ok && mid.state.pending).toBe('club-mid');
    const high = doActivity({ ...make(), turn: 107 }, 'room', 'rest');
    expect(high.ok && high.state.pending).toBe('club-high');
  });

  it('모든 사건의 선택지는 2~4개', () => {
    for (const e of EVENTS) {
      expect(e.options.length).toBeGreaterThanOrEqual(2);
      expect(e.options.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('돌보기 사건', () => {
  it('칭찬하면 기분이 오르고 턴은 그대로다', () => {
    const s = { ...make(), pending: 'care' };
    const r = resolveEvent(s, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.turn).toBe(0);
    expect(r.state.mood).toBeGreaterThan(s.mood);
  });
  it('이야기를 들어 주면 아이의 속마음이 나온다', () => {
    const s = { ...make(), pending: 'care', fields: { ...make().fields, food: 30 } };
    const r = resolveEvent(s, 2);
    expect(r.ok && r.text).toContain('맛있게');
  });
  it('간식은 용돈이 든다', () => {
    expect(resolveEvent({ ...make(), pending: 'care', money: 0 }, 1).ok).toBe(false);
  });
});

describe('키우기 모드', () => {
  it('행동마다 행동력을 쓰고, 다 쓰면 기다려야 한다', () => {
    let s = make('raise', 1, 0);
    expect(s.tokens).toBe(MAX_TOKENS);
    for (let i = 0; i < MAX_TOKENS; i++) s = step(s, 'room', 'rest');
    s = settle(s);
    expect(s.tokens).toBe(0);
    expect(doActivity(s, 'room', 'rest').ok).toBe(false);
  });

  it('4시간마다 1씩, 최대치까지만 찬다', () => {
    const s = { ...make('raise', 1, 0), tokens: 0, tokenAt: 0 };
    expect(accrue(s, CHARGE_MS - 1).state.tokens).toBe(0);
    const one = accrue(s, CHARGE_MS + 1000);
    expect(one.state.tokens).toBe(1);
    expect(one.state.tokenAt).toBe(CHARGE_MS); // 남은 시간은 이어서 센다
    expect(accrue(s, CHARGE_MS * 10).state.tokens).toBe(MAX_TOKENS);
  });

  it('하루 넘게 안 와도 벌점은 없다 — 반갑게 맞기만 한다', () => {
    const s = make('raise', 1, 0);
    const r = accrue(s, MISS_MS + 1);
    expect(r.missed).toBe(true);
    expect(r.state.mood).toBe(s.mood);
    expect(r.state.fatigue).toBe(s.fatigue);
    expect(accrue(s, 1000).missed).toBe(false);
  });

  it('한 번에 키우기에서는 행동력을 따지지 않는다', () => {
    let s = make('classic');
    for (let i = 0; i < 8; i++) s = step(s, 'room', 'rest');
    expect(s.turn).toBe(8);
  });
});

describe('진로', () => {
  const grad = (patch: Partial<GameState>): GameState => ({ ...make(), turn: TOTAL_TURNS, pending: null, ...patch });
  const statsAll = (v: number) => ({ know: v, logic: v, create: v, express: v, body: v, craft: v, social: v });

  it('졸업 전에는 끝낼 수 없다', () => {
    expect(finish(make(), 'dev').ok).toBe(false);
  });

  it('관심 분야와 능력치가 맞는 직업이 후보에 오른다', () => {
    const s = grad({ stats: { ...statsAll(30), logic: 85, know: 70, create: 60 }, fields: { ...make().fields, it: 80 } });
    const list = candidates(s).map((c) => c.careerId);
    expect(list[0]).toBe('dev');
    const r = finish(s, 'dev');
    expect(r.ok && r.state.ending?.careerId).toBe('dev');
    expect(finish(s, 'doctor').ok).toBe(false);
  });

  it('창업은 도전 성향과 모은 돈이 있어야 한다', () => {
    const base = { stats: { ...statsAll(60) }, fields: { ...make().fields, biz: 70, food: 40 } };
    const cafe = careerById('cafe')!;
    expect(scoreCareer(grad({ ...base, bold: 50, money: 10 }), cafe)).toBeNull();
    expect(scoreCareer(grad({ ...base, bold: -20, money: 200 }), cafe)).toBeNull();
    expect(scoreCareer(grad({ ...base, bold: 50, money: 200 }), cafe)).not.toBeNull();
  });

  it('너무 지친 채 졸업하면 쉼표 엔딩뿐이다', () => {
    const s = grad({ stress: 90, stats: statsAll(80), fields: { ...make().fields, it: 90 } });
    expect(candidates(s).map((c) => c.careerId)).toEqual(['gap']);
  });

  it('모든 능력치가 70을 넘으면 숨은 엔딩이 맨 앞에 나온다', () => {
    const s = grad({ stats: statsAll(75), fields: { ...make().fields, it: 50 } });
    expect(candidates(s)[0].careerId).toBe('allround');
  });

  it('아무 데도 맞지 않으면 쉼표', () => {
    expect(candidates(grad({ stats: statsAll(10) }))[0].careerId).toBe('gap');
  });

  it('직업 id는 겹치지 않고 후기는 세 단계', () => {
    expect(new Set(CAREERS.map((c) => c.id)).size).toBe(CAREERS.length);
    for (const c of CAREERS) expect(c.epilogue).toHaveLength(3);
  });
});

describe('끝까지 키우기', () => {
  const ALL: [PlaceId, string][] = PLACES.flatMap((p) => p.stages.flatMap((st) => st.acts.map((a) => [p.id, a.id] as [PlaceId, string])));

  it('아무렇게나 키워도 144달 뒤 진로가 하나 이상 나온다', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const r = rnd(seed);
      const plan = Array.from({ length: 20 }, () => ALL[Math.floor(r() * ALL.length)]);
      const s = play(seed, plan);
      expect(s.turn).toBe(TOTAL_TURNS);
      const list = candidates(s);
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(3);
      expect(finish(s, list[0].careerId).ok).toBe(true);
    }
  });

  it('코딩을 꾸준히 판 아이는 개발자 3등급에 닿는다', () => {
    const s = play(3, [['academy', 'coding'], ['academy', 'math'], ['room', 'homework'], ['room', 'study'], ['room', 'cram'], ['classroom', 'class'], ['club', 'codeclub'], ['club', 'project'], ['media', 'video']]);
    const dev = candidates(s).find((c) => c.careerId === 'dev');
    expect(dev?.tier).toBe(3);
    expect(topFields(s, 1)[0].field).toBe('it');
  });

  it('몸만 쓴 아이는 운동 쪽으로 간다', () => {
    const s = play(5, [['field', 'soccer'], ['field', 'sportsday'], ['field', 'run'], ['room', 'workout'], ['classroom', 'play']]);
    const ids = candidates(s).map((c) => c.careerId);
    expect(ids).toContain('athlete');
  });
});

describe('친구', () => {
  it('같은 분야 활동을 하면 그 친구와 가까워지고, 처음엔 알게 됐다고 알려 준다', () => {
    const s = { ...make(), money: 10, friends: { ...make().friends, seoyeon: 4 } };
    const r = doActivity(s, 'academy', 'artclass');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.friends.seoyeon).toBeGreaterThan(4);
    expect(r.state.friends.doyun).toBe(0);
    expect(r.report.lines.some((l) => l.includes('서연'))).toBe(true);
  });

  it('친밀도가 문턱을 넘으면 그 달엔 친구 사건이 먼저 나온다', () => {
    const s = { ...make(), friends: { ...make().friends, doyun: 29 } };
    const r = doActivity(s, 'field', 'soccer');
    expect(r.ok && r.state.pending).toBe('friend-doyun-1');
    if (!r.ok) return;
    const done = resolveEvent(r.state, 0);
    expect(done.ok && done.state.friends.doyun).toBeGreaterThan(r.state.friends.doyun);
  });

  it('친구 사건은 단계마다 한 번만', () => {
    const s = { ...make(), friends: { ...make().friends, doyun: 50 }, eventSeen: { 'friend-doyun-1': 3 } };
    const r = doActivity(s, 'room', 'rest');
    expect(r.ok && r.state.pending).not.toBe('friend-doyun-1');
  });

  it('같은 분야 단짝이 있으면 진로 점수가 조금 오른다', () => {
    const g = { ...make(), turn: TOTAL_TURNS, pending: null, stats: { know: 40, logic: 40, create: 70, express: 50, body: 30, craft: 50, social: 40 }, fields: { ...make().fields, art: 60 } };
    const alone = scoreCareer(g, careerById('designer')!)!.score;
    const withBff = scoreCareer({ ...g, friends: { ...g.friends, seoyeon: 80 } }, careerById('designer')!)!.score;
    expect(withBff).toBe(alone + 3);
  });
});

describe('블록 마을', () => {
  it('학교급마다 건물 4채가 캔버스 안에 서고, 문 앞 자리는 칸 안에 있다', async () => {
    const { buildWorld, doorX, COLS, PLACE_SLOT, SLOT_W } = await import('../src/games/growup/world');
    for (const stage of [0, 1, 2] as const) {
      const { buildings } = buildWorld(stage, stage * 3 + 3);
      expect(buildings.map((b) => b.place)).toEqual(PLACES.map((p) => p.id));
      for (const b of buildings) expect(b.top).toBeGreaterThanOrEqual(0);
    }
    expect(buildWorld(0, 0).buildings.find((b) => b.place === 'maker')!.open).toBe(false);
    expect(buildWorld(1, 6).buildings.find((b) => b.place === 'maker')!.open).toBe(true);
    for (const p of PLACES.map((x) => x.id)) {
      const x = doorX(p);
      expect(x).toBeGreaterThan(PLACE_SLOT[p] * SLOT_W);
      expect(x).toBeLessThan((PLACE_SLOT[p] + 1) * SLOT_W);
      expect(x).toBeLessThan(COLS);
    }
  });
  it('학교는 학교급이 오를수록 높아진다', async () => {
    const { buildWorld } = await import('../src/games/growup/world');
    const tops = ([0, 1, 2] as const).map((st) => buildWorld(st, st * 3).buildings.find((b) => b.place === 'classroom')!.top);
    expect(tops[0]).toBeGreaterThan(tops[1]);
    expect(tops[1]).toBeGreaterThan(tops[2]);
  });
});
