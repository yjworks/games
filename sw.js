/* 자동 생성 — vite.config.ts의 pwaPlugin이 만든 파일입니다. 직접 수정하지 마세요. */
const CACHE = 'games-vmuiaap8v';
const PRECACHE = [
  "./assets/hub-CS_Zumyd.css",
  "./assets/omok-_iV_uu2F.css",
  "./assets/janggi-ByUKz1B3.css",
  "./assets/sudoku-BbWrtbDC.css",
  "./assets/tetris-fjyYOuZW.css",
  "./assets/reversi-C8W0XywZ.css",
  "./assets/kkodle-D2Xgi7fF.css",
  "./assets/minesweeper-B_SKMI0Z.css",
  "./assets/nonogram-0lT7Gnp5.css",
  "./assets/solitaire-DJ7qmD0B.css",
  "./assets/g2048-BpiZUr8M.css",
  "./assets/breakout-CF8c8RiQ.css",
  "./assets/yut-BKsT7HDa.css",
  "./assets/pwa-C1qk58tU.css",
  "./assets/hub-d0ma1gwb.js",
  "./assets/omok-DjS6KijN.js",
  "./assets/janggi-B0pdeHGB.js",
  "./assets/sudoku-Bqum-YOj.js",
  "./assets/tetris-BHvUAXEg.js",
  "./assets/reversi-lX8B8JlQ.js",
  "./assets/kkodle-h13jiVZH.js",
  "./assets/minesweeper-DkCaA4fm.js",
  "./assets/nonogram-8HB8r3Tu.js",
  "./assets/DailyToggle-BFQPtwrh.js",
  "./assets/daily-5HwZDSkT.js",
  "./assets/solitaire-CfuF9H13.js",
  "./assets/g2048-DJbzMftg.js",
  "./assets/breakout-BLns32wM.js",
  "./assets/color-BAMIQH0K.js",
  "./assets/records-naaVqPS7.js",
  "./assets/yut-DUU2aIXl.js",
  "./assets/stats-D7cAYCAT.js",
  "./assets/useKeys-DxjyVNNJ.js",
  "./assets/react-C81AYkAM.js",
  "./assets/progress-BNQEEG8Q.js",
  "./assets/GameShell-DNC-L3AJ.js",
  "./assets/sound-CSdQGWAp.js",
  "./assets/pwa-SlPImvTy.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-192.png",
  "./maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./"
];

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
