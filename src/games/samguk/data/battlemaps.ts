import type { CityId } from './types';

/**
 * 도시마다 하나씩 있는 전장. 19×13 육각 칸, 위쪽이 북쪽이다.
 * 실제 지리(강·산줄기·관·호수·바다)를 칸 위에 옮긴 것이며, 공격군은 출발 도시가 있는 쪽 가장자리로 들어온다.
 * 가장자리 두 줄은 공격군이 들어서는 자리라서, 관(關)을 둔 산줄기는 가장자리에서 두 칸 이상 안쪽에 둔다.
 */
export type Compass = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type P = [number, number];

export interface BattleMapDef {
  /** 바탕 지형 */
  base: 'plain' | 'hill' | 'mountain' | 'marsh';
  /** 본진 위치와 성 규모(대성: 성벽 3칸 밖 / 중성·소성: 2칸 밖) */
  castle: [number, number, 'large' | 'medium' | 'small'];
  /** 성문 방향 */
  gates: Compass[];
  /** 성벽 바깥 해자 */
  moat?: boolean;
  /** 강: 꺾은선, 너비(1~3), 다리, 여울 */
  rivers?: { pts: P[]; w?: number; bridges?: P[]; fords?: P[] }[];
  /** 산줄기(hill이면 구릉) */
  ridges?: { pts: P[]; w?: number; hill?: boolean }[];
  forests?: [number, number, number][];
  lakes?: [number, number, number][];
  roads?: P[][];
  villages?: P[];
  /** 관(關): 산줄기를 가로지르는 문. 수비 측이 지킨다 */
  passes?: P[];
  /** 제방: 여기서 둑을 터 수공을 쓸 수 있다 */
  dams?: P[];
  /** 그쪽 가장자리 두 줄이 바다 */
  sea?: Compass;
  labels?: [string, number, number][];
  note: string;
}

export const BATTLE_MAPS: Record<CityId, BattleMapDef> = {
  /* ── 유주 ── */
  xiangping: {
    base: 'plain', castle: [12, 6, 'medium'], gates: ['W', 'E', 'S'],
    rivers: [{ pts: [[6, 0], [5, 6], [6, 12]], w: 2, bridges: [[5, 3]], fords: [[6, 9]] }],
    forests: [[15, 2, 2], [2, 10, 1]], villages: [[14, 10], [2, 3]],
    labels: [['요수', 4, 6]],
    note: '요수를 건너야 닿는 요동의 성. 238년 사마의가 장마 속에 포위해 함락했다.',
  },
  beiping: {
    base: 'hill', castle: [10, 7, 'medium'], gates: ['S', 'W', 'E'],
    ridges: [{ pts: [[0, 2], [18, 2]] }], passes: [[12, 2]],
    forests: [[4, 8, 2], [15, 9, 1]], roads: [[[12, 2], [10, 7], [10, 12]]], villages: [[4, 11]],
    labels: [['연산', 5, 1], ['노룡새', 12, 1]],
    note: '연산 아래 변경의 성. 북쪽 고개 노룡새는 오환의 땅으로 통한다.',
  },
  ji: {
    base: 'plain', castle: [10, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 9], [8, 12]], bridges: [[4, 10]] }, { pts: [[14, 0], [18, 3]] }],
    forests: [[3, 2, 2], [16, 10, 1]], villages: [[3, 5], [15, 10], [6, 11]],
    roads: [[[0, 6], [18, 6]], [[10, 0], [10, 12]]],
    labels: [['고량하', 3, 11]],
    note: '유주 치소 계성. 사방이 트인 평원의 큰 성이다.',
  },
  /* ── 기주 ── */
  nanpi: {
    base: 'marsh', castle: [8, 6, 'medium'], gates: ['W', 'S', 'N'], sea: 'E',
    rivers: [{ pts: [[0, 3], [16, 7]], bridges: [[4, 4], [12, 6]] }],
    lakes: [[13, 10, 1]], forests: [[3, 10, 1]], villages: [[4, 1], [11, 11]],
    labels: [['발해', 17, 6]],
    note: '발해 바닷가의 저습지. 늪과 물길이 많아 대군이 나아가기 어렵다.',
  },
  ye: {
    base: 'plain', castle: [9, 8, 'large'], gates: ['N', 'S', 'E', 'W'], moat: true,
    rivers: [{ pts: [[0, 2], [18, 2]], w: 2, bridges: [[9, 2]], fords: [[3, 2], [15, 2]] }],
    dams: [[5, 4]], ridges: [{ pts: [[4, 7], [4, 8]], hill: true }],
    forests: [[16, 10, 1]], villages: [[2, 10], [16, 6]],
    labels: [['장수(漳水)', 13, 1], ['동작대', 3, 6]],
    note: '위공의 도읍. 204년 조조가 북쪽 장수를 터 성을 물에 잠기게 하고 함락했다.',
  },
  /* ── 병주 ── */
  jinyang: {
    base: 'hill', castle: [11, 6, 'medium'], gates: ['W', 'E', 'S'],
    rivers: [{ pts: [[6, 0], [7, 12]], bridges: [[6, 4], [7, 9]] }],
    ridges: [{ pts: [[0, 0], [0, 12]], w: 2 }, { pts: [[16, 0], [16, 12]] }], passes: [[16, 6]],
    dams: [[5, 6]], villages: [[3, 9], [13, 10]],
    labels: [['분수', 7, 2], ['정형관', 17, 5], ['여량산', 1, 3]],
    note: '분수 골짜기의 병주 치소. 춘추 시대 지백이 진수를 터 이 성을 잠기게 했다.',
  },
  shangdang: {
    base: 'mountain', castle: [9, 6, 'small'], gates: ['E', 'W', 'S'],
    ridges: [{ pts: [[14, 0], [14, 12]] }, { pts: [[3, 0], [3, 12]] }], passes: [[14, 6], [3, 4]],
    roads: [[[0, 4], [9, 6], [18, 6]]], forests: [[9, 10, 2]], villages: [[7, 9]],
    labels: [['호관', 15, 5], ['장평', 2, 3]],
    note: '태항산 위의 고원. 동쪽 호관을 넘어야 기주와 통한다.',
  },
  /* ── 청주 ── */
  pingyuan: {
    base: 'plain', castle: [9, 8, 'medium'], gates: ['N', 'S', 'W', 'E'],
    rivers: [{ pts: [[0, 4], [18, 1]], w: 2, fords: [[4, 3], [14, 2]], bridges: [[9, 3]] }],
    forests: [[4, 8, 1]], villages: [[3, 11], [15, 10], [14, 6]],
    labels: [['황하', 6, 2]],
    note: '황하 남쪽의 넓은 들. 유비가 평원상으로 있으며 백성을 돌보았다.',
  },
  beihai: {
    base: 'hill', castle: [9, 7, 'medium'], gates: ['W', 'S', 'E'], sea: 'N',
    rivers: [{ pts: [[14, 3], [15, 12]], bridges: [[14, 7]] }],
    forests: [[3, 10, 2], [15, 10, 1]], villages: [[5, 4], [12, 4]],
    labels: [['바다', 9, 0]],
    note: '청주 바닷가. 공융이 황건에게 포위되자 태사자가 홀로 포위를 뚫고 원군을 청했다.',
  },
  /* ── 연주 ── */
  puyang: {
    base: 'plain', castle: [10, 6, 'medium'], gates: ['N', 'W', 'E', 'S'],
    rivers: [{ pts: [[0, 1], [18, 2]], w: 2, fords: [[4, 1], [15, 2]] }, { pts: [[0, 10], [18, 10]], bridges: [[6, 10], [14, 10]] }],
    forests: [[3, 6, 2]], villages: [[15, 6], [5, 8]],
    labels: [['황하', 8, 1], ['복수', 10, 11]],
    note: '조조와 여포가 100여 일을 다툰 성. 조조는 동문 안 불길 속을 겨우 빠져나왔다.',
  },
  chenliu: {
    base: 'plain', castle: [9, 6, 'medium'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 10], [18, 10]], bridges: [[5, 10], [13, 10]] }],
    roads: [[[0, 6], [18, 6]]], villages: [[4, 3], [14, 3], [15, 8]], forests: [[3, 8, 1], [13, 1, 1]],
    labels: [['변수', 9, 11]],
    note: '연주와 낙양을 잇는 길목. 조조가 처음 의병을 모은 곳이다.',
  },
  /* ── 서주 ── */
  xiapi: {
    base: 'plain', castle: [9, 6, 'medium'], gates: ['W', 'E', 'S', 'N'], moat: true,
    rivers: [
      { pts: [[12, 0], [14, 6], [11, 12]], w: 2, bridges: [[14, 4]] },
      { pts: [[4, 0], [3, 6], [7, 12]], bridges: [[3, 4]] },
    ],
    dams: [[11, 1], [5, 1]], forests: [[16, 11, 1]], villages: [[1, 11], [17, 1]],
    labels: [['사수', 16, 7], ['기수', 2, 8], ['백문루', 9, 10]],
    note: '사수와 기수가 감싸 도는 서주의 요새. 198년 조조가 두 물을 터 성을 잠기게 해 여포를 사로잡았다.',
  },
  xiaopei: {
    base: 'plain', castle: [9, 6, 'small'], gates: ['W', 'E', 'S', 'N'],
    rivers: [{ pts: [[15, 0], [16, 12]], bridges: [[15, 6]] }],
    forests: [[4, 3, 2], [5, 10, 1]], villages: [[12, 10], [2, 7]],
    labels: [['사수', 17, 3], ['원문', 6, 6]],
    note: '서주와 예주 사이의 작은 성. 여포가 원문에 세운 극을 쏘아 맞혀 유비와 기령을 화해시켰다.',
  },
  langya: {
    base: 'hill', castle: [11, 7, 'medium'], gates: ['W', 'S', 'E'],
    ridges: [{ pts: [[2, 2], [7, 2], [8, 4]], w: 2 }],
    rivers: [{ pts: [[5, 5], [5, 12]], bridges: [[5, 8]] }],
    forests: [[15, 3, 2], [15, 11, 1]], villages: [[8, 11], [2, 9]],
    labels: [['몽산', 3, 1], ['기수', 4, 10]],
    note: '몽산 남쪽 구릉의 성. 제갈씨의 고향이며 장패 등 태산 호족의 근거지였다.',
  },
  /* ── 예주 ── */
  xuchang: {
    base: 'plain', castle: [9, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 11], [4, 8], [3, 0]], bridges: [[4, 5], [2, 10]] }],
    roads: [[[9, 0], [9, 12]], [[0, 6], [18, 6]]],
    villages: [[13, 1], [15, 10], [13, 11], [2, 3], [15, 3]], forests: [[17, 6, 1]],
    labels: [['영수', 1, 9], ['둔전', 14, 11]],
    note: '헌제를 맞은 허도. 둘레에 둔전이 펼쳐져 촌락을 잡으면 군량을 얻는다.',
  },
  runan: {
    base: 'plain', castle: [9, 6, 'medium'], gates: ['N', 'S', 'E', 'W'],
    lakes: [[3, 9, 1], [14, 2, 1], [15, 10, 1]],
    rivers: [{ pts: [[12, 0], [16, 12]], bridges: [[13, 4]] }],
    forests: [[4, 3, 1]], villages: [[6, 11], [2, 5]],
    labels: [['홍극피', 3, 11], ['여수', 16, 7]],
    note: '원씨의 본향. 저수지(피당)가 많아 땅이 기름지다.',
  },
  qiao: {
    base: 'plain', castle: [9, 7, 'small'], gates: ['W', 'E', 'N', 'S'],
    rivers: [{ pts: [[0, 3], [18, 2]], bridges: [[6, 3], [13, 2]] }],
    forests: [[3, 9, 2], [15, 9, 1]], villages: [[14, 5], [5, 11]],
    labels: [['와수', 9, 2]],
    note: '조씨와 하후씨의 고향 초현. 와수가 성 북쪽을 지난다.',
  },
  /* ── 양주 북부 ── */
  shouchun: {
    base: 'plain', castle: [10, 8, 'large'], gates: ['N', 'S', 'E', 'W'], moat: true,
    rivers: [
      { pts: [[0, 2], [18, 1]], w: 2, fords: [[4, 2]], bridges: [[12, 1]] },
      { pts: [[3, 12], [4, 4]], bridges: [[3, 9]] },
    ],
    ridges: [{ pts: [[1, 5], [2, 7]], hill: true }], villages: [[15, 4], [17, 11]],
    labels: [['회수', 8, 1], ['비수', 5, 10], ['팔공산', 1, 6]],
    note: '회수 남쪽의 큰 성. 원술이 황제를 칭했고, 뒤에 비수·회수가 위와 오의 싸움터가 되었다.',
  },
  lujiang: {
    base: 'hill', castle: [11, 6, 'small'], gates: ['W', 'E', 'S'],
    ridges: [{ pts: [[2, 0], [2, 12]] }], passes: [[2, 6]],
    lakes: [[16, 2, 2]], rivers: [{ pts: [[5, 0], [8, 12]], bridges: [[6, 4]], fords: [[7, 9]] }],
    forests: [[13, 10, 2], [4, 8, 1]], villages: [[15, 7]],
    labels: [['대별산', 1, 4], ['소호', 16, 1], ['환수', 8, 10]],
    note: '환성. 대별산과 소호 사이 구릉에 기대어 있다.',
  },
  /* ── 사례 ── */
  luoyang: {
    base: 'plain', castle: [8, 5, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 9], [18, 9]], bridges: [[4, 9], [11, 9]] }, { pts: [[0, 0], [18, 0]], fords: [[8, 0], [14, 0]] }],
    ridges: [{ pts: [[15, 1], [15, 12]] }, { pts: [[0, 10], [14, 10]] }], passes: [[15, 5], [6, 10]],
    roads: [[[8, 5], [18, 5]], [[6, 10], [6, 12]]],
    villages: [[13, 3], [2, 6], [12, 11]],
    labels: [['호뢰관', 16, 4], ['이궐', 6, 11], ['낙수', 2, 8], ['맹진', 9, 1]],
    note: '후한의 도읍. 동쪽 호뢰관, 남쪽 이궐, 북쪽 맹진 나루가 문을 이룬다.',
  },
  hongnong: {
    base: 'mountain', castle: [9, 6, 'small'], gates: ['E', 'W'],
    rivers: [{ pts: [[0, 2], [18, 2]], w: 2 }],
    ridges: [{ pts: [[0, 10], [16, 10]] }, { pts: [[14, 4], [14, 9]] }, { pts: [[4, 4], [4, 9]] }],
    roads: [[[0, 6], [18, 6]]], passes: [[14, 6], [4, 6]],
    labels: [['함곡관', 14, 5], ['동관', 4, 5], ['황하', 9, 2]],
    note: '함곡관과 동관 사이의 좁은 골짜기. 관을 깨지 않으면 지나기 어렵다.',
  },
  changan: {
    base: 'plain', castle: [8, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 1], [18, 1]], w: 2, bridges: [[8, 1]], fords: [[15, 1]] }, { pts: [[15, 3], [16, 12]], bridges: [[15, 6]] }],
    ridges: [{ pts: [[0, 10], [13, 10]] }], passes: [[5, 10]],
    villages: [[13, 9], [2, 4], [11, 12]],
    labels: [['위수', 4, 1], ['패수', 17, 8], ['위교', 8, 0], ['자오곡', 5, 11]],
    note: '전한의 옛 도읍. 성벽이 높고 넓으며 북쪽 위수가 해자 구실을 한다.',
  },
  henei: {
    base: 'plain', castle: [9, 6, 'medium'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 10], [18, 10]], w: 2, fords: [[4, 10]], bridges: [[12, 10]] }, { pts: [[14, 3], [15, 9]], bridges: [[14, 6]] }],
    ridges: [{ pts: [[0, 2], [18, 2]] }], passes: [[6, 2]],
    forests: [[3, 5, 2]], villages: [[6, 8], [16, 5]],
    labels: [['황하', 8, 12], ['태항산', 3, 1], ['심수', 16, 3]],
    note: '황하 북쪽 기슭. 북으로 태항산을 지고 있으며 사마씨가 대를 이은 땅이다.',
  },
  /* ── 옹주·양주(涼) ── */
  anding: {
    base: 'hill', castle: [9, 6, 'small'], gates: ['S', 'E', 'W'],
    rivers: [{ pts: [[0, 10], [18, 9]], bridges: [[9, 10]] }],
    ridges: [{ pts: [[2, 0], [6, 3]] }], forests: [[15, 2, 1]], villages: [[14, 12]],
    labels: [['경수', 3, 11]],
    note: '황토 고원의 변경 성. 강족과 섞여 산다.',
  },
  tianshui: {
    base: 'mountain', castle: [9, 5, 'medium'], gates: ['W', 'E', 'S'],
    rivers: [{ pts: [[0, 9], [18, 8]], bridges: [[5, 9], [13, 8]] }],
    ridges: [{ pts: [[15, 0], [15, 12]] }, { pts: [[2, 11], [6, 12]], hill: true }], passes: [[15, 8]],
    roads: [[[9, 5], [15, 8], [18, 8]]], villages: [[12, 11], [3, 5]],
    labels: [['가정', 16, 7], ['위수', 6, 10], ['기산', 3, 12]],
    note: '농서의 기성. 제갈량 북벌의 첫 목표였고 가정에서 마속이 패했다.',
  },
  wuwei: {
    base: 'plain', castle: [9, 5, 'medium'], gates: ['N', 'S', 'E', 'W'],
    ridges: [{ pts: [[0, 10], [18, 10]] }], passes: [[9, 10]],
    lakes: [[3, 3, 1], [15, 3, 1]], forests: [[14, 8, 1]], villages: [[4, 8]],
    labels: [['기련산', 4, 11]],
    note: '하서회랑의 입구. 남쪽 기련산 너머는 강족의 땅이다.',
  },
  jincheng: {
    base: 'mountain', castle: [9, 8, 'small'], gates: ['W', 'E', 'N'],
    rivers: [{ pts: [[0, 3], [18, 4]], w: 2, bridges: [[9, 3]] }],
    roads: [[[0, 8], [18, 8]], [[9, 3], [9, 8]]], forests: [[4, 11, 1]], villages: [[14, 11]],
    labels: [['황하', 4, 3]],
    note: '황하 상류 산골의 성. 한수가 30년을 웅거했다.',
  },
  wudu: {
    base: 'mountain', castle: [10, 5, 'small'], gates: ['N', 'S', 'W'],
    rivers: [{ pts: [[6, 0], [7, 12]], bridges: [[6, 5]] }],
    ridges: [{ pts: [[0, 10], [18, 10]] }], passes: [[12, 10]],
    roads: [[[10, 5], [12, 10], [12, 12]]], forests: [[14, 2, 2]],
    labels: [['서한수', 5, 3], ['음평', 13, 11]],
    note: '저족의 땅. 남쪽 음평 샛길은 263년 등애가 촉으로 넘어간 길이다.',
  },
  /* ── 익주 ── */
  hanzhong: {
    base: 'hill', castle: [11, 5, 'medium'], gates: ['W', 'E', 'N', 'S'],
    rivers: [{ pts: [[3, 8], [18, 8]], bridges: [[7, 8], [15, 8]] }],
    ridges: [{ pts: [[0, 2], [18, 2]] }, { pts: [[2, 3], [2, 12]] }, { pts: [[3, 10], [18, 10]] }, { pts: [[4, 9], [6, 9]], hill: true }],
    passes: [[13, 2], [2, 6], [9, 10]],
    roads: [[[13, 0], [13, 2], [11, 5]], [[0, 6], [2, 6], [11, 5]]],
    labels: [['야곡', 14, 1], ['양평관', 1, 5], ['미창도', 9, 11], ['한수', 12, 8], ['정군산', 5, 8]],
    note: '진령과 대파산 사이의 분지. 북쪽 야곡, 서쪽 양평관, 남쪽 미창도가 문이다.',
  },
  zitong: {
    base: 'mountain', castle: [9, 8, 'small'], gates: ['N', 'S', 'E'],
    ridges: [{ pts: [[0, 3], [18, 3]] }], passes: [[9, 3]],
    rivers: [{ pts: [[14, 4], [15, 12]], bridges: [[14, 8]] }],
    roads: [[[9, 0], [9, 3], [9, 8], [9, 12]]], forests: [[4, 8, 2]], villages: [[12, 11]],
    labels: [['검각', 10, 2], ['부강', 16, 10]],
    note: '검각의 험한 잔도 아래. 강유가 이곳에서 종회의 대군을 막아 냈다.',
  },
  chengdu: {
    base: 'plain', castle: [9, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 1], [18, 1]], bridges: [[5, 1], [13, 1]] }, { pts: [[0, 10], [18, 10]], bridges: [[6, 10], [12, 10]] }],
    villages: [[3, 4], [15, 4], [3, 8], [15, 8], [9, 12]], forests: [[2, 12, 1], [16, 0, 1]],
    labels: [['금강', 9, 11], ['비강', 5, 0]],
    note: '천부지국의 중심. 두 강이 성을 끼고 흐르고 촌락이 많아 군량을 얻기 쉽다.',
  },
  jiangzhou: {
    base: 'hill', castle: [8, 5, 'medium'], gates: ['N', 'W', 'E'],
    rivers: [{ pts: [[0, 9], [18, 9]], w: 2 }, { pts: [[12, 0], [11, 8]], w: 2, fords: [[12, 3]] }],
    villages: [[3, 3]], forests: [[3, 7, 1], [15, 12, 1]],
    labels: [['장강', 4, 10], ['가릉강', 14, 2]],
    note: '장강과 가릉강이 만나는 곶 위의 성. 두 강이 해자다.',
  },
  yongan: {
    base: 'mountain', castle: [12, 4, 'small'], gates: ['W', 'S'],
    rivers: [{ pts: [[0, 8], [18, 8]], w: 3 }],
    roads: [[[0, 6], [12, 4], [18, 6]]],
    labels: [['구당협', 16, 11], ['장강', 4, 9], ['백제성', 12, 1]],
    note: '삼협 어귀의 백제성. 강을 타고 오지 않으면 험한 산길뿐이다. 223년 유비가 여기서 숨졌다.',
  },
  jianning: {
    base: 'mountain', castle: [11, 6, 'small'], gates: ['W', 'E', 'S'],
    lakes: [[4, 6, 2]], forests: [[14, 10, 2], [15, 2, 2], [8, 11, 1]], villages: [[7, 3]],
    roads: [[[0, 10], [11, 6], [18, 6]]],
    labels: [['전지', 4, 6]],
    note: '남중의 중심. 서쪽에 전지(滇池)가 넓게 펼쳐져 있고 산마다 숲이 짙다.',
  },
  yunnan: {
    base: 'mountain', castle: [8, 6, 'small'], gates: ['E', 'S', 'N'],
    lakes: [[13, 6, 2]], ridges: [{ pts: [[3, 0], [3, 12]], w: 2 }],
    forests: [[9, 11, 2], [10, 1, 1], [16, 11, 1]],
    labels: [['이해', 13, 6], ['점창산', 3, 6]],
    note: '이해와 점창산 사이의 땅. 숲이 깊어 매복에 알맞다.',
  },
  shangyong: {
    base: 'mountain', castle: [10, 6, 'small'], gates: ['W', 'N', 'E'],
    rivers: [{ pts: [[0, 9], [8, 9], [13, 12]], bridges: [[5, 9]] }],
    forests: [[4, 3, 2], [15, 3, 1]], roads: [[[0, 6], [18, 6]]],
    labels: [['도수', 4, 10]],
    note: '깊은 산중의 동삼군. 228년 맹달이 사마의의 기습에 무너진 신성이 가깝다.',
  },
  /* ── 형주 ── */
  wan: {
    base: 'plain', castle: [9, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[14, 0], [15, 12]], bridges: [[14, 4], [15, 9]] }],
    villages: [[3, 3], [3, 9], [12, 11]], forests: [[5, 11, 1]], roads: [[[0, 6], [18, 6]]],
    labels: [['육수', 17, 6]],
    note: '천하에서 가장 큰 군의 치소. 197년 장수의 기습으로 조조가 맏아들과 전위를 잃었다.',
  },
  xinye: {
    base: 'plain', castle: [9, 7, 'small'], gates: ['N', 'E', 'S'],
    rivers: [{ pts: [[4, 0], [5, 12]], bridges: [[4, 4], [5, 9]] }],
    forests: [[11, 2, 2], [15, 3, 1]], villages: [[14, 10], [2, 9]],
    labels: [['박망', 11, 1], ['백하', 6, 11]],
    note: '유비가 객장으로 머문 성. 북쪽 박망에서 군영을 불사르고 매복해 하후돈을 물리쳤다.',
  },
  xiangyang: {
    base: 'hill', castle: [9, 7, 'medium'], gates: ['N', 'S', 'W'], moat: true,
    rivers: [{ pts: [[0, 2], [18, 2]], w: 2, bridges: [[9, 2]], fords: [[15, 2]] }],
    ridges: [{ pts: [[2, 10], [6, 12]], hill: true }], forests: [[4, 11, 1]], villages: [[15, 8]],
    labels: [['한수', 6, 2], ['번성', 9, 0], ['현산', 3, 12]],
    note: '한수를 끼고 번성과 마주한 형주의 요새. 191년 손견이 현산에서 화살에 맞아 죽었다.',
  },
  jiangling: {
    base: 'marsh', castle: [9, 5, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 10], [18, 10]], w: 2 }],
    lakes: [[16, 4, 1]], villages: [[3, 4], [15, 8]], forests: [[3, 8, 1]],
    labels: [['장강', 5, 11]],
    note: '남군 치소. 큰 성과 넓은 저습지, 남쪽 장강 나루가 물자의 집산지다.',
  },
  jiangxia: {
    base: 'hill', castle: [10, 5, 'medium'], gates: ['W', 'S', 'E'],
    rivers: [{ pts: [[0, 8], [18, 9]], w: 2 }, { pts: [[0, 2], [8, 8]], bridges: [[4, 5]] }],
    forests: [[15, 2, 1]], villages: [[15, 6]],
    labels: [['하구', 9, 10], ['장강', 3, 10], ['한수', 2, 3]],
    note: '한수가 장강에 드는 하구. 황조가 지키며 손씨와 대를 이어 다퉜다.',
  },
  changsha: {
    base: 'plain', castle: [11, 6, 'medium'], gates: ['W', 'N', 'S', 'E'],
    rivers: [{ pts: [[6, 0], [6, 12]], w: 2, bridges: [[6, 6]] }],
    ridges: [{ pts: [[2, 3], [3, 9]], hill: true }], forests: [[3, 6, 1], [15, 10, 1]], villages: [[15, 3], [13, 11]],
    labels: [['상수', 8, 10], ['악록산', 1, 6]],
    note: '상수 동쪽 기슭의 형남 중심. 손견이 태수로 있던 곳이다.',
  },
  wuling: {
    base: 'mountain', castle: [9, 5, 'small'], gates: ['S', 'E', 'W'],
    rivers: [{ pts: [[0, 8], [18, 8]], bridges: [[6, 8], [13, 8]] }],
    forests: [[4, 2, 2], [14, 2, 2], [9, 11, 2]],
    labels: [['원수', 3, 9]],
    note: '동정호 서쪽 산지. 무릉만이 숲에 기대어 산다.',
  },
  lingling: {
    base: 'hill', castle: [8, 5, 'small'], gates: ['N', 'W', 'E'],
    rivers: [{ pts: [[0, 10], [11, 10], [14, 0]], bridges: [[5, 10], [12, 6]] }],
    forests: [[3, 3, 2], [16, 10, 1]], villages: [[4, 8]],
    labels: [['상수', 15, 2], ['소수', 3, 11]],
    note: '상수와 소수가 만나는 구릉. 교주로 넘어가는 길목이다.',
  },
  guiyang: {
    base: 'mountain', castle: [9, 6, 'small'], gates: ['N', 'S'],
    ridges: [{ pts: [[0, 10], [18, 10]] }], passes: [[9, 10]],
    forests: [[4, 4, 2], [14, 4, 2]], villages: [[9, 2]], roads: [[[9, 0], [9, 12]]],
    labels: [['남령', 13, 11]],
    note: '남령 북쪽의 산성. 형주의 남쪽 끝이다.',
  },
  /* ── 양주 남부 ── */
  jianye: {
    base: 'hill', castle: [10, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    rivers: [{ pts: [[0, 10], [3, 3], [12, 0]], w: 2 }, { pts: [[4, 11], [18, 11]], bridges: [[9, 11], [14, 11]] }],
    ridges: [{ pts: [[15, 2], [16, 8]], hill: true }], villages: [[14, 9]],
    labels: [['장강', 1, 6], ['석두성', 6, 5], ['종산', 17, 5], ['진회', 11, 12]],
    note: '석두성을 낀 손권의 도읍. 장강이 서쪽과 북쪽을 막고 동쪽에 종산이 솟았다.',
  },
  wu: {
    base: 'marsh', castle: [11, 6, 'large'], gates: ['N', 'S', 'E', 'W'],
    lakes: [[2, 7, 3]],
    rivers: [
      { pts: [[0, 1], [18, 1]], bridges: [[5, 1], [11, 1], [16, 1]] },
      { pts: [[0, 11], [18, 11]], bridges: [[7, 11], [14, 11]] },
      { pts: [[7, 0], [7, 12]], bridges: [[7, 4], [7, 8]] },
    ],
    villages: [[16, 9], [16, 3]],
    labels: [['태호', 2, 7], ['운하', 6, 10]],
    note: '물길이 거미줄처럼 얽힌 강남 수향. 손씨와 고·육·주·장 네 집안의 근거지다.',
  },
  kuaiji: {
    base: 'hill', castle: [9, 6, 'medium'], gates: ['N', 'S', 'W', 'E'],
    rivers: [{ pts: [[0, 1], [18, 2]], w: 2, bridges: [[9, 1]] }],
    ridges: [{ pts: [[0, 10], [18, 10]] }], passes: [[6, 10]],
    lakes: [[14, 7, 1]], forests: [[3, 6, 1]],
    labels: [['절강', 4, 2], ['회계산', 13, 11], ['경호', 15, 6]],
    note: '절강 남쪽 기슭. 남쪽 회계산은 우임금의 무덤이 있다는 산이다.',
  },
  chaisang: {
    base: 'hill', castle: [8, 6, 'medium'], gates: ['W', 'S', 'E'],
    rivers: [{ pts: [[0, 2], [18, 2]], w: 2, fords: [[3, 2]] }],
    lakes: [[15, 8, 3]], ridges: [{ pts: [[1, 9], [5, 12]] }], forests: [[4, 6, 1]],
    labels: [['장강', 9, 2], ['파양호', 15, 8], ['여산', 2, 11]],
    note: '파양호 어귀의 수군 기지. 적벽 전야 손권이 이곳에 머물며 결전을 정했다.',
  },
  yuzhang: {
    base: 'hill', castle: [11, 6, 'medium'], gates: ['W', 'N', 'S', 'E'],
    rivers: [{ pts: [[6, 12], [6, 0]], w: 2, bridges: [[6, 6]] }],
    lakes: [[15, 0, 2]], forests: [[3, 3, 2], [15, 10, 2]], villages: [[2, 9]],
    labels: [['공수', 8, 10], ['파양호', 15, 1]],
    note: '공수 동쪽의 넓은 군. 산월이 깊은 산에 숨어 산다.',
  },
  /* ── 교주 ── */
  nanhai: {
    base: 'hill', castle: [9, 5, 'medium'], gates: ['N', 'E', 'W', 'S'], sea: 'S',
    rivers: [{ pts: [[0, 8], [18, 8]], bridges: [[4, 8], [14, 8]] }],
    ridges: [{ pts: [[3, 1], [15, 1]], hill: true }], villages: [[15, 6]], forests: [[3, 5, 1]],
    labels: [['주강', 9, 9], ['백운산', 9, 0]],
    note: '번우. 주강이 바다로 드는 남해 무역의 항구다.',
  },
  cangwu: {
    base: 'mountain', castle: [9, 5, 'small'], gates: ['W', 'E'],
    rivers: [{ pts: [[0, 9], [9, 9], [18, 8]], w: 2, bridges: [[5, 9]] }, { pts: [[12, 0], [12, 8]], bridges: [[12, 4]] }],
    forests: [[4, 3, 2]], roads: [[[0, 5], [18, 5]]],
    labels: [['서강', 3, 11], ['계강', 13, 2]],
    note: '서강과 계강이 만나는 광신. 사섭 일족이 대를 이어 다스렸다.',
  },
  jiaozhi: {
    base: 'marsh', castle: [13, 4, 'medium'], gates: ['N', 'S', 'W', 'E'],
    rivers: [{ pts: [[0, 1], [18, 11]], w: 2, bridges: [[5, 4]] }],
    forests: [[3, 9, 2], [8, 11, 2], [16, 11, 1]], villages: [[5, 11]],
    labels: [['홍하', 8, 7], ['용편', 13, 0]],
    note: '홍하 삼각주의 용편성. 물길과 밀림이 얽혀 있다.',
  },
};
