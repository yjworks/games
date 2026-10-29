import { useEffect, useRef } from 'react';
import type { BattleState, Unit } from '../../engine/battle';
import { BattleScene, type Fx, type Overlay } from './BattleScene';

/** 3D 전장 그리기판 — 칸을 누르면 onTile, 그 밖의 모든 상태는 전투 자료를 그대로 비춘다 */
export interface Field3DProps {
  bs: BattleState;
  month: number;
  sel: number | null;
  overlays: Overlay[];
  colorOf: (u: Unit) => string;
  labelOf: (u: Unit) => string;
  onTile: (q: number, r: number) => void;
  /** 새로 생긴 연출(한 번씩만 꺼내 쓴다) */
  fxQueue: { current: Fx[] };
  tick: number;
  focus: [number, number] | null;
  onFail: () => void;
  low: boolean;
  onSlow: () => void;
}

export default function Field3D(p: Field3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<BattleScene | null>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const slow = useRef(p.onSlow);
  slow.current = p.onSlow;

  useEffect(() => {
    if (!host.current) return;
    try {
      scene.current = new BattleScene(host.current, { low: p.low, onSlow: () => slow.current() });
    } catch {
      p.onFail();
      return;
    }
    return () => { scene.current?.dispose(); scene.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    sc.setField(p.bs, p.month);
    sc.setWeather(p.bs.weather, p.month);
    sc.syncUnits(p.bs, p.colorOf, p.labelOf, p.sel, p.bs.side);
    sc.setHazards(p.bs);
    sc.setOverlays(p.overlays);
    const q = p.fxQueue.current.splice(0);
    if (q.length) sc.play(q);
  });

  useEffect(() => { if (p.focus && scene.current) scene.current.focus(p.focus[0], p.focus[1]); }, [p.focus?.[0], p.focus?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={host} className="sg-bt3d"
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: performance.now() }; }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return;
        const hit = scene.current?.pick(e.clientX, e.clientY);
        if (hit) p.onTile(hit[0], hit[1]);
      }}
      onContextMenu={(e) => e.preventDefault()} />
  );
}
