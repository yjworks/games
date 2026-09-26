import { useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { nonogramTutorial } from './tutorial';
import { LEVELS, Mark, bestFor, useNonogram } from './store';
import { DailyToggle } from '../../shared/react/DailyToggle';
import { Level, lineDone } from './engine';

const meta = gameById('nonogram');
const LEVEL_KEYS: Level[] = ['easy', 'normal', 'hard'];

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const level = useNonogram((s) => s.level);
  const puzzle = useNonogram((s) => s.puzzle);
  const mode = useNonogram((s) => s.mode);
  const paintMode = useNonogram((s) => s.paintMode);
  const daily = useNonogram((s) => s.daily);
  const doneToday = useNonogram((s) => s.doneToday);
  const status = useNonogram((s) => s.status);
  const elapsedMs = useNonogram((s) => s.elapsedMs);
  const version = useNonogram((s) => s.version);
  const undoDepth = useNonogram((s) => s.undoStack.length);
  const setLevel = useNonogram((s) => s.setLevel);
  const setMode = useNonogram((s) => s.setMode);
  const setPaintMode = useNonogram((s) => s.setPaintMode);
  const paint = useNonogram((s) => s.paint);
  const beginStroke = useNonogram((s) => s.beginStroke);
  const undo = useNonogram((s) => s.undo);
  const newPuzzle = useNonogram((s) => s.newPuzzle);
  const clearMarks = useNonogram((s) => s.clearMarks);
  const tick = useNonogram((s) => s.tick);

  const [showResult, setShowResult] = useState(false);
  const marks = useNonogram.getState().marks;
  const { size, rowClues, colClues } = puzzle;
  const best = bestFor(level);

  const startRef = useRef(0);
  useEffect(() => {
    if (status !== 'playing') return;
    startRef.current = Date.now() - useNonogram.getState().elapsedMs;
    const id = setInterval(() => tick(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [status, tick, version === 0]);

  useEffect(() => {
    if (status === 'won') {
      const t = setTimeout(() => setShowResult(true), 350);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status]);

  useKeys({
    f: () => setPaintMode(paintMode === 'fill' ? 'cross' : 'fill'),
    z: () => undo(),
    n: () => newPuzzle(),
  });

  /* 누른 채 밀어서 여러 칸 칠하기 — 터치에서도 되도록 좌표로 칸을 찾는다 */
  const stroke = useRef<{ value: Mark; active: boolean }>({ value: 1, active: false });

  const cellAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const idx = el?.dataset?.index;
    return idx === undefined ? null : Number(idx);
  };

  const onPointerDown = (e: React.PointerEvent, i: number) => {
    if (status !== 'playing') return;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    const cur = marks[i];
    const want: Mark = paintMode === 'fill' ? 1 : -1;
    const value: Mark = cur === want ? 0 : want;
    stroke.current = { value, active: true };
    beginStroke();
    paint(i, value);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!stroke.current.active || status !== 'playing') return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    paint(i, stroke.current.value);
  };

  const endStroke = () => { stroke.current.active = false; };

  /* 힌트 칸 크기: 가장 긴 힌트 줄에 맞춘다 */
  const maxRowClue = Math.max(...rowClues.map((c) => c.length), 1);
  const maxColClue = Math.max(...colClues.map((c) => c.length), 1);

  const cells = [];
  cells.push(<div key="corner" className="ng-corner" />);
  for (let c = 0; c < size; c++) {
    cells.push(
      <div key={`c${c}`} className={`ng-clue col${lineDone(puzzle, marks, c, false) ? ' done' : ''}`}>
        {colClues[c].map((n, k) => <span key={k}>{n}</span>)}
      </div>
    );
  }
  for (let r = 0; r < size; r++) {
    cells.push(
      <div key={`r${r}`} className={`ng-clue${lineDone(puzzle, marks, r, true) ? ' done' : ''}`}>
        {rowClues[r].map((n, k) => <span key={k}>{n}</span>)}
      </div>
    );
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      const m = marks[i];
      const cls = ['ng-cell'];
      if (m === 1) cls.push('fill');
      if (m === -1) cls.push('cross');
      if (c % 5 === 0 && c !== 0) cls.push('b-left');
      if (r % 5 === 0 && r !== 0) cls.push('b-top');
      cells.push(
        <button
          key={i}
          data-index={i}
          className={cls.join(' ')}
          aria-label={`${r + 1}행 ${c + 1}열 ${m === 1 ? '칠함' : m === -1 ? '엑스' : '빈칸'}`}
          onPointerDown={(e) => onPointerDown(e, i)}
        >
          {m === -1 ? '✕' : ''}
        </button>
      );
    }
  }

  return (
    <GameShell
      meta={meta}
      tutorial={nonogramTutorial}
      actions={<button className="db-btn shell-btn" onClick={newPuzzle} aria-label="새 문제">새 문제</button>}
    >
      <div
        className="ng-root"
        style={{
          ['--ng-cell' as string]:
            `clamp(14px, min((100dvh - 300px) / ${size + maxColClue}, (100vw - 34px) / ${size + maxRowClue * 0.7}), 34px)`,
        }}
      >
        <DailyToggle
          mode={mode}
          onChange={setMode}
          record={daily}
          doneToday={doneToday}
          freeInfo={<span>{LEVELS[level].label} {LEVELS[level].size}×{LEVELS[level].size}</span>}
        />

        {mode === 'free' && (
        <div className="ng-levels">
          {LEVEL_KEYS.map((k) => (
            <button key={k} aria-pressed={level === k} onClick={() => setLevel(k)}>
              {LEVELS[k].label}
              <span style={{ opacity: 0.6, fontSize: '0.66rem' }}> {LEVELS[k].size}×{LEVELS[k].size}</span>
            </button>
          ))}
        </div>
        )}

        <div className="ng-stats">
          <span>⏱ <strong>{formatTime(elapsedMs)}</strong></span>
          <span className="ng-right">
            {mode === 'daily' ? '오늘의 문제' : best ? `최고 ${best.label.split(' ').pop()}` : '기록 없음'}
          </span>
        </div>

        <div className="ng-board-wrap">
          <div
            className="ng-board"
            key={version}
            style={{
              gridTemplateColumns: `calc(var(--ng-cell) * ${Math.max(maxRowClue * 0.72, 1.2)}) repeat(${size}, var(--ng-cell))`,
              gridTemplateRows: `calc(var(--ng-cell) * ${Math.max(maxColClue * 0.85, 1.2)}) repeat(${size}, var(--ng-cell))`,
            }}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          >
            {cells}
          </div>
        </div>

        <div className="ng-controls">
          <button aria-pressed={paintMode === 'fill'} onClick={() => setPaintMode('fill')}>■ 칠하기</button>
          <button aria-pressed={paintMode === 'cross'} onClick={() => setPaintMode('cross')}>✕ 표시</button>
          <button onClick={undo} disabled={undoDepth === 0}>↩ 되돌리기</button>
          <button onClick={clearMarks}>지우기</button>
        </div>

        {showResult && status === 'won' && (
          <div className="ng-result fade-in" role="dialog" aria-modal="true" aria-label="결과">
            <div className="ng-result-box pop-in">
              <div style={{ fontSize: '2.2rem' }}>🖼️</div>
              <h2>{mode === 'daily' ? '오늘의 문제 완료' : '그림을 찾았어요'}</h2>
              <p>
                {LEVELS[level].label} · {formatTime(elapsedMs)}
                {best ? <><br />최고 기록 {best.label.split(' ').pop()}</> : null}
              </p>
              <button className="ng-btn" onClick={() => { newPuzzle(); setShowResult(false); }}>새 문제</button>
              <button className="ng-btn ghost" onClick={() => setShowResult(false)}>그림 보기</button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
