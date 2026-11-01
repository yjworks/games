import { create } from 'zustand';
import { createStore } from '../../shared/storage';
import { clearProgress, setProgress } from '../../shared/progress';
import { sfx } from '../../shared/sound';
import { careerById } from './careers';
import { NewGameOpts, WakeResult, accrue, expression, fill, newGame, pendingEvent, progressLabel, toClassic } from './engine';
import { Flow, Step, goto as gotoPlace, press as step, settle } from './flow';
import type { Button } from './input';
import { emit } from './bridge';
import { GameState, PlaceId } from './types';
import { Uploads, loadUploads, saveUpload } from './portraits';

const store = createStore('growup');
const SAVE_KEY = 'save';
const DEX_KEY = 'dex';

/** 엔딩 도감: 직업 id → 가장 높게 본 등급 */
export type Dex = Record<string, number>;

function loadSave(): GameState | null {
  const s = store.get<GameState | null>(SAVE_KEY, null);
  if (!s || s.v !== 4 || typeof s.turn !== 'number' || !s.stats) return null;
  return s;
}

interface State {
  game: GameState | null;
  /** 지금 화면 — 저장하지 않는다(다시 열면 settle 로 이어서) */
  flow: Flow;
  dex: Dex;
  dexOpen: boolean;
  /** 내 수첩(능력치·친구·기록) 창 */
  notebookOpen: boolean;
  setNotebook: (open: boolean) => void;
  /** 플레이어가 올린 초상 그림 */
  uploads: Uploads;
  setUpload: (key: string, dataUrl: string | null) => void;
  toast: { text: string; key: number } | null;
  /** 화면이 연출(걷기 등) 중이면 버튼을 잠깐 받지 않는다 */
  busy: boolean;
  start: (opts: Omit<NewGameOpts, 'seed' | 'now'>) => void;
  /** 버튼 ①~④·뒤로 — 모든 진행은 이 하나로 한다 */
  press: (b: Button) => void;
  /** 화면에서 장소를 바로 눌렀을 때 */
  goto: (place: PlaceId) => void;
  setBusy: (v: boolean) => void;
  setDex: (open: boolean) => void;
  /** 키우기 모드: 지난 시간만큼 행동력을 채운다 */
  wake: () => WakeResult | null;
  toClassic: () => void;
  /** 저장을 지우고 처음 화면으로 */
  reset: () => void;
}

export const useGrow = create<State>()((set, get) => {
  const first = loadSave();

  function save(game: GameState) {
    set({ game });
    store.set(SAVE_KEY, game);
    setProgress('growup', progressLabel(game));
  }

  function toast(text: string) {
    set({ toast: { text, key: Date.now() } });
  }

  function apply(flow: Flow, game: GameState, r: Step) {
    if (r.toast) { sfx.alert(); toast(r.toast); }
    if (r.game !== game) save(r.game);
    set({ flow: r.flow });
    const fx = r.fx;
    if (!fx) { if (r.flow !== flow && !r.toast) sfx.tap(); return; }
    switch (fx.kind) {
      case 'month': {
        const o = fx.report.outcome;
        if (o === 'great') sfx.win(); else if (o === 'fail') sfx.lose(); else if (o === 'sick') sfx.undo(); else sfx.place();
        emit({ type: 'turn', when: fx.report.when, place: fx.report.place, act: fx.report.act, outcome: o, expression: expression(r.game) });
        const ev = pendingEvent(r.game);
        if (ev) emit({ type: 'event', id: ev.id, title: fill(ev.title, r.game.name) });
        break;
      }
      case 'quiz':
        if (fx.correct) sfx.levelUp(); else sfx.lose();
        break;
      case 'choice':
        sfx.tap();
        break;
      case 'finish': {
        const tier = r.game.ending?.tier ?? 1;
        const dex = { ...get().dex };
        dex[fx.careerId] = Math.max(dex[fx.careerId] ?? 0, tier);
        store.set(DEX_KEY, dex);
        set({ dex });
        sfx.win();
        emit({ type: 'ending', careerId: fx.careerId, title: careerById(fx.careerId)?.title ?? fx.careerId, tier });
        break;
      }
      case 'newGame':
        get().reset();
        break;
      case 'dex':
        set({ dexOpen: true });
        break;
    }
  }

  return {
    game: first,
    flow: first ? settle(first) : { s: 'town' },
    dex: store.get<Dex>(DEX_KEY, {}),
    dexOpen: false,
    notebookOpen: false,
    setNotebook: (notebookOpen) => set({ notebookOpen }),
    uploads: loadUploads(),
    setUpload: (key, url) => set({ uploads: saveUpload(key, url) }),
    toast: null,
    busy: false,

    start: (opts) => {
      const game = newGame({ ...opts, now: Date.now() });
      sfx.levelUp();
      set({ flow: { s: 'town' } });
      save(game);
    },

    goto: (place) => {
      const { game, flow, busy } = get();
      if (!game || busy) return;
      apply(flow, game, gotoPlace(flow, game, place));
    },

    press: (b) => {
      const { game, flow, busy } = get();
      if (!game || busy) return;
      apply(flow, game, step(flow, game, b));
    },
    setBusy: (busy) => set({ busy }),
    setDex: (dexOpen) => set({ dexOpen }),

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

    reset: () => {
      store.remove(SAVE_KEY);
      clearProgress('growup');
      set({ game: null, flow: { s: 'town' }, busy: false });
    },
  };
});
