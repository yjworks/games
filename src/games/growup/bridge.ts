import type { Expression } from './engine';
import type { Outcome } from './types';

/**
 * 게임 밖으로 내보내는 신호. window 의 CustomEvent('growup:bridge') 로만 쏜다.
 * 로봇(파이보·파이브레인 등)이나 다른 화면이 이 이벤트를 받아
 * 표정·동작·음성으로 따라 하게 붙이는 자리다. 게임은 받는 쪽이 있는지 모른다.
 *
 * 반대 방향(기기 버튼 → 게임)은 input.ts 의 'growup:input' 이벤트로 들어온다.
 * `choices` 는 지금 화면에서 버튼 ①~④가 무엇을 뜻하는지 — 버튼 옆 LED·소리 안내에 쓸 수 있다.
 */
export type BridgeEvent =
  | { type: 'screen'; screen: string; choices: string[] }
  | { type: 'turn'; when: string; place?: string; act?: string; outcome: Outcome | 'sick'; expression: Expression }
  | { type: 'event'; id: string; title: string }
  | { type: 'ending'; careerId: string; title: string; tier: number };

export const BRIDGE_EVENT = 'growup:bridge';

export function emit(e: BridgeEvent): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(BRIDGE_EVENT, { detail: e }));
  } catch { /* 받는 쪽 오류가 게임을 멈추지 않게 한다 */ }
}
