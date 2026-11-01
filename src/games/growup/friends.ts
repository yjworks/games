import type { GameEvent } from './events';
import { FieldKey, FriendId, PlaceId } from './types';

export type { FriendId };

export interface Friend {
  id: FriendId;
  name: string;
  emoji: string;
  /** 자주 마주치는 곳 — 블록 마을에서 이 건물 앞에 서 있다 */
  place: PlaceId;
  /** 이 분야 활동을 하면 친해진다 */
  fields: FieldKey[];
  /** 픽셀 아바타 */
  hair: string;
  style: number;
  shirt: string;
  intro: string;
  /** 10년 뒤 — [친구, 단짝] */
  epilogue: [string, string];
}

/** 친해지는 단계 — 이 값을 넘으면 친구 사건이 한 번씩 열린다 */
export const FRIEND_LEVELS = [30, 70] as const;
/** 이만큼이면 처음 만난 것으로 친다(마을에 나타난다) */
export const FRIEND_MET = 5;

export const FRIENDS: Friend[] = [
  {
    id: 'minjun', name: '민준', emoji: '🤖', place: 'academy', fields: ['it', 'eng'],
    hair: '#2b2b33', style: 0, shirt: '#3f7fd0',
    intro: '뭐든 뜯어 보고 다시 조립하는 아이.',
    epilogue: [
      '민준이는 로봇 회사에 다닌다. 가끔 만든 시제품을 보내 온다.',
      '민준이는 지금도 제일 먼저 전화하는 친구다. 둘이 처음 만든 로봇이 아직 책상 위에 있다.',
    ],
  },
  {
    id: 'seoyeon', name: '서연', emoji: '🎨', place: 'classroom', fields: ['art', 'music'],
    hair: '#6a2f2f', style: 1, shirt: '#d0508a',
    intro: '스케치북을 늘 끼고 다니고, 노래도 잘 부른다.',
    epilogue: [
      '서연이는 작은 작업실을 차렸다. 전시회 초대장이 해마다 온다.',
      '서연이의 첫 전시회 맨 앞자리는 늘 내 자리다. 그림 한 점이 우리 집 거실에 걸려 있다.',
    ],
  },
  {
    id: 'doyun', name: '도윤', emoji: '⚽', place: 'field', fields: ['sport'],
    hair: '#4a3020', style: 0, shirt: '#e0a030',
    intro: '쉬는 시간 종이 치면 제일 먼저 운동장으로 뛰어나간다.',
    epilogue: [
      '도윤이는 유소년 축구 코치가 됐다. 동네 운동장에서 가끔 마주친다.',
      '도윤이와는 매주 일요일 아침에 같이 뛴다. 12년째 깨지지 않은 약속이다.',
    ],
  },
  {
    id: 'haeun', name: '하은', emoji: '📚', place: 'library', fields: ['write', 'edu'],
    hair: '#1f2a40', style: 2, shirt: '#3fa070',
    intro: '도서관 창가 자리의 주인. 이야기 공책을 몇 권째 쓰고 있다.',
    epilogue: [
      '하은이는 동화 작가 겸 선생님이 됐다. 새 책이 나오면 꼭 사인해서 보내 준다.',
      '하은이의 첫 책 머리말에 내 이름이 있다. 우리는 지금도 같은 도서관 창가에 앉는다.',
    ],
  },
];

export const friendById = (id: string) => FRIENDS.find((f) => f.id === id);

/** 친구 사건 — 친밀도가 문턱을 넘은 달에 한 번씩 나온다(무작위 사건보다 먼저) */
export const FRIEND_EVENTS: (GameEvent & { friend: FriendId; level: 0 | 1 })[] = [
  {
    id: 'friend-minjun-1', friend: 'minjun', level: 0, title: '민준이의 고장 난 로봇', emoji: '🤖',
    text: '민준이가 만든 로봇이 꼼짝도 안 한다. “같이 봐 줄래?”',
    options: [
      { label: '같이 뜯어서 고친다', fields: { eng: 5 }, stats: { craft: 2 }, result: '헐거운 전선 하나를 찾아냈다. 로봇이 삐빅 소리를 냈다!' },
      { label: '코드부터 살펴본다', fields: { it: 5 }, stats: { logic: 2 }, result: '반복문 하나가 잘못돼 있었다. 고치자마자 움직였다.' },
      { label: '옆에서 응원한다', mood: 6, stats: { social: 2 }, result: '민준이가 “네 덕에 포기 안 했어”라며 웃었다.' },
    ],
  },
  {
    id: 'friend-minjun-2', friend: 'minjun', level: 1, title: '민준이의 제안', emoji: '🛠️',
    text: '“우리 둘이 대회 나가 볼래? 너랑이면 할 수 있을 것 같아.”',
    options: [
      { label: '로봇 대회에 같이 나간다', fields: { eng: 8 }, bold: 4, fatigue: 10, result: '밤새 함께 조립했다. 결과보다 그 밤이 더 기억에 남는다.' },
      { label: '앱을 같이 만든다', fields: { it: 8 }, stats: { create: 2 }, result: '둘이 만든 앱을 반 친구들이 깔았다.' },
      { label: '다음에 하자고 한다', stress: -5, result: '민준이는 “그래, 다음엔 꼭!” 하고 손을 흔들었다.' },
    ],
  },
  {
    id: 'friend-seoyeon-1', friend: 'seoyeon', level: 0, title: '서연이의 스케치북', emoji: '🎨',
    text: '서연이가 아무한테도 안 보여 준 스케치북을 슬쩍 펼쳐 보였다.',
    options: [
      { label: '나란히 앉아 같이 그린다', fields: { art: 5 }, stats: { create: 2 }, result: '같은 풍경을 그렸는데 둘의 그림이 전혀 달랐다.' },
      { label: '그림에 노래를 붙인다', fields: { music: 5 }, stats: { express: 2 }, result: '그림 한 장에 노래 한 곡. 둘만의 놀이가 생겼다.' },
      { label: '진심으로 칭찬한다', stats: { social: 3 }, mood: 5, result: '서연이 볼이 빨개졌다.' },
    ],
  },
  {
    id: 'friend-seoyeon-2', friend: 'seoyeon', level: 1, title: '둘만의 전시회', emoji: '🖼️',
    text: '“우리 동네 카페 벽에 전시회 열어 볼래?”',
    options: [
      { label: '그림을 함께 건다', fields: { art: 8 }, bold: 3, result: '첫날 손님 열두 명. 방명록이 꽉 찼다.' },
      { label: '개막 공연을 맡는다', fields: { music: 8 }, stats: { express: 3 }, result: '기타 한 대로 문을 열었다. 박수가 쏟아졌다.' },
      { label: '홍보를 맡는다', fields: { biz: 6 }, stats: { social: 3 }, result: '전단지를 돌리고 SNS에 올렸다. 동네 소문이 났다.' },
    ],
  },
  {
    id: 'friend-doyun-1', friend: 'doyun', level: 0, title: '도윤이의 새벽 운동', emoji: '🌅',
    text: '“내일 새벽 여섯 시, 운동장에서 같이 뛸래?”',
    options: [
      { label: '알람 맞추고 같이 뛴다', stats: { body: 3 }, fields: { sport: 5 }, fatigue: 8, result: '해 뜨는 운동장을 열 바퀴 돌았다.' },
      { label: '기록을 재 준다', stats: { logic: 2 }, fields: { sport: 3 }, result: '도윤이의 기록이 매주 줄어드는 게 보였다.' },
      { label: '늦잠을 잔다', fatigue: -8, result: '도윤이가 “내일은 꼭 와!”라고 문자를 남겼다.' },
    ],
  },
  {
    id: 'friend-doyun-2', friend: 'doyun', level: 1, title: '도윤이의 부상', emoji: '🩹',
    text: '결승을 앞두고 도윤이가 발목을 다쳤다. 많이 속상해 보인다.',
    options: [
      { label: '재활을 돕는다', fields: { med: 6 }, stats: { social: 3 }, result: '매일 같이 스트레칭을 했다. 도윤이가 다시 뛰기 시작했다.' },
      { label: '대신 경기에 나간다', fields: { sport: 7 }, bold: 4, fatigue: 10, result: '도윤이 번호를 달고 뛰었다. 관중석에서 도윤이가 제일 크게 소리쳤다.' },
      { label: '응원 영상을 만든다', fields: { write: 5 }, stats: { create: 2 }, result: '반 친구들 응원을 모았다. 도윤이가 영상을 보고 울었다.' },
    ],
  },
  {
    id: 'friend-haeun-1', friend: 'haeun', level: 0, title: '하은이의 이야기 공책', emoji: '📓',
    text: '하은이가 이야기 공책을 내밀었다. “다음 장면이 안 떠올라.”',
    options: [
      { label: '뒷이야기를 이어 쓴다', fields: { write: 5 }, stats: { express: 2 }, result: '둘이 번갈아 쓴 이야기가 한 권이 됐다.' },
      { label: '동생들에게 읽어 준다', fields: { edu: 5 }, stats: { social: 2 }, result: '동생들이 다음 화를 조르기 시작했다.' },
      { label: '삽화를 그려 준다', fields: { art: 4 }, stats: { create: 2 }, result: '공책이 그림책이 됐다.' },
    ],
  },
  {
    id: 'friend-haeun-2', friend: 'haeun', level: 1, title: '하은이의 고민', emoji: '💭',
    text: '“나 선생님이 될까, 작가가 될까? 너라면 어떻게 할 거야?”',
    options: [
      { label: '가르치는 게 멋지다고 한다', fields: { edu: 6 }, stats: { social: 2 }, result: '말하다 보니 나도 가르치는 일이 궁금해졌다.' },
      { label: '계속 쓰라고 한다', fields: { write: 6 }, stats: { express: 2 }, result: '하은이가 그날 밤 새 이야기를 시작했다고 했다.' },
      { label: '둘 다 해 보라고 한다', bold: 4, stats: { create: 2 }, result: '“왜 하나만 골라야 해?” 둘이 동시에 웃었다.' },
    ],
  },
];
