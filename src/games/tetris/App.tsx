import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { shade, withAlpha } from '../../shared/color';
import { submitBest, getBest } from '../../shared/records';
import { tetrisTutorial } from './tutorial';
import { TetrisGame, Hud } from './game';
import {
  COLS, HIDDEN_ROWS, KIND_LABEL, PieceKind, TOTAL_ROWS, cellsOf, spawnPiece,
} from './engine';

const meta = gameById('tetris');

const COLORS: Record<PieceKind, string> = {
  I: '#38d9e8', O: '#f6cf3f', T: '#b57bff',
  S: '#4ade80', Z: '#f87171', J: '#5b8dff', L: '#ffa14a',
};

/** 블록 하나 — 위가 밝고 아래가 어두운 사출 플라스틱처럼 그린다 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, color: string,
  opts: { alpha?: number; glow?: boolean } = {}
) {
  const { alpha = 1, glow = false } = opts;
  const pad = Math.max(1, size * 0.055);
  const r = Math.max(2, size * 0.18);
  const w = size - pad * 2;

  ctx.globalAlpha = alpha;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = size * 0.45; }

  const g = ctx.createLinearGradient(x, y + pad, x, y + size - pad);
  g.addColorStop(0, shade(color, 0.34));
  g.addColorStop(0.52, color);
  g.addColorStop(1, shade(color, -0.34));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x + pad, y + pad, w, w, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  /* 윗면 하이라이트 */
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.roundRect(x + pad + 1.5, y + pad + 1.5, Math.max(1, w - 3), Math.max(1.5, size * 0.15), r * 0.55);
  ctx.fill();

  /* 바깥선 */
  ctx.strokeStyle = 'rgba(0,0,0,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1, r);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function MiniPiece({ kind }: { kind: PieceKind | null }) {
  const cells = useMemo(() => {
    if (!kind) return new Set<string>();
    const p = spawnPiece(kind);
    return new Set(cellsOf(p).map(([x, y]) => `${x - 3},${y}`));
  }, [kind]);

  return (
    <div className="mini-grid" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => {
        const x = i % 4;
        const y = Math.floor(i / 4);
        const on = cells.has(`${x},${y}`);
        return (
          <span key={i} className={`mini-cell${on ? ' on' : ''}`}
            style={on && kind ? { background: COLORS[kind] } : undefined} />
        );
      })}
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [best, setBest] = useState(() => getBest('tetris', 'score'));
  const [newRecord, setNewRecord] = useState(false);

  if (!gameRef.current) gameRef.current = new TetrisGame();
  const game = gameRef.current;

  /* HUD 갱신은 이벤트가 있을 때만 — 매 프레임 리렌더를 피한다 */
  useEffect(() => {
    game.onHud = (h) => setHud(h);
    game.onGameOver = (h) => {
      const improved = submitBest('tetris', 'score', h.score, `${h.score.toLocaleString()}점`, true);
      setNewRecord(improved);
      setBest(getBest('tetris', 'score'));
    };
    setHud(game.hud());
  }, [game]);

  /* 렌더 루프 */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(now - prev, 100);
      prev = now;
      game.update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      /* 가로·세로 중 더 빡빡한 쪽에 맞춰 칸 크기를 정한다 */
      const dpr = window.devicePixelRatio || 1;
      const wrap = canvas.parentElement;
      const availH = wrap ? wrap.clientHeight : canvas.clientHeight;
      const availW = wrap ? wrap.clientWidth : canvas.clientWidth;
      const visibleRows = TOTAL_ROWS - HIDDEN_ROWS;
      const cellCss = Math.max(8, Math.floor(Math.min(availH / visibleRows, availW / COLS)));
      const cell = Math.floor(cellCss * dpr);
      const w = cell * COLS;
      const h = cell * visibleRows;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${cellCss * COLS}px`;
        canvas.style.height = `${cellCss * visibleRows}px`;
      }

      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#101a22');
      bg.addColorStop(1, '#080d13');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      /* 격자 */
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * cell + 0.5, 0);
        ctx.lineTo(x * cell + 0.5, h);
        ctx.stroke();
      }
      for (let y = 1; y < TOTAL_ROWS - HIDDEN_ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * cell + 0.5);
        ctx.lineTo(w, y * cell + 0.5);
        ctx.stroke();
      }

      /* 쌓인 블록 */
      for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const kind = game.grid[y][x];
          if (!kind || kind === 'G') continue;
          drawCell(ctx, x * cell, (y - HIDDEN_ROWS) * cell, cell, COLORS[kind]);
        }
      }

      /* 고스트 */
      if (game.ghost && game.status === 'playing') {
        for (const [x, y] of cellsOf(game.ghost)) {
          if (y < HIDDEN_ROWS) continue;
          const gx = x * cell;
          const gy = (y - HIDDEN_ROWS) * cell;
          const gr = Math.max(2, cell * 0.18);
          ctx.fillStyle = withAlpha(COLORS[game.ghost.kind], 0.12);
          ctx.beginPath();
          ctx.roundRect(gx + 2, gy + 2, cell - 4, cell - 4, gr);
          ctx.fill();
          ctx.globalAlpha = 0.75;
          ctx.strokeStyle = COLORS[game.ghost.kind];
          ctx.lineWidth = Math.max(1, cell * 0.07);
          ctx.beginPath();
          ctx.roundRect(gx + 2, gy + 2, cell - 4, cell - 4, gr);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      /* 현재 조각 */
      if (game.active) {
        for (const [x, y] of cellsOf(game.active)) {
          if (y < HIDDEN_ROWS) continue;
          drawCell(ctx, x * cell, (y - HIDDEN_ROWS) * cell, cell, COLORS[game.active.kind], { glow: true });
        }
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  /* 키보드 */
  useEffect(() => {
    const REPEAT: Record<string, 'left' | 'right' | 'down'> = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
    };
    const onDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(t.tagName) && e.key === ' ') return;
      const held = REPEAT[e.key];
      if (held) { e.preventDefault(); game.setHeld(held, true); return; }
      switch (e.key) {
        case 'ArrowUp': case 'x': case 'X': e.preventDefault(); game.rotate(1); break;
        case 'z': case 'Z': case 'Control': e.preventDefault(); game.rotate(-1); break;
        case ' ': e.preventDefault(); game.hardDrop(); break;
        case 'Shift': case 'c': case 'C': e.preventDefault(); game.holdPiece(); break;
        case 'p': case 'P': case 'Escape': e.preventDefault(); game.togglePause(); break;
        case 'r': case 'R': e.preventDefault(); setNewRecord(false); game.start(); break;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const held = REPEAT[e.key];
      if (held) game.setHeld(held, false);
    };
    const onBlur = () => { game.releaseAll(); game.pause(); };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [game]);

  /* 탭이 가려지면 자동 일시정지 */
  useEffect(() => {
    const onVis = () => { if (document.hidden) { game.releaseAll(); game.pause(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [game]);

  /* 스와이프 조작 */
  const touch = useRef({ x: 0, y: 0, t: 0, moved: false });
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY, t: performance.now(), moved: false };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const p = e.touches[0];
    const dx = p.clientX - touch.current.x;
    const dy = p.clientY - touch.current.y;
    const step = 26;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > step) {
      game.shift(dx > 0 ? 1 : -1);
      touch.current.x = p.clientX;
      touch.current.moved = true;
    } else if (dy > step * 2) {
      game.softDrop();
      touch.current.y = p.clientY;
      touch.current.moved = true;
    }
  };
  const onTouchEnd = () => {
    const dt = performance.now() - touch.current.t;
    if (!touch.current.moved && dt < 250) game.rotate(1);
  };

  const start = useCallback(() => { setNewRecord(false); game.start(); }, [game]);

  const status = hud?.status ?? 'ready';
  const flash = hud?.flash;

  return (
    <GameShell
      meta={meta}
      tutorial={tetrisTutorial}
      actions={
        <button className="db-btn shell-btn" onClick={() => game.togglePause()} aria-label="일시정지">
          {status === 'paused' ? '▶' : '⏸'}
        </button>
      }
    >
      <div className="tetris-root">
        <div className="tetris-stage">
          <div className="tetris-aux">
            <div className="t-panel t-panel-hold">
              <h3>홀드</h3>
              <MiniPiece kind={hud?.hold ?? null} />
            </div>

            <div className="t-panel t-panel-score">
              <div className="t-stat big"><span>점수</span><strong>{(hud?.score ?? 0).toLocaleString()}</strong></div>
              <div className="t-stat"><span>최고</span><strong>{best ? best.value.toLocaleString() : '-'}</strong></div>
              <div className="t-stat"><span>레벨</span><strong>{hud?.level ?? 1}</strong></div>
              <div className="t-stat"><span>줄</span><strong>{hud?.lines ?? 0}</strong></div>
              <div className="t-badges">
                {(hud?.combo ?? -1) > 0 && <span className="t-badge">{hud!.combo} COMBO</span>}
                {hud?.backToBack && <span className="t-badge">B2B</span>}
              </div>
            </div>

            <div className="t-panel t-panel-next">
              <h3>다음</h3>
              <div className="queue-list">
                {(hud?.queue ?? []).map((k, i) => <MiniPiece key={`${k}-${i}`} kind={k} />)}
              </div>
            </div>
          </div>

          <div className="tetris-board-wrap">
            <canvas
              ref={canvasRef}
              className="tetris-canvas"
              aria-label="테트리스 보드"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            />

            {flash && flash.kind && (
              <div className="t-flash" key={flash.at}>
                <span className="t-flash-main">{KIND_LABEL[flash.kind]}</span>
                {(flash.b2b || flash.combo > 0) && (
                  <span className="t-flash-sub">
                    {flash.b2b ? 'BACK-TO-BACK ' : ''}{flash.combo > 0 ? `${flash.combo} COMBO` : ''}
                  </span>
                )}
              </div>
            )}

            {status !== 'playing' && (
              <div className="t-overlay fade-in">
                {status === 'ready' && (
                  <>
                    <h2>테트리스</h2>
                    <p className="t-lore">
                      {meta.lore.map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
                    </p>
                    <button className="t-btn" onClick={start}>시작하기</button>
                  </>
                )}
                {status === 'paused' && (
                  <>
                    <h2>일시정지</h2>
                    <p>다시 눌러 이어서 진행</p>
                    <button className="t-btn" onClick={() => game.resume()}>이어하기</button>
                  </>
                )}
                {status === 'over' && (
                  <>
                    <h2>게임 오버</h2>
                    <p>
                      {(hud?.score ?? 0).toLocaleString()}점 · {hud?.lines ?? 0}줄 · 레벨 {hud?.level ?? 1}
                    </p>
                    {newRecord && <p style={{ color: '#22c1a4', fontWeight: 800 }}>🏅 최고 기록 경신!</p>}
                    <button className="t-btn" onClick={start}>다시 하기</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="t-touch" aria-label="터치 조작">
          <button onPointerDown={() => game.setHeld('left', true)} onPointerUp={() => game.setHeld('left', false)}
            onPointerLeave={() => game.setHeld('left', false)} aria-label="왼쪽으로">←</button>
          <button onPointerDown={() => game.rotate(-1)} aria-label="반시계 회전">↺</button>
          <button onPointerDown={() => game.rotate(1)} aria-label="시계 회전">↻</button>
          <button onPointerDown={() => game.setHeld('down', true)} onPointerUp={() => game.setHeld('down', false)}
            onPointerLeave={() => game.setHeld('down', false)} aria-label="소프트 드롭">↓</button>
          <button onPointerDown={() => game.setHeld('right', true)} onPointerUp={() => game.setHeld('right', false)}
            onPointerLeave={() => game.setHeld('right', false)} aria-label="오른쪽으로">→</button>
          <button onPointerDown={() => game.holdPiece()} aria-label="홀드" style={{ gridColumn: 'span 2' }}>홀드</button>
          <button onPointerDown={() => game.hardDrop()} aria-label="하드 드롭" style={{ gridColumn: 'span 3' }}>하드 드롭</button>
        </div>
      </div>
    </GameShell>
  );
}
