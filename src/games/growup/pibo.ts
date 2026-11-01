import type { Expression } from './engine';

/**
 * 파이보 얼굴(128×64 흑백) — 아이의 표정을 눈 모양으로 옮긴다.
 * 결과는 1비트 그림(행 우선, 0=꺼짐/1=켜짐). 실제 디스플레이 컨트롤러의 메모리 배치(페이지 방식 등)로
 * 바꾸는 일은 기기 쪽 코드에서 한다 — 컨트롤러 사양은 확인이 필요하다.
 */
export const PIBO_W = 128;
export const PIBO_H = 64;

type Bitmap = Uint8Array;

const blank = (): Bitmap => new Uint8Array(PIBO_W * PIBO_H);
const set = (b: Bitmap, x: number, y: number, v = 1) => {
  if (x >= 0 && y >= 0 && x < PIBO_W && y < PIBO_H) b[y * PIBO_W + (x | 0)] = v;
};
const rect = (b: Bitmap, x0: number, y0: number, w: number, h: number, v = 1) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(b, x, y, v);
};
const disc = (b: Bitmap, cx: number, cy: number, r: number, v = 1) => {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(b, cx + x, cy + y, v);
};
/** 굵은 선 */
const line = (b: Bitmap, x0: number, y0: number, x1: number, y1: number, t: number) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) disc(b, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), t);
};
/** 고리의 위쪽 반(웃는 눈 ∩) 또는 아래쪽 반(∪) */
const arc = (b: Bitmap, cx: number, cy: number, r: number, t: number, upper: boolean) => {
  for (let y = -r - t; y <= r + t; y++) for (let x = -r - t; x <= r + t; x++) {
    const d = Math.sqrt(x * x + y * y);
    if (d >= r - t && d <= r + t && (upper ? y <= 0 : y >= 0)) set(b, cx + x, cy + y);
  }
};

const EYES = [40, 88];
const EY = 28;

export function piboFace(expr: Expression): Bitmap {
  const b = blank();
  switch (expr) {
    case 'happy':
      for (const x of EYES) arc(b, x, EY + 6, 12, 3, true);
      arc(b, 64, 46, 8, 2, false);
      break;
    case 'tired':
      for (const x of EYES) { rect(b, x - 13, EY + 2, 26, 9); rect(b, x - 13, EY - 2, 26, 2); }
      rect(b, 58, 52, 12, 2);
      break;
    case 'sad':
      for (const [i, x] of EYES.entries()) {
        disc(b, x, EY + 4, 10);
        /* 안쪽이 올라간 눈썹 */
        line(b, x - 12, EY - 8 + (i ? -6 : 0), x + 12, EY - 8 + (i ? 0 : -6), 1);
      }
      arc(b, 64, 58, 8, 2, true);
      break;
    case 'sick':
      for (const x of EYES) { line(b, x - 9, EY - 9, x + 9, EY + 9, 2); line(b, x - 9, EY + 9, x + 9, EY - 9, 2); }
      for (let x = 52; x < 76; x++) set(b, x, 52 + Math.round(Math.sin(x / 2) * 2));
      break;
    default:
      for (const x of EYES) {
        rect(b, x - 11, EY - 14, 22, 28);
        rect(b, x + 2, EY - 10, 5, 5, 0); // 반짝임
      }
      break;
  }
  return b;
}

/** 행 우선, 한 바이트에 가로 8픽셀(왼쪽이 최상위 비트) — 1024바이트 */
export function packRows(b: Bitmap): Uint8Array {
  const out = new Uint8Array((PIBO_W / 8) * PIBO_H);
  for (let y = 0; y < PIBO_H; y++) for (let x = 0; x < PIBO_W; x++) {
    if (b[y * PIBO_W + x]) out[y * (PIBO_W / 8) + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return out;
}
