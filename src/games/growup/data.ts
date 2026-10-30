import { FieldKey, Place, StatKey } from './types';

export const STAT_KEYS: StatKey[] = ['know', 'logic', 'create', 'express', 'body', 'craft', 'social'];

export const STAT_LABEL: Record<StatKey, string> = {
  know: '지식', logic: '논리', create: '창의', express: '표현', body: '체력', craft: '손재주', social: '사교',
};

export const STAT_COLOR: Record<StatKey, string> = {
  know: '#5b8def', logic: '#8b6cf0', create: '#f06cb4', express: '#f0a03c',
  body: '#3cc47a', craft: '#c9894a', social: '#3cb8d0',
};

export const FIELD_KEYS: FieldKey[] = ['it', 'eng', 'sci', 'med', 'art', 'music', 'write', 'food', 'sport', 'biz', 'edu'];

export const FIELD_LABEL: Record<FieldKey, string> = {
  it: 'IT·코딩', eng: '공학·로봇', sci: '과학·연구', med: '의료·돌봄', art: '미술·디자인', music: '음악·공연',
  write: '글·미디어', food: '요리', sport: '스포츠', biz: '경영·장사', edu: '교육·상담',
};

export const FIELD_EMOJI: Record<FieldKey, string> = {
  it: '💻', eng: '🤖', sci: '🔬', med: '🩺', art: '🎨', music: '🎵', write: '✍️', food: '🍳', sport: '⚽', biz: '💼', edu: '🍎',
};

/** 단계별 한 달 용돈(만원) */
export const ALLOWANCE = [1, 1, 2] as const;

/** 잠긴 활동을 여는 기본 단골도 */
const REG = 6;

export const PLACES: Place[] = [
  {
    id: 'home', name: '집', emoji: '🏠', from: 0, color: '#e9a15b',
    desc: '쉬어 가는 곳. 지친 달에는 집이 최고예요.',
    acts: [
      { id: 'rest', name: '푹 쉬기', emoji: '😴', desc: '아무것도 안 하고 뒹굴뒹굴.', safe: true, fatigue: -35, stress: -15, mood: 5 },
      { id: 'homework', name: '숙제하기', emoji: '✏️', desc: '미루지 않고 그날 할 일을 끝낸다.', main: 'know', stats: { know: 3, logic: 2 }, fatigue: 8, stress: 4, bold: -1 },
      { id: 'chores', name: '집안일 돕기', emoji: '🧹', desc: '설거지와 빨래 개기. 용돈을 조금 더 받는다.', main: 'body', stats: { craft: 1, social: 1, body: 1 }, fields: { food: 1 }, money: 1, fatigue: 8, mood: -2 },
      { id: 'game', name: '게임하기', emoji: '🎮', desc: '오늘은 실컷 논다. 기분이 확 풀린다.', safe: true, stats: { logic: 1 }, fields: { it: 2 }, mood: 12, stress: -12, fatigue: 3 },
    ],
  },
  {
    id: 'park', name: '놀이터·운동장', emoji: '🌳', from: 0, color: '#4fbf6b',
    desc: '뛰고 구르고 친구를 사귀는 곳.',
    acts: [
      { id: 'play', name: '친구랑 놀기', emoji: '🤸', desc: '술래잡기, 얼음땡, 수다.', main: 'social', stats: { social: 4, body: 1 }, mood: 10, stress: -10, fatigue: 10 },
      { id: 'soccer', name: '축구', emoji: '⚽', desc: '편을 나눠 한 판. 땀이 비 오듯 한다.', main: 'body', diff: 1, stats: { body: 4, social: 2 }, fields: { sport: 4 }, fatigue: 16, stress: -6 },
      { id: 'run', name: '달리기·줄넘기', emoji: '🏃', desc: '혼자서도 할 수 있는 체력 단련.', main: 'body', stats: { body: 5 }, fields: { sport: 3 }, fatigue: 14, stress: -4 },
      { id: 'sportsday', name: '동네 체육대회', emoji: '🏅', desc: '구청 대회에 학교 대표로 나간다.', main: 'body', diff: 2, contest: 'sport', lock: { visits: REG, stat: 'body', min: 30 }, stats: { body: 6, express: 2 }, fields: { sport: 8 }, bold: 5, fatigue: 20, stress: 4 },
    ],
  },
  {
    id: 'library', name: '도서관', emoji: '📚', from: 0, color: '#5b8def',
    desc: '조용한 곳에서 세상을 넓히는 시간.',
    acts: [
      { id: 'novel', name: '동화·소설 읽기', emoji: '📖', desc: '다른 사람의 삶을 살아 본다.', main: 'express', stats: { express: 3, create: 2 }, fields: { write: 4 }, mood: 4, stress: -3, fatigue: 5 },
      { id: 'science', name: '과학책 읽기', emoji: '🔭', desc: '우주, 공룡, 인체의 비밀.', main: 'know', diff: 1, stats: { know: 4 }, fields: { sci: 5 }, fatigue: 6 },
      { id: 'study', name: '자습', emoji: '📝', desc: '문제집을 펴고 버틴다.', main: 'know', diff: 1, stats: { know: 5, logic: 3 }, fatigue: 12, stress: 8, bold: -2 },
      { id: 'bookclub', name: '독서 모임', emoji: '💬', desc: '같은 책을 읽고 생각을 나눈다.', main: 'express', diff: 1, lock: { visits: REG }, stats: { express: 4, social: 3 }, fields: { write: 5, edu: 2 }, fatigue: 8 },
    ],
  },
  {
    id: 'academy', name: '학원가', emoji: '🏫', from: 0, color: '#8b6cf0',
    desc: '돈이 들지만 확실히 는다. 대신 지친다.',
    acts: [
      { id: 'math', name: '수학 학원', emoji: '➗', desc: '어려운 문제를 끝까지 붙잡는다.', main: 'logic', diff: 1, cost: 2, stats: { logic: 6, know: 2 }, fields: { sci: 2 }, fatigue: 14, stress: 10 },
      { id: 'english', name: '영어 학원', emoji: '🔤', desc: '단어 시험과 말하기 수업.', main: 'know', diff: 1, cost: 2, stats: { know: 5, express: 2 }, fatigue: 12, stress: 8 },
      { id: 'coding', name: '코딩 학원', emoji: '💻', desc: '블록 코딩부터 진짜 프로그램까지.', main: 'logic', diff: 1, cost: 2, stats: { logic: 4, create: 2 }, fields: { it: 7 }, fatigue: 12, stress: 6 },
      { id: 'artclass', name: '미술 학원', emoji: '🎨', desc: '데생, 수채화, 디지털 드로잉.', main: 'create', diff: 1, cost: 2, stats: { create: 5, craft: 2 }, fields: { art: 7 }, fatigue: 10, stress: 3 },
    ],
  },
  {
    id: 'kitchen', name: '주방', emoji: '🍳', from: 2, color: '#f07a4a',
    desc: '재료만 있으면 뭐든 만들 수 있다.',
    acts: [
      { id: 'snack', name: '간식 만들기', emoji: '🍪', desc: '쿠키 반죽을 조물조물.', main: 'craft', cost: 1, stats: { craft: 3, create: 2 }, fields: { food: 5 }, mood: 6, fatigue: 6 },
      { id: 'recipe', name: '요리 따라 하기', emoji: '🍲', desc: '레시피 영상을 보며 한 그릇.', main: 'craft', diff: 1, cost: 1, stats: { craft: 4, know: 1 }, fields: { food: 6 }, fatigue: 10 },
      { id: 'family', name: '가족 식사 차리기', emoji: '🍽️', desc: '온 가족이 먹을 저녁을 맡는다.', main: 'craft', diff: 1, stats: { craft: 3, social: 3 }, fields: { food: 4 }, mood: 5, fatigue: 12 },
      { id: 'cookoff', name: '어린이 요리 대회', emoji: '🏆', desc: '심사위원 앞에서 나만의 요리를.', main: 'craft', diff: 2, cost: 2, contest: 'food', lock: { visits: REG, stat: 'craft', min: 35 }, stats: { craft: 6, create: 4 }, fields: { food: 10 }, bold: 5, fatigue: 18, stress: 6 },
    ],
  },
  {
    id: 'culture', name: '문화센터', emoji: '🎭', from: 2, color: '#e0609a',
    desc: '음악, 연극, 그림. 무대가 있는 곳.',
    acts: [
      { id: 'piano', name: '피아노', emoji: '🎹', desc: '손가락이 건반 위를 달린다.', main: 'express', diff: 1, cost: 2, stats: { express: 3, create: 2 }, fields: { music: 6 }, fatigue: 8, stress: -2 },
      { id: 'drama', name: '연극 교실', emoji: '🎭', desc: '다른 사람이 되어 본다.', main: 'express', diff: 1, cost: 2, stats: { express: 5, social: 2 }, fields: { music: 4 }, fatigue: 10 },
      { id: 'drawing', name: '그림 교실', emoji: '🖌️', desc: '마음대로 그리는 자유 시간.', main: 'create', cost: 1, stats: { create: 4, craft: 2 }, fields: { art: 5 }, fatigue: 6, stress: -4 },
      { id: 'stage', name: '공연 무대', emoji: '🎤', desc: '진짜 관객 앞에 선다.', main: 'express', diff: 2, contest: 'music', lock: { visits: REG, stat: 'express', min: 40 }, stats: { express: 7, social: 3 }, fields: { music: 10 }, bold: 6, fatigue: 18, stress: 8 },
    ],
  },
  {
    id: 'market', name: '시장', emoji: '🛒', from: 4, color: '#e0b43c',
    desc: '사고파는 사람들. 돈이 도는 원리가 보인다.',
    acts: [
      { id: 'errand', name: '심부름', emoji: '🧺', desc: '장보기 목록을 들고 시장 한 바퀴.', main: 'social', stats: { social: 2, body: 1 }, money: 2, fatigue: 8 },
      { id: 'watch', name: '장사 구경', emoji: '👀', desc: '손님을 부르는 말, 물건을 놓는 자리.', safe: true, stats: { social: 1, logic: 1 }, fields: { biz: 6 }, mood: 3, fatigue: 5 },
      { id: 'flea', name: '벼룩시장 판매', emoji: '🪙', desc: '안 쓰는 물건에 값을 매겨 판다.', main: 'social', diff: 1, stats: { social: 3, express: 2 }, fields: { biz: 7 }, money: 2, bold: 4, fatigue: 12, stress: 4 },
      { id: 'mentor', name: '사장님 멘토링', emoji: '🧑‍💼', desc: '단골 가게 사장님이 장사 비법을 알려 준다.', main: 'social', diff: 1, flag: 'mentor', lock: { visits: REG, stat: 'social', min: 40 }, stats: { social: 3, logic: 2 }, fields: { biz: 10 }, bold: 6, fatigue: 8 },
    ],
  },
  {
    id: 'maker', name: '메이커 공방', emoji: '🔧', from: 6, color: '#4aa8c9',
    desc: '납땜 냄새와 톱밥. 직접 만드는 곳.',
    acts: [
      { id: 'robot', name: '로봇 조립', emoji: '🤖', desc: '모터와 센서로 움직이는 친구를.', main: 'craft', diff: 2, cost: 2, stats: { craft: 4, logic: 3 }, fields: { eng: 7 }, fatigue: 12, stress: 4 },
      { id: 'circuit', name: '전자회로', emoji: '⚡', desc: 'LED 하나 켜는 데서 시작.', main: 'logic', diff: 2, cost: 1, stats: { logic: 4, know: 2 }, fields: { eng: 6, it: 2 }, fatigue: 10, stress: 5 },
      { id: 'wood', name: '목공', emoji: '🪚', desc: '나무를 깎아 의자 하나.', main: 'craft', diff: 1, cost: 1, stats: { craft: 5, body: 2 }, fields: { eng: 3, art: 2 }, fatigue: 12 },
      { id: 'invent', name: '발명대회 준비', emoji: '💡', desc: '생활 속 불편을 고치는 발명품.', main: 'craft', diff: 3, contest: 'eng', lock: { visits: REG, stat: 'craft', min: 45 }, stats: { create: 6, craft: 4, logic: 3 }, fields: { eng: 10 }, bold: 6, fatigue: 20, stress: 10 },
    ],
  },
  {
    id: 'welfare', name: '복지관', emoji: '🤝', from: 6, color: '#3cc4a0',
    desc: '누군가에게 도움이 되는 시간.',
    acts: [
      { id: 'volunteer', name: '봉사활동', emoji: '🙌', desc: '배식과 청소, 말동무.', main: 'social', stats: { social: 4, express: 1 }, fields: { med: 4, edu: 2 }, mood: 6, fatigue: 12 },
      { id: 'tutor', name: '동생들 공부 봐주기', emoji: '🧒', desc: '가르치면서 내가 더 배운다.', main: 'express', diff: 1, stats: { know: 2, express: 3, social: 2 }, fields: { edu: 7 }, fatigue: 10 },
      { id: 'nursing', name: '간호 체험', emoji: '🩺', desc: '혈압 재기와 붕대 감기.', main: 'know', diff: 1, stats: { know: 2, body: 2, social: 2 }, fields: { med: 7 }, fatigue: 12 },
      { id: 'medcamp', name: '의료 봉사 캠프', emoji: '🏥', desc: '의료진을 따라 마을을 돈다.', main: 'know', diff: 2, contest: 'med', lock: { visits: REG, stat: 'know', min: 50 }, stats: { know: 5, social: 3 }, fields: { med: 11 }, bold: 3, fatigue: 20, stress: 6 },
    ],
  },
  {
    id: 'media', name: '미디어실', emoji: '🎬', from: 6, color: '#d05050',
    desc: '찍고, 쓰고, 세상에 내보낸다.',
    acts: [
      { id: 'video', name: '영상 만들기', emoji: '🎥', desc: '찍고 자르고 자막을 단다.', main: 'create', diff: 1, stats: { create: 4, express: 2 }, fields: { write: 4, it: 3 }, fatigue: 10 },
      { id: 'blog', name: '글쓰기', emoji: '✍️', desc: '블로그에 한 편씩 쌓는다.', main: 'express', diff: 1, stats: { express: 5, know: 1 }, fields: { write: 6 }, fatigue: 6 },
      { id: 'photo', name: '사진 찍기', emoji: '📷', desc: '같은 길도 다르게 보인다.', main: 'create', stats: { create: 4, body: 1 }, fields: { art: 5 }, mood: 5, fatigue: 8 },
      { id: 'channel', name: '채널 운영', emoji: '📡', desc: '구독자와 함께 키우는 내 채널.', main: 'express', diff: 3, contest: 'write', lock: { visits: REG, stat: 'express', min: 45 }, stats: { express: 6, create: 4, social: 3 }, fields: { write: 10, biz: 3 }, bold: 6, fatigue: 16, stress: 8 },
    ],
  },
  {
    id: 'parttime', name: '아르바이트', emoji: '💼', from: 9, color: '#9a8a6a',
    desc: '내 손으로 버는 첫 돈. 고되지만 배운다.',
    acts: [
      { id: 'store', name: '편의점', emoji: '🏪', desc: '진열, 계산, 밤의 손님들.', main: 'body', stats: { social: 2, body: 2 }, fields: { biz: 2 }, money: 5, fatigue: 18, stress: 8 },
      { id: 'cafe', name: '카페', emoji: '☕', desc: '라테 아트는 아직 연습 중.', main: 'social', diff: 1, stats: { social: 3, craft: 2 }, fields: { food: 3, biz: 2 }, money: 4, fatigue: 16, stress: 6 },
      { id: 'assist', name: '학원 조교', emoji: '📋', desc: '채점하고 질문을 받는다.', main: 'know', diff: 1, stats: { know: 2, express: 2 }, fields: { edu: 4 }, money: 4, fatigue: 14, stress: 6 },
      { id: 'intern', name: '직업 인턴 체험', emoji: '🏢', desc: '가장 관심 있는 분야의 현장에 간다.', main: 'social', diff: 2, special: 'topField', lock: { visits: 5, stat: 'social', min: 50 }, stats: { social: 3, logic: 2 }, money: 3, bold: 3, fatigue: 18, stress: 8 },
    ],
  },
  {
    id: 'career', name: '진로체험센터', emoji: '🧭', from: 9, color: '#5bb0e0',
    desc: '내가 뭘 좋아하는지 확인하는 곳.',
    acts: [
      { id: 'jobexp', name: '직업 체험', emoji: '🧪', desc: '오늘은 어떤 직업일까? 뜻밖의 관심이 생긴다.', main: 'social', special: 'randomField', stats: { social: 1, know: 1 }, mood: 5, fatigue: 8 },
      { id: 'interview', name: '모의 면접', emoji: '🎙️', desc: '떨리는 목소리를 다잡는 연습.', main: 'express', diff: 1, stats: { express: 4, social: 3, logic: 1 }, fatigue: 8, stress: 8 },
      { id: 'counsel', name: '진로 상담', emoji: '🗺️', desc: '선생님과 내 관심사를 정리해 본다.', safe: true, special: 'counsel', stress: -10, mood: 5, fatigue: 4 },
      { id: 'startupcamp', name: '창업 캠프', emoji: '🚀', desc: '아이디어를 사업 계획서로.', main: 'social', diff: 2, cost: 3, contest: 'biz', lock: { visits: 5, bold: 20 }, stats: { create: 3, social: 3 }, fields: { biz: 10 }, bold: 8, fatigue: 20, stress: 10 },
    ],
  },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);

export const HAIR_COLORS = ['#3a2a20', '#7a4a2a', '#c98a3a', '#2a2f4a', '#8a3a4a'];
export const HAIR_STYLES = ['짧은 머리', '긴 머리', '묶은 머리'];
