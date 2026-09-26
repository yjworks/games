import { useCallback, useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { breakoutTutorial } from './tutorial';
import { BreakoutGame, Hud } from './game';
import { FIELD_H, FIELD_W, PADDLE_H, PADDLE_Y } from './engine';
import { getBest, submitBest } from '../../shared/records';
import { shade } from '../../shared/color';

const meta = gameById('breakout');

/* 줄마다 색이 다르다 — 어디를 깨고 있는지 한눈에 보이게 */
const ROW_COLORS = [
  '#ff6b6b', '#ff9f45', '#ffd166', '#7bd88f',
  '#5eead4', '#4cc9f0', '#8b9cff', '#c084fc',
];
const rowColor = (row: number) => ROW_COLORS[row % ROW_COLORS.length];

const ITEM_COLORS: Record<string, string> = { wide: '#4ade80', slow: '#60a5fa', multi: '#fbbf24' };
const ITEM_MARK: Record<string, string> = { wide: '넓', slow: '느', multi: '멀' };
const EFFECT_LABEL: Record<string, string> = { wide: '넓은 패들', slow: '느린 공', multi: '멀티볼' };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BreakoutGame | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [best, setBest] = useState(() => getBest('breakout', 'score'));
  /* 공마다 지나온 자리를 조금 기억해 꼬리를 그린다 (연출 전용) */
  const trails = useRef(new WeakMap<object, { x: number; y: number }[]>());

  if (!gameRef.current) gameRef.current = new BreakoutGame();
  const game = gameRef.current;

  useEffect(() => {
    game.onHud = (h) => {
      setHud(h);
      if (h.status === 'over') {
        submitBest('breakout', 'score', h.score, `${h.score.toLocaleString()}점 · ${h.level}판`, true);
        submitBest('breakout', 'default', h.score, `${h.score.toLocaleString()}점 · ${h.level}판`, true);
        setBest(getBest('breakout', 'score'));
      }
    };
    setHud(game.hud());
  }, [game]);

  /* 그리기 + 진행 */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      const scale = (canvas.width / FIELD_W);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, FIELD_W, FIELD_H);

      /* 바탕 — 위쪽이 밝은 밤하늘 */
      const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
      bg.addColorStop(0, '#12232b');
      bg.addColorStop(0.45, '#0b161d');
      bg.addColorStop(1, '#070f14');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      const glow = ctx.createRadialGradient(FIELD_W / 2, 40, 10, FIELD_W / 2, 40, FIELD_W * 0.9);
      glow.addColorStop(0, 'rgba(94, 234, 212, 0.10)');
      glow.addColorStop(1, 'rgba(94, 234, 212, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, FIELD_W, FIELD_H);

      /* 벽돌 — 줄마다 색, 맞을수록 어두워지고 금이 간다 */
      for (const b of game.bricks) {
        const base = rowColor(b.row);
        const worn = b.tone > 1 ? b.hp / b.tone : 1;
        const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
        grad.addColorStop(0, shade(base, 0.22 * worn));
        grad.addColorStop(1, shade(base, -0.42 + 0.2 * worn));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 3);
        ctx.fill();

        /* 윗면 하이라이트 */
        ctx.fillStyle = `rgba(255,255,255,${0.3 * worn + 0.06})`;
        ctx.beginPath();
        ctx.roundRect(b.x + 1.5, b.y + 1.2, b.w - 3, 2, 1);
        ctx.fill();

        /* 남은 hp가 줄면 금 */
        if (b.tone > 1 && b.hp < b.tone) {
          ctx.strokeStyle = 'rgba(0,0,0,0.42)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(b.x + b.w * 0.3, b.y + 1);
          ctx.lineTo(b.x + b.w * 0.45, b.y + b.h * 0.6);
          ctx.lineTo(b.x + b.w * 0.35, b.y + b.h - 1);
          if (b.hp <= b.tone - 2) {
            ctx.moveTo(b.x + b.w * 0.68, b.y + 1);
            ctx.lineTo(b.x + b.w * 0.58, b.y + b.h - 1);
          }
          ctx.stroke();
        }
      }

      /* 방금 맞은 자리 번쩍임 */
      for (const f of game.flashes) {
        ctx.fillStyle = `rgba(255,255,255,${0.75 * f.life})`;
        ctx.beginPath();
        ctx.roundRect(f.x, f.y, f.w, f.h, 3);
        ctx.fill();
      }

      /* 깨진 조각 */
      for (const p of game.particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = rowColor(p.hue);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* 아이템 — 무엇인지 글자로 */
      for (const it of game.items) {
        const c = ITEM_COLORS[it.kind] ?? '#fff';
        ctx.fillStyle = c;
        ctx.shadowColor = c;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(it.x - 8, it.y - 6, 16, 12, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(10,20,18,0.9)';
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ITEM_MARK[it.kind] ?? '?', it.x, it.y + 0.5);
      }

      /* 공 꼬리 */
      for (const b of game.balls) {
        let tail = trails.current.get(b);
        if (!tail) { tail = []; trails.current.set(b, tail); }
        tail.push({ x: b.x, y: b.y });
        if (tail.length > 9) tail.shift();
        for (let i = 0; i < tail.length - 1; i++) {
          const t = (i + 1) / tail.length;
          ctx.globalAlpha = t * 0.35;
          ctx.fillStyle = '#8ef7e6';
          ctx.beginPath();
          ctx.arc(tail[i].x, tail[i].y, b.r * t * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* 패들 */
      const px = game.paddle.x - game.paddle.w / 2;
      const pg = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H);
      pg.addColorStop(0, '#f2fffd');
      pg.addColorStop(0.5, '#a9ece2');
      pg.addColorStop(1, '#4fb3a4');
      ctx.shadowColor = 'rgba(94, 234, 212, 0.55)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.roundRect(px, PADDLE_Y, game.paddle.w, PADDLE_H, PADDLE_H / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + game.paddle.w / 2 - 6, PADDLE_Y + 3.5);
      ctx.lineTo(px + game.paddle.w / 2 + 6, PADDLE_Y + 3.5);
      ctx.stroke();

      /* 공 */
      for (const b of game.balls) {
        const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, 0.5, b.x, b.y, b.r * 2.2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, '#dffaf4');
        g.addColorStop(1, 'rgba(94, 234, 212, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = now - prev;
      prev = now;
      game.update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  /* 키보드 */
  useEffect(() => {
    const held = { left: false, right: false };
    let raf = 0;
    const tick = () => {
      if (held.left) game.nudge(-1);
      if (held.right) game.nudge(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); held.left = true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); held.right = true; }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); game.togglePause(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); game.start(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') held.left = false;
      if (e.key === 'ArrowRight') held.right = false;
    };
    const blur = () => { held.left = held.right = false; game.pause(); };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [game]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) game.pause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [game]);

  /* 손가락으로 패들 옮기기 */
  const dragging = useRef(false);
  const moveTo = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    game.movePaddle(BreakoutGame.toField(clientX - rect.left, rect.width));
  }, [game]);

  const status = hud?.status ?? 'ready';

  return (
    <GameShell
      meta={meta}
      tutorial={breakoutTutorial}
      actions={
        <button className="db-btn shell-btn" onClick={() => game.togglePause()} aria-label="일시정지">
          {status === 'paused' ? '▶' : '⏸'}
        </button>
      }
    >
      <div className="bo-root">
        <div className="bo-stats">
          <span>점수 <strong>{(hud?.score ?? 0).toLocaleString()}</strong></span>
          <span>{hud?.level ?? 1}판</span>
          <span className="bo-lives">{'●'.repeat(Math.max(0, hud?.lives ?? 3))}</span>
          <span className="bo-right">
            <span className="bo-effects">
              {(hud?.effects ?? []).map((e) => (
                <span key={e.kind} className="bo-chip">{EFFECT_LABEL[e.kind]} {e.left}s</span>
              ))}
            </span>
          </span>
        </div>

        <div className="bo-stage">
          <canvas
            ref={canvasRef}
            className="bo-canvas"
            style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}`, height: '100%' }}
            aria-label="벽돌깨기 판"
            onPointerDown={(e) => { dragging.current = true; moveTo(e.clientX); }}
            onPointerMove={(e) => { if (dragging.current) moveTo(e.clientX); }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
          />

          {status !== 'playing' && (
            <div className="bo-overlay fade-in">
              {status === 'ready' && (
                <>
                  <h2>벽돌깨기</h2>
                  <p>{meta.lore.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}</p>
                  <button className="bo-btn" onClick={() => game.start()}>시작하기</button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <h2>일시정지</h2>
                  <button className="bo-btn" onClick={() => game.resume()}>이어하기</button>
                </>
              )}
              {status === 'clear' && (
                <>
                  <h2>{hud?.level ?? 1}판 통과</h2>
                  <p>점수 {(hud?.score ?? 0).toLocaleString()}</p>
                  <button className="bo-btn" onClick={() => game.nextLevel()}>다음 판</button>
                </>
              )}
              {status === 'over' && (
                <>
                  <h2>게임 오버</h2>
                  <p>
                    {(hud?.score ?? 0).toLocaleString()}점 · {hud?.level ?? 1}판까지
                    {best ? <><br />최고 {best.value.toLocaleString()}점</> : null}
                  </p>
                  <button className="bo-btn" onClick={() => game.start()}>다시 하기</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bo-controls">
          <button onPointerDown={() => game.nudge(-1)} aria-label="왼쪽">←</button>
          <button onClick={() => game.togglePause()}>{status === 'paused' ? '▶ 계속' : '⏸ 정지'}</button>
          <button onClick={() => game.start()}>⟳ 새 게임</button>
          <button onPointerDown={() => game.nudge(1)} aria-label="오른쪽">→</button>
        </div>
      </div>
    </GameShell>
  );
}
