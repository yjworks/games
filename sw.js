/* 자동 생성 — vite.config.ts의 pwaPlugin이 만든 파일입니다. 직접 수정하지 마세요. */
const CACHE = 'games-vmwebtg8f';
/* 글꼴 조각은 바뀌지 않으므로 CACHE 를 올려도 지우지 않는다 */
const FONT_CACHE = 'games-fonts-v1';
const PRECACHE = [
  "./assets/hub-BXdIV0hM.css",
  "./assets/omok-CjGDpAzF.css",
  "./assets/janggi-C16nWZCp.css",
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
  "./assets/samguk-UBMPMWnc.css",
  "./assets/growup-tXyf2ssq.css",
  "./assets/pwa-DzUScA1d.css",
  "./assets/hub-Dop6RSjp.js",
  "./assets/omok-Di_-XrmW.js",
  "./assets/janggi-Bium0GiD.js",
  "./assets/sudoku-DOkgsKBl.js",
  "./assets/tetris-3TTbuMeo.js",
  "./assets/reversi-DuCfYKm7.js",
  "./assets/kkodle-1JvNZuJd.js",
  "./assets/minesweeper-CKcDfPy3.js",
  "./assets/nonogram-BHfmvS6Q.js",
  "./assets/DailyToggle-BTX7wV-e.js",
  "./assets/daily-TrXvC1Qt.js",
  "./assets/solitaire-Ccp6Frvl.js",
  "./assets/g2048-B-LY-XdP.js",
  "./assets/breakout-DEO1e6rh.js",
  "./assets/color-BAMIQH0K.js",
  "./assets/records-hFDQBUGc.js",
  "./assets/yut-LwQ23xte.js",
  "./assets/stats-Dn3zwtdw.js",
  "./assets/useKeys-GlBklTjj.js",
  "./assets/samguk-0oQBrOPq.js",
  "./assets/growup-CmsbLL4R.js",
  "./assets/react-CRDcYqvv.js",
  "./assets/progress-B_b0q7cG.js",
  "./assets/GameShell-D3bOFJuI.js",
  "./assets/sound-B_NoAxnW.js",
  "./assets/pwa-BzEpenZc.js",
  "./assets/Field3D-BZcWZgHt.js",
  "./assets/WorldMap3D-BFlVRQ6g.js",
  "./assets/MapControls-CyXgqPuS.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-192.png",
  "./maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon.ico",
  "./vendor/fonts/pretendard.css",
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
