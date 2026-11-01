import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expression } from './engine';
import { FRIENDS } from './friends';
import { StaticScene, Sky, renderStatic, sceneKey, skyOf } from './render';
import { PERSON_W, drawPerson, personHeight } from './sprites';
import { FieldKey, FriendId, Look, PlaceId, Stage } from './types';
import { BLOCK, COLS, FRIEND_X, GROUND, HEIGHT, PLACE_SLOT, Season, WIDTH, doorX } from './world';
import { HAIR_COLORS } from './data';

export type WorldEffect = { kind: 'great' | 'ok' | 'fail' | 'sick' | 'heart'; key: number };

interface Props {
  stage: Stage;
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
  bubble: string;
  /** 장소 이름(학교급마다 다르다) — 버튼 ①~④ */
  labels: string[];
  onPlace?: (p: PlaceId) => void;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; kind: 'dot' | 'drop' | 'spark' | 'heart' }

const PLACES: PlaceId[] = ['home', 'school', 'town', 'center'];
const NUM = ['1', '2', '3', '4'];
const SPEED = 30; // 칸/초

function useHour() {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return hour;
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 블록 마을 — 아이가 고른 장소로 걸어가고, 계절·시각·기분이 풍경에 드러난다 */
export function WorldView(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const hour = useHour();
  const sky: Sky = skyOf(hour);

  const scene: StaticScene = useMemo(
    () => renderStatic({ stage: p.stage, season: p.season, sky, hour, props: p.props, trophies: p.trophies }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sceneKey({ stage: p.stage, season: p.season, sky, hour, props: p.props, trophies: p.trophies })],
  );

  /* 그리기에 쓰는 값은 ref 로 — 매 프레임 React 를 거치지 않는다 */
  const live = useRef(p);
  live.current = p;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const skyRef = useRef(sky);
  skyRef.current = sky;

  const kid = useRef({ x: doorX(p.at), target: doorX(p.at), face: 1, walking: false, arrive: false });
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
      live.current.onArrive?.();
      return;
    }
    k.walking = true;
    k.arrive = true;
    k.face = k.target > k.x ? 1 : -1;
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
      const sk = skyRef.current;

      /* 걷기 */
      if (k.walking) {
        const d = k.target - k.x;
        const mv = Math.sign(d) * SPEED * step;
        if (Math.abs(mv) >= Math.abs(d)) {
          k.x = k.target;
          k.walking = false;
          if (k.arrive) { k.arrive = false; o.onArrive?.(); }
        } else {
          k.x += mv;
        }
      }

      ctx.drawImage(sc.base, 0, 0);

      /* 구름 */
      cloudOffset.current = (cloudOffset.current + step * 3) % (WIDTH + 80);
      ctx.fillStyle = sk === 'night' ? 'rgba(80,90,130,0.5)' : sk === 'dusk' ? 'rgba(255,210,200,0.75)' : 'rgba(255,255,255,0.9)';
      for (const [cx0, cy, w] of [[20, 14, 34], [140, 26, 26], [230, 10, 40]] as const) {
        const cx = ((cx0 + cloudOffset.current) % (WIDTH + 80)) - 40;
        ctx.fillRect(cx, cy, w, 6);
        ctx.fillRect(cx + 6, cy - 4, w - 14, 4);
      }

      /* 친구들 — 아이 쪽을 본다 */
      for (const f of FRIENDS) {
        if (!o.friends.includes(f.id)) continue;
        const fx = FRIEND_X[f.id] * BLOCK;
        const bob = Math.floor((t * 1.5 + fx) % 2) === 0 ? 0 : 1;
        const h = personHeight(o.stage);
        drawPerson(ctx, { hair: f.hair, style: f.style, stage: o.stage, expr: 'normal', shirt: f.shirt },
          fx - PERSON_W / 2, GROUND * BLOCK - h + bob, 1, k.x * BLOCK < fx);
      }

      /* 아이 */
      {
        const h = personHeight(o.stage);
        const walkFrame = k.walking && Math.floor(t * 8) % 2 ? 1 : 0;
        const bob = !k.walking && o.expr === 'happy' && Math.floor(t * 2) % 2 ? -1 : 0;
        drawPerson(ctx, { hair: HAIR_COLORS[o.look.hair % HAIR_COLORS.length], style: o.look.style, stage: o.stage, expr: o.expr, frame: walkFrame },
          k.x * BLOCK - PERSON_W / 2, GROUND * BLOCK - h + bob, 1, k.face < 0);
        /* 피곤하면 Z */
        if ((o.expr === 'tired' || o.expr === 'sick') && !k.walking) {
          const zy = GROUND * BLOCK - h - 6 - Math.floor((t * 4) % 6);
          ctx.fillStyle = '#ffffff';
          const zx = k.x * BLOCK + 6;
          ctx.fillRect(zx, zy, 4, 1); ctx.fillRect(zx + 2, zy + 1, 1, 1); ctx.fillRect(zx + 1, zy + 2, 1, 1); ctx.fillRect(zx, zy + 3, 4, 1);
        }
        if (bubbleRef.current) {
          /* 말풍선이 화면 밖으로 나가지 않게 가장자리에서 멈춘다 */
          bubbleRef.current.style.left = `${Math.min(80, Math.max(20, (k.x / COLS) * 100))}%`;
          bubbleRef.current.style.opacity = k.walking ? '0' : '1';
        }
      }

      /* 계절·날씨 */
      const want = o.rain ? 50 : o.season === '겨울' ? 40 : o.season === '여름' ? (sk === 'night' ? 10 : 0) : 10;
      while (weather.length < want) {
        const R = Math.random;
        const rainy = o.rain;
        weather.push({
          x: R() * WIDTH, y: R() * GROUND * BLOCK, vx: rainy ? -8 : o.season === '겨울' ? (R() - 0.5) * 6 : -10 - R() * 8,
          vy: rainy ? 140 : o.season === '여름' ? (R() - 0.5) * 6 : 10 + R() * 8, life: 0, max: 99,
          color: rainy ? 'rgba(170,200,255,0.8)' : o.season === '봄' ? '#ffb8d0' : o.season === '가을' ? (R() < 0.5 ? '#e07a30' : '#f2c230') : o.season === '겨울' ? '#ffffff' : '#fff27a',
          size: rainy ? 1 : o.season === '겨울' ? 1 : 2, kind: rainy ? 'drop' : 'dot',
        });
      }
      if (weather.length > want) weather.length = want;
      for (const w of weather) {
        w.x += w.vx * step; w.y += w.vy * step;
        if (w.y > GROUND * BLOCK || w.x < -4 || w.x > WIDTH + 4) { w.y = -2; w.x = Math.random() * (WIDTH + 40); }
        if (o.season === '여름' && !o.rain && Math.floor(t * 3 + w.x) % 3 === 0) continue; // 반딧불 깜빡임
        ctx.fillStyle = w.color;
        if (w.kind === 'drop') ctx.fillRect(w.x, w.y, 1, 3);
        else ctx.fillRect(w.x, w.y, w.size, w.size);
      }
      if (o.rain) { ctx.fillStyle = 'rgba(40,50,80,0.18)'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }

      /* 연출 입자 */
      const ps = parts.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const q = ps[i];
        q.life += step;
        if (q.life >= q.max) { ps.splice(i, 1); continue; }
        q.x += q.vx * step; q.y += q.vy * step;
        if (q.kind === 'drop' && q.y > GROUND * BLOCK) { q.y = GROUND * BLOCK - personHeight(o.stage) - 14; }
        ctx.globalAlpha = 1 - q.life / q.max;
        ctx.fillStyle = q.color;
        if (q.kind === 'heart') {
          ctx.fillRect(q.x, q.y + 1, 5, 2); ctx.fillRect(q.x + 1, q.y, 1, 1); ctx.fillRect(q.x + 3, q.y, 1, 1);
          ctx.fillRect(q.x + 1, q.y + 3, 3, 1); ctx.fillRect(q.x + 2, q.y + 4, 1, 1);
        } else if (q.kind === 'spark') {
          ctx.fillRect(q.x, q.y, q.size, q.size);
          if (q.size > 1) { ctx.fillRect(q.x - 1, q.y + 0.5, 4, 1); }
        } else {
          ctx.fillRect(q.x, q.y, 1, 3);
        }
        ctx.globalAlpha = 1;
      }
      /* 실패하면 머리 위에 먹구름 */
      if (ps.some((q) => q.kind === 'drop')) {
        const cx = k.x * BLOCK;
        const top = GROUND * BLOCK - personHeight(o.stage) - 18;
        ctx.fillStyle = '#6a7080';
        ctx.fillRect(cx - 9, top, 18, 5); ctx.fillRect(cx - 5, top - 3, 10, 3);
      }

      /* 밤·저녁 */
      if (sk !== 'day') {
        ctx.fillStyle = sk === 'night' ? 'rgba(8,12,40,0.5)' : 'rgba(70,40,90,0.18)';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
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

  const kidTop = ((GROUND * BLOCK - personHeight(p.stage) - 4) / HEIGHT) * 100;

  return (
    <div className="gu-world">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="gu-world-canvas"
        role="img" aria-label={`블록 마을 — ${p.season}, ${sky === 'night' ? '밤' : sky === 'dusk' ? '저녁' : '낮'}`} />
      {scene.buildings.map((b) => {
        const i = PLACE_SLOT[b.place];
        return (
          <button key={b.place} className="gu-world-sign" type="button"
            style={{ left: `${((i * 8 + 4) / COLS) * 100}%`, top: `${(Math.max(18, b.top * BLOCK - 3) / HEIGHT) * 100}%` }}
            onClick={() => p.onPlace?.(PLACES[i])} tabIndex={-1} aria-hidden="true">
            <b>{NUM[i]}</b>{p.labels[i]}
          </button>
        );
      })}
      <div ref={bubbleRef} className="gu-world-bubble" style={{ bottom: `${100 - kidTop}%` }}>{p.bubble}</div>
    </div>
  );
}
