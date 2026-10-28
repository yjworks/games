import { create } from 'zustand';
import { clearProgress, setProgress } from '../../shared/progress';
import { sfx } from '../../shared/sound';
import type { CityId } from './data/types';
import type { Result } from './engine/commands';
import { factionName } from './engine/officers';
import { loadGame, saveGame } from './engine/save';
import { DEFAULT_OPTIONS, newGame } from './engine/setup';
import type { GameState, Options } from './engine/state';
import { advance, currentHuman, endTurn, finishBattle } from './engine/turn';
import { lastActor } from './engine/commands';
import type { LogEntry } from './engine/state';

export type Screen = 'title' | 'setup' | 'game';
export type Panel = null | 'factions' | 'people' | 'report' | 'menu' | 'captives' | 'help';

interface UIState {
  screen: Screen;
  game: GameState | null;
  rev: number;
  city: CityId | null;
  panel: Panel;
  toast: { text: string; ok: boolean; at: number; by?: string | null; color?: string } | null;
  /** 이번 달 일어난 역사 사건(카드로 보여 준다) */
  events: LogEntry[];
  /** 엔진을 직접 고친 뒤 다시 그리게 한다 */
  bump: () => void;
  go: (screen: Screen) => void;
  start: (scenario: string, rulers: string[], opts?: Options) => void;
  load: (slot: number) => boolean;
  save: (slot: number) => void;
  act: (fn: (s: GameState) => Result | void, quiet?: boolean) => Result | void;
  endTurn: () => void;
  battleDone: () => void;
  select: (c: CityId | null) => void;
  open: (p: Panel) => void;
  say: (text: string, ok?: boolean) => void;
  quit: () => void;
}

function afterAdvance(s: GameState) {
  if (s.over) { clearProgress('samguk'); saveGame(s, -1); return; }
  const f = currentHuman(s);
  if (f >= 0 && !s.battle) {
    saveGame(s, -1);
    setProgress('samguk', `${s.year}년 ${s.month}월 · ${factionName(s, f)}`);
  }
}

export const useGame = create<UIState>((set, get) => ({
  screen: 'title',
  game: null,
  rev: 0,
  city: null,
  panel: null,
  toast: null,
  events: [],
  bump: () => set({ rev: get().rev + 1 }),
  go: (screen) => set({ screen }),
  start: (scenario, rulers, opts = DEFAULT_OPTIONS) => {
    const s = newGame(scenario, rulers, opts);
    advance(s);
    afterAdvance(s);
    const f = currentHuman(s);
    const cap = f >= 0 ? s.factions[f].capital : null;
    set({ game: s, screen: 'game', city: cap, panel: null, rev: get().rev + 1 });
  },
  load: (slot) => {
    const s = loadGame(slot);
    if (!s) return false;
    advance(s);
    const f = currentHuman(s);
    set({ game: s, screen: 'game', city: f >= 0 ? s.factions[f].capital : null, panel: null, rev: get().rev + 1 });
    return true;
  },
  save: (slot) => {
    const s = get().game;
    if (!s) return;
    saveGame(s, slot);
    get().say(`${slot + 1}번 칸에 저장했습니다.`);
  },
  act: (fn, quiet) => {
    const s = get().game;
    if (!s) return;
    lastActor.id = null;
    const r = fn(s);
    const by = lastActor.id;
    if (s.attacks.length) advance(s);
    if (r && !quiet) {
      const f = currentHuman(s);
      const speaker = by ?? (f >= 0 ? s.factions[f].advisor ?? s.factions[f].ruler : null);
      const color = f >= 0 ? s.factions[f].color : undefined;
      set({ toast: { text: r.msg, ok: r.ok, at: Date.now(), by: speaker, color } });
      if (r.ok) sfx.place(); else sfx.alert();
    }
    set({ rev: get().rev + 1 });
    return r;
  },
  endTurn: () => {
    const s = get().game;
    if (!s) return;
    endTurn(s);
    afterAdvance(s);
    sfx.tap();
    const f = currentHuman(s);
    const keep = get().city;
    const events = s.news.filter((n) => n.kind === 'event' && n.y === s.year && n.m === s.month);
    set({ rev: get().rev + 1, events, panel: !events.length && s.news.length ? 'report' : null, city: keep ?? (f >= 0 ? s.factions[f].capital : null) });
  },
  battleDone: () => {
    const s = get().game;
    if (!s) return;
    finishBattle(s);
    afterAdvance(s);
    set({ rev: get().rev + 1 });
  },
  select: (city) => set({ city }),
  open: (panel) => set({ panel }),
  say: (text, ok = true) => set({ toast: { text, ok, at: Date.now() } }),
  quit: () => set({ screen: 'title', game: null, panel: null, city: null }),
}));
