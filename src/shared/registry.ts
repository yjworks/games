/** 허브 필터용 분류 */
export type Category = '보드' | '퍼즐' | '액션' | '데일리';

export const CATEGORIES: Category[] = ['보드', '퍼즐', '액션', '데일리'];

/** 게임 식별자 — 저장소 이름이기도 하므로 한번 정하면 바꾸지 않는다 */
export type GameId =
  | 'omok' | 'janggi' | 'sudoku' | 'tetris' | 'reversi' | 'kkodle'
  | 'minesweeper' | 'nonogram' | 'solitaire' | 'g2048' | 'breakout' | 'yut';

/** 허브와 각 게임이 함께 쓰는 게임 목록(메타데이터) */
export interface GameMeta {
  id: GameId;
  /** 페이지 경로. 없으면 id를 그대로 쓴다 (id는 저장소 이름이라 경로와 다를 수 있다) */
  path?: string;
  title: string;
  /** 부제 (원어/영문) */
  subtitle: string;
  emoji: string;
  /** 허브 카드에 쓰는 한 줄 설명 */
  desc: string;
  /** 조작 요약 — 마우스·키보드가 있는 기기에서 허브 카드에 보인다 */
  controls: string;
  /** 터치 화면용 조작 요약. 없으면 controls 를 그대로 쓴다(키보드 안내는 터치 화면에서 숨긴다) */
  touchControls?: string;
  /** 게임을 소개하는 짧은 서사 (2~3줄) */
  lore: string[];
  /** 허브 필터에 쓰는 큰 분류 */
  category: Category;
  tags: string[];
  /** 카드/헤더 강조색 (CSS 색상) */
  accent: string;
}

export const GAMES: GameMeta[] = [
  {
    id: 'omok',
    title: '오목',
    subtitle: 'GOMOKU · 五目',
    emoji: '⚫',
    desc: '15×15 바둑판에서 다섯 개를 먼저 잇는 쪽이 승리. 3단계 AI와 2인 대국.',
    controls: '클릭 · 방향키 + Enter',
    touchControls: '탭해서 착수',
    category: '보드',
    tags: ['보드', 'AI 대전', '2인'],
    accent: '#d9a43c',
    lore: [
      '한 점을 놓는 데 걸리는 시간은 몇 초.',
      '그 몇 초가 열 수 뒤의 판을 통째로 바꾼다.',
      '다섯을 잇는 일은 언제나 그 전에 결정된다.',
    ],
  },
  {
    id: 'janggi',
    title: '장기',
    subtitle: 'JANGGI · 楚漢之爭',
    emoji: '🀄',
    desc: '차림 선택과 점수제를 갖춘 한국 장기. 궁·차·포·마·상 전부 구현.',
    controls: '클릭 · 방향키 + Enter',
    touchControls: '탭해서 기물 선택 · 이동',
    category: '보드',
    tags: ['보드', 'AI 대전', '2인'],
    accent: '#e05a4a',
    lore: [
      '초와 한이 판 하나를 사이에 두고 마주 선다.',
      '궁은 궁성을 떠나지 못하고, 병졸은 뒤로 돌아오지 못한다.',
      '모두가 제 자리에서 할 수 있는 일만 하며 판이 기운다.',
    ],
  },
  {
    id: 'sudoku',
    title: '스도쿠',
    subtitle: 'SUDOKU · 數獨',
    emoji: '🔢',
    desc: '유일해가 보장된 퍼즐 생성기, 메모·되돌리기·힌트·기록까지.',
    controls: '숫자키 · 방향키',
    touchControls: '칸 선택 · 숫자 패드',
    category: '퍼즐',
    tags: ['퍼즐', '싱글'],
    accent: '#4361ee',
    lore: [
      '빈 칸은 아홉 개의 가능성을 품고 있다.',
      '하나씩 지워 나가면 남는 것은 언제나 하나.',
      '운이 아니라 순서의 문제다.',
    ],
  },
  {
    id: 'tetris',
    title: '테트리스',
    subtitle: 'TETRIS · 落下物',
    emoji: '🧱',
    desc: 'SRS 회전과 월킥, 7-bag, 홀드, 고스트, T-스핀과 백투백 보너스까지.',
    controls: '방향키 · Space · Shift',
    touchControls: '화면 버튼 · 밀어서 이동',
    category: '액션',
    tags: ['액션', '싱글', '점수'],
    accent: '#22c1a4',
    lore: [
      '한 번 내려온 조각은 되돌릴 수 없다.',
      '판에 남는 건 쌓아 올린 판단의 흔적뿐.',
      '지워지는 순간에만 자리가 생긴다.',
    ],
  },
  {
    id: 'reversi',
    title: '리버시',
    subtitle: 'REVERSI · 오델로',
    emoji: '⚪',
    desc: '착수 가능 위치 표시와 종반 완전탐색을 갖춘 8×8 오델로.',
    controls: '클릭 · 방향키 + Enter',
    touchControls: '탭해서 착수',
    category: '보드',
    tags: ['보드', 'AI 대전', '2인'],
    accent: '#7048e8',
    lore: [
      '같은 돌이 흑이 되었다가 백이 된다.',
      '많이 가진 쪽이 곧 잃을 자리가 많은 쪽이다.',
      '마지막 한 수까지 판은 누구의 것도 아니다.',
    ],
  },
  {
    id: 'kkodle',
    title: '꼬들',
    subtitle: 'KKODLE · 한글 낱말',
    emoji: '🔤',
    desc: '두 글자 낱말을 여덟 번 안에. 하루 한 문제와 무한 모드, 연속 일수 기록.',
    controls: '화면 자판 · 두벌식 키보드',
    touchControls: '화면 자판',
    lore: [
      '낱말 하나를 두고 여덟 번의 기회.',
      '틀린 글자도 남긴다 — 어디에 없는지를.',
      '지워 나가다 보면 남는 건 하나뿐이다.',
    ],
    category: '데일리',
    tags: ['데일리', '낱말', '싱글'],
    accent: '#f0a63c',
  },
  {
    id: 'minesweeper',
    title: '지뢰찾기',
    subtitle: 'MINESWEEPER',
    emoji: '💣',
    desc: '추측 없이 논리로만 풀리는 판만 출제. 길게 눌러 깃발, 숫자를 눌러 한 번에 열기.',
    controls: '탭 · 길게 누르기',
    lore: [
      '숫자는 거짓말을 하지 않는다.',
      '모르는 건 판이 아니라 아직 읽지 않은 나다.',
      '찍을 자리는 여기 없다.',
    ],
    category: '퍼즐',
    tags: ['퍼즐', '싱글', '기록'],
    accent: '#5aa0f0',
  },
  {
    id: 'nonogram',
    title: '노노그램',
    subtitle: 'NONOGRAM · 네모로직',
    emoji: '🖼️',
    desc: '가장자리 숫자를 읽어 그림을 찾는 논리 퍼즐. 줄 논리만으로 전부 풀리는 문제만 출제.',
    controls: '탭 · 밀어서 칠하기',
    lore: [
      '숫자는 길이만 알려 준다. 어디인지는 말해 주지 않는다.',
      '겹치는 자리부터 하나씩.',
      '다 칠하고 나면 그림이 남는다.',
    ],
    category: '퍼즐',
    tags: ['퍼즐', '싱글', '기록'],
    accent: '#a78bfa',
  },
  {
    id: 'solitaire',
    title: '솔리테어',
    subtitle: 'KLONDIKE',
    emoji: '🃏',
    desc: '클래식 클론다이크. 한 번 더 누르면 알아서 올라가고, 되돌리기와 자동 완성까지.',
    controls: '탭 · 두 번 탭',
    lore: [
      '뒤집힌 카드는 아직 오지 않은 시간이다.',
      '한 장을 넘기려면 그 위의 것들을 먼저 치워야 한다.',
      '순서를 지키면 언젠가 전부 제자리에 놓인다.',
    ],
    category: '퍼즐',
    tags: ['카드', '싱글', '기록'],
    accent: '#10a37f',
  },
  {
    id: 'g2048',
    path: '2048',
    title: '2048',
    subtitle: '2048 · 숫자 합치기',
    emoji: '🧮',
    desc: '같은 수를 붙여 2048까지. 되돌리기와 최고 타일 기록, 달성 후 계속하기.',
    controls: '쓸어넘기기 · 방향키',
    touchControls: '쓸어넘기기',
    lore: [
      '같은 것끼리만 하나가 된다.',
      '한 칸을 비우려면 두 칸을 붙여야 한다.',
      '구석을 지키는 쪽이 오래 남는다.',
    ],
    category: '액션',
    tags: ['액션', '싱글', '점수'],
    accent: '#edc22e',
  },
  {
    id: 'breakout',
    title: '벽돌깨기',
    subtitle: 'BREAKOUT',
    emoji: '🏓',
    desc: '패들 어디에 맞느냐로 각이 갈립니다. 떨어지는 아이템 세 가지와 판마다 달라지는 배치.',
    controls: '드래그 · 방향키',
    touchControls: '드래그',
    tags: ['액션', '싱글', '점수'],
    category: '액션',
    lore: [
      '벽은 한 번에 무너지지 않는다.',
      '각도를 만드는 건 공이 아니라 받는 쪽이다.',
      '놓친 공만큼 배운다.',
    ],
    accent: '#5eead4',
  },
  {
    id: 'yut',
    title: '윷놀이',
    subtitle: 'YUT NORI · 윷',
    emoji: '🎲',
    desc: '도개걸윷모와 뒤도, 지름길과 업기·잡기까지 갖춘 윷놀이. AI 대전과 2인 대국.',
    controls: '던지기 · 말 선택',
    lore: [
      '던지기 전까지는 아무도 모른다.',
      '먼저 간 말이 잡히고, 뒤처진 말이 지름길을 탄다.',
      '업을지 흩을지, 그것만이 내 몫이다.',
    ],
    category: '보드',
    tags: ['보드', 'AI 대전', '2인'],
    accent: '#f0873c',
  },
];

export function gameById(id: GameId): GameMeta {
  const meta = GAMES.find((g) => g.id === id);
  if (!meta) throw new Error(`알 수 없는 게임: ${id}`);
  return meta;
}

/** 허브(루트)에서 게임 페이지로 가는 상대 경로 */
export const gameHref = (id: GameId) => {
  const meta = GAMES.find((g) => g.id === id);
  return `games/${meta?.path ?? id}/`;
};
/** 게임 페이지(games/<id>/)에서 허브로 돌아가는 상대 경로 */
export const HUB_HREF = '../../';
