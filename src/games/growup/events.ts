import { Calendar } from './calendar';
import { Effect, GameState } from './types';

export interface EventOption extends Effect {
  label: string;
  /** 고른 뒤 보여 주는 한 줄 */
  result: string;
  /** 돈이 이만큼 있어야 고를 수 있다 */
  need?: number;
  /** 가장 관심 있는 분야를 더 키운다 */
  special?: 'topField';
}

export interface GameEvent {
  id: string;
  title: string;
  emoji: string;
  /** {name}, {name:이가}, {name:은는}, {name:을를}, {name:와과}, {name:아야} */
  text: string;
  /** 정해진 때 반드시 나온다 */
  fixed?: (s: GameState, c: Calendar) => boolean;
  /** 무작위 사건이 나올 수 있는 때 */
  when?: (s: GameState, c: Calendar) => boolean;
  weight?: number;
  options: EventOption[];
}

export const EVENTS: GameEvent[] = [
  /* ── 정해진 사건 ── */
  {
    id: 'club-mid', title: '중학교 동아리', emoji: '🏫',
    text: '중학생이 됐다! 동아리 신청서를 받은 {name:은는} 한참 고민한다.',
    fixed: (s) => s.turn === 72,
    options: [
      { label: '코딩부', fields: { it: 8 }, stats: { logic: 2 }, result: '컴퓨터실에서 첫 프로그램을 돌렸다.' },
      { label: '방송부', fields: { write: 8 }, stats: { express: 2 }, result: '점심 방송 진행을 맡았다.' },
      { label: '밴드부', fields: { music: 8 }, stats: { express: 2 }, result: '드럼 스틱을 처음 잡았다.' },
      { label: '과학탐구부', fields: { sci: 8 }, stats: { know: 2 }, result: '현미경으로 양파 세포를 봤다.' },
    ],
  },
  {
    id: 'club-high', title: '고등학교 동아리', emoji: '🎒',
    text: '고등학생이 된 {name}. 이번 동아리는 진로와 이어질지도 모른다.',
    fixed: (s) => s.turn === 108,
    options: [
      { label: '창업 동아리', fields: { biz: 8 }, bold: 5, result: '첫 회의에서 사업 아이디어를 세 개나 냈다.' },
      { label: '로봇부', fields: { eng: 8 }, stats: { craft: 2 }, result: '대회용 로봇의 바퀴를 맡았다.' },
      { label: '요리부', fields: { food: 8 }, stats: { craft: 2 }, result: '첫 시간에 김치볶음밥을 만들었다.' },
      { label: '봉사 동아리', fields: { med: 5, edu: 5 }, stats: { social: 2 }, result: '주말마다 지역아동센터에 가기로 했다.' },
    ],
  },
  {
    id: 'senior', title: '고3의 봄', emoji: '🌸',
    text: '마지막 1년이 시작됐다. 진로 희망 조사서를 앞에 둔 {name:은는} 어떻게 할까?',
    fixed: (s) => s.turn === 132,
    options: [
      { label: '꿈을 향해 달린다', stress: 8, bold: 3, special: 'topField', result: '목표가 분명해졌다. 조금 긴장된다.' },
      { label: '천천히 생각한다', stress: -10, mood: 5, result: '조급해하지 않기로 했다. 마음이 편하다.' },
    ],
  },

  /* ── 무작위 사건 ── */
  {
    id: 'friend', title: '친구의 연락', emoji: '📞',
    text: '“지금 나와! 다 모였어!” 할 일이 남았는데…',
    when: () => true, weight: 3,
    options: [
      { label: '같이 논다', stats: { social: 2 }, mood: 10, stress: -6, fatigue: 5, result: '해 질 때까지 실컷 놀았다.' },
      { label: '할 일을 한다', stats: { know: 2 }, mood: -4, stress: 3, bold: -1, result: '아쉽지만 할 일을 끝냈다.' },
    ],
  },
  {
    id: 'wallet', title: '주운 지갑', emoji: '👛',
    text: '길에서 지갑을 주웠다. 안에 학생증이 있다.',
    when: (_s, c) => c.grade >= 2, weight: 1,
    options: [
      { label: '경찰서에 맡긴다', stats: { social: 1 }, mood: 5, money: 1, result: '주인이 고맙다며 음료수 값을 줬다.' },
      { label: '직접 주인을 찾는다', stats: { social: 3 }, fatigue: 8, mood: 6, bold: 2, result: '수소문 끝에 옆 학교 학생에게 돌려줬다.' },
    ],
  },
  {
    id: 'cold', title: '감기 기운', emoji: '🤧',
    text: '{name:이가} 아침부터 콧물을 훌쩍인다.',
    when: (s) => s.fatigue >= 40, weight: 2,
    options: [
      { label: '하루 푹 쉰다', fatigue: -15, stats: { know: -1 }, result: '따뜻한 꿀물을 마시고 일찍 잤다.' },
      { label: '참고 학교에 간다', stress: 8, fatigue: 6, stats: { know: 1 }, result: '버텼지만 하루 종일 멍했다.' },
    ],
  },
  {
    id: 'trip', title: '가족 여행', emoji: '🧳',
    text: '방학을 맞아 가족 여행을 가기로 했다. 어디로 갈까?',
    when: (_s, c) => c.month === 8 || c.month === 1, weight: 4,
    options: [
      { label: '바다', stats: { body: 2 }, mood: 15, stress: -15, result: '파도에 실컷 휩쓸렸다.' },
      { label: '과학관과 박물관', stats: { know: 3 }, fields: { sci: 3 }, mood: 8, stress: -6, result: '공룡 뼈 앞에서 한참을 서 있었다.' },
      { label: '미술관 투어', stats: { create: 3 }, fields: { art: 3 }, mood: 8, stress: -6, result: '좋아하는 그림을 엽서로 샀다.' },
    ],
  },
  {
    id: 'cat', title: '길고양이', emoji: '🐈',
    text: '학교 가는 길에 다리를 저는 고양이를 봤다.',
    when: () => true, weight: 1,
    options: [
      { label: '돌봐 준다', need: 1, money: -1, fields: { med: 4 }, stats: { social: 1 }, mood: 6, result: '동물병원에 데려갔다. 고양이가 손을 핥았다.' },
      { label: '사진을 찍어 둔다', fields: { art: 2 }, result: '동네 커뮤니티에 올려 보호자를 찾았다.' },
    ],
  },
  {
    id: 'rival', title: '라이벌 등장', emoji: '⚔️',
    text: '반에 뭐든 잘하는 전학생이 왔다. 자꾸 신경이 쓰인다.',
    when: (_s, c) => c.stage >= 1, weight: 2,
    options: [
      { label: '지지 않겠다!', stats: { know: 3, logic: 2 }, stress: 8, bold: 3, result: '시험 점수가 올랐다. 대신 잠이 줄었다.' },
      { label: '친구가 된다', stats: { social: 4 }, mood: 6, result: '알고 보니 말이 잘 통했다.' },
    ],
  },
  {
    id: 'praise', title: '선생님의 칭찬', emoji: '🌟',
    text: '선생님이 반 친구들 앞에서 {name:을를} 칭찬했다.',
    when: () => true, weight: 2,
    options: [
      { label: '더 열심히 한다', stats: { know: 2 }, mood: 8, result: '어깨가 으쓱해졌다.' },
      { label: '집에 가서 자랑한다', stats: { express: 2 }, mood: 10, result: '저녁 반찬이 하나 늘었다.' },
    ],
  },
  {
    id: 'phone', title: '고장 난 휴대폰', emoji: '📱',
    text: '휴대폰 화면이 켜지지 않는다.',
    when: (_s, c) => c.stage >= 1, weight: 1,
    options: [
      { label: '직접 고쳐 본다', stats: { craft: 3 }, fields: { eng: 5 }, fatigue: 6, result: '영상을 보며 뜯어서 배터리 커넥터를 다시 꽂았다. 켜졌다!' },
      { label: '수리점에 맡긴다', need: 3, money: -3, result: '이틀 만에 고쳐 왔다.' },
    ],
  },
  {
    id: 'festival', title: '학교 축제', emoji: '🎪',
    text: '이번 주는 학교 축제다. 무엇을 할까?',
    when: (_s, c) => c.stage >= 1 && c.month === 10, weight: 6,
    options: [
      { label: '무대 공연', fields: { music: 6 }, stats: { express: 3 }, bold: 3, fatigue: 8, result: '떨렸지만 박수를 받았다.' },
      { label: '먹거리 부스 운영', fields: { biz: 6 }, stats: { social: 3 }, money: 2, result: '떡볶이가 동났다. 수익금도 생겼다.' },
      { label: '실컷 구경', mood: 12, stress: -8, result: '친구들 공연을 보며 목이 쉬도록 응원했다.' },
    ],
  },
  {
    id: 'grandma', title: '할머니 댁', emoji: '👵',
    text: '명절이라 할머니 댁에 왔다.',
    when: (_s, c) => c.month === 9 || c.month === 2, weight: 4,
    options: [
      { label: '밭일을 돕는다', stats: { body: 3 }, fields: { food: 4 }, fatigue: 8, result: '고구마를 한 바구니 캤다.' },
      { label: '옛날이야기를 듣는다', stats: { express: 2 }, fields: { write: 4 }, mood: 5, result: '할머니 어릴 적 이야기를 공책에 적었다.' },
      { label: '세배하고 용돈 받기', money: 3, mood: 6, result: '두둑한 봉투를 받았다.' },
    ],
  },
  {
    id: 'news', title: '뉴스 속 직업', emoji: '📺',
    text: '저녁 뉴스에 눈길을 끄는 이야기가 나왔다.',
    when: (_s, c) => c.grade >= 4, weight: 2,
    options: [
      { label: '돌봄 로봇 기사', fields: { eng: 5 }, result: '로봇이 어르신과 대화하는 모습이 신기했다.' },
      { label: '응급 의료 다큐', fields: { med: 5 }, result: '헬기에서 내린 의사가 멋져 보였다.' },
      { label: '청년 창업가 인터뷰', fields: { biz: 5 }, bold: 2, result: '“실패해도 괜찮다”는 말이 오래 남았다.' },
    ],
  },
  {
    id: 'snow', title: '첫눈', emoji: '☃️',
    text: '창밖에 첫눈이 펑펑 내린다!',
    when: (_s, c) => c.month === 12 || c.month === 1, weight: 3,
    options: [
      { label: '눈사람 만들기', stats: { create: 2, body: 1 }, mood: 10, fatigue: 4, result: '당근 코를 단 눈사람이 생겼다.' },
      { label: '눈 오는 풍경 그리기', fields: { art: 3 }, mood: 6, result: '창가에 앉아 스케치북을 채웠다.' },
    ],
  },
  {
    id: 'allnighter', title: '밤샘의 유혹', emoji: '🌙',
    text: '내일이 시험인데 아직 못 본 범위가 남았다.',
    when: (_s, c) => c.stage >= 1 && (c.month === 6 || c.month === 11), weight: 3,
    options: [
      { label: '밤새 공부한다', stats: { know: 4 }, fatigue: 15, stress: 6, result: '눈이 빨개졌지만 범위는 다 봤다.' },
      { label: '일찍 잔다', fatigue: -12, stress: -3, result: '푹 자고 맑은 머리로 시험장에 갔다.' },
    ],
  },
  {
    id: 'quarrel', title: '친구와 다툼', emoji: '💢',
    text: '사소한 말 한마디로 친한 친구와 다퉜다.',
    when: () => true, weight: 1,
    options: [
      { label: '먼저 사과한다', stats: { social: 3 }, mood: 4, stress: -4, result: '둘 다 미안했다며 웃었다.' },
      { label: '시간을 둔다', stats: { express: 1 }, stress: 5, result: '며칠 어색했지만 결국 풀렸다.' },
    ],
  },
  {
    id: 'contest-flyer', title: '공모전 포스터', emoji: '📮',
    text: '복도 게시판에 공모전 포스터가 붙었다.',
    when: (_s, c) => c.grade >= 3, weight: 2,
    options: [
      { label: '그림 공모전', fields: { art: 5 }, stats: { create: 2 }, fatigue: 6, result: '밤마다 조금씩 그려 냈다.' },
      { label: '글짓기 공모전', fields: { write: 5 }, stats: { express: 2 }, fatigue: 6, result: '원고지 열 장을 꽉 채웠다.' },
      { label: '과학 탐구 공모전', fields: { sci: 5 }, stats: { logic: 2 }, fatigue: 6, result: '베란다 콩나물로 실험 보고서를 썼다.' },
    ],
  },
  {
    id: 'raise', title: '용돈 협상', emoji: '🤝',
    text: '{name:은는} 용돈을 올려 달라고 말해 보기로 했다.',
    when: (_s, c) => c.grade >= 4, weight: 1,
    options: [
      { label: '조목조목 설명한다', stats: { express: 2, logic: 1 }, money: 2, bold: 2, result: '계획서까지 보여 줬더니 통했다.' },
      { label: '그냥 참는다', mood: -3, bold: -2, result: '다음에 말해 보기로 했다.' },
    ],
  },
  {
    id: 'codecamp', title: '무료 코딩 캠프', emoji: '🏕️',
    text: '주말 무료 코딩 캠프 안내문을 받았다.',
    when: (_s, c) => c.grade >= 2, weight: 1,
    options: [
      { label: '간다', fields: { it: 6 }, stats: { logic: 2 }, fatigue: 10, result: '로봇을 코드로 움직여 봤다.' },
      { label: '주말엔 쉰다', fatigue: -10, result: '늦잠을 실컷 잤다.' },
    ],
  },
  {
    id: 'fitness', title: '체력 검사', emoji: '📏',
    text: '오늘은 체력 검사 날. 오래달리기가 남았다.',
    when: (_s, c) => c.grade >= 3 && c.month === 5, weight: 5,
    options: [
      { label: '전력을 다한다', stats: { body: 3 }, fields: { sport: 4 }, fatigue: 10, result: '반에서 손꼽히는 기록이 나왔다.' },
      { label: '적당히 뛴다', result: '무난하게 끝났다.' },
    ],
  },
];

export const eventById = (id: string) => EVENTS.find((e) => e.id === id);
