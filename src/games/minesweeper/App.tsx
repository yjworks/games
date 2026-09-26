import { useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { minesweeperTutorial } from './tutorial';
import { LEVELS, bestFor, useMinesweeper } from './store';
import { DailyToggle } from '../../shared/react/DailyToggle';
import { Level } from './engine';

const meta = gameById('minesweeper');
const LEVEL_KEYS: Level[] = ['easy', 'normal', 'hard'];
const LONG_PRESS_MS = 380;

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const mode = useMinesweeper((s) => s.mode);
  const daily = useMinesweeper((s) => s.daily);
  const doneToday = useMinesweeper((s) => s.doneToday);
  const level = useMinesweeper((s) => s.level);
  const layout = useMinesweeper((s) => s.layout);
  const status = useMinesweeper((s) => s.status);
  const flagMode = useMinesweeper((s) => s.flagMode);
  const exploded = useMinesweeper((s) => s.exploded);
  const elapsedMs = useMinesweeper((s) => s.elapsedMs);
  const version = useMinesweeper((s) => s.version);
  const hasSave = useMinesweeper((s) => s.hasSave);
  const setMode = useMinesweeper((s) => s.setMode);
  const setLevel = useMinesweeper((s) => s.setLevel);
  const setFlagMode = useMinesweeper((s) => s.setFlagMode);
  const reveal = useMinesweeper((s) => s.reveal);
  const toggleFlag = useMinesweeper((s) => s.toggleFlag);
  const chord = useMinesweeper((s) => s.chord);
  const restart = useMinesweeper((s) => s.restart);
  const resumeSaved = useMinesweeper((s) => s.resumeSaved);
  const tick = useMinesweeper((s) => s.tick);

  const [showResult, setShowResult] = useState(false);
  const spec = LEVELS[level];
  const best = bestFor(level);

  /* 타이머 — 상태를 자주 건드리지 않도록 250ms 간격 */
  const startRef = useRef(0);
  useEffect(() => {
    if (status !== 'playing') return;
    startRef.current = Date.now() - elapsedMs;
    const id = setInterval(() => tick(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tick]);

  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      const t = setTimeout(() => setShowResult(true), 400);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status]);

  useKeys({
    f: () => setFlagMode(!flagMode),
    n: () => restart(),
  });

  /* 길게 누르면 깃발 */
  const press = useRef<{ timer: number; index: number; long: boolean } | null>(null);

  const onPointerDown = (i: number) => {
    if (status === 'won' || status === 'lost') return;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.long = true;
      toggleFlag(i);
      if ('vibrate' in navigator) navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
    press.current = { timer, index: i, long: false };
  };

  const onPointerUp = (i: number) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.long || p.index !== i) return;
    const state = useMinesweeper.getState();
    if (state.layout && state.revealed[i]) chord(i);
    else reveal(i);
  };

  const onPointerCancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  const minesLeft = useMinesweeper.getState().minesLeft();
  const cells = [];
  const size = spec.cols * spec.rows;
  const { revealed, flagged } = useMinesweeper.getState();
  const over = status === 'won' || status === 'lost';

  for (let i = 0; i < size; i++) {
    const isOpen = layout ? revealed[i] === 1 : false;
    const isFlag = flagged[i] === 1;
    const isMine = layout ? layout.mines[i] === 1 : false;
    const count = layout ? layout.counts[i] : 0;

    const classes = ['ms-cell'];
    let text = '';

    if (isOpen && !isMine) {
      classes.push('open');
      if (count > 0) { classes.push(`n${count}`); text = String(count); }
    } else if (over && isMine && !isFlag) {
      classes.push(i === exploded ? 'boom' : 'mine');
      text = '💣';
    } else if (isFlag) {
      classes.push(over && !isMine ? 'wrong' : 'flag');
      text = '🚩';
    }

    cells.push(
      <button
        key={i}
        className={classes.join(' ')}
        aria-label={`${Math.floor(i / spec.cols) + 1}행 ${(i % spec.cols) + 1}열${isFlag ? ' 깃발' : isOpen ? ` ${count}` : ' 닫힘'}`}
        onPointerDown={() => onPointerDown(i)}
        onPointerUp={() => onPointerUp(i)}
        onPointerLeave={onPointerCancel}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => { e.preventDefault(); toggleFlag(i); }}
      >
        {text}
      </button>
    );
  }

  return (
    <GameShell
      meta={meta}
      tutorial={minesweeperTutorial}
      actions={<button className="db-btn shell-btn" onClick={restart} aria-label="새 판">새 판</button>}
    >
      <div
        className="ms-root"
        style={{
          ['--ms-cell' as string]:
            `clamp(18px, min((100dvh - 300px) / ${spec.rows}, (100vw - 40px) / ${spec.cols}), 44px)`,
        }}
      >
        <DailyToggle
          mode={mode}
          onChange={setMode}
          record={daily}
          doneToday={doneToday}
          freeInfo={<span>{LEVELS[level].label} {LEVELS[level].cols}×{LEVELS[level].rows}</span>}
        />

        {mode === 'free' && (
        <div className="ms-levels">
          {LEVEL_KEYS.map((k) => (
            <button key={k} aria-pressed={level === k} onClick={() => setLevel(k)}>
              {LEVELS[k].label}
              <span style={{ opacity: 0.6, fontSize: '0.66rem' }}> {LEVELS[k].cols}×{LEVELS[k].rows}</span>
            </button>
          ))}
        </div>
        )}

        <div className="ms-stats">
          <span className="ms-stat">🚩 <strong>{minesLeft}</strong></span>
          <span className="ms-stat">⏱ <strong>{formatTime(elapsedMs)}</strong></span>
          <span className="ms-right">
            {mode === 'daily' ? '오늘의 판' : best ? `최고 ${best.label.split(' ').pop()}` : '기록 없음'}
            {layout && !layout.noGuess ? ' · 추측 필요할 수 있음' : ''}
          </span>
        </div>

        <div className="ms-board-wrap">
          <div
            className="ms-board"
            role="grid"
            aria-label="지뢰찾기 판"
            style={{ gridTemplateColumns: `repeat(${spec.cols}, var(--ms-cell))` }}
            key={version}
          >
            {cells}
          </div>
        </div>

        <div className="ms-controls">
          <button aria-pressed={flagMode} onClick={() => setFlagMode(!flagMode)}>
            🚩 깃발 모드
          </button>
          {hasSave && status === 'ready' ? (
            <button onClick={resumeSaved}>▶ 이어하기</button>
          ) : (
            <button onClick={restart}>⟳ 새 판</button>
          )}
        </div>

        {showResult && over && (
          <div className="ms-result fade-in" role="dialog" aria-modal="true" aria-label="결과">
            <div className="ms-result-box pop-in">
              <div style={{ fontSize: '2.2rem' }}>{status === 'won' ? '🎉' : '💥'}</div>
              <h2>{status === 'won' ? '전부 찾았어요' : '지뢰를 밟았어요'}</h2>
              <p>
                {mode === 'daily' ? '오늘의 판' : LEVELS[level].label} · {formatTime(elapsedMs)}
                {status === 'won' && best ? <><br />최고 기록 {best.label.split(' ').pop()}</> : null}
              </p>
              <button className="ms-btn" onClick={() => { restart(); setShowResult(false); }}>
                {mode === 'daily' ? '오늘의 판 다시' : '새 판'}
              </button>
              <button className="ms-btn ghost" onClick={() => setShowResult(false)}>판 보기</button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
