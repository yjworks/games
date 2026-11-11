/**
 * 서비스 워커 등록 — 한 번 방문한 뒤에는 네트워크 없이도 실행된다.
 * 상대 경로만 쓰기 때문에 저장소 이름이나 배포 경로가 바뀌어도 그대로 동작한다.
 * 새 버전이 배포되면 화면 아래에 “새로고침” 안내를 띄운다(저장은 브라우저에 남아 있어 새로고침해도 이어진다).
 */
export function registerServiceWorker(rootHref: string): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  /* 개발 서버에서는 캐시가 방해되므로 등록하지 않는다 */
  if (import.meta.env.DEV) return;

  window.addEventListener('load', () => {
    const root = new URL(rootHref, window.location.href);
    const swUrl = new URL('sw.js', root);
    /* 처음 설치일 때는 안내하지 않는다 — 이미 옛 버전이 화면을 맡고 있을 때만 */
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showUpdateBanner();
    });
    navigator.serviceWorker.register(swUrl.href, { scope: root.href })
      .then((reg) => {
        /* 다른 탭에 있다가 돌아오면 새 버전이 있는지 확인한다 */
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {});
        });
      })
      .catch(() => {
        /* 등록 실패해도 게임 자체는 그대로 동작한다 */
      });
  });
}

const BANNER_ID = 'pwa-update-banner';

/** 새 버전 안내 — 화면 아래 가운데. 누르면 새로고침, ✕ 로 닫는다 */
export function showUpdateBanner(): void {
  if (document.getElementById(BANNER_ID)) return;
  const bar = document.createElement('div');
  bar.id = BANNER_ID;
  bar.setAttribute('role', 'status');
  bar.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:calc(16px + env(safe-area-inset-bottom))', 'transform:translateX(-50%)',
    'z-index:2147483000', 'display:flex', 'align-items:center', 'gap:10px', 'max-width:calc(100vw - 32px)',
    'padding:10px 10px 10px 16px', 'border-radius:12px', 'background:#14121b', 'color:#f4f0fa',
    'border:2px solid #ffc23d', 'box-shadow:0 6px 24px rgba(0,0,0,.45)', 'font:600 14px/1.3 system-ui,sans-serif', 'white-space:nowrap',
  ].join(';');
  const text = document.createElement('span');
  text.textContent = '새 버전이 나왔어요';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = '새로고침';
  reload.style.cssText = 'border:0;border-radius:8px;padding:8px 12px;background:#ffc23d;color:#2a1a00;font:800 14px system-ui,sans-serif;cursor:pointer';
  reload.addEventListener('click', () => window.location.reload());
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', '닫기');
  close.style.cssText = 'border:0;background:transparent;color:#b7afc8;font:700 16px system-ui,sans-serif;padding:6px;cursor:pointer';
  close.addEventListener('click', () => bar.remove());
  bar.append(text, reload, close);
  document.body.appendChild(bar);
}
