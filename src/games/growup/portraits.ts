import { createStore } from '../../shared/storage';
import type { Expression } from './engine';
import { Stage } from './types';
import { PRESETS, gridToDataUrl, presetGrid } from './pixelart';

/**
 * 초상 이미지 — 프리셋을 고르거나, 직접 그리거나(픽셀 편집기), 이미지를 올릴 수 있다. 찾는 순서:
 *   1) 플레이어가 게임 안에서 고르거나 올린 그림(이 기기 localStorage) — 표정별 → 학교급별 → 전체
 *   2) 개발자가 src/games/growup/portraits/ 폴더에 넣은 그림(빌드에 포함)
 *   3) 없으면 픽셀 아바타
 *
 * 폴더 파일 이름:  {학교급}-{표정}.png   학교급 elem|middle|high, 표정 normal|happy|tired|sad|sick
 *                 {학교급}.png           그 학교급의 모든 표정에 쓴다
 *                 default.png            모든 학교급에 쓴다
 * (png·jpg·webp 모두 된다)
 */
export const STAGE_KEYS = ['elem', 'middle', 'high'] as const;
export const STAGE_NAMES = ['초등', '중등', '고등'] as const;
export const EXPR_KEYS: Expression[] = ['normal', 'happy', 'tired', 'sad', 'sick'];
export const EXPR_NAMES: Record<Expression, string> = { normal: '보통', happy: '기쁨', tired: '피곤', sad: '슬픔', sick: '아픔' };

const bundled = import.meta.glob('./portraits/*.{png,jpg,jpeg,webp}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** 파일 이름(확장자 뺌) → 주소 */
const FILES: Record<string, string> = Object.fromEntries(
  Object.entries(bundled).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.[a-z]+$/i, ''), url]),
);

/* ── 플레이어가 올린 그림 ── */
const store = createStore('growup');
const KEY = 'portraits';
/** 키: 'all'(모든 학교급), 'elem'(학교급 전체), 'elem-happy'(표정별). 값: data URL 또는 'preset:p1' */
export type Uploads = Record<string, string>;

export const loadUploads = (): Uploads => store.get<Uploads>(KEY, {});
export function saveUpload(key: string, dataUrl: string | null): Uploads {
  const u = { ...loadUploads() };
  if (dataUrl) u[key] = dataUrl; else delete u[key];
  store.set(KEY, u);
  return u;
}

/** 이 학교급·표정에 쓸 그림 주소 — 없으면 null(픽셀 아바타) */
export function portraitUrl(stage: Stage, expr: Expression, uploads: Uploads = loadUploads()): string | null {
  const st = STAGE_KEYS[stage];
  for (const k of [`${st}-${expr}`, st, 'all']) {
    const v = uploads[k];
    if (!v) continue;
    if (v.startsWith('preset:')) { const u = presetUrl(v.slice(7), expr); if (u) return u; continue; }
    return v;
  }
  for (const k of [`${st}-${expr}`, st, `${st}-normal`, 'default']) if (FILES[k]) return FILES[k];
  return null;
}

export const hasBundled = () => Object.keys(FILES).length > 0;

/** 프리셋 그림 — 표정까지 바뀐다. 한 번 만든 이미지는 기억해 둔다 */
const presetCache = new Map<string, string>();
export function presetUrl(id: string, expr: Expression): string | null {
  const p = PRESETS.find((x) => x.id === id);
  if (!p || typeof document === 'undefined') return null;
  const key = `${id}|${expr}`;
  let u = presetCache.get(key);
  if (!u) { u = gridToDataUrl(presetGrid(p, expr)); presetCache.set(key, u); }
  return u;
}

/**
 * 고른 이미지 파일을 초상 크기(세로 최대 320px)로 줄여 data URL 로 만든다.
 * localStorage 용량이 작아서(보통 5MB 안팎) 큰 사진을 그대로 넣지 않는다.
 */
export function shrinkImage(file: File, maxH = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxH / img.height);
      const w = Math.max(1, Math.round(img.width * k));
      const h = Math.max(1, Math.round(img.height * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      /* 작은 픽셀 그림은 키울 때 뭉개지지 않게 */
      ctx.imageSmoothingEnabled = img.height >= maxH;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.88));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했어요')); };
    img.src = url;
  });
}
