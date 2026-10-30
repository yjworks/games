import type { Expression } from './engine';
import type { Outcome } from './types';

/**
 * 게임 밖으로 내보내는 신호. 지금은 window 의 CustomEvent('growup:bridge') 로만 쏜다.
 * 나중에 로봇(파이보·파이브레인 등)이나 다른 화면이 이 이벤트를 받아
 * 표정·동작·음성으로 따라 하게 붙이는 자리다. 게임은 받는 쪽이 있는지 모른다.
 */
export type BridgeEvent =
  | { type: 'turn'; when: string; place?: string; act?: string; outcome: Outcome | 'sick'; expression: Expression }
  | { type: 'event'; id: string; title: string }
  | { type: 'care'; kind: string; expression: Expression }
  | { type: 'ending'; careerId: string; title: string; tier: number };

export const BRIDGE_EVENT = 'growup:bridge';

export function emit(e: BridgeEvent): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(BRIDGE_EVENT, { detail: e }));
  } catch { /* 받는 쪽 오류가 게임을 멈추지 않게 한다 */ }
}
