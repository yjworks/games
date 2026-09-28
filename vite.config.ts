import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

/** public/ 에 있어 번들에는 잡히지 않지만 오프라인에 필요한 파일들 */
const STATIC_PRECACHE = [
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './maskable-192.png',
  './maskable-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  /* Pretendard 글꼴의 @font-face 목록. 조각 파일(woff2 92개)은 미리 받지 않고
     화면에 필요한 것만 처음 쓸 때 FONT_CACHE 에 저장한다(아래 fetch 처리). */
  './vendor/fonts/pretendard.css',
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
/* 글꼴 조각은 바뀌지 않으므로 CACHE 를 올려도 지우지 않는다 */
const FONT_CACHE = 'games-fonts-v1';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

/* dibrain.dev 는 여러 앱이 같은 주소(origin)를 쓴다. 다른 앱의 캐시는 건드리지 않고 딴짓의 옛 캐시만 지운다 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('games-') && k !== CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
      ))
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

  /* 글꼴 조각: 저장해 둔 것이 있으면 네트워크를 보지 않고 바로 쓴다 */
  if (url.pathname.includes('/vendor/fonts/') && url.pathname.endsWith('.woff2')) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

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

/** 방문 통계(Google Analytics). 빌드 결과의 모든 페이지 <head> 끝에 넣는다(개발 서버에는 넣지 않음).
 *  방문한 페이지·유입 경로만 보내고 게임 기록은 보내지 않는다. content_group "app" + app_name "games" 로
 *  허브·도구와 나눠 보고, 게임별로는 페이지 경로(/games/games/<id>/)로 본다. */
const GA_ID = 'G-3MH93TXQTM';
function analyticsPlugin(): Plugin {
  return {
    name: 'games-analytics',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{content_group:'app',app_name:'games'});</script>
`;
      return html.replace('</head>', `${tag}</head>`);
    },
  };
}

/**
 * 멀티 페이지 구성 — 허브(index.html) + 게임별 페이지(games/<id>/index.html).
 * base를 상대 경로로 두어 저장소 이름이나 배포 경로가 바뀌어도 그대로 동작한다.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? './' : '/',
  plugins: [react(), pwaPlugin(), analyticsPlugin()],
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
