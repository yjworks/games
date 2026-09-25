import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/** public/ 에 있어 번들에는 잡히지 않지만 오프라인에 필요한 파일들 */
const STATIC_PRECACHE = [
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-512.png',
];

/**
 * 빌드 결과물 목록을 그대로 담은 서비스 워커를 생성한다.
 * 외부 의존성 없이 한 번 방문한 뒤에는 네트워크 없이 실행된다.
 */
function pwaPlugin(): Plugin {
  return {
    name: 'games-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).map((f) => `./${f}`);
      const precache = [...new Set([...assets, ...STATIC_PRECACHE, './'])];
      const version = `v${Date.now().toString(36)}`;

      const sw = `/* 자동 생성 — vite.config.ts의 pwaPlugin이 만든 파일입니다. 직접 수정하지 마세요. */
const CACHE = 'games-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/* 화면 이동은 캐시 우선(오프라인 우선), 그 외 정적 파일도 캐시 우선 + 백그라운드 갱신 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      /* 백그라운드에서 조용히 갱신 */
      fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

/**
 * 멀티 페이지 구성 — 허브(index.html) + 게임별 페이지(games/<id>/index.html).
 * base를 상대 경로로 두어 저장소 이름이나 배포 경로가 바뀌어도 그대로 동작한다.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  plugins: [react(), pwaPlugin()],
  resolve: {
    alias: { '@shared': resolve(__dirname, 'src/shared') },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        hub: resolve(__dirname, 'index.html'),
        omok: resolve(__dirname, 'games/omok/index.html'),
        janggi: resolve(__dirname, 'games/janggi/index.html'),
        sudoku: resolve(__dirname, 'games/sudoku/index.html'),
        tetris: resolve(__dirname, 'games/tetris/index.html'),
        reversi: resolve(__dirname, 'games/reversi/index.html'),
        kkodle: resolve(__dirname, 'games/kkodle/index.html'),
        minesweeper: resolve(__dirname, 'games/minesweeper/index.html'),
        nonogram: resolve(__dirname, 'games/nonogram/index.html'),
        solitaire: resolve(__dirname, 'games/solitaire/index.html'),
        g2048: resolve(__dirname, 'games/2048/index.html'),
        breakout: resolve(__dirname, 'games/breakout/index.html'),
        yut: resolve(__dirname, 'games/yut/index.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
