import type { CityDef, CityId, RoadDef } from './types';

/**
 * 53개 도시. 위치는 치소(군·국의 중심 현)의 대략적인 경위도.
 * 인구는 『후한서』 군국지(140년 호구)를 만 명 단위로 반올림하고, 한 도시가 여러 군을 대표하는 곳은 합쳐서 보정했다.
 */
export const CITIES: CityDef[] = [
  // 유주
  { id: 'xiangping', name: '양평', hanja: '襄平', zhou: '유주', lon: 123.2, lat: 41.3, pop: 12, land: 'plain', note: '요동군 치소. 공손씨가 대를 이어 다스린 동북의 끝.' },
  { id: 'beiping', name: '북평', hanja: '北平', zhou: '유주', lon: 118.6, lat: 40.0, pop: 10, land: 'hill', note: '우북평·요서. 오환과 맞닿은 변경으로 백마의종의 무대.' },
  { id: 'ji', name: '계', hanja: '薊', zhou: '유주', lon: 116.4, lat: 39.9, pop: 45, land: 'plain', note: '유주 치소. 탁군을 아우르며 유비의 고향 탁현이 가깝다.' },
  // 기주
  { id: 'nanpi', name: '남피', hanja: '南皮', zhou: '기주', lon: 116.7, lat: 38.0, pop: 70, land: 'plain', note: '발해군 치소. 원소가 반동탁의 기치를 올린 곳.' },
  { id: 'ye', name: '업', hanja: '鄴', zhou: '기주', lon: 114.6, lat: 36.3, pop: 75, land: 'plain', note: '기주 치소이자 위공·위왕의 도읍. 동작대가 섰다.' },
  // 병주
  { id: 'jinyang', name: '진양', hanja: '晉陽', zhou: '병주', lon: 112.55, lat: 37.9, pop: 22, land: 'hill', note: '태원군 치소. 흉노·선비와 맞닿은 병주의 중심.' },
  { id: 'shangdang', name: '상당', hanja: '上黨', zhou: '병주', lon: 113.1, lat: 36.2, pop: 25, land: 'mountain', note: '태항산 위의 고원. 하동과 기주를 내려다본다.' },
  // 청주
  { id: 'pingyuan', name: '평원', hanja: '平原', zhou: '청주', lon: 116.4, lat: 37.2, pop: 55, land: 'plain', note: '황하 하류의 평야. 유비가 평원상을 지냈다.' },
  { id: 'beihai', name: '북해', hanja: '北海', zhou: '청주', lon: 119.1, lat: 36.7, pop: 60, land: 'plain', note: '공융이 다스린 학문의 고장. 바다 건너 요동과 통한다.' },
  // 연주
  { id: 'puyang', name: '복양', hanja: '濮陽', zhou: '연주', lon: 115.0, lat: 35.7, pop: 60, land: 'river', note: '동군 치소. 조조와 여포가 100여 일을 다툰 곳.' },
  { id: 'chenliu', name: '진류', hanja: '陳留', zhou: '연주', lon: 114.4, lat: 34.8, pop: 70, land: 'plain', note: '조조가 처음 의병을 일으킨 곳. 낙양으로 가는 동쪽 관문.' },
  // 서주
  { id: 'xiapi', name: '하비', hanja: '下邳', zhou: '서주', lon: 117.9, lat: 34.3, pop: 60, land: 'river', note: '서주 치소. 사수와 기수가 감싸 도는 요새, 여포 최후의 땅.' },
  { id: 'xiaopei', name: '소패', hanja: '小沛', zhou: '서주', lon: 116.9, lat: 34.7, pop: 25, land: 'plain', note: '패현. 서주와 예주를 잇는 길목의 작은 성.' },
  { id: 'langya', name: '낭야', hanja: '琅邪', zhou: '서주', lon: 118.3, lat: 35.1, pop: 55, land: 'hill', note: '제갈씨의 고향. 장패 등 태산의 호족이 웅거했다.' },
  // 예주
  { id: 'xuchang', name: '허창', hanja: '許昌', zhou: '예주', lon: 113.8, lat: 34.0, pop: 80, land: 'plain', note: '영천군 허현. 196년 헌제를 맞아 허도가 되었다.' },
  { id: 'runan', name: '여남', hanja: '汝南', zhou: '예주', lon: 114.4, lat: 33.0, pop: 90, land: 'plain', note: '원씨의 본향. 인구가 가장 많은 군 가운데 하나.' },
  { id: 'qiao', name: '초', hanja: '譙', zhou: '예주', lon: 115.8, lat: 33.9, pop: 25, land: 'plain', note: '패국 초현. 조씨와 하후씨, 허저의 고향.' },
  // 양주 북부
  { id: 'shouchun', name: '수춘', hanja: '壽春', zhou: '양주', lon: 116.8, lat: 32.6, pop: 45, land: 'river', note: '회수 남쪽의 요충. 원술이 황제를 칭한 곳.' },
  { id: 'lujiang', name: '여강', hanja: '廬江', zhou: '양주', lon: 117.0, lat: 31.1, pop: 42, land: 'hill', note: '주유의 고향 서현. 장강과 회수 사이의 완충지.' },
  // 사례
  { id: 'luoyang', name: '낙양', hanja: '洛陽', zhou: '사례', lon: 112.6, lat: 34.7, pop: 60, land: 'plain', note: '후한의 수도. 190년 동탁이 불태웠다.' },
  { id: 'hongnong', name: '홍농', hanja: '弘農', zhou: '사례', lon: 110.9, lat: 34.5, pop: 20, land: 'mountain', note: '함곡관과 동관 사이. 관중으로 드는 좁은 길.' },
  { id: 'changan', name: '장안', hanja: '長安', zhou: '사례', lon: 108.9, lat: 34.3, pop: 45, land: 'plain', note: '전한의 수도. 동탁이 천도한 관중의 중심.' },
  { id: 'henei', name: '하내', hanja: '河內', zhou: '사례', lon: 113.2, lat: 35.1, pop: 70, land: 'river', note: '황하 북안. 사마씨의 고향 온현이 있다.' },
  // 양주(涼州)·옹주
  { id: 'anding', name: '안정', hanja: '安定', zhou: '옹주', lon: 106.7, lat: 35.6, pop: 10, land: 'hill', note: '황토 고원의 변경. 강족과 섞여 살았다.' },
  { id: 'tianshui', name: '천수', hanja: '天水', zhou: '옹주', lon: 105.7, lat: 34.75, pop: 18, land: 'mountain', note: '한양·농서. 강유의 고향이자 북벌의 첫 목표.' },
  { id: 'wuwei', name: '무위', hanja: '武威', zhou: '양주(涼)', lon: 102.6, lat: 37.9, pop: 12, land: 'plain', note: '하서회랑의 입구. 가후의 고향.' },
  { id: 'jincheng', name: '금성', hanja: '金城', zhou: '양주(涼)', lon: 103.8, lat: 36.1, pop: 8, land: 'mountain', note: '한수의 근거지. 황하 상류의 강족 땅.' },
  { id: 'wudu', name: '무도', hanja: '武都', zhou: '양주(涼)', lon: 105.6, lat: 33.7, pop: 9, land: 'mountain', note: '저족의 땅. 음평을 넘어 촉으로 가는 샛길이 있다.' },
  // 익주
  { id: 'hanzhong', name: '한중', hanja: '漢中', zhou: '익주', lon: 107.0, lat: 33.07, pop: 27, land: 'hill', note: '진령 아래 분지. 장로의 오두미도가 다스렸다.' },
  { id: 'zitong', name: '재동', hanja: '梓潼', zhou: '익주', lon: 105.2, lat: 31.6, pop: 45, land: 'mountain', note: '광한·자동. 검각과 가맹관이 성도를 지킨다.' },
  { id: 'chengdu', name: '성도', hanja: '成都', zhou: '익주', lon: 104.07, lat: 30.66, pop: 110, land: 'plain', note: '익주 치소. 천부지국이라 불린 촉의 심장.' },
  { id: 'jiangzhou', name: '강주', hanja: '江州', zhou: '익주', lon: 106.55, lat: 29.56, pop: 75, land: 'river', note: '파군 치소. 장강과 가릉강이 만난다.' },
  { id: 'yongan', name: '영안', hanja: '永安', zhou: '익주', lon: 109.5, lat: 31.0, pop: 20, land: 'river', note: '백제성. 삼협 어귀로, 유비가 숨을 거둔 곳.' },
  { id: 'jianning', name: '건녕', hanja: '建寧', zhou: '익주', lon: 103.8, lat: 25.5, pop: 15, land: 'mountain', note: '남중의 중심(옛 익주군). 옹개가 일어선 곳.' },
  { id: 'yunnan', name: '운남', hanja: '雲南', zhou: '익주', lon: 100.6, lat: 25.3, pop: 20, land: 'mountain', note: '영창·운남. 남만의 깊은 땅.' },
  { id: 'shangyong', name: '상용', hanja: '上庸', zhou: '형주', lon: 110.2, lat: 32.2, pop: 12, land: 'mountain', note: '동삼군. 맹달과 유봉이 지키다 잃었다.' },
  // 형주
  { id: 'wan', name: '완', hanja: '宛', zhou: '형주', lon: 112.5, lat: 33.0, pop: 120, land: 'plain', note: '남양군 치소. 천하제일의 큰 군으로 장수가 웅거했다.' },
  { id: 'xinye', name: '신야', hanja: '新野', zhou: '형주', lon: 112.4, lat: 32.5, pop: 18, land: 'plain', note: '유비가 유표의 객장으로 머문 작은 성.' },
  { id: 'xiangyang', name: '양양', hanja: '襄陽', zhou: '형주', lon: 112.1, lat: 32.0, pop: 40, land: 'river', note: '형주 치소. 한수를 끼고 번성과 마주 본다.' },
  { id: 'jiangling', name: '강릉', hanja: '江陵', zhou: '형주', lon: 112.2, lat: 30.35, pop: 70, land: 'river', note: '남군 치소. 장강 중류 물자의 집산지.' },
  { id: 'jiangxia', name: '강하', hanja: '江夏', zhou: '형주', lon: 114.3, lat: 30.6, pop: 27, land: 'river', note: '하구. 황조가 지키며 손씨와 대를 이어 다퉜다.' },
  { id: 'changsha', name: '장사', hanja: '長沙', zhou: '형주', lon: 112.9, lat: 28.2, pop: 100, land: 'plain', note: '손견이 태수를 지낸 형남의 중심.' },
  { id: 'wuling', name: '무릉', hanja: '武陵', zhou: '형주', lon: 111.7, lat: 29.0, pop: 25, land: 'mountain', note: '동정호 서쪽. 무릉만이 사는 산지.' },
  { id: 'lingling', name: '영릉', hanja: '零陵', zhou: '형주', lon: 111.6, lat: 26.4, pop: 100, land: 'hill', note: '상수 상류. 교주로 넘어가는 길.' },
  { id: 'guiyang', name: '계양', hanja: '桂陽', zhou: '형주', lon: 113.0, lat: 25.8, pop: 50, land: 'mountain', note: '남령 북쪽. 형주 최남단.' },
  // 양주 남부
  { id: 'jianye', name: '건업', hanja: '建業', zhou: '양주', lon: 118.8, lat: 32.05, pop: 60, land: 'river', note: '말릉. 손권이 도읍한 석두성.' },
  { id: 'wu', name: '오', hanja: '吳', zhou: '양주', lon: 120.6, lat: 31.3, pop: 70, land: 'marsh', note: '오군. 손씨와 강동 사대성(고·육·주·장)의 근거지.' },
  { id: 'kuaiji', name: '회계', hanja: '會稽', zhou: '양주', lon: 120.6, lat: 30.0, pop: 48, land: 'hill', note: '절강 남쪽. 왕랑이 다스리다 손책에게 빼앗겼다.' },
  { id: 'chaisang', name: '시상', hanja: '柴桑', zhou: '양주', lon: 116.0, lat: 29.7, pop: 50, land: 'river', note: '파양호 어귀. 적벽 전야 손권이 머문 수군 기지.' },
  { id: 'yuzhang', name: '예장', hanja: '豫章', zhou: '양주', lon: 115.9, lat: 28.7, pop: 100, land: 'hill', note: '남창. 산월이 많은 넓은 군.' },
  // 교주
  { id: 'nanhai', name: '남해', hanja: '南海', zhou: '교주', lon: 113.3, lat: 23.1, pop: 25, land: 'river', note: '번우(광주). 남해 무역의 항구.' },
  { id: 'cangwu', name: '창오', hanja: '蒼梧', zhou: '교주', lon: 111.3, lat: 23.5, pop: 45, land: 'mountain', note: '광신. 교주 치소이자 사섭의 고향.' },
  { id: 'jiaozhi', name: '교지', hanja: '交趾', zhou: '교주', lon: 105.85, lat: 21.0, pop: 50, land: 'marsh', note: '홍하 삼각주. 사섭이 40년을 다스렸다.' },
];

/** 길 — 실제 교통로(관도·잔도·수로)를 단순화했다 */
export const ROADS: RoadDef[] = [
  ['xiangping', 'beiping', 'l'], ['xiangping', 'beihai', 'w'],
  ['beiping', 'ji', 'l'], ['ji', 'nanpi', 'l'], ['ji', 'jinyang', 'l'],
  ['nanpi', 'pingyuan', 'l'], ['nanpi', 'ye', 'l'],
  ['ye', 'jinyang', 'l'], ['ye', 'shangdang', 'l'], ['ye', 'pingyuan', 'l'], ['ye', 'puyang', 'r'], ['ye', 'henei', 'l'],
  ['jinyang', 'shangdang', 'l'], ['jinyang', 'hongnong', 'r'], ['shangdang', 'henei', 'l'],
  ['pingyuan', 'beihai', 'l'], ['pingyuan', 'puyang', 'r'],
  ['beihai', 'langya', 'l'], ['langya', 'xiapi', 'l'], ['langya', 'xiaopei', 'l'],
  ['xiapi', 'xiaopei', 'l'], ['xiapi', 'shouchun', 'l'], ['xiapi', 'jianye', 'r'],
  ['xiaopei', 'qiao', 'l'], ['xiaopei', 'chenliu', 'l'], ['xiaopei', 'puyang', 'l'],
  ['puyang', 'chenliu', 'l'], ['puyang', 'henei', 'r'],
  ['chenliu', 'xuchang', 'l'], ['chenliu', 'luoyang', 'l'], ['chenliu', 'qiao', 'l'],
  ['xuchang', 'luoyang', 'l'], ['xuchang', 'runan', 'l'], ['xuchang', 'wan', 'l'], ['xuchang', 'qiao', 'l'],
  ['qiao', 'runan', 'l'], ['qiao', 'shouchun', 'l'],
  ['runan', 'shouchun', 'l'], ['runan', 'wan', 'l'], ['runan', 'jiangxia', 'l'],
  ['shouchun', 'lujiang', 'l'], ['lujiang', 'jianye', 'r'], ['lujiang', 'chaisang', 'r'], ['lujiang', 'jiangxia', 'l'],
  ['luoyang', 'henei', 'r'], ['luoyang', 'hongnong', 'l'], ['luoyang', 'wan', 'l'],
  ['hongnong', 'changan', 'l'],
  ['changan', 'anding', 'l'], ['changan', 'tianshui', 'l'], ['changan', 'hanzhong', 'l'],
  ['anding', 'wuwei', 'l'], ['anding', 'tianshui', 'l'],
  ['jincheng', 'wuwei', 'l'], ['jincheng', 'tianshui', 'l'],
  ['tianshui', 'wudu', 'l'], ['wudu', 'hanzhong', 'l'], ['wudu', 'zitong', 'l'],
  ['hanzhong', 'zitong', 'l'], ['hanzhong', 'shangyong', 'l'],
  ['zitong', 'chengdu', 'l'], ['chengdu', 'jiangzhou', 'l'], ['chengdu', 'jianning', 'l'],
  ['jiangzhou', 'yongan', 'w'], ['jiangzhou', 'jianning', 'l'],
  ['jianning', 'yunnan', 'l'], ['jianning', 'jiaozhi', 'l'],
  ['yongan', 'jiangling', 'w'], ['yongan', 'shangyong', 'l'],
  ['shangyong', 'wan', 'l'], ['shangyong', 'xiangyang', 'l'],
  ['wan', 'xinye', 'l'], ['xinye', 'xiangyang', 'r'],
  ['xiangyang', 'jiangling', 'l'], ['xiangyang', 'jiangxia', 'l'],
  ['jiangling', 'jiangxia', 'w'], ['jiangling', 'wuling', 'l'], ['jiangling', 'changsha', 'r'],
  ['wuling', 'changsha', 'l'], ['wuling', 'lingling', 'l'],
  ['changsha', 'lingling', 'l'], ['changsha', 'guiyang', 'l'], ['changsha', 'jiangxia', 'l'], ['changsha', 'yuzhang', 'l'],
  ['lingling', 'guiyang', 'l'], ['lingling', 'cangwu', 'l'],
  ['guiyang', 'nanhai', 'l'],
  ['jiangxia', 'chaisang', 'w'],
  ['chaisang', 'yuzhang', 'l'], ['chaisang', 'jianye', 'w'],
  ['jianye', 'wu', 'l'], ['wu', 'kuaiji', 'l'], ['kuaiji', 'yuzhang', 'l'],
  ['yuzhang', 'nanhai', 'l'],
  ['cangwu', 'nanhai', 'l'], ['cangwu', 'jiaozhi', 'l'], ['nanhai', 'jiaozhi', 'w'],
];

export const CITY_BY_ID: Record<CityId, CityDef> = Object.fromEntries(
  CITIES.map((c) => [c.id, c]),
) as Record<CityId, CityDef>;

/** 이웃 도시 목록(양방향) */
export const NEIGHBORS: Record<CityId, { to: CityId; kind: RoadDef[2] }[]> = (() => {
  const m = Object.fromEntries(CITIES.map((c) => [c.id, [] as { to: CityId; kind: RoadDef[2] }[]])) as Record<
    CityId, { to: CityId; kind: RoadDef[2] }[]
  >;
  for (const [a, b, k] of ROADS) {
    m[a].push({ to: b, kind: k });
    m[b].push({ to: a, kind: k });
  }
  return m;
})();

export function roadKind(a: CityId, b: CityId): RoadDef[2] | null {
  return NEIGHBORS[a].find((n) => n.to === b)?.kind ?? null;
}

/** 지도 좌표 (viewBox 0 0 1000 860) */
export const MAP_W = 1000;
export const MAP_H = 860;
const LON0 = 97.5;
const LON1 = 125.5;
const LAT0 = 43.0;
const LAT1 = 19.5;
export function project(lon: number, lat: number): [number, number] {
  const x = ((lon - LON0) / (LON1 - LON0)) * MAP_W;
  const y = ((LAT0 - lat) / (LAT0 - LAT1)) * MAP_H;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}
