/**
 * DigitalBrain 공통 상단 바에 쓰는 값.
 * 마크 경로는 leeyunjai.github.io 저장소 brand/README.md 의 원본을 그대로 옮겼다.
 */
export const DB_HOME_HREF = 'https://dibrain.dev/';
export const DB_HOME_LABEL = 'DigitalBrain 첫 화면';
export const DB_MARK_SVG =
  '<svg viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="22" fill="#2f6fed"/><path fill="#fff" d="M25.5 24H40.5a3.5 3.5 0 0 1 3.5 3.5V68.5a3.5 3.5 0 0 1-3.5 3.5H25.5a3.5 3.5 0 0 1-3.5-3.5V27.5a3.5 3.5 0 0 1 3.5-3.5Z M49 23.2a24.8 24.8 0 0 1 0 49.6Z"/></svg>';

/** 공통 상단 바 왼쪽의 브랜드 마크 링크(DOM 버전). React 쪽은 react/GameShell.tsx 의 DbHome */
export function createDbHome(): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'db-home';
  a.href = DB_HOME_HREF;
  a.setAttribute('aria-label', DB_HOME_LABEL);
  a.innerHTML = DB_MARK_SVG;
  return a;
}
