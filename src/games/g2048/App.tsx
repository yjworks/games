import { useEffect, useRef } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { g2048Tutorial } from './tutorial';
import { bestScore, maxTile, use2048 } from './store';
import { Dir, SIZE, Tile } from './engine';

const meta = gameById('g2048');

/** 칸 좌표 → 판 안에서의 위치 */
const pos = (n: number) => `calc(var(--tw-gap) + ${n} * (var(--tw-cell) + var(--tw-gap)))`;

function TileView({ tile, fading }: { tile: Tile; fading?: boolean }) {
  const cls = [
    'tw-tile',
    tile.value > 2048 ? 'big' : '',
    tile.isNew ? 'pop' : '',
    tile.merged ? 'merge' : '',
  ].join(' ').trim();
  const digits = String(tile.value).length;
  return (
    <div
      className={cls}
      data-v={tile.value}
      style={{
        transform: `translate(${pos(tile.c)}, ${pos(tile.r)})`,
        left: 0,
        top: 0,
        fontSize: `calc(var(--tw-cell) * ${digits <= 2 ? 0.44 : digits === 3 ? 0.36 : 0.28})`,
        zIndex: fading ? 1 : 2,
        opacity: fading ? 0.999 : 1,
      }}
      aria-hidden={fading}
    >
      {tile.value}
    </div>
  );
}

export default function App() {
  const tiles = use2048((s) => s.tiles);
  const fading = use2048((s) => s.fading);
  const score = use2048((s) => s.score);
  const status = use2048((s) => s.status);
  const historyDepth = use2048((s) => s.history.length);
  const slide = use2048((s) => s.slide);
  const undo = use2048((s) => s.undo);
  const restart = use2048((s) => s.restart);
  const continueGame = use2048((s) => s.continueGame);
  const best = bestScore();

  /* 키보드 */
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      w: 'up', s: 'down', a: 'left', d: 'right',
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const dir = map[e.key];
      if (dir) { e.preventDefault(); slide(dir); return; }
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); restart(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slide, undo, restart]);

  /* 쓸어넘기기 */
  const touch = useRef({ x: 0, y: 0, active: false });
  const onStart = (e: React.PointerEvent) => {
    touch.current = { x: e.clientX, y: e.clientY, active: true };
  };
  const onEnd = (e: React.PointerEvent) => {
    if (!touch.current.active) return;
    touch.current.active = false;
    const dx = e.clientX - touch.current.x;
    const dy = e.clientY - touch.current.y;
    const threshold = 24;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) slide(dx > 0 ? 'right' : 'left');
    else slide(dy > 0 ? 'down' : 'up');
  };

  const slots = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      slots.push(
        <div key={`${r}-${c}`} className="tw-slot"
          style={{ transform: `translate(${pos(c)}, ${pos(r)})`, left: 0, top: 0 }} />
      );
    }
  }

  return (
    <GameShell
      meta={meta}
      tutorial={g2048Tutorial}
      actions={<button className="db-btn shell-btn" onClick={restart} aria-label="새 게임">새 게임</button>}
    >
      <div className="tw-root">
        <div className="tw-stats">
          <div className="tw-stat"><span>점수</span><strong>{score.toLocaleString()}</strong></div>
          <div className="tw-stat"><span>최고</span><strong>{best ? best.value.toLocaleString() : 0}</strong></div>
          <div className="tw-stat"><span>최대 타일</span><strong>{maxTile(tiles)}</strong></div>
        </div>

        <div className="tw-board-wrap">
          <div
            className="tw-board"
            onPointerDown={onStart}
            onPointerUp={onEnd}
            onPointerCancel={() => { touch.current.active = false; }}
            aria-label="2048 판"
          >
            {slots}
            {fading.map((t) => <TileView key={`f${t.id}`} tile={t} fading />)}
            {tiles.map((t) => <TileView key={t.id} tile={t} />)}
          </div>

          {status !== 'playing' && (
            <div className="tw-overlay fade-in">
              <h2>{status === 'won' ? '2048 달성!' : '더 움직일 수 없어요'}</h2>
              <p>
                {score.toLocaleString()}점 · 최대 타일 {maxTile(tiles)}
                {best && status === 'over' ? <><br />최고 점수 {best.value.toLocaleString()}</> : null}
              </p>
              {status === 'won' ? (
                <button className="tw-btn" onClick={continueGame}>계속하기</button>
              ) : (
                <button className="tw-btn" onClick={restart}>새 게임</button>
              )}
              {status === 'won' && (
                <button className="tw-btn ghost" onClick={restart}>새 게임</button>
              )}
            </div>
          )}
        </div>

        <div className="tw-controls">
          <button onClick={undo} disabled={historyDepth === 0}>↩ 되돌리기</button>
          <button onClick={restart}>⟳ 새 게임</button>
        </div>

        <p className="tw-hint">
          <span className="touch-only">쓸어넘겨 미세요</span>
          <span className="kbd-only">방향키로 미세요 · 화면을 끌어도 됩니다</span>
        </p>
      </div>
    </GameShell>
  );
}
