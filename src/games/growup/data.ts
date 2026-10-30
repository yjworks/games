import { FieldKey, Place, PlaceId, StatKey } from './types';

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

/** 잠긴 활동을 여는 기본 단골도(이번 학교급 안에서 센다) */
const REG = 6;

/**
 * 장소는 4곳뿐이다 — 파이브레인 버튼 ①~④에 그대로 대응한다.
 * 같은 장소라도 초·중·고마다 할 수 있는 활동 4개가 달라진다.
 */
export const PLACES: Place[] = [
  {
    id: 'home', name: '집', emoji: '🏠', color: '#e9a15b',
    stages: [
      {
        label: '집', desc: '쉬어 가는 곳. 지친 달에는 집이 최고예요.',
        acts: [
          { id: 'rest', name: '푹 쉬기', emoji: '😴', desc: '아무것도 안 하고 뒹굴뒹굴.', safe: true, fatigue: -35, stress: -15, mood: 5 },
          { id: 'homework', name: '숙제하기', emoji: '✏️', desc: '미루지 않고 그날 할 일을 끝낸다.', main: 'know', stats: { know: 3, logic: 2 }, fatigue: 8, stress: 4, bold: -1 },
          { id: 'snack', name: '간식 만들기', emoji: '🍪', desc: '쿠키 반죽을 조물조물.', main: 'craft', cost: 1, stats: { craft: 3, create: 2 }, fields: { food: 5 }, mood: 6, fatigue: 6 },
          { id: 'game', name: '게임하기', emoji: '🎮', desc: '오늘은 실컷 논다. 기분이 확 풀린다.', safe: true, stats: { logic: 1 }, fields: { it: 2 }, mood: 12, stress: -12, fatigue: 3 },
        ],
      },
      {
        label: '집', desc: '내 방 책상과 부엌. 혼자서 하는 일들.',
        acts: [
          { id: 'rest', name: '푹 쉬기', emoji: '😴', desc: '이불 속이 최고다.', safe: true, fatigue: -35, stress: -15, mood: 5 },
          { id: 'study', name: '자습', emoji: '📝', desc: '문제집을 펴고 버틴다.', main: 'know', diff: 1, stats: { know: 5, logic: 3 }, fatigue: 12, stress: 8, bold: -2 },
          { id: 'cook', name: '요리하기', emoji: '🍲', desc: '레시피 영상을 보며 한 그릇.', main: 'craft', diff: 1, cost: 1, stats: { craft: 4, social: 1 }, fields: { food: 6 }, fatigue: 10 },
          { id: 'video', name: '영상 만들기', emoji: '🎥', desc: '찍고 자르고 자막을 단다.', main: 'create', diff: 1, stats: { create: 4, express: 2 }, fields: { write: 3, art: 3, it: 2 }, fatigue: 10 },
        ],
      },
      {
        label: '집', desc: '입시와 꿈 사이, 내 시간을 쓰는 곳.',
        acts: [
          { id: 'rest', name: '푹 쉬기', emoji: '😴', desc: '오늘만은 아무 생각 없이.', safe: true, fatigue: -35, stress: -15, mood: 5 },
          { id: 'cram', name: '수능 공부', emoji: '📚', desc: '모의고사 오답 노트를 채운다.', main: 'know', diff: 2, stats: { know: 6, logic: 4 }, fatigue: 14, stress: 12, bold: -2 },
          { id: 'blog', name: '글쓰기·채널 운영', emoji: '✍️', desc: '블로그와 채널에 한 편씩 쌓는다.', main: 'express', diff: 1, stats: { express: 5, create: 2 }, fields: { write: 6, biz: 2 }, fatigue: 8 },
          { id: 'workout', name: '운동 루틴', emoji: '🏋️', desc: '매일 아침 달리기와 근력 운동.', main: 'body', stats: { body: 5 }, fields: { sport: 4 }, fatigue: 12, stress: -8 },
        ],
      },
    ],
  },
  {
    id: 'school', name: '학교', emoji: '🏫', color: '#5b8def',
    stages: [
      {
        label: '초등학교', desc: '배우고 뛰놀고 친구를 사귀는 곳.',
        acts: [
          { id: 'class', name: '수업 집중', emoji: '🙋', desc: '손 들고 발표도 해 본다.', main: 'know', stats: { know: 4, express: 1 }, fatigue: 8, stress: 3 },
          { id: 'soccer', name: '운동장 축구', emoji: '⚽', desc: '쉬는 시간마다 한 판.', main: 'body', diff: 1, stats: { body: 4, social: 2 }, fields: { sport: 4 }, fatigue: 16, stress: -6 },
          { id: 'play', name: '친구랑 놀기', emoji: '🤸', desc: '술래잡기, 얼음땡, 수다.', main: 'social', stats: { social: 4, body: 1 }, mood: 10, stress: -10, fatigue: 10 },
          { id: 'recital', name: '학예회 무대', emoji: '🎤', desc: '반 대표로 무대에 선다.', main: 'express', diff: 2, contest: 'music', lock: { visits: REG, stat: 'express', min: 25 }, stats: { express: 5, social: 2 }, fields: { music: 8 }, bold: 5, fatigue: 14, stress: 6 },
        ],
      },
      {
        label: '중학교', desc: '과목도 많아지고 동아리도 생겼다.',
        acts: [
          { id: 'class', name: '수업 집중', emoji: '🙋', desc: '필기를 꼼꼼히 한다.', main: 'know', diff: 1, stats: { know: 4, logic: 2 }, fatigue: 10, stress: 4 },
          { id: 'lab', name: '과학 실험', emoji: '🔬', desc: '가설을 세우고 직접 확인한다.', main: 'logic', diff: 1, stats: { know: 3, logic: 3 }, fields: { sci: 6 }, fatigue: 10 },
          { id: 'pe', name: '체육 활동', emoji: '🏀', desc: '농구, 배구, 달리기.', main: 'body', stats: { body: 4, social: 2 }, fields: { sport: 5 }, fatigue: 14, stress: -5 },
          { id: 'band', name: '밴드·연극 연습', emoji: '🎸', desc: '축제 무대를 준비한다.', main: 'express', diff: 1, stats: { express: 4, create: 2 }, fields: { music: 6 }, fatigue: 10 },
        ],
      },
      {
        label: '고등학교', desc: '진로를 정해야 하는 마지막 학교.',
        acts: [
          { id: 'class', name: '수업 집중', emoji: '🙋', desc: '수업 시간에 끝낸다.', main: 'know', diff: 1, stats: { know: 5, logic: 2 }, fatigue: 10, stress: 5 },
          { id: 'counsel', name: '진로 상담', emoji: '🗺️', desc: '선생님과 내 관심사를 정리해 본다.', safe: true, special: 'counsel', stress: -10, mood: 5, fatigue: 4 },
          { id: 'project', name: '동아리 프로젝트', emoji: '🧪', desc: '가장 관심 있는 분야로 직접 만들어 본다.', main: 'social', diff: 1, special: 'topField', stats: { create: 2, social: 2 }, fatigue: 14, stress: 4 },
          { id: 'olympiad', name: '교내 경시대회', emoji: '🏅', desc: '수학·과학 실력을 겨룬다.', main: 'know', diff: 2, contest: 'sci', lock: { visits: REG, stat: 'know', min: 55 }, stats: { know: 5, logic: 4 }, fields: { sci: 10 }, bold: 4, fatigue: 18, stress: 10 },
        ],
      },
    ],
  },
  {
    id: 'town', name: '동네', emoji: '🏘️', color: '#4fbf6b',
    stages: [
      {
        label: '동네', desc: '도서관, 시장, 놀이터가 다 있는 우리 동네.',
        acts: [
          { id: 'novel', name: '도서관에서 동화 읽기', emoji: '📖', desc: '다른 사람의 삶을 살아 본다.', main: 'express', stats: { express: 3, create: 2 }, fields: { write: 4 }, mood: 4, stress: -3, fatigue: 5 },
          { id: 'science', name: '도서관에서 과학책 읽기', emoji: '🔭', desc: '우주, 공룡, 인체의 비밀.', main: 'know', diff: 1, stats: { know: 4 }, fields: { sci: 5 }, fatigue: 6 },
          { id: 'errand', name: '시장 심부름', emoji: '🧺', desc: '장보기 목록을 들고 시장 한 바퀴.', main: 'social', stats: { social: 2, body: 1 }, fields: { biz: 2 }, money: 2, fatigue: 8 },
          { id: 'sportsday', name: '동네 체육대회', emoji: '🏅', desc: '구청 대회에 학교 대표로 나간다.', main: 'body', diff: 2, contest: 'sport', lock: { visits: REG, stat: 'body', min: 30 }, stats: { body: 6, express: 2 }, fields: { sport: 8 }, bold: 5, fatigue: 20, stress: 4 },
        ],
      },
      {
        label: '동네', desc: '도서관, 시장, 복지관. 동네가 넓어졌다.',
        acts: [
          { id: 'bookclub', name: '독서 모임', emoji: '💬', desc: '같은 책을 읽고 생각을 나눈다.', main: 'express', diff: 1, stats: { express: 4, social: 3 }, fields: { write: 5, edu: 2 }, fatigue: 8 },
          { id: 'flea', name: '벼룩시장 판매', emoji: '🪙', desc: '안 쓰는 물건에 값을 매겨 판다.', main: 'social', diff: 1, stats: { social: 3, express: 2 }, fields: { biz: 7 }, money: 2, bold: 4, fatigue: 12, stress: 4 },
          { id: 'volunteer', name: '복지관 봉사', emoji: '🙌', desc: '배식과 청소, 동생들 공부 봐주기.', main: 'social', stats: { social: 4, express: 1 }, fields: { med: 4, edu: 3 }, mood: 6, fatigue: 12 },
          { id: 'mentor', name: '사장님 멘토링', emoji: '🧑‍💼', desc: '단골 가게 사장님이 장사 비법을 알려 준다.', main: 'social', diff: 1, flag: 'mentor', lock: { visits: REG, stat: 'social', min: 40 }, stats: { social: 3, logic: 2 }, fields: { biz: 10 }, bold: 6, fatigue: 8 },
        ],
      },
      {
        label: '동네', desc: '내 손으로 돈을 벌고 누군가를 돕는 곳.',
        acts: [
          { id: 'repair', name: '수리점 아르바이트', emoji: '🔧', desc: '고장 난 선풍기와 자전거를 고친다.', main: 'craft', diff: 1, stats: { craft: 4, logic: 1 }, fields: { eng: 5, biz: 2 }, money: 4, fatigue: 16, stress: 6 },
          { id: 'cafe', name: '카페 아르바이트', emoji: '☕', desc: '라테 아트는 아직 연습 중.', main: 'social', diff: 1, stats: { social: 3, craft: 2 }, fields: { food: 4, biz: 2 }, money: 4, fatigue: 16, stress: 6 },
          { id: 'tutor', name: '공부방 멘토링', emoji: '🧒', desc: '초등학생 동생들을 가르친다.', main: 'express', diff: 1, stats: { know: 2, express: 3, social: 2 }, fields: { edu: 7 }, fatigue: 10 },
          { id: 'startupcamp', name: '창업 캠프', emoji: '🚀', desc: '아이디어를 사업 계획서로.', main: 'social', diff: 2, cost: 3, contest: 'biz', lock: { visits: 5, bold: 20 }, stats: { create: 3, social: 3 }, fields: { biz: 10 }, bold: 8, fatigue: 20, stress: 10 },
        ],
      },
    ],
  },
  {
    id: 'center', name: '체험센터', emoji: '🧭', color: '#8b6cf0',
    stages: [
      {
        label: '방과후 교실', desc: '돈이 들지만 확실히 는다.',
        acts: [
          { id: 'coding', name: '코딩·로봇 교실', emoji: '💻', desc: '블록 코딩으로 작은 로봇을 움직인다.', main: 'logic', diff: 1, cost: 2, stats: { logic: 4, create: 2 }, fields: { it: 5, eng: 3 }, fatigue: 12, stress: 6 },
          { id: 'artclass', name: '미술 교실', emoji: '🎨', desc: '수채화와 만들기.', main: 'create', diff: 1, cost: 2, stats: { create: 5, craft: 2 }, fields: { art: 7 }, fatigue: 10, stress: 3 },
          { id: 'piano', name: '피아노', emoji: '🎹', desc: '손가락이 건반 위를 달린다.', main: 'express', diff: 1, cost: 2, stats: { express: 3, create: 2 }, fields: { music: 6 }, fatigue: 8, stress: -2 },
          { id: 'cookoff', name: '어린이 요리 대회', emoji: '🏆', desc: '심사위원 앞에서 나만의 요리를.', main: 'craft', diff: 2, cost: 2, contest: 'food', lock: { visits: REG, stat: 'craft', min: 30 }, stats: { craft: 6, create: 4 }, fields: { food: 10 }, bold: 5, fatigue: 18, stress: 6 },
        ],
      },
      {
        label: '학원·공방', desc: '깊이 파고드는 곳. 대신 지친다.',
        acts: [
          { id: 'math', name: '수학 학원', emoji: '➗', desc: '어려운 문제를 끝까지 붙잡는다.', main: 'logic', diff: 1, cost: 2, stats: { logic: 6, know: 2 }, fields: { sci: 2 }, fatigue: 14, stress: 10 },
          { id: 'codeacademy', name: '코딩 학원', emoji: '💻', desc: '진짜 프로그램을 짜 본다.', main: 'logic', diff: 1, cost: 2, stats: { logic: 4, create: 2 }, fields: { it: 7 }, fatigue: 12, stress: 6 },
          { id: 'robot', name: '메이커 공방 로봇 조립', emoji: '🤖', desc: '모터와 센서로 움직이는 친구를.', main: 'craft', diff: 2, cost: 2, stats: { craft: 4, logic: 3 }, fields: { eng: 7 }, fatigue: 12, stress: 4 },
          { id: 'invent', name: '발명대회', emoji: '💡', desc: '생활 속 불편을 고치는 발명품.', main: 'craft', diff: 3, contest: 'eng', lock: { visits: REG, stat: 'craft', min: 40 }, stats: { create: 6, craft: 4, logic: 3 }, fields: { eng: 10 }, bold: 6, fatigue: 20, stress: 10 },
        ],
      },
      {
        label: '진로체험센터', desc: '직업 현장을 미리 겪어 보는 곳.',
        acts: [
          { id: 'jobexp', name: '직업 체험', emoji: '🧪', desc: '오늘은 어떤 직업일까? 뜻밖의 관심이 생긴다.', main: 'social', special: 'randomField', stats: { social: 1, know: 1 }, mood: 5, fatigue: 8 },
          { id: 'hospital', name: '병원 체험', emoji: '🏥', desc: '의사와 간호사를 따라 하루를 보낸다.', main: 'know', diff: 1, stats: { know: 3, social: 2, body: 1 }, fields: { med: 7 }, fatigue: 12 },
          { id: 'studio', name: '공연·디자인 스튜디오', emoji: '🎬', desc: '무대 뒤와 작업실을 오간다.', main: 'create', diff: 1, stats: { create: 4, express: 3 }, fields: { art: 4, music: 4 }, fatigue: 10 },
          { id: 'intern', name: '인턴 체험', emoji: '🏢', desc: '가장 관심 있는 분야의 현장에 간다.', main: 'social', diff: 2, special: 'topField', lock: { visits: 5, stat: 'social', min: 50 }, stats: { social: 3, logic: 2 }, money: 3, bold: 3, fatigue: 18, stress: 8 },
        ],
      },
    ],
  },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);

export const HAIR_COLORS = ['#3a2a20', '#7a4a2a', '#c98a3a', '#2a2f4a', '#8a3a4a'];
export const HAIR_STYLES = ['짧은 머리', '긴 머리', '묶은 머리'];

export const PLACE_ORDER: PlaceId[] = PLACES.map((p) => p.id);
