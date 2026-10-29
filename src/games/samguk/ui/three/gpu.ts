import { readJSON, writeJSON } from '../../../../shared/storage';

/**
 * 그래픽 가속 판정 — three.js를 불러오기 전에 쓰므로 three에 기대지 않는다.
 * - none: WebGL 자체가 없다 → 늘 2D
 * - soft: WebGL은 되지만 CPU가 대신 그린다(SwiftShader·llvmpipe·WARP 등) → 기본 2D, 켜면 낮은 화질
 * - hw:   GPU 가속 → 기본 3D
 */
export type GpuTier = 'none' | 'soft' | 'hw';

const SOFT = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|microsoft basic|\bwarp\b|mesa offscreen/i;

let cached: GpuTier | null = null;

function drop(gl: WebGLRenderingContext | WebGL2RenderingContext | null) {
  try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* 무시 */ }
}

export function gpuTier(): GpuTier {
  if (cached) return cached;
  cached = 'none';
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return cached;
    let soft = false;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (SOFT.test(name)) soft = true;
    drop(gl);
    /* 브라우저가 「성능이 크게 떨어진다」고 아는 경우(소프트웨어 대체) 이 옵션으로는 만들어지지 않는다 */
    if (!soft) {
      const c2 = document.createElement('canvas');
      const strict = (c2.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
        || c2.getContext('webgl', { failIfMajorPerformanceCaveat: true })) as WebGLRenderingContext | null;
      if (!strict) soft = true;
      drop(strict);
    }
    cached = soft ? 'soft' : 'hw';
  } catch { cached = 'none'; }
  return cached;
}

/**
 * 3D 켜기 설정 — 사람이 고른 적이 없으면(null) 기기에 맞춰 정한다.
 * auto: 사람이 정하지 않았음 → 느리면 알아서 2D로 내려가도 된다
 */
export function read3d(key: string): { on: boolean; auto: boolean } {
  const tier = gpuTier();
  if (tier === 'none') return { on: false, auto: true };
  const pref = readJSON<boolean | null>(key, null);
  if (pref === null) return { on: tier === 'hw', auto: true };
  return { on: pref, auto: false };
}
export const write3d = (key: string, on: boolean) => writeJSON(key, on);

/** 화질 — 소프트웨어 렌더링이면 처음부터 낮게 */
export const lowQuality = () => gpuTier() !== 'hw';

/**
 * 초당 장면 수 감시 — 처음 1.5초는 건너뛰고 그다음 3초 평균이 12장 아래면 한 번 알린다.
 * 탭이 가려져 있던 틈(2초 넘는 간격)은 세지 않는다.
 */
export class FrameWatch {
  private t0 = -1;
  private last = -1;
  private n = 0;
  private sum = 0;
  private fired = false;
  constructor(private onSlow: () => void, private minFps = 12) {}
  tick(now: number) {
    if (this.fired) return;
    if (this.t0 < 0) { this.t0 = now; this.last = now; return; }
    const dt = now - this.last;
    this.last = now;
    if (now - this.t0 < 1500 || dt > 2000 || (typeof document !== 'undefined' && document.hidden)) return;
    this.n++; this.sum += dt;
    if (this.sum >= 3000) {
      const fps = (this.n * 1000) / this.sum;
      this.fired = true;
      if (fps < this.minFps) this.onSlow();
    }
  }
  /** 화질을 낮춘 뒤 다시 잰다 */
  reset() { this.t0 = -1; this.n = 0; this.sum = 0; this.fired = false; }
}

export interface SceneOpt {
  /** 낮은 화질로 시작(계단 현상 다듬기·그림자 끔, 화소 배율 1) */
  low?: boolean;
  /** 낮은 화질로도 느릴 때 */
  onSlow?: () => void;
}
