import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expression } from './engine';
import { FRIENDS } from './friends';
import { StaticScene, Sky, drawSky, renderStatic, sceneKey, skyOf } from './render';
import { PERSON_W, drawPerson, personHeight } from './sprites';
import { FieldKey, FriendId, Look, PlaceId, Stage } from './types';
import { BLOCK, GROUND, HEIGHT, PLACE_SLOT, SLOT_W, Season, VIEW_W, WIDTH, doorX, friendX } from './world';
import { DISTRICTS, HAIR_COLORS, PLACES } from './data';
import { gradeLabel } from './calendar';

export type WorldEffect = { kind: 'great' | 'ok' | 'fail' | 'sick' | 'heart'; key: number };

interface Props {
  stage: Stage;
  /** 학년(0~11) — 공사 중이던 곳이 열린다 */
  grade: number;
  season: Season;
  look: Look;
  expr: Expression;
  /** 집 앞 소품으로 보여 줄 관심 분야 */
  props: FieldKey[];
  trophies: number;
  /** 이미 만난 친구 */
  friends: FriendId[];
  /** 아이가 가 있어야 할 곳 — 바뀌면 걸어간다 */
  at: PlaceId;
  /** 걸어서 도착했을 때 */
  onArrive?: () => void;
  effect?: WorldEffect | null;
  /** 스트레스가 높으면 비가 온다 */
  rain: boolean;
  /** 아이 머리 위 말풍선(없으면 안 띄운다) */
  bubble?: string;
  /** 장소 이름(학교급마다 다르다) */
  labels: Partial<Record<PlaceId, string>>;
  onPlace?: (p: PlaceId) => void;
  /** 장소 화면 — at 한 곳만 크게 보여 주고, 아이가 옆에서 걸어 들어온다 */
  focus?: boolean;
  /** 장소 화면을 세로로 길게(넓은 화면에서 지도와 같은 비율) */
  tall?: boolean;
}

/**
 * 장소 화면 — 건물 하나와 양옆 조금만, 하늘과 땅속은 잘라 크게 보여 준다.
 * 좁은 화면(모바일)은 가로로 넓게 잘라 그림 높이를 줄이고(아래 활동 목록이 더 보이게),
 * 넓은 화면은 마을 지도(272×304)와 같은 비율로 세로를 늘려 옆 패널과 높이를 맞춘다.
 */
const focusBox = (tall?: boolean) => (tall ? { w: 128, y: 0, h: 143 } : { w: 150, y: 30, h: 110 });

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dot' | 'drop' | 'spark' | 'heart' }

/** 걷는 데 길어야 이만큼(초) — 마을 끝에서 끝까지도 오래 기다리지 않게 */
const WALK_MAX_S = 1.1;
const MIN_SPEED = 30; // 칸/초

function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const camFor = (x: number, vw: number) => Math.max(0, Math.min(WIDTH - vw, x * BLOCK - vw / 2));

/** 화면에 보일 마을 폭(px) — 좁은 화면에서는 덜 보여 주고 크게 그린다(픽셀 하나가 약 1.8배 이상) */
const viewFor = (cssW: number) => (cssW >= 576 ? VIEW_W : Math.max(180, Math.min(VIEW_W, Math.round(cssW / 1.8))));

/** 블록 마을 — 아이가 고른 장소로 걸어가고(화면이 따라간다), 계절·시각·기분이 풍경에 드러난다 */
export function WorldView(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(p.focus ? focusBox(p.tall).w : VIEW_W);
  const vwRef = useRef(viewW);
  vwRef.current = viewW;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const pick = () => setViewW(live.current.focus ? focusBox(live.current.tall).w : viewFor(el.clientWidth));
    const ro = new ResizeObserver(pick);
    ro.observe(el);
    pick();
    return () => ro.disconnect();
  }, []);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const signRefs = useRef<Partial<Record<PlaceId, HTMLButtonElement | null>>>({});
  const dotRef = useRef<HTMLSpanElement>(null);
  const hour = useHour();
  const sky: Sky = skyOf(hour);

  const opts = { stage: p.stage, grade: p.grade, season: p.season, sky, hour, props: p.props, trophies: p.trophies };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene: StaticScene = useMemo(() => renderStatic(opts), [sceneKey(opts)]);

  /* 그리기에 쓰는 값은 ref 로 — 매 프레임 React 를 거치지 않는다 */
  const live = useRef(p);
  live.current = p;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const skyRef = useRef({ sky, hour });
  skyRef.current = { sky, hour };

  const kid = useRef({ x: p.focus ? doorX(p.at) - 9 : doorX(p.at), target: doorX(p.at), face: 1, walking: !!p.focus, arrive: !!p.focus, speed: 12 });
  const cam = useRef(camFor(doorX(p.at), p.focus ? focusBox(p.tall).w : VIEW_W));
  const parts = useRef<Particle[]>([]);
  const cloudOffset = useRef(0);

  /* 갈 곳이 바뀌면 걷기 시작 */
  useEffect(() => {
    const k = kid.current;
    k.target = doorX(p.at);
    /* 이미 그 자리이거나 움직임을 줄인 설정이면 바로 도착 */
    if (Math.abs(k.target - k.x) < 0.05 || reduceMotion()) {
      k.x = k.target;
      k.walking = false;
      cam.current = camFor(k.x, vwRef.current);
      live.current.onArrive?.();
      return;
    }
    k.walking = true;
    k.arrive = true;
    k.face = k.target > k.x ? 1 : -1;
    k.speed = live.current.focus ? 15 : Math.max(MIN_SPEED, Math.abs(k.target - k.x) / WALK_MAX_S);
  }, [p.at]);

  /* 결과 연출 */
  useEffect(() => {
    if (!p.effect) return;
    const k = kid.current;
    const cx = k.x * BLOCK;
    const top = GROUND * BLOCK - personHeight(live.current.stage);
    const add = (n: number, f: (i: number) => Particle) => { for (let i = 0; i < n; i++) parts.current.push(f(i)); };
    const R = Math.random;
    switch (p.effect.kind) {
      case 'great':
        add(18, () => ({ x: cx + (R() - 0.5) * 16, y: top + R() * 10, vx: (R() - 0.5) * 20, vy: -20 - R() * 30, life: 0, max: 1.2, color: R() < 0.5 ? '#ffe680' : '#fff6c0', size: 2, kind: 'spark' }));
        break;
      case 'ok':
        add(6, () => ({ x: cx + (R() - 0.5) * 14, y: top, vx: (R() - 0.5) * 8, vy: -15 - R() * 10, life: 0, max: 1, color: '#ffffff', size: 1, kind: 'spark' }));
        break;
      case 'heart':
        add(4, (i) => ({ x: cx - 8 + i * 5, y: top - 2, vx: 0, vy: -12, life: 0, max: 1.4, color: '#ff6b8a', size: 1, kind: 'heart' }));
        break;
      case 'fail':
      case 'sick':
        add(16, () => ({ x: cx + (R() - 0.5) * 16, y: top - 14, vx: 0, vy: 40 + R() * 20, life: 0, max: 0.4 + R() * 0.8, color: p.effect!.kind === 'sick' ? '#8fd0ff' : '#9ab8ff', size: 1, kind: 'drop' }));
        break;
    }
  }, [p.effect]);

  /* 그리기 */
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let t = 0;
    const weather: Particle[] = [];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 30) return; // 30fps면 충분하다(저사양 기기)
      const step = acc;
      acc = 0;
      t += step;
      const o = live.current;
      const k = kid.current;
      const sc = sceneRef.current;
      const sk = skyRef.current.sky;
      const VW = vwRef.current;
      const fb = focusBox(o.tall);
      const Y0 = o.focus ? fb.y : 0;
      const VH = o.focus ? fb.h : HEIGHT;

      /* 걷기 */
      if (k.walking) {
        const d = k.target - k.x;
        const mv = Math.sign(d) * k.speed * step;
        if (Math.abs(mv) >= Math.abs(d)) {
          k.x = k.target;
          k.walking = false;
          if (k.arrive) { k.arrive = false; o.onArrive?.(); }
        } else {
          k.x += mv;
        }
      }
      /* 화면이 아이를 따라간다 */
      const want = camFor(o.focus ? doorX(o.at) : k.x, VW);
      cam.current += (want - cam.current) * Math.min(1, step * 8);
      if (Math.abs(want - cam.current) < 0.5) cam.current = want;
      const cx0 = Math.round(cam.current);

      drawSky(ctx, sk, o.season, skyRef.current.hour, VW);

      /* 구름 — 하늘에 고정, 천천히 흐른다 */
      cloudOffset.current = (cloudOffset.current + step * 3) % (VW + 80);
      ctx.fillStyle = sk === 'night' ? 'rgba(80,90,130,0.5)' : sk === 'dusk' ? 'rgba(255,210,200,0.75)' : 'rgba(255,255,255,0.9)';
      for (const [c0, cy, w] of [[20, 14, 34], [140, 26, 26], [230, 10, 40]] as const) {
        const cx = ((c0 + cloudOffset.current - cx0 * 0.15) % (VW + 80) + VW + 80) % (VW + 80) - 40;
        ctx.fillRect(cx, cy, w, 6);
        ctx.fillRect(cx + 6, cy - 4, w - 14, 4);
      }

      ctx.save();
      ctx.translate(0, -Y0);
      ctx.drawImage(sc.base, cx0, 0, VW, HEIGHT, 0, 0, VW, HEIGHT);

      /* 친구들 — 아이 쪽을 본다 */
      for (const f of FRIENDS) {
        if (!o.friends.includes(f.id)) continue;
        const fx = friendX(f.place) * BLOCK - cx0;
        if (fx < -20 || fx > VW + 20) continue;
        const bob = Math.floor((t * 1.5 + fx) % 2) === 0 ? 0 : 1;
        const h = personHeight(o.stage);
        drawPerson(ctx, { hair: f.hair, style: f.style, stage: o.stage, expr: 'normal', shirt: f.shirt },
          fx - PERSON_W / 2, GROUND * BLOCK - h + bob, 1, k.x * BLOCK - cx0 < fx);
      }

      /* 아이 */
      const kx = k.x * BLOCK - cx0;
      {
        const h = personHeight(o.stage);
        const walkFrame = k.walking && Math.floor(t * 8) % 2 ? 1 : 0;
        const bob = !k.walking && o.expr === 'happy' && Math.floor(t * 2) % 2 ? -1 : 0;
        drawPerson(ctx, { hair: HAIR_COLORS[o.look.hair % HAIR_COLORS.length], style: o.look.style, stage: o.stage, expr: o.expr, frame: walkFrame },
          kx - PERSON_W / 2, GROUND * BLOCK - h + bob, 1, k.face < 0);
        /* 피곤하면 Z */
        if ((o.expr === 'tired' || o.expr === 'sick') && !k.walking) {
          const zy = GROUND * BLOCK - h - 6 - Math.floor((t * 4) % 6);
          ctx.fillStyle = '#ffffff';
          const zx = kx + 6;
          ctx.fillRect(zx, zy, 4, 1); ctx.fillRect(zx + 2, zy + 1, 1, 1); ctx.fillRect(zx + 1, zy + 2, 1, 1); ctx.fillRect(zx, zy + 3, 4, 1);
        }
        if (bubbleRef.current) {
          bubbleRef.current.style.left = `${Math.min(80, Math.max(20, (kx / VW) * 100))}%`;
          bubbleRef.current.style.opacity = k.walking ? '0' : '1';
        }
      }

      ctx.restore();

      /* 간판과 미니맵도 화면을 따라 옮긴다 */
      for (const pl of PLACES) {
        const el = signRefs.current[pl.id];
        if (!el) continue;
        const sx = (PLACE_SLOT[pl.id] * SLOT_W + 4) * BLOCK - cx0;
        el.style.left = `${(sx / VW) * 100}%`;
        el.style.visibility = (o.focus && pl.id !== o.at) || sx < -30 || sx > VW + 30 ? 'hidden' : 'visible';
      }
      if (dotRef.current) dotRef.current.style.left = `${(k.x * BLOCK / WIDTH) * 100}%`;

      /* 계절·날씨 — 화면 좌표 */
      const want2 = o.rain ? 50 : o.season === '겨울' ? 40 : o.season === '여름' ? (sk === 'night' ? 10 : 0) : 10;
      while (weather.length < want2) {
        const R = Math.random;
        const rainy = o.rain;
        weather.push({
          x: R() * VW, y: R() * GROUND * BLOCK, vx: rainy ? -8 : o.season === '겨울' ? (R() - 0.5) * 6 : -10 - R() * 8,
          vy: rainy ? 140 : o.season === '여름' ? (R() - 0.5) * 6 : 10 + R() * 8, life: 0, max: 99,
          color: rainy ? 'rgba(170,200,255,0.8)' : o.season === '봄' ? '#ffb8d0' : o.season === '가을' ? (R() < 0.5 ? '#e07a30' : '#f2c230') : o.season === '겨울' ? '#ffffff' : '#fff27a',
          size: rainy ? 1 : o.season === '겨울' ? 1 : 2, kind: rainy ? 'drop' : 'dot',
        });
      }
      if (weather.length > want2) weather.length = want2;
      for (const w of weather) {
        w.x += w.vx * step; w.y += w.vy * step;
        if (w.y > GROUND * BLOCK || w.x < -4 || w.x > VW + 4) { w.y = -2; w.x = Math.random() * (VW + 40); }
        if (o.season === '여름' && !o.rain && Math.floor(t * 3 + w.x) % 3 === 0) continue; // 반딧불 깜빡임
        ctx.fillStyle = w.color;
        if (w.kind === 'drop') ctx.fillRect(w.x, w.y, 1, 3);
        else ctx.fillRect(w.x, w.y, w.size, w.size);
      }
      if (o.rain) { ctx.fillStyle = 'rgba(40,50,80,0.18)'; ctx.fillRect(0, 0, VW, VH); }

      ctx.save();
      ctx.translate(0, -Y0);

      /* 연출 입자 — 마을 좌표로 만들어 화면으로 옮겨 그린다 */
      const ps = parts.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const q = ps[i];
        q.life += step;
        if (q.life >= q.max) { ps.splice(i, 1); continue; }
        q.x += q.vx * step; q.y += q.vy * step;
        if (q.kind === 'drop' && q.y > GROUND * BLOCK) { q.y = GROUND * BLOCK - personHeight(o.stage) - 14; }
        const qx = q.x - cx0;
        ctx.globalAlpha = 1 - q.life / q.max;
        ctx.fillStyle = q.color;
        if (q.kind === 'heart') {
          ctx.fillRect(qx, q.y + 1, 5, 2); ctx.fillRect(qx + 1, q.y, 1, 1); ctx.fillRect(qx + 3, q.y, 1, 1);
          ctx.fillRect(qx + 1, q.y + 3, 3, 1); ctx.fillRect(qx + 2, q.y + 4, 1, 1);
        } else if (q.kind === 'spark') {
          ctx.fillRect(qx, q.y, q.size, q.size);
          if (q.size > 1) { ctx.fillRect(qx - 1, q.y + 0.5, 4, 1); }
        } else {
          ctx.fillRect(qx, q.y, 1, 3);
        }
        ctx.globalAlpha = 1;
      }
      /* 실패하면 머리 위에 먹구름 */
      if (ps.some((q) => q.kind === 'drop')) {
        const top = GROUND * BLOCK - personHeight(o.stage) - 18;
        ctx.fillStyle = '#6a7080';
        ctx.fillRect(kx - 9, top, 18, 5); ctx.fillRect(kx - 5, top - 3, 10, 3);
      }
      ctx.restore();

      /* 밤·저녁 */
      if (sk !== 'day') {
        ctx.fillStyle = sk === 'night' ? 'rgba(8,12,40,0.5)' : 'rgba(70,40,90,0.18)';
        ctx.fillRect(0, 0, VW, VH);
        ctx.globalAlpha = sk === 'night' ? 1 : 0.6;
        ctx.drawImage(sc.glow, cx0, Y0, VW, VH, 0, 0, VW, VH);
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

  const y0 = p.focus ? focusBox(p.tall).y : 0;
  const vh = p.focus ? focusBox(p.tall).h : HEIGHT;
  const kidTop = ((GROUND * BLOCK - personHeight(p.stage) - 4 - y0) / vh) * 100;

  return (
    <div className="gu-world" ref={boxRef}>
      <canvas ref={canvasRef} width={viewW} height={vh} className="gu-world-canvas" style={{ aspectRatio: `${viewW} / ${vh}` }}
        role="img" aria-label={`블록 마을 — ${p.season}, ${sky === 'night' ? '밤' : sky === 'dusk' ? '저녁' : '낮'}`} />
      {scene.buildings.map((b) => {
        const pl = PLACES[PLACE_SLOT[b.place]];
        return (
          <button key={b.place} ref={(el) => { signRefs.current[b.place] = el; }}
            className={`gu-world-sign ${b.open ? '' : 'closed'}`} type="button"
            style={{ top: `${(Math.max(p.focus ? 4 : 18, b.top * BLOCK - 3 - y0) / vh) * 100}%` }}
            onClick={() => b.open && p.onPlace?.(b.place)} tabIndex={-1} aria-hidden="true">
            {b.open ? <>{pl.emoji} {p.labels[b.place] ?? pl.name}</> : <>🚧 {gradeLabel(pl.from)}부터</>}
          </button>
        );
      })}
      {p.bubble && <div ref={bubbleRef} className="gu-world-bubble" style={{ bottom: `${100 - kidTop}%` }}>{p.bubble}</div>}
      {/* 미니맵 — 구역 넷과 지금 아이 자리 */}
      <div className="gu-minimap" aria-hidden="true" hidden={p.focus}>
        {DISTRICTS.map((d) => (
          <span key={d.id} style={{ flex: d.places.length, background: d.color }}>{d.emoji} {d.name}</span>
        ))}
        <span ref={dotRef} className="gu-minimap-dot" />
      </div>
    </div>
  );
}
