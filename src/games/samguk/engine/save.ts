import { createStore } from '../../../shared/storage';
import { SCENARIOS } from '../data/scenarios';
import { SAVE_VERSION, type GameState } from './state';

const store = createStore('samguk');
export const SLOTS = 3;
const slotKey = (i: number) => (i < 0 ? 'auto' : `slot${i}`);

export interface SlotInfo { slot: number; label: string; at: number }

export function saveGame(s: GameState, slot: number) {
  store.set(slotKey(slot), s);
  const sc = SCENARIOS.find((x) => x.id === s.scenarioId);
  const humans = s.factions.filter((f) => f.human).map((f) => f.ruler);
  store.set(`${slotKey(slot)}-info`, {
    slot,
    label: `${s.year}년 ${s.month}월 · ${sc?.name ?? ''} · ${humans.length} 세력`,
    at: Date.now(),
  } satisfies SlotInfo);
}

export function loadGame(slot: number): GameState | null {
  const s = store.get<GameState | null>(slotKey(slot), null);
  if (!s || s.version !== SAVE_VERSION) return null;
  return s;
}

export function slotInfo(slot: number): SlotInfo | null {
  return store.get<SlotInfo | null>(`${slotKey(slot)}-info`, null);
}

export function deleteSlot(slot: number) {
  store.remove(slotKey(slot));
  store.remove(`${slotKey(slot)}-info`);
}

export function getSetting<T>(key: string, fallback: T): T { return store.get(key, fallback); }
export function setSetting(key: string, v: unknown) { store.set(key, v); }
