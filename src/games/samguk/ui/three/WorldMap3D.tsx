import { useEffect, useRef } from 'react';
import type { CityId } from '../../data/types';
import type { GameState } from '../../engine/state';
import { WorldScene } from './WorldScene';

/** 3D 천하 지도 — 도시를 누르면 onSelect. 끌기·휠·두 손가락으로 둘러본다 */
export default function WorldMap3D({ s, rev, selected, onSelect, marks, viewer, onFail, onView }: {
  s: GameState; rev: number; selected: CityId | null; onSelect: (c: CityId) => void; marks?: Set<CityId>; viewer: number;
  onFail: () => void; onView: (api: { zoom: (f: number) => void; overview: () => void } | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<WorldScene | null>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const focused = useRef<CityId | null>(null);

  useEffect(() => {
    if (!host.current) return;
    try {
      scene.current = new WorldScene(host.current);
    } catch {
      onFail();
      return;
    }
    onView({ zoom: (f) => scene.current?.zoom(f), overview: () => scene.current?.overview() });
    return () => { onView(null); scene.current?.dispose(); scene.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    void sc.sync(s, selected, marks, viewer).then(() => {
      if (selected && focused.current !== selected) {
        sc.focus(selected, focused.current === null);
        focused.current = selected;
      }
    });
  }, [s, rev, selected, marks, viewer]);

  return (
    <div ref={host} className="sg-map3d"
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, t: performance.now() }; }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return;
        const c = scene.current?.pick(e.clientX, e.clientY);
        if (c) onSelect(c);
      }}
      onContextMenu={(e) => e.preventDefault()} />
  );
}
