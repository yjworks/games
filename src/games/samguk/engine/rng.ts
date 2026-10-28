/** 상태에 저장되는 시드 난수(mulberry32). 같은 저장에서 같은 결과가 나온다 */
export interface RngHolder { rng: number }

export function rnd(s: RngHolder): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** a 이상 b 이하 정수 */
export function rint(s: RngHolder, a: number, b: number): number {
  return a + Math.floor(rnd(s) * (b - a + 1));
}

/** 확률 p(0~1) */
export function chance(s: RngHolder, p: number): boolean {
  return rnd(s) < p;
}

/** lo~hi 사이 실수 */
export function rrange(s: RngHolder, lo: number, hi: number): number {
  return lo + rnd(s) * (hi - lo);
}

export function pick<T>(s: RngHolder, arr: readonly T[]): T {
  return arr[Math.floor(rnd(s) * arr.length)];
}

export function shuffle<T>(s: RngHolder, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
