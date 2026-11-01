import { useEffect, useRef, useState } from 'react';
import { GRID_SIZES, PALETTE, PRESETS, PixelGrid, blankGrid, floodFill, gridToDataUrl, imageToGrid, presetGrid, resizeGrid } from './pixelart';

type Tool = 'pen' | 'eraser' | 'fill' | 'pick';

interface Props {
  /** 이어서 그릴 그림(작은 data URL) — 없으면 프리셋 1번에서 시작 */
  from?: string | null;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

/**
 * 픽셀 편집기 — 16·24·32칸. 좌우 대칭 그리기로 얼굴을 쉽게 그린다.
 * 마우스·터치로 끌어서 칠하고, 결과는 그 크기 그대로의 png 로 저장한다(화면에서는 또렷하게 확대).
 */
export function PixelEditor({ from, onSave, onClose }: Props) {
  const [grid, setGrid] = useState<PixelGrid>(() => presetGrid(PRESETS[0]));
  const [color, setColor] = useState(PALETTE[0]);
  const [tool, setTool] = useState<Tool>('pen');
  const [mirror, setMirror] = useState(true);
  const [undo, setUndo] = useState<PixelGrid[]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (!from || from.startsWith('preset:')) {
      const p = PRESETS.find((x) => `preset:${x.id}` === from);
      if (p) setGrid(presetGrid(p));
      return;
    }
    imageToGrid(from).then((g) => { if (g) setGrid(g); });
  }, [from]);

  /* 칸과 격자선을 그린다 */
  const CELL = Math.floor(320 / grid.w);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = grid.w * CELL;
    const H = grid.h * CELL;
    for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#3a3648' : '#2e2b3a';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      const c = grid.px[y * grid.w + x];
      if (c) { ctx.fillStyle = c; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= grid.w; i++) { ctx.beginPath(); ctx.moveTo(i * CELL + 0.5, 0); ctx.lineTo(i * CELL + 0.5, H); ctx.stroke(); }
    for (let j = 0; j <= grid.h; j++) { ctx.beginPath(); ctx.moveTo(0, j * CELL + 0.5); ctx.lineTo(W, j * CELL + 0.5); ctx.stroke(); }
    if (mirror) {
      ctx.strokeStyle = 'rgba(255,194,61,0.5)';
      ctx.beginPath(); ctx.moveTo(W / 2 + 0.5, 0); ctx.lineTo(W / 2 + 0.5, H); ctx.stroke();
    }
  }, [grid, CELL, mirror]);

  const cellAt = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * grid.w);
    const y = Math.floor(((e.clientY - r.top) / r.height) * grid.h);
    return x >= 0 && y >= 0 && x < grid.w && y < grid.h ? [x, y] as const : null;
  };

  const paint = (x: number, y: number, g: PixelGrid): PixelGrid => {
    const c = tool === 'eraser' ? '' : color;
    const px = [...g.px];
    px[y * g.w + x] = c;
    if (mirror) px[y * g.w + (g.w - 1 - x)] = c;
    return { ...g, px };
  };

  const down = (e: React.PointerEvent) => {
    const at = cellAt(e);
    if (!at) return;
    const [x, y] = at;
    if (tool === 'pick') { const c = grid.px[y * grid.w + x]; if (c) { setColor(c); setTool('pen'); } return; }
    setUndo((u) => [...u.slice(-29), grid]);
    if (tool === 'fill') { setGrid((g) => floodFill(g, x, y, color)); return; }
    drawing.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setGrid((g) => paint(x, y, g));
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const at = cellAt(e);
    if (at) setGrid((g) => paint(at[0], at[1], g));
  };
  const up = () => { drawing.current = false; };

  const change = (g: PixelGrid) => { setUndo((u) => [...u.slice(-29), grid]); setGrid(g); };

  return (
    <div className="gu-editor">
      <div className="gu-editor-top">
        <canvas ref={canvas} width={grid.w * CELL} height={grid.h * CELL} className="gu-editor-canvas"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <div className="gu-editor-preview">
          <span className="gu-muted small">미리보기</span>
          <img src={gridToDataUrl(grid)} alt="" className="gu-editor-big" />
          <img src={gridToDataUrl(grid)} alt="" className="gu-editor-small" />
        </div>
      </div>

      <div className="gu-editor-tools" role="group" aria-label="도구">
        {([['pen', '✏️ 펜'], ['eraser', '🧽 지우개'], ['fill', '🪣 채우기'], ['pick', '💧 색 집기']] as const).map(([k, l]) => (
          <button key={k} className={tool === k ? 'on' : ''} aria-pressed={tool === k} onClick={() => setTool(k)}>{l}</button>
        ))}
        <button className={mirror ? 'on' : ''} aria-pressed={mirror} onClick={() => setMirror(!mirror)}>🪞 좌우 대칭</button>
        <button disabled={!undo.length} onClick={() => { setGrid(undo[undo.length - 1]); setUndo((u) => u.slice(0, -1)); }}>↩ 되돌리기</button>
      </div>

      <div className="gu-palette" role="group" aria-label="색">
        {PALETTE.map((c) => (
          <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} aria-label={c} onClick={() => { setColor(c); if (tool === 'eraser' || tool === 'pick') setTool('pen'); }} />
        ))}
        <label className="gu-palette-custom" title="다른 색">
          <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setTool('pen'); }} />
          <span style={{ background: color }} />
        </label>
      </div>

      <div className="gu-editor-row">
        <span className="gu-muted small">크기</span>
        {GRID_SIZES.map((n) => (
          <button key={n} className={`gu-mini ${grid.w === n ? 'on' : ''}`} onClick={() => change(resizeGrid(grid, n))}>{n}×{n}</button>
        ))}
        <span className="gu-muted small">시작 그림</span>
        {PRESETS.map((p) => (
          <button key={p.id} className="gu-mini" onClick={() => change(resizeGrid(presetGrid(p), grid.w))}>{p.name}</button>
        ))}
        <button className="gu-mini" onClick={() => change(blankGrid(grid.w))}>빈 종이</button>
      </div>

      <div className="gu-four two">
        <button className="gu-choice primary" onClick={() => onSave(gridToDataUrl(grid))}><span className="gu-choice-body"><strong>💾 이 그림으로 초상 정하기</strong></span></button>
        <button className="gu-choice" onClick={onClose}><span className="gu-choice-body"><strong>취소</strong></span></button>
      </div>
    </div>
  );
}
