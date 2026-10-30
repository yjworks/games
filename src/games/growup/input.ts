import { useEffect, useRef } from 'react';
import { emit } from './bridge';

/**
 * 버튼 4개(①~④)와 '뒤로' 하나로 게임 전체를 조작한다.
 * 파이브레인처럼 버튼 4개뿐인 기기에서도 끝까지 할 수 있게, 화면마다 선택지는 많아야 4개다.
 *
 * 입력은 세 군데서 들어온다.
 *  - 키보드 1~4(숫자패드 포함), Esc·Backspace = 뒤로
 *  - 화면 터치(각 버튼의 onClick)
 *  - 외부 기기: window 에 CustomEvent('growup:input', { detail: { button: 1~4 | 'back' } })
 *
 * 입력을 받는 화면이 바뀔 때마다 bridge 로 { type: 'screen', screen, choices } 를 내보낸다.
 * choices[i] 가 버튼 i+1 의 뜻이다(기기의 LED·음성 안내용).
 */
export type Button = 1 | 2 | 3 | 4 | 'back';

export const INPUT_EVENT = 'growup:input';

/** 입력을 받는 층 — 높은 층이 먼저 받는다. 같은 층이면 나중에 열린 쪽 */
export const LAYER = { screen: 0, popup: 1, overlay: 2 } as const;

type Handler = (b: Button) => void;
interface Entry {
  layer: number;
  seq: number;
  handler: { current: Handler };
  screen: string;
  choices: string[];
}

const entries: Entry[] = [];
let seq = 0;
let announced = '';

function top(): Entry | undefined {
  let t: Entry | undefined;
  for (const e of entries) {
    if (!t || e.layer > t.layer || (e.layer === t.layer && e.seq > t.seq)) t = e;
  }
  return t;
}

/** 지금 버튼을 받는 화면을 밖에 알린다(바뀌었을 때만) */
function announce() {
  const t = top();
  if (!t) return;
  const key = `${t.screen}|${t.choices.join('|')}`;
  if (key === announced) return;
  announced = key;
  emit({ type: 'screen', screen: t.screen, choices: t.choices });
}

function dispatch(b: Button) {
  /* 공통 도움말 창이 떠 있으면 어느 버튼이든 그 창을 닫는다 — 버튼만 있는 기기에서 갇히지 않게 */
  const tut = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.tut-overlay .tut-close') : null;
  if (tut) { tut.click(); return; }
  top()?.handler.current(b);
}

function fromKey(e: KeyboardEvent): Button | null {
  const t = e.target as HTMLElement | null;
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return null;
  if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return null;
  const n = Number(e.key);
  if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4;
  if (e.key === 'Escape' || e.key === 'Backspace') return 'back';
  return null;
}

let installed = false;
function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    const b = fromKey(e);
    if (b === null || !entries.length) return;
    e.preventDefault();
    dispatch(b);
  });
  window.addEventListener(INPUT_EVENT, (e) => {
    const b = (e as CustomEvent<{ button?: unknown }>).detail?.button;
    if (b === 1 || b === 2 || b === 3 || b === 4 || b === 'back') dispatch(b);
  });
}

/**
 * 이 화면이 떠 있는 동안 버튼 입력을 받는다. 더 높은 층(창)이 떠 있으면 그쪽이 받는다.
 * screen·choices 는 기기 쪽 안내용 — 버튼 ①~④가 지금 무엇을 뜻하는지.
 */
export function useButtons(handler: Handler, layer: number, screen: string, choices: string[]) {
  const ref = useRef(handler);
  ref.current = handler;
  const entryRef = useRef<Entry | null>(null);
  const choiceKey = choices.join('|');

  useEffect(() => {
    install();
    const entry: Entry = { layer, seq: ++seq, handler: ref, screen, choices: choiceKey.split('|') };
    entryRef.current = entry;
    entries.push(entry);
    announce();
    return () => {
      const i = entries.indexOf(entry);
      if (i >= 0) entries.splice(i, 1);
      entryRef.current = null;
      announce();
    };
    // 화면 이름이 바뀌어도 입력 순서는 그대로 둔다(아래 효과가 갱신한다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer]);

  useEffect(() => {
    const e = entryRef.current;
    if (!e) return;
    e.screen = screen;
    e.choices = choiceKey.split('|');
    announce();
  }, [screen, choiceKey]);
}

/** 외부 기기 연동용 — 버튼을 누른 것처럼 보낸다 */
export function press(button: Button) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(INPUT_EVENT, { detail: { button } }));
}
