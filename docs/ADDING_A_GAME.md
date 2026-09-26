# 게임 추가하기

게임 하나는 **폴더 하나 + HTML 하나 + 레지스트리 한 줄**로 끝나도록 만들어 두었습니다.
아래 순서대로 하면 허브 카드·튜토리얼·기록·효과음·오프라인 캐시가 자동으로 붙습니다.

예시로 `snake`를 추가한다고 가정합니다.

## 1. 레지스트리에 등록

`src/shared/registry.ts`의 `GameId` 유니온에 id를 넣고, `GAMES` 배열에 항목을 추가합니다.
허브 카드, 게임 상단바, 튜토리얼 제목이 모두 이 정의를 참조합니다.

```ts
{
  id: 'snake',
  title: '스네이크',
  subtitle: 'SNAKE',
  emoji: '🐍',
  desc: '한 줄 설명 — 허브 카드에 그대로 나옵니다.',
  controls: '방향키 · 스와이프',   // 마우스·키보드 기기에서 보이는 조작 안내
  touchControls: '스와이프',        // 터치 화면용(키 이름이 들어가면 따로 적는다)
  lore: [
    '서사 첫 줄',
    '서사 둘째 줄',
  ],
  category: '액션',
  tags: ['액션', '싱글'],
  accent: '#4ade80',
}
```

`lore`는 필수입니다. 허브 카드의 인용구, 튜토리얼 상단, 게임 시작 화면에서 함께 쓰입니다.

id는 저장소 이름(localStorage 네임스페이스)이라 한번 정하면 바꾸지 않습니다.
폴더 이름을 id와 다르게 두어야 한다면 `path: '2048'`처럼 경로를 따로 적습니다.
`gameHref()`가 이 값을 봅니다 — 빠뜨리면 허브 카드가 없는 주소로 갑니다.

## 1-2. 표식 그리기

`src/shared/react/GameMark.tsx`의 `MARKS`에 48×48 좌표계로 그림 하나를 추가합니다.
판의 한 조각을 그대로 그리면 됩니다 — 허브 카드와 게임 상단바에 함께 쓰입니다.
`GameId`에 id를 추가하면 여기 빠뜨린 게임은 타입 검사에서 걸립니다.

## 2. 폴더 만들기

```
src/games/snake/
  engine.ts      규칙만 담은 순수 로직 (DOM·React 없음 → 테스트 대상)
  tutorial.ts    TutorialContent
  App.tsx        화면
  main.tsx       엔트리
  snake.css      게임 전용 스타일
```

규칙은 반드시 `engine.ts`처럼 순수 함수로 분리하세요. 테스트가 쉬워지고,
나중에 AI를 붙일 때 그대로 재사용할 수 있습니다.

## 3. HTML 엔트리

`games/snake/index.html`을 다른 게임에서 복사해 제목·설명·아이콘만 바꿉니다.
`<script type="module" src="/src/games/snake/main.tsx">` 경로를 잊지 마세요.
`<link rel="canonical" href="https://dibrain.dev/games/games/snake/">`의 경로도 새 게임 것으로 바꿉니다.
글꼴 `<link rel="stylesheet" href="/vendor/fonts/pretendard.css">`와 `apple-mobile-web-app-title`(딴짓)은 그대로 둡니다.

## 4. vite 입력에 추가

`vite.config.ts`의 `rollupOptions.input`에 한 줄 추가합니다.

```ts
snake: resolve(__dirname, 'games/snake/index.html'),
```

## 5. 공통 레이어 붙이기

```tsx
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { snakeTutorial } from './tutorial';

const meta = gameById('snake');

export default function App() {
  return (
    <GameShell meta={meta} tutorial={snakeTutorial}>
      {/* 게임 화면 */}
    </GameShell>
  );
}
```

`main.tsx`에서는 공통 스타일과 서비스 워커 등록을 함께 합니다.

```tsx
import '../../shared/base.css';
import './snake.css';
import { registerServiceWorker } from '../../shared/pwa';
import { HUB_HREF } from '../../shared/registry';
// ...
registerServiceWorker(HUB_HREF);
```

React를 쓰지 않는다면 `shared/dom/shell.ts`와 `shared/dom/tutorial.ts`가 같은 일을 합니다(스도쿠 참고).

## 6. 저장·기록·전적

| 하고 싶은 것 | 쓰는 API |
|---|---|
| 게임 상태 저장 | `createStore('snake')` → `get/set/remove` |
| 허브에 “이어하기” 표시 | `setProgress('snake', '12점 진행 중')` / `clearProgress('snake')` |
| 최고 기록 | `submitBest('snake', 'score', 값, '표시문구', true)` — 시간 기록이면 마지막 인자를 `false` |
| AI 대전 전적 | `bumpStat('snake', 'wins' | 'losses' | 'draws')` |
| 효과음 | `sfx.place()`, `sfx.win()` … (전역 on/off는 셸이 처리) |

localStorage 키는 전부 `games:` 접두사 아래로 들어갑니다. 직접 `localStorage`를 만지지 마세요.
허브의 “기록 전체 삭제”가 이 접두사를 기준으로 동작합니다.

## 7. 테스트

`tests/snake-engine.test.ts`에 규칙 테스트를 추가합니다.
`npm test`는 `tests/**/*.test.ts`를 모두 실행합니다. 화면이 아니라 규칙을 검증하세요.

## 8. 모바일 퍼스트 체크리스트

- 기본 CSS는 좁은 화면 기준으로 쓰고, 넓은 화면은 `@media (min-width: 720px)`에서 확장합니다.
- 터치 목표는 최소 44px, 주 조작 버튼은 52px 이상.
- 하단 조작부에는 `padding-bottom: calc(… + env(safe-area-inset-bottom))`.
- 보드는 `dvh` 기준으로 크기를 잡고, 스크롤 없이 한 화면에 들어오게 합니다.
- 마우스 hover에만 의존하는 정보 표시를 두지 않습니다.
- 키보드 조작(방향키 + Enter)도 함께 제공합니다.
