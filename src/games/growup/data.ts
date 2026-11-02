import { Activity, District, DistrictId, FieldKey, Four, Place, PlaceStage, StatKey } from './types';

export const STAT_KEYS: StatKey[] = ['know', 'logic', 'create', 'express', 'body', 'craft', 'social'];

export const STAT_LABEL: Record<StatKey, string> = {
  know: '공부', logic: '생각', create: '상상', express: '말하기', body: '체력', craft: '만들기', social: '사귀기',
};

export const STAT_COLOR: Record<StatKey, string> = {
  know: '#5b8def', logic: '#8b6cf0', create: '#f06cb4', express: '#f0a03c',
  body: '#3cc47a', craft: '#c9894a', social: '#3cb8d0',
};

export const FIELD_KEYS: FieldKey[] = ['it', 'eng', 'sci', 'med', 'art', 'music', 'write', 'food', 'sport', 'biz', 'edu'];

export const FIELD_LABEL: Record<FieldKey, string> = {
  it: '컴퓨터·코딩', eng: '기계·로봇', sci: '과학', med: '병원·돌봄', art: '미술·디자인', music: '음악·공연',
  write: '글·영상', food: '요리', sport: '운동', biz: '가게·장사', edu: '가르치기·돕기',
};

export const FIELD_EMOJI: Record<FieldKey, string> = {
  it: '💻', eng: '🤖', sci: '🔬', med: '🩺', art: '🎨', music: '🎵', write: '✍️', food: '🍳', sport: '⚽', biz: '💼', edu: '🍎',
};

/** 단계별 한 달 용돈(만원) */
export const ALLOWANCE = [1, 1, 2] as const;

/** 잠긴 활동을 여는 기본 단골도(이번 학교급 안에서 센다) */
const REG = 6;

/** 학교급과 상관없이 같은 장소 */
const same = (label: string, desc: string, acts: Four<Activity>): [PlaceStage, PlaceStage, PlaceStage] => {
  const st = { label, desc, acts };
  return [st, st, st];
};

/* 학교급마다 같이 쓰는 활동 */
const REST: Activity = { id: 'rest', name: '푹 쉬기', emoji: '😴', desc: '아무것도 안 하고 뒹굴뒹굴.', safe: true, fatigue: -35, stress: -15, mood: 5 };
const GAME: Activity = { id: 'game', name: '게임하기', emoji: '🎮', desc: '오늘은 실컷 논다. 기분이 확 풀린다.', safe: true, stats: { logic: 1 }, fields: { it: 2 }, mood: 12, stress: -12, fatigue: 3 };
const CLASS = (lv: number): Activity => ({
  id: 'class', name: '수업 집중', emoji: '🙋', desc: ['손 들고 발표도 해 본다.', '필기를 꼼꼼히 한다.', '수업 시간에 끝낸다.'][lv],
  main: 'know', diff: lv ? 1 : 0, stats: { know: 4 + (lv === 2 ? 1 : 0), logic: lv ? 2 : 0, express: lv ? 0 : 1 }, fatigue: 8 + lv, stress: 3 + lv,
});

/**
 * 장소 14곳 — 구역 4개(집·학교·동네·시내)에 나뉜다. 학년이 오르면 공사 중이던 곳이 하나씩 열린다.
 * 장소마다 활동은 4개(버튼 ①~④). 교실·내 방처럼 학교급마다 활동이 바뀌는 곳도 있다.
 */
export const PLACES: Place[] = [
  /* ── ① 집 ── */
  {
    id: 'room', district: 'home', name: '내 방', emoji: '🛏️', color: '#e9a15b', from: 0,
    stages: [
      { label: '내 방', desc: '쉬어 가는 곳. 지친 달에는 내 방이 최고예요.', acts: [
        REST,
        { id: 'homework', name: '숙제하기', emoji: '✏️', desc: '미루지 않고 그날 할 일을 끝낸다.', main: 'know', stats: { know: 3, logic: 2 }, fatigue: 8, stress: 4, bold: -1 },
        GAME,
        { id: 'doodle', name: '낙서 그림', emoji: '🖍️', desc: '공책 귀퉁이가 그림으로 가득.', main: 'create', stats: { create: 3, craft: 1 }, fields: { art: 3 }, mood: 4, fatigue: 4 },
      ] },
      { label: '내 방', desc: '내 책상과 침대. 혼자서 하는 일들.', acts: [
        REST,
        { id: 'study', name: '자습', emoji: '📝', desc: '문제집을 펴고 버틴다.', main: 'know', diff: 1, stats: { know: 5, logic: 3 }, fatigue: 12, stress: 8, bold: -2 },
        { id: 'diary', name: '일기·편지 쓰기', emoji: '📔', desc: '오늘 있었던 일을 글로 남긴다.', main: 'express', stats: { express: 4, create: 1 }, fields: { write: 5 }, stress: -4, fatigue: 5 },
        GAME,
      ] },
      { label: '내 방', desc: '입시와 꿈 사이, 내 시간을 쓰는 곳.', acts: [
        REST,
        { id: 'cram', name: '수능 공부', emoji: '📚', desc: '모의고사 오답 노트를 채운다.', main: 'know', diff: 2, stats: { know: 6, logic: 4 }, fatigue: 14, stress: 12, bold: -2 },
        { id: 'blog', name: '글쓰기·채널 운영', emoji: '✍️', desc: '블로그와 채널에 한 편씩 쌓는다.', main: 'express', diff: 1, stats: { express: 5, create: 2 }, fields: { write: 6, biz: 2 }, fatigue: 8 },
        { id: 'workout', name: '홈트레이닝', emoji: '🏋️', desc: '매일 아침 맨몸 운동.', main: 'body', stats: { body: 5 }, fields: { sport: 4 }, fatigue: 12, stress: -8 },
      ] },
    ],
  },
  {
    id: 'kitchen', district: 'home', name: '부엌', emoji: '🍳', color: '#f07a4a', from: 0,
    stages: same('부엌', '재료만 있으면 뭐든 만들 수 있다.', [
      { id: 'snack', name: '간식 만들기', emoji: '🍪', desc: '쿠키 반죽을 조물조물.', main: 'craft', cost: 1, stats: { craft: 3, create: 2 }, fields: { food: 5 }, mood: 6, fatigue: 6 },
      { id: 'cook', name: '요리 따라 하기', emoji: '🍲', desc: '레시피 영상을 보며 한 그릇.', main: 'craft', diff: 1, cost: 1, stats: { craft: 4, know: 1 }, fields: { food: 6 }, fatigue: 10 },
      { id: 'family', name: '가족 식사 차리기', emoji: '🍽️', desc: '온 가족이 먹을 저녁을 맡는다.', main: 'craft', diff: 1, stats: { craft: 3, social: 3 }, fields: { food: 4 }, mood: 5, fatigue: 12 },
      { id: 'chores', name: '집안일 돕기', emoji: '🧹', desc: '설거지와 빨래 개기. 용돈을 조금 더 받는다.', main: 'body', stats: { craft: 1, social: 1, body: 1 }, fields: { food: 1 }, money: 1, fatigue: 8, mood: -2 },
    ]),
  },

  /* ── ② 학교 ── */
  {
    id: 'classroom', district: 'school', name: '교실', emoji: '🏫', color: '#5b8def', from: 0,
    stages: [
      { label: '초등학교 교실', desc: '배우고 뛰놀고 친구를 사귀는 곳.', acts: [
        CLASS(0),
        { id: 'play', name: '친구랑 놀기', emoji: '🤸', desc: '쉬는 시간 술래잡기, 수다.', main: 'social', stats: { social: 4, body: 1 }, mood: 10, stress: -10, fatigue: 10 },
        { id: 'speech', name: '발표 연습', emoji: '🗣️', desc: '앞에 나가 말하는 연습.', main: 'express', stats: { express: 4, social: 1 }, fields: { edu: 2, write: 2 }, fatigue: 8, stress: 3 },
        { id: 'recital', name: '학예회 무대', emoji: '🎤', desc: '반 대표로 무대에 선다.', main: 'express', diff: 2, contest: 'music', lock: { visits: REG, stat: 'express', min: 25 }, stats: { express: 5, social: 2 }, fields: { music: 8 }, bold: 5, fatigue: 14, stress: 6 },
      ] },
      { label: '중학교 교실', desc: '과목도 많아지고 실험도 한다.', acts: [
        CLASS(1),
        { id: 'lab', name: '과학 실험', emoji: '🔬', desc: '가설을 세우고 직접 확인한다.', main: 'logic', diff: 1, stats: { know: 3, logic: 3 }, fields: { sci: 6 }, fatigue: 10 },
        { id: 'debate', name: '토론 수업', emoji: '⚖️', desc: '근거를 들어 내 생각을 말한다.', main: 'express', diff: 1, stats: { express: 4, logic: 2, social: 1 }, fields: { write: 3, edu: 2 }, fatigue: 9, stress: 4 },
        { id: 'scifair', name: '과학 탐구 대회', emoji: '🧪', desc: '탐구 보고서로 학교 대표를 겨룬다.', main: 'logic', diff: 2, contest: 'sci', lock: { visits: REG, stat: 'logic', min: 40 }, stats: { logic: 5, know: 3 }, fields: { sci: 10 }, bold: 4, fatigue: 16, stress: 8 },
      ] },
      { label: '고등학교 교실', desc: '진로를 정해야 하는 마지막 교실.', acts: [
        CLASS(2),
        { id: 'report', name: '탐구 보고서', emoji: '📑', desc: '궁금한 주제를 끝까지 파고든다.', main: 'logic', diff: 1, stats: { know: 3, logic: 3, express: 1 }, fields: { sci: 3, write: 3 }, fatigue: 12, stress: 6 },
        { id: 'debate', name: '토론 수업', emoji: '⚖️', desc: '근거를 들어 내 생각을 말한다.', main: 'express', diff: 1, stats: { express: 4, logic: 2, social: 1 }, fields: { write: 3, edu: 2 }, fatigue: 9, stress: 4 },
        { id: 'olympiad', name: '교내 경시대회', emoji: '🏅', desc: '수학·과학 실력을 겨룬다.', main: 'know', diff: 2, contest: 'sci', lock: { visits: REG, stat: 'know', min: 55 }, stats: { know: 5, logic: 4 }, fields: { sci: 10 }, bold: 4, fatigue: 18, stress: 10 },
      ] },
    ],
  },
  {
    id: 'field', district: 'school', name: '운동장', emoji: '⚽', color: '#4fbf6b', from: 0,
    stages: same('운동장', '뛰고 구르고 땀 흘리는 곳.', [
      { id: 'soccer', name: '축구', emoji: '⚽', desc: '편을 나눠 한 판. 땀이 비 오듯 한다.', main: 'body', diff: 1, stats: { body: 4, social: 2 }, fields: { sport: 4 }, fatigue: 16, stress: -6 },
      { id: 'run', name: '달리기·줄넘기', emoji: '🏃', desc: '혼자서도 할 수 있는 체력 단련.', main: 'body', stats: { body: 5 }, fields: { sport: 3 }, fatigue: 14, stress: -4 },
      { id: 'dodge', name: '피구·배드민턴', emoji: '🏸', desc: '친구들과 왁자지껄.', main: 'body', stats: { body: 3, social: 3 }, fields: { sport: 2 }, mood: 6, fatigue: 12, stress: -6 },
      { id: 'sportsday', name: '체육대회 대표', emoji: '🏅', desc: '구청 대회에 학교 대표로 나간다.', main: 'body', diff: 2, contest: 'sport', lock: { visits: REG, stat: 'body', min: 30 }, stats: { body: 6, express: 2 }, fields: { sport: 8 }, bold: 5, fatigue: 20, stress: 4 },
    ]),
  },
  {
    id: 'club', district: 'school', name: '동아리방', emoji: '🎸', color: '#d0508a', from: 6,
    stages: [
      { label: '동아리방', desc: '좋아하는 걸 같이 하는 사람들.', acts: [
        { id: 'band', name: '밴드·연극부', emoji: '🎸', desc: '축제 무대를 준비한다.', main: 'express', diff: 1, stats: { express: 4, create: 2 }, fields: { music: 6 }, fatigue: 10 },
        { id: 'broadcast', name: '방송부', emoji: '📻', desc: '점심 방송을 맡는다.', main: 'express', diff: 1, stats: { express: 4, social: 2 }, fields: { write: 6 }, fatigue: 9 },
        { id: 'codeclub', name: '코딩부', emoji: '💻', desc: '친구들과 앱을 만든다.', main: 'logic', diff: 1, stats: { logic: 4, create: 2 }, fields: { it: 6 }, fatigue: 10, stress: 3 },
        { id: 'sciclub', name: '과학탐구부', emoji: '🔭', desc: '별을 보고 곤충을 기록한다.', main: 'know', diff: 1, stats: { know: 4, logic: 2 }, fields: { sci: 6 }, fatigue: 9 },
      ] },
      { label: '동아리방', desc: '좋아하는 걸 같이 하는 사람들.', acts: [
        { id: 'band', name: '밴드·연극부', emoji: '🎸', desc: '축제 무대를 준비한다.', main: 'express', diff: 1, stats: { express: 4, create: 2 }, fields: { music: 6 }, fatigue: 10 },
        { id: 'broadcast', name: '방송부', emoji: '📻', desc: '점심 방송을 맡는다.', main: 'express', diff: 1, stats: { express: 4, social: 2 }, fields: { write: 6 }, fatigue: 9 },
        { id: 'codeclub', name: '코딩부', emoji: '💻', desc: '친구들과 앱을 만든다.', main: 'logic', diff: 1, stats: { logic: 4, create: 2 }, fields: { it: 6 }, fatigue: 10, stress: 3 },
        { id: 'sciclub', name: '과학탐구부', emoji: '🔭', desc: '별을 보고 곤충을 기록한다.', main: 'know', diff: 1, stats: { know: 4, logic: 2 }, fields: { sci: 6 }, fatigue: 9 },
      ] },
      { label: '동아리방', desc: '이제는 후배를 이끄는 동아리.', acts: [
        { id: 'project', name: '동아리 프로젝트', emoji: '🧪', desc: '가장 관심 있는 분야로 직접 만들어 본다.', main: 'social', diff: 1, special: 'topField', stats: { create: 2, social: 2 }, fatigue: 14, stress: 4 },
        { id: 'band', name: '밴드·연극부', emoji: '🎸', desc: '마지막 축제 무대.', main: 'express', diff: 1, stats: { express: 4, create: 2 }, fields: { music: 6 }, fatigue: 10 },
        { id: 'startclub', name: '창업 동아리', emoji: '💡', desc: '아이디어로 작은 사업을 꾸린다.', main: 'social', diff: 1, stats: { social: 3, create: 3 }, fields: { biz: 6 }, bold: 4, fatigue: 11, stress: 4 },
        { id: 'mentoring', name: '후배 멘토링', emoji: '🧑‍🏫', desc: '후배들에게 내가 아는 걸 알려 준다.', main: 'express', stats: { express: 3, social: 3 }, fields: { edu: 6 }, fatigue: 9 },
      ] },
    ],
  },
  {
    id: 'counsel', district: 'school', name: '진로상담실', emoji: '🧭', color: '#5bb0e0', from: 9,
    stages: same('진로상담실', '내가 뭘 좋아하는지 확인하는 곳.', [
      { id: 'counsel', name: '진로 상담', emoji: '🗺️', desc: '선생님과 내 관심사를 정리해 본다.', safe: true, special: 'counsel', stress: -10, mood: 5, fatigue: 4 },
      { id: 'jobexp', name: '직업 체험', emoji: '🧪', desc: '오늘은 어떤 직업일까? 뜻밖의 관심이 생긴다.', main: 'social', special: 'randomField', stats: { social: 1, know: 1 }, mood: 5, fatigue: 8 },
      { id: 'interview', name: '모의 면접', emoji: '🎙️', desc: '떨리는 목소리를 다잡는 연습.', main: 'express', diff: 1, stats: { express: 4, social: 3, logic: 1 }, fatigue: 8, stress: 8 },
      { id: 'intern', name: '인턴 체험', emoji: '🏢', desc: '가장 관심 있는 분야의 현장에 간다.', main: 'social', diff: 2, special: 'topField', lock: { visits: 5, stat: 'social', min: 50 }, stats: { social: 3, logic: 2 }, money: 3, bold: 3, fatigue: 18, stress: 8 },
    ]),
  },

  /* ── ③ 동네 ── */
  {
    id: 'library', district: 'town', name: '도서관', emoji: '📚', color: '#4a7ad8', from: 0,
    stages: same('도서관', '조용한 곳에서 세상을 넓히는 시간.', [
      { id: 'novel', name: '동화·소설 읽기', emoji: '📖', desc: '다른 사람의 삶을 살아 본다.', main: 'express', stats: { express: 3, create: 2 }, fields: { write: 4 }, mood: 4, stress: -3, fatigue: 5 },
      { id: 'science', name: '과학책 읽기', emoji: '🔭', desc: '우주, 공룡, 인체의 비밀.', main: 'know', diff: 1, stats: { know: 4 }, fields: { sci: 5 }, fatigue: 6 },
      { id: 'libstudy', name: '열람실 공부', emoji: '📝', desc: '조용한 열람실에서 집중.', main: 'know', diff: 1, stats: { know: 4, logic: 2 }, fatigue: 10, stress: 6, bold: -1 },
      { id: 'bookclub', name: '독서 모임', emoji: '💬', desc: '같은 책을 읽고 생각을 나눈다.', main: 'express', diff: 1, lock: { visits: REG }, stats: { express: 4, social: 3 }, fields: { write: 5, edu: 2 }, fatigue: 8 },
    ]),
  },
  {
    id: 'park', district: 'town', name: '공원', emoji: '🌳', color: '#3fa070', from: 0,
    stages: same('공원', '바람 쐬고 친구 만나는 곳.', [
      { id: 'parkplay', name: '친구랑 놀기', emoji: '🤸', desc: '얼음땡, 자전거, 수다.', main: 'social', stats: { social: 4, body: 1 }, mood: 10, stress: -10, fatigue: 10 },
      { id: 'walk', name: '산책', emoji: '🚶', desc: '천천히 걸으며 생각을 정리한다.', safe: true, stats: { body: 1 }, mood: 6, stress: -12, fatigue: -6 },
      { id: 'sketch', name: '사진·스케치', emoji: '📷', desc: '같은 풍경도 다르게 보인다.', main: 'create', stats: { create: 4, craft: 1 }, fields: { art: 4 }, mood: 4, fatigue: 6 },
      { id: 'busking', name: '공원 버스킹', emoji: '🎵', desc: '지나가는 사람들 앞에서 노래한다.', main: 'express', diff: 2, contest: 'music', lock: { visits: REG, stat: 'express', min: 40 }, stats: { express: 7, social: 3 }, fields: { music: 10 }, bold: 6, fatigue: 16, stress: 8 },
    ]),
  },
  {
    id: 'market', district: 'town', name: '시장', emoji: '🛒', color: '#e0b43c', from: 4,
    stages: same('시장', '사고파는 사람들. 돈이 도는 원리가 보인다.', [
      { id: 'errand', name: '심부름', emoji: '🧺', desc: '장보기 목록을 들고 시장 한 바퀴.', main: 'social', stats: { social: 2, body: 1 }, fields: { biz: 2 }, money: 2, fatigue: 8 },
      { id: 'watch', name: '장사 구경', emoji: '👀', desc: '손님을 부르는 말, 물건을 놓는 자리.', safe: true, stats: { social: 1, logic: 2 }, fields: { biz: 6 }, mood: 3, fatigue: 5 },
      { id: 'flea', name: '벼룩시장 판매', emoji: '🪙', desc: '안 쓰는 물건에 값을 매겨 판다.', main: 'social', diff: 1, stats: { social: 3, express: 3, create: 1 }, fields: { biz: 7 }, money: 2, bold: 4, fatigue: 12, stress: 4 },
      { id: 'mentor', name: '사장님 멘토링', emoji: '🧑‍💼', desc: '단골 가게 사장님이 장사 비법을 알려 준다.', main: 'social', diff: 1, flag: 'mentor', lock: { visits: REG, stat: 'social', min: 40 }, stats: { social: 3, logic: 2 }, fields: { biz: 10 }, bold: 6, fatigue: 8 },
    ]),
  },
  {
    id: 'welfare', district: 'town', name: '복지관', emoji: '🤝', color: '#3cc4a0', from: 6,
    stages: same('복지관', '누군가에게 도움이 되는 시간.', [
      { id: 'volunteer', name: '봉사활동', emoji: '🙌', desc: '배식과 청소, 말동무.', main: 'social', stats: { social: 4, express: 1 }, fields: { med: 4, edu: 2 }, mood: 6, fatigue: 12 },
      { id: 'tutor', name: '동생들 공부 봐주기', emoji: '🧒', desc: '가르치면서 내가 더 배운다.', main: 'express', diff: 1, stats: { know: 2, express: 3, social: 2 }, fields: { edu: 7 }, fatigue: 10 },
      { id: 'nursing', name: '간호 체험', emoji: '🩺', desc: '혈압 재기와 붕대 감기.', main: 'know', diff: 1, stats: { know: 2, body: 2, social: 2 }, fields: { med: 7 }, fatigue: 12 },
      { id: 'medcamp', name: '의료 봉사 캠프', emoji: '🏥', desc: '의료진을 따라 마을을 돈다.', main: 'know', diff: 2, contest: 'med', lock: { visits: REG, stat: 'know', min: 50 }, stats: { know: 5, social: 3 }, fields: { med: 11 }, bold: 3, fatigue: 20, stress: 6 },
    ]),
  },

  /* ── ④ 시내 ── */
  {
    id: 'academy', district: 'city', name: '학원가', emoji: '🏢', color: '#8b6cf0', from: 0,
    stages: same('학원가', '돈이 들지만 확실히 는다. 대신 지친다.', [
      { id: 'math', name: '수학 학원', emoji: '➗', desc: '어려운 문제를 끝까지 붙잡는다.', main: 'logic', diff: 1, cost: 2, stats: { logic: 6, know: 2 }, fields: { sci: 2 }, fatigue: 14, stress: 10 },
      { id: 'coding', name: '코딩·로봇 학원', emoji: '💻', desc: '블록 코딩부터 진짜 프로그램까지.', main: 'logic', diff: 1, cost: 2, stats: { logic: 4, create: 2 }, fields: { it: 6, eng: 2 }, fatigue: 12, stress: 6 },
      { id: 'artclass', name: '미술 학원', emoji: '🎨', desc: '데생, 수채화, 디지털 드로잉.', main: 'create', diff: 1, cost: 2, stats: { create: 5, craft: 2 }, fields: { art: 7 }, fatigue: 10, stress: 3 },
      { id: 'piano', name: '음악 학원', emoji: '🎹', desc: '피아노와 노래.', main: 'express', diff: 1, cost: 2, stats: { express: 3, create: 2 }, fields: { music: 6 }, fatigue: 8, stress: -2 },
    ]),
  },
  {
    id: 'maker', district: 'city', name: '메이커 공방', emoji: '🔧', color: '#4aa8c9', from: 6,
    stages: same('메이커 공방', '납땜 냄새와 톱밥. 직접 만드는 곳.', [
      { id: 'robot', name: '로봇 조립', emoji: '🤖', desc: '모터와 센서로 움직이는 친구를.', main: 'craft', diff: 2, cost: 2, stats: { craft: 4, logic: 3 }, fields: { eng: 7 }, fatigue: 12, stress: 4 },
      { id: 'circuit', name: '전자회로', emoji: '⚡', desc: 'LED 하나 켜는 데서 시작.', main: 'logic', diff: 2, cost: 1, stats: { logic: 4, know: 2 }, fields: { eng: 6, it: 2 }, fatigue: 10, stress: 5 },
      { id: 'wood', name: '목공', emoji: '🪚', desc: '나무를 깎아 의자 하나.', main: 'craft', diff: 1, cost: 1, stats: { craft: 5, body: 2 }, fields: { eng: 3, art: 2 }, fatigue: 12 },
      { id: 'invent', name: '발명대회 준비', emoji: '💡', desc: '생활 속 불편을 고치는 발명품.', main: 'craft', diff: 3, contest: 'eng', lock: { visits: REG, stat: 'craft', min: 40 }, stats: { create: 6, craft: 4, logic: 3 }, fields: { eng: 10 }, bold: 6, fatigue: 20, stress: 10 },
    ]),
  },
  {
    id: 'media', district: 'city', name: '미디어센터', emoji: '🎬', color: '#d05050', from: 6,
    stages: same('미디어센터', '찍고, 쓰고, 세상에 내보낸다.', [
      { id: 'video', name: '영상 만들기', emoji: '🎥', desc: '찍고 자르고 자막을 단다.', main: 'create', diff: 1, stats: { create: 4, express: 2 }, fields: { write: 4, it: 2, art: 2 }, fatigue: 10 },
      { id: 'design', name: '디자인 실습', emoji: '🖌️', desc: '포스터와 로고를 컴퓨터로.', main: 'create', diff: 1, stats: { create: 4, craft: 2 }, fields: { art: 6, it: 1 }, fatigue: 9 },
      { id: 'podcast', name: '팟캐스트 녹음', emoji: '🎙️', desc: '친구와 수다를 방송으로.', main: 'express', diff: 1, stats: { express: 5, social: 2 }, fields: { write: 5, music: 1 }, fatigue: 8 },
      { id: 'channel', name: '채널 운영', emoji: '📡', desc: '구독자와 함께 키우는 내 채널.', main: 'express', diff: 3, contest: 'write', lock: { visits: REG, stat: 'express', min: 45 }, stats: { express: 6, create: 4, social: 3 }, fields: { write: 10, biz: 3 }, bold: 6, fatigue: 16, stress: 8 },
    ]),
  },
  {
    id: 'parttime', district: 'city', name: '아르바이트', emoji: '💼', color: '#9a8a6a', from: 9,
    stages: same('아르바이트', '내 손으로 버는 첫 돈. 고되지만 배운다.', [
      { id: 'repair', name: '수리점', emoji: '🔧', desc: '고장 난 선풍기와 자전거를 고친다.', main: 'craft', diff: 1, stats: { craft: 4, logic: 1 }, fields: { eng: 5, biz: 2 }, money: 4, fatigue: 16, stress: 6 },
      { id: 'cafe', name: '카페', emoji: '☕', desc: '라테 아트는 아직 연습 중.', main: 'social', diff: 1, stats: { social: 3, craft: 2 }, fields: { food: 4, biz: 2 }, money: 4, fatigue: 16, stress: 6 },
      { id: 'assist', name: '학원 조교', emoji: '📋', desc: '채점하고 질문을 받는다.', main: 'know', diff: 1, stats: { know: 2, express: 2 }, fields: { edu: 4 }, money: 4, fatigue: 14, stress: 6 },
      { id: 'startupcamp', name: '창업 캠프', emoji: '🚀', desc: '아이디어를 사업 계획서로.', main: 'social', diff: 2, cost: 3, contest: 'biz', lock: { visits: 5, bold: 20 }, stats: { create: 3, social: 3 }, fields: { biz: 10 }, bold: 8, fatigue: 20, stress: 10 },
    ]),
  },
];

export const placeById = (id: string) => PLACES.find((p) => p.id === id);

export const DISTRICTS: District[] = [
  { id: 'home', name: '집', emoji: '🏠', color: '#e9a15b', places: ['room', 'kitchen'] },
  { id: 'school', name: '학교', emoji: '🏫', color: '#5b8def', places: ['classroom', 'field', 'club', 'counsel'] },
  { id: 'town', name: '동네', emoji: '🏘️', color: '#4fbf6b', places: ['library', 'park', 'market', 'welfare'] },
  { id: 'city', name: '시내', emoji: '🏙️', color: '#8b6cf0', places: ['academy', 'maker', 'media', 'parttime'] },
];

export const districtById = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!;

export const HAIR_COLORS = ['#3a2a20', '#7a4a2a', '#c98a3a', '#2a2f4a', '#8a3a4a'];
export const HAIR_STYLES = ['짧은 머리', '긴 머리', '묶은 머리'];
