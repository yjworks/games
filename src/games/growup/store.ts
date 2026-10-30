import { create } from 'zustand';
import { createStore } from '../../shared/storage';
import { clearProgress, setProgress } from '../../shared/progress';
import { sfx } from '../../shared/sound';
import { careerById } from './careers';
import {
  ActResult, CareKind, CareResult, EventResult, NewGameOpts, WakeResult,
  accrue, care, doActivity, expression, finish, newGame, pendingEvent, progressLabel,
  resolveEvent, restSick, toClassic,
} from './engine';
import { emit } from './bridge';
import { GameState, PlaceId } from './types';

const store = createStore('growup');
const SAVE_KEY = 'save';
const DEX_KEY = 'dex';

/** 엔딩 도감: 직업 id → 가장 높게 본 등급 */
export type Dex = Record<string, number>;

function loadSave(): GameState | null {
  const s = store.get<GameState | null>(SAVE_KEY, null);
  if (!s || s.v !== 1 || typeof s.turn !== 'number' || !s.stats) return null;
  return s;
}

interface State {
  game: GameState | null;
  dex: Dex;
  start: (opts: Omit<NewGameOpts, 'seed' | 'now'>) => void;
  act: (place: PlaceId, act: string) => ActResult;
  rest: () => ActResult;
  choose: (idx: number) => EventResult;
  careFor: (kind: CareKind) => CareResult;
  /** 키우기 모드: 지난 시간만큼 행동력을 채운다 */
  wake: () => WakeResult | null;
  toClassic: () => void;
  finish: (careerId: string) => void;
  /** 저장을 지우고 처음 화면으로 */
  reset: () => void;
}

export const useGrow = create<State>()((set, get) => {
  function save(game: GameState) {
    set({ game });
    store.set(SAVE_KEY, game);
    setProgress('growup', progressLabel(game));
  }

  return {
    game: loadSave(),
    dex: store.get<Dex>(DEX_KEY, {}),

    start: (opts) => {
      const game = newGame({ ...opts, now: Date.now() });
      sfx.levelUp();
      save(game);
    },

    act: (place, act) => {
      const g = get().game;
      if (!g) return { ok: false, reason: '게임이 없어요' };
      const res = doActivity(g, place, act);
      if (!res.ok) { sfx.alert(); return res; }
      save(res.state);
      const o = res.report.outcome;
      if (o === 'great') sfx.win(); else if (o === 'fail') sfx.lose(); else sfx.place();
      emit({ type: 'turn', when: res.report.when, place, act, outcome: o, expression: expression(res.state) });
      announcePending(res.state);
      return res;
    },

    rest: () => {
      const g = get().game;
      if (!g) return { ok: false, reason: '게임이 없어요' };
      const res = restSick(g);
      if (!res.ok) { sfx.alert(); return res; }
      save(res.state);
      sfx.undo();
      emit({ type: 'turn', when: res.report.when, outcome: 'sick', expression: expression(res.state) });
      announcePending(res.state);
      return res;
    },

    choose: (idx) => {
      const g = get().game;
      if (!g) return { ok: false, reason: '게임이 없어요' };
      const res = resolveEvent(g, idx);
      if (!res.ok) { sfx.alert(); return res; }
      sfx.tap();
      save(res.state);
      return res;
    },

    careFor: (kind) => {
      const g = get().game;
      if (!g) return { ok: false, reason: '게임이 없어요' };
      const res = care(g, kind);
      if (!res.ok) { sfx.alert(); return res; }
      sfx.tap();
      save(res.state);
      emit({ type: 'care', kind, expression: expression(res.state) });
      return res;
    },

    wake: () => {
      const g = get().game;
      if (!g || g.mode !== 'raise') return null;
      const res = accrue(g, Date.now());
      if (res.gained > 0 || res.missed || res.state.tokenAt !== g.tokenAt || res.state.lastSeen - g.lastSeen > 60_000) {
        save(res.state);
      }
      return res;
    },

    toClassic: () => {
      const g = get().game;
      if (!g) return;
      save(toClassic(g));
    },

    finish: (careerId) => {
      const g = get().game;
      if (!g) return;
      const res = finish(g, careerId);
      if (!res.ok || !res.state.ending) return;
      const { tier } = res.state.ending;
      const dex = { ...get().dex };
      dex[careerId] = Math.max(dex[careerId] ?? 0, tier);
      store.set(DEX_KEY, dex);
      set({ dex });
      save(res.state);
      sfx.win();
      emit({ type: 'ending', careerId, title: careerById(careerId)?.title ?? careerId, tier });
    },

    reset: () => {
      store.remove(SAVE_KEY);
      clearProgress('growup');
      set({ game: null });
    },
  };
});

function announcePending(s: GameState) {
  const ev = pendingEvent(s);
  if (ev) emit({ type: 'event', id: ev.id, title: ev.title });
}
