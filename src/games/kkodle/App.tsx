import { useEffect, useMemo, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { kkodleTutorial } from './tutorial';
import { useKkodle } from './store';
import { MAX_TRIES, SLOTS, SlotResult, shareGrid, toSlots } from './engine';
import { KEY_ROWS, toJamoKey } from './keyboard';
import { todayKey } from '../../shared/daily';

const meta = gameById('kkodle');

interface Cell {
  jamo: string;
  /** 칸에 입힐 클래스 (채점 전에는 색을 입히지 않는다) */
  cls: string;
}

const EMPTY_ROW: Cell[] = Array.from({ length: SLOTS }, () => ({ jamo: '', cls: '' }));

/** 채점이 끝난 줄 */
const scoredCells = (result: SlotResult[]): Cell[] =>
  result.map((r) => ({ jamo: r.jamo, cls: r.state }));

/** 입력 중인 줄 — 조합 중인 글자를 자모 칸에 그대로 보여준다 */
function inputCells(input: string): Cell[] {
  const slots = toSlots(input);
  return Array.from({ length: SLOTS }, (_, i) => {
    const jamo = slots[i] ?? '';
    return { jamo, cls: jamo ? 'filled' : '' };
  });
}

/** 여섯 칸을 3 + 간격 + 3으로 그린다 */
function Row({ cells, shake }: { cells: Cell[]; shake?: boolean }) {
  const draw = (i: number) => (
    <div key={i} className={`kk-cell ${cells[i]?.cls ?? ''}`.trim()}>{cells[i]?.jamo ?? ''}</div>
  );
  return (
    <div className={`kk-row${shake ? ' shake' : ''}`}>
      {[0, 1, 2].map(draw)}
      <div className="kk-gap" />
      {[3, 4, 5].map(draw)}
    </div>
  );
}

export default function App() {
  const mode = useKkodle((s) => s.mode);
  const rows = useKkodle((s) => s.rows);
  const input = useKkodle((s) => s.input);
  const status = useKkodle((s) => s.status);
  const answer = useKkodle((s) => s.answer);
  const keyStates = useKkodle((s) => s.keyStates);
  const message = useKkodle((s) => s.message);
  const shake = useKkodle((s) => s.shake);
  const streak = useKkodle((s) => s.streak);
  const bestStreak = useKkodle((s) => s.bestStreak);
  const setMode = useKkodle((s) => s.setMode);
  const pushJamo = useKkodle((s) => s.pushJamo);
  const backspace = useKkodle((s) => s.backspace);
  const submit = useKkodle((s) => s.submit);
  const newFreeGame = useKkodle((s) => s.newFreeGame);
  const shareResult = useKkodle((s) => s.shareResult);

  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (status !== 'playing') {
      const t = setTimeout(() => setShowResult(true), 450);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status, mode]);

  /* 물리 키보드 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(); return; }
      const jamo = toJamoKey(e.key);
      if (jamo) { e.preventDefault(); pushJamo(jamo); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pushJamo, backspace, submit]);

  const board = useMemo(() => {
    const list: { cells: Cell[]; shake?: boolean }[] = [];
    for (const r of rows) list.push({ cells: scoredCells(r.result) });
    if (status === 'playing') list.push({ cells: inputCells(input), shake: true });
    while (list.length < MAX_TRIES) list.push({ cells: EMPTY_ROW });
    return list;
  }, [rows, input, status]);

  const won = status === 'won';

  return (
    <GameShell
      meta={meta}
      tutorial={kkodleTutorial}
      actions={
        status !== 'playing' ? (
          <button className="db-btn shell-btn" onClick={() => setShowResult(true)} aria-label="결과 보기">결과</button>
        ) : undefined
      }
    >
      <div className="kk-root">
        <div className="kk-top">
          <div className="kk-modes">
            <button aria-pressed={mode === 'daily'} onClick={() => setMode('daily')}>오늘의 문제</button>
            <button aria-pressed={mode === 'free'} onClick={() => setMode('free')}>무한</button>
          </div>
          <div className="kk-streak">
            {mode === 'daily' ? (
              <>
                <span>연속 <strong>{streak}</strong>일</span>
                <span>최고 <strong>{bestStreak}</strong>일</span>
              </>
            ) : (
              <span>{rows.length}/{MAX_TRIES}회</span>
            )}
          </div>
        </div>

        <div className="kk-board center-scroll">
          {board.map((r, i) => (
            <Row key={`${i}-${r.shake ? shake : 'x'}`} cells={r.cells} shake={r.shake && shake > 0} />
          ))}
        </div>

        <div className="kk-message" aria-live="polite">{message}</div>

        <div className="kk-keyboard">
          {KEY_ROWS.map((row, i) => (
            <div className="kk-krow" key={i}>
              {i === KEY_ROWS.length - 1 && (
                <button className="kk-key wide" onClick={backspace} aria-label="지우기">⌫</button>
              )}
              {row.map((k) => (
                <button
                  key={k}
                  className={`kk-key ${keyStates[k] ?? ''}`}
                  onClick={() => pushJamo(k)}
                  aria-label={k}
                >
                  {k}
                </button>
              ))}
              {i === KEY_ROWS.length - 1 && (
                <button className="kk-key wide" onClick={submit} aria-label="제출">입력</button>
              )}
            </div>
          ))}
        </div>

        {showResult && status !== 'playing' && (
          <div className="kk-result fade-in" role="dialog" aria-modal="true" aria-label="결과">
            <div className="kk-result-box pop-in">
              <div style={{ fontSize: '2rem' }}>{won ? '🎉' : '😵'}</div>
              <h2>{won ? `${rows.length}번 만에 맞혔어요` : '다음 기회에'}</h2>
              <div className="kk-answer">{answer}</div>
              <div className="kk-grid-preview">{shareGrid(rows.map((r) => r.result))}</div>
              {mode === 'daily' && (
                <p>
                  연속 {streak}일 · 최고 {bestStreak}일<br />
                  다음 문제는 내일 ({todayKey()} 기준)
                </p>
              )}
              <button className="kk-btn" onClick={() => void shareResult()}>결과 복사</button>
              <div className="kk-btn-row">
                {mode === 'daily' ? (
                  <button className="kk-btn ghost" onClick={() => { setMode('free'); setShowResult(false); }}>
                    무한 모드로
                  </button>
                ) : (
                  <button className="kk-btn ghost" onClick={() => { newFreeGame(); setShowResult(false); }}>
                    새 낱말
                  </button>
                )}
                <button className="kk-btn ghost" onClick={() => setShowResult(false)}>닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
