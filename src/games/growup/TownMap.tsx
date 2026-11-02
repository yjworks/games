import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expression } from './engine';
import { FRIENDS } from './friends';
import { DISTRICTS, HAIR_COLORS, PLACES } from './data';
import { gradeLabel } from './calendar';
import { Sky, skyOf } from './render';
import { PERSON_W, drawPerson, personHeight } from './sprites';
import { MAP_PX_H, MAP_PX_W, TILE, buildTown, findPath } from './towntop';
import { paintTown, townKey } from './townpaint';
import { FieldKey, FriendId, Look, PlaceId, Stage } from './types';
import type { Season } from './world';

interface Props {
  stage: Stage;
  season: Season;
  look: Look;
  expr: Expression;
  open: PlaceId[];
  labels: Partial<Record<PlaceId, string>>;
  props: FieldKey[];
  trophies: number;
  friends: FriendId[];
  rain: boolean;
  /** 아이가 있는 곳(또는 가야 할 곳) */
  at: PlaceId;
  /** 늘어날 때마다 at 으로 걸어가 문으로 들어간다 — 방금 나온 곳을 다시 골라도 들어가게 */
  trip?: number;
  /** 처음 그릴 때 아이가 이 장소 안에 있으면 문에서 걸어 나온다 */
  emergeFrom?: PlaceId | null;
  /** 문으로 들어갔을 때 */
  onEnter?: (p: PlaceId) => void;
  onPlace?: (p: PlaceId) => void;
}

const LAYOUT = buildTown();
const STEP_S = 0.07; // 한 칸 걷는 시간
const MAX_WALK_S = 1.5;
const DOOR_S = 0.35; // 문 드나드는 시간

type Phase =
  | { k: 'idle' }
  | { k: 'walk'; pts: { x: number; y: number }[]; t: number; dur: number; to: PlaceId }
  | { k: 'enter'; place: PlaceId; t: number }
  | { k: 'inside'; place: PlaceId }
  | { k: 'exit'; place: PlaceId; t: number };

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

/** 칸 → 사람이 서는 픽셀(발밑 가운데) */
const feet = (t: { x: number; y: number }) => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE - 1 });

/** 위에서 내려다본 마을 지도 — 14곳이 한눈에 보이고, 아이가 거리를 따라 걸어가 문으로 드나든다 */
export function TownMap(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hour = useHour();
  const sky: Sky = skyOf(hour);
  const openSet = useMemo(() => new Set(p.open), [p.open.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const opts = { season: p.season, sky, open: openSet, props: p.props, trophies: p.trophies };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => paintTown(LAYOUT, opts), [townKey(opts)]);

  const live = useRef(p);
  live.current = p;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const skyRef = useRef(sky);
  skyRef.current = sky;

  /* 아이 위치(픽셀)와 하는 일 */
  const kid = useRef({ ...feet(LAYOUT.lots[p.emergeFrom ?? p.at].stand), face: 1, place: p.emergeFrom ?? p.at });
  const phase = useRef<Phase>(p.emergeFrom ? { k: 'exit', place: p.emergeFrom, t: 0 } : { k: 'idle' });

  /** 나오는 중에 받은 길 — 다 나온 뒤에 출발한다 */
  const pending = useRef(false);
  const startWalk = (to: PlaceId) => {
    const k = kid.current;
    const from = LAYOUT.lots[k.place].stand;
    const target = LAYOUT.lots[to].stand;
    if (reduceMotion()) {
      Object.assign(k, feet(target), { place: to });
      phase.current = { k: 'inside', place: to };
      live.current.onEnter?.(to);
      return;
    }
    if (from.x === target.x && from.y === target.y) { phase.current = { k: 'enter', place: to, t: 0 }; return; }
    const pts = findPath(LAYOUT, from, target).map(feet);
    phase.current = { k: 'walk', pts, t: 0, dur: Math.min(MAX_WALK_S, pts.length * STEP_S), to };
  };

  /* 길 요청(trip)이 오면 걷는다. 처음 그릴 때의 값은 이미 지난 요청이다 */
  const lastTrip = useRef(p.trip ?? 0);
  useEffect(() => {
    if ((p.trip ?? 0) === lastTrip.current) return;
    lastTrip.current = p.trip ?? 0;
    const ph = phase.current;
    if (ph.k === 'exit') { pending.current = true; return; }
    if (ph.k === 'inside') { phase.current = { k: 'exit', place: ph.place, t: 0 }; pending.current = true; return; }
    startWalk(p.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.trip]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let t = 0;
    const drops: { x: number; y: number; v: number }[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 30) return;
      const step = acc;
      acc = 0;
      t += step;
      const o = live.current;
      const k = kid.current;
      const sc = sceneRef.current;
      const sk = skyRef.current;
      let ph = phase.current;

      /* 움직임 */
      let doorOpen: PlaceId | null = null;
      let kidAlpha = 1;
      let walking = false;
      if (ph.k === 'walk') {
        ph.t += step;
        walking = true;
        const f = Math.min(1, ph.t / ph.dur);
        const pos = f * (ph.pts.length - 1);
        const i = Math.floor(pos);
        const a = ph.pts[i];
        const b = ph.pts[Math.min(ph.pts.length - 1, i + 1)];
        const nx = a.x + (b.x - a.x) * (pos - i);
        if (nx !== k.x) k.face = nx > k.x ? 1 : -1;
        k.x = nx;
        k.y = a.y + (b.y - a.y) * (pos - i);
        if (f >= 1) { k.place = ph.to; ph = phase.current = { k: 'enter', place: ph.to, t: 0 }; }
      }
      if (ph.k === 'enter') {
        ph.t += step;
        const lot = LAYOUT.lots[ph.place];
        const f = Math.min(1, ph.t / DOOR_S);
        const s = feet(lot.stand);
        k.x = s.x;
        k.y = s.y - f * TILE * 1.2;
        kidAlpha = 1 - f;
        doorOpen = ph.place;
        walking = true;
        if (f >= 1) { const pl = ph.place; phase.current = { k: 'inside', place: pl }; o.onEnter?.(pl); }
      } else if (ph.k === 'exit') {
        ph.t += step;
        const lot = LAYOUT.lots[ph.place];
        const f = Math.min(1, ph.t / DOOR_S);
        const s = feet(lot.stand);
        k.x = s.x;
        k.y = s.y - (1 - f) * TILE * 1.2;
        kidAlpha = f;
        doorOpen = ph.place;
        walking = true;
        k.place = ph.place;
        if (f >= 1) {
          phase.current = { k: 'idle' };
          /* 나오는 동안 갈 곳이 골라졌으면 이제 출발(방금 나온 곳이면 바로 다시 들어간다) */
          if (pending.current) { pending.current = false; startWalk(o.at); }
        }
      } else if (ph.k === 'inside') {
        kidAlpha = 0;
      }

      ctx.drawImage(sc.base, 0, 0);

      /* 남은 길 — 점선과 도착 표시 */
      if (ph.k === 'walk') {
        const n = ph.pts.length - 1;
        const from = Math.ceil(Math.min(1, ph.t / ph.dur) * n);
        for (let i = from; i <= n; i++) {
          if ((i + Math.floor(t * 6)) % 2) continue;
          const p = ph.pts[i];
          const x = Math.round(p.x) - 2;
          const y = Math.round(p.y) - 3;
          ctx.fillStyle = 'rgba(40,30,20,0.7)';
          ctx.fillRect(x, y + 1, 4, 3);
          ctx.fillStyle = '#ffe066';
          ctx.fillRect(x, y, 3, 3);
        }
        const end = ph.pts[n];
        const pulse = Math.floor(t * 4) % 2;
        ctx.strokeStyle = '#ffe066';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(end.x) - 4 - pulse + 0.5, Math.round(end.y) - 3 - pulse + 0.5, 8 + pulse * 2, 5 + pulse * 2);
      }

      /* 열린 문 */
      if (doorOpen) {
        const d = LAYOUT.lots[doorOpen].door;
        ctx.fillStyle = '#1a1420';
        ctx.fillRect(d.x * TILE - 3, d.y * TILE - 4, 6, TILE + 3);
      }

      /* 친구들 — 자기 장소 문 옆 */
      const h = personHeight(o.stage);
      for (const f of FRIENDS) {
        if (!o.friends.includes(f.id) || !o.open.includes(f.place)) continue;
        const s = feet(LAYOUT.lots[f.place].stand);
        const fx = s.x + 12;
        const bob = Math.floor(t * 1.5 + fx) % 2;
        drawPerson(ctx, { hair: f.hair, style: f.style, stage: o.stage, expr: 'normal', shirt: f.shirt },
          fx - PERSON_W / 2, s.y - h + 1 + bob, 1, k.x < fx);
      }

      /* 아이 */
      if (kidAlpha > 0) {
        ctx.globalAlpha = kidAlpha;
        const frame2 = walking && Math.floor(t * 8) % 2 ? 1 : 0;
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(k.x) - 5, Math.round(k.y) - 1, 10, 2);
        drawPerson(ctx, { hair: HAIR_COLORS[o.look.hair % HAIR_COLORS.length], style: o.look.style, stage: o.stage, expr: o.expr, frame: frame2 },
          Math.round(k.x) - PERSON_W / 2, Math.round(k.y) - h, 1, k.face < 0);
        ctx.globalAlpha = 1;
      }

      /* 비·눈 */
      const want = o.rain ? 60 : o.season === '겨울' ? 40 : 0;
      while (drops.length < want) drops.push({ x: Math.random() * MAP_PX_W, y: Math.random() * MAP_PX_H, v: o.rain ? 160 : 14 + Math.random() * 10 });
      if (drops.length > want) drops.length = want;
      ctx.fillStyle = o.rain ? 'rgba(170,200,255,0.8)' : '#ffffff';
      for (const d of drops) {
        d.y += d.v * step;
        d.x += (o.rain ? -10 : Math.sin(t + d.y) * 6) * step;
        if (d.y > MAP_PX_H) { d.y = -3; d.x = Math.random() * MAP_PX_W; }
        if (o.rain) ctx.fillRect(d.x, d.y, 1, 3); else ctx.fillRect(d.x, d.y, 1, 1);
      }
      if (o.rain) { ctx.fillStyle = 'rgba(40,50,80,0.18)'; ctx.fillRect(0, 0, MAP_PX_W, MAP_PX_H); }

      /* 밤 */
      if (sk !== 'day') {
        ctx.fillStyle = sk === 'night' ? 'rgba(8,12,40,0.5)' : 'rgba(70,40,90,0.18)';
        ctx.fillRect(0, 0, MAP_PX_W, MAP_PX_H);
        ctx.globalAlpha = sk === 'night' ? 1 : 0.6;
        ctx.drawImage(sc.glow, 0, 0);
        ctx.globalAlpha = 1;
      }
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div className="gu-town-map">
      <canvas ref={canvasRef} width={MAP_PX_W} height={MAP_PX_H} className="gu-town-canvas"
        role="img" aria-label={`마을 지도 — ${p.season}, ${sky === 'night' ? '밤' : sky === 'dusk' ? '저녁' : '낮'}`} />
      {PLACES.map((pl) => {
        const lot = LAYOUT.lots[pl.id];
        const open = openSet.has(pl.id);
        return (
          <button key={pl.id} type="button" tabIndex={-1} aria-hidden="true"
            className={`gu-map-sign ${open ? '' : 'closed'}`}
            style={{ left: `${((lot.x + lot.w / 2) * TILE / MAP_PX_W) * 100}%`, top: `${((lot.y * TILE + 1) / MAP_PX_H) * 100}%` }}
            onClick={() => open && p.onPlace?.(pl.id)}>
            {open ? <>{pl.emoji} {p.labels[pl.id] ?? pl.name}</> : <>🚧 {gradeLabel(pl.from)}</>}
          </button>
        );
      })}
      {LAYOUT.districtSigns.map((d) => {
        const dist = DISTRICTS.find((x) => x.id === d.id)!;
        return (
          <span key={d.id} className="gu-map-district" style={{ top: `${(d.y * TILE / MAP_PX_H) * 100}%`, ['--pc' as string]: dist.color }}>
            {dist.emoji}<b>{dist.name}</b>
          </span>
        );
      })}
    </div>
  );
}
