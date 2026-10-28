/** 그림용 결정적 난수·색 도구 */

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

/** 같은 시드면 같은 수열 */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parse(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const n = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  }
  const m = c.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
  if (m) {
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
    };
    return [f(0), f(8), f(4)];
  }
  return [128, 128, 128];
}

/** 색을 섞는다: t=0 a, t=1 b */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const h = (x: number) => Math.round(x).toString(16).padStart(2, '0');
  return `#${h(r1 + (r2 - r1) * t)}${h(g1 + (g2 - g1) * t)}${h(b1 + (b2 - b1) * t)}`;
}

export const darken = (c: string, t: number) => mix(c, '#000000', t);
export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);

/** 종이 결 무늬를 캔버스로 한 번만 그려 data URL로 돌려준다(그 뒤로는 그림 한 장처럼 빠르다) */
const cache = new Map<string, string>();
export function paperTexture(key: string, w: number, h: number, base: string, fiber: string, seed = 7): string {
  const id = `${key}:${w}x${h}`;
  const hit = cache.get(id);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const rnd = seeded(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const [fr, fg, fb] = parse(fiber);
  /* 얼룩: 큰 결 + 작은 알갱이 */
  const blobs = Array.from({ length: 14 }, () => [rnd() * w, rnd() * h, 40 + rnd() * 140, (rnd() - 0.5) * 0.22] as const);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = (rnd() - 0.5) * 0.16;
      for (const [bx, by, br, bv] of blobs) {
        const dx = x - bx, dy = y - by;
        const d = (dx * dx + dy * dy) / (br * br);
        if (d < 1) v += bv * (1 - d);
      }
      const i = (y * w + x) * 4;
      const t = Math.max(-1, Math.min(1, v));
      const tgt = t > 0 ? [fr, fg, fb] : [img.data[i] * 1.08, img.data[i + 1] * 1.06, img.data[i + 2] * 1.02];
      const k = Math.abs(t);
      img.data[i] = img.data[i] + (tgt[0] - img.data[i]) * k;
      img.data[i + 1] = img.data[i + 1] + (tgt[1] - img.data[i + 1]) * k;
      img.data[i + 2] = img.data[i + 2] + (tgt[2] - img.data[i + 2]) * k;
    }
  }
  ctx.putImageData(img, 0, 0);
  /* 섬유 줄 */
  ctx.strokeStyle = fiber;
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * h, l = 6 + rnd() * 26, a = rnd() * Math.PI;
    ctx.lineWidth = 0.6 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  const url = cv.toDataURL('image/png');
  cache.set(id, url);
  return url;
}

/** 한자 성(姓) — 복성은 두 글자 */
const COMPOUND = ['諸葛', '夏侯', '司馬', '公孫', '皇甫', '司徒', '太史', '令狐', '鍾離', '毌丘', '淳于', '鮮于', '東方', '上官', '歐陽', '慕容'];
export function surname(hanja: string): string {
  for (const c of COMPOUND) if (hanja.startsWith(c)) return c;
  return hanja.slice(0, 1);
}
