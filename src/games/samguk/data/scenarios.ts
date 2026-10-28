import type { CityId, FactionKey } from './types';

export interface ScenarioFaction {
  key: FactionKey;
  /** 군주 officer id */
  ruler: string;
  capital: CityId;
  cities: CityId[];
  /** 세력 규모 보정(병력·금·군량 배수). 기본 1 */
  power?: number;
}

export interface ScenarioDef {
  id: string;
  name: string;
  year: number;
  month: number;
  /** 시대 설명(역사 배경) */
  desc: string[];
  /** 역사와 다르게 둔 부분 */
  liberty?: string;
  factions: ScenarioFaction[];
  /** 천자를 모시는 계통. null이면 한 조정이 없거나 떠돌고 있음 */
  emperor: FactionKey | null;
  /** 한 황실이 남아 있는지(220년 선양 이전) */
  hanAlive: boolean;
  /** 소속 이력과 다르게 배치할 장수: id → 계통 */
  overrides?: Record<string, FactionKey>;
}

/** 계통별 깃발 색 */
export const FACTION_COLORS: Record<FactionKey, string> = {
  none: '#6b7280',
  han: '#d4c38a',
  yellow: '#e3c31c',
  dong: '#7c4dbd',
  lijue: '#9a6bd1',
  yuanshao: '#d9a93b',
  yuanshu: '#c27a34',
  cao: '#3f74e0',
  jin: '#5562c4',
  liubei: '#2fa35a',
  sun: '#d9453a',
  lubu: '#b8327a',
  gongsunzan: '#d8d2bf',
  taoqian: '#3fb6ad',
  kongrong: '#93b85c',
  liubiao: '#3aa2d0',
  liuzhang: '#b2cc45',
  zhanglu: '#c99a6b',
  mateng: '#c0612f',
  hansui: '#8f7552',
  zhangxiu: '#5f8fa0',
  gongsundu: '#8394b0',
  shixie: '#cc6fa4',
  liuyao: '#62a88e',
  wanglang: '#aaa86a',
  yanbaihu: '#8a5a5a',
  zhangyan: '#6d7480',
  menghuo: '#a3812f',
};

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 's190',
    name: '반동탁 연합',
    year: 190,
    month: 1,
    desc: [
      '189년 영제가 죽자 대장군 하진이 환관을 치려다 살해되고, 그 혼란 속에 서량의 동탁이 낙양에 들어왔다.',
      '동탁은 소제를 폐하고 헌제를 세웠으며, 이듬해 정월 관동의 주·군이 원소를 맹주로 삼아 군사를 일으켰다.',
      '동탁은 낙양을 불태우고 장안으로 천도하려 한다. 천하가 갈라지는 첫해다.',
    ],
    liberty: '이 무렵 유비는 공손찬 휘하였으나 평원의 독립 세력으로 두었다. 장로는 191년 무렵 한중에 들어갔으나 처음부터 둔다.',
    emperor: 'dong',
    hanAlive: true,
    overrides: { liubei: 'liubei', guanyu: 'liubei', zhangfei: 'liubei', jianyong: 'liubei', tianyu: 'liubei' },
    factions: [
      { key: 'dong', ruler: 'dongzhuo', capital: 'luoyang', cities: ['luoyang', 'changan', 'hongnong', 'anding'], power: 1.6 },
      { key: 'yuanshao', ruler: 'yuanshao', capital: 'nanpi', cities: ['nanpi'], power: 1.2 },
      { key: 'cao', ruler: 'caocao', capital: 'chenliu', cities: ['chenliu'] },
      { key: 'yuanshu', ruler: 'yuanshu', capital: 'wan', cities: ['wan'], power: 1.2 },
      { key: 'sun', ruler: 'sunjian', capital: 'changsha', cities: ['changsha'] },
      { key: 'gongsunzan', ruler: 'gongsunzan', capital: 'beiping', cities: ['beiping'], power: 1.2 },
      { key: 'liubei', ruler: 'liubei', capital: 'pingyuan', cities: ['pingyuan'], power: 0.7 },
      { key: 'taoqian', ruler: 'taoqian', capital: 'xiapi', cities: ['xiapi', 'xiaopei', 'langya'] },
      { key: 'kongrong', ruler: 'kongrong', capital: 'beihai', cities: ['beihai'] },
      { key: 'liubiao', ruler: 'liubiao', capital: 'xiangyang', cities: ['xiangyang', 'jiangling', 'jiangxia'] },
      { key: 'liuzhang', ruler: 'liuyan', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan'] },
      { key: 'zhanglu', ruler: 'zhanglu', capital: 'hanzhong', cities: ['hanzhong'] },
      { key: 'mateng', ruler: 'mateng', capital: 'tianshui', cities: ['tianshui'] },
      { key: 'hansui', ruler: 'hansui', capital: 'jincheng', cities: ['jincheng', 'wuwei'] },
      { key: 'gongsundu', ruler: 'gongsundu', capital: 'xiangping', cities: ['xiangping'] },
      { key: 'shixie', ruler: 'shixie', capital: 'jiaozhi', cities: ['jiaozhi'] },
      { key: 'zhangyan', ruler: 'zhangyan', capital: 'shangdang', cities: ['shangdang'], power: 0.8 },
    ],
  },
  {
    id: 's196',
    name: '천자를 받들다',
    year: 196,
    month: 1,
    desc: [
      '192년 왕윤과 여포가 동탁을 죽였으나, 동탁의 부장 이각·곽사가 장안을 짓밟았다.',
      '195년 헌제는 장안을 빠져나와 폐허가 된 낙양으로 향하고 있다. 천자를 맞는 자가 대의를 얻는다.',
      '연주를 되찾은 조조, 서주를 이어받은 유비, 그에게 몸을 의탁한 여포, 강동으로 건너간 손책이 저마다 판을 노린다.',
    ],
    liberty: '이 무렵 여포는 유비의 허락으로 소패에 머물던 객장이었으나 독립 세력으로 두었다.',
    emperor: null,
    hanAlive: true,
    factions: [
      { key: 'cao', ruler: 'caocao', capital: 'chenliu', cities: ['chenliu', 'puyang', 'xuchang'], power: 1.2 },
      { key: 'liubei', ruler: 'liubei', capital: 'xiapi', cities: ['xiapi', 'langya'] },
      { key: 'lubu', ruler: 'lubu', capital: 'xiaopei', cities: ['xiaopei'] },
      { key: 'yuanshao', ruler: 'yuanshao', capital: 'ye', cities: ['ye', 'nanpi', 'pingyuan'], power: 1.4 },
      { key: 'gongsunzan', ruler: 'gongsunzan', capital: 'beiping', cities: ['beiping', 'ji'] },
      { key: 'yuanshu', ruler: 'yuanshu', capital: 'shouchun', cities: ['shouchun', 'runan', 'lujiang', 'qiao'], power: 1.3 },
      { key: 'sun', ruler: 'sunce', capital: 'jianye', cities: ['jianye'] },
      { key: 'liuyao', ruler: 'liuyao', capital: 'yuzhang', cities: ['yuzhang'] },
      { key: 'wanglang', ruler: 'wanglang', capital: 'kuaiji', cities: ['kuaiji'] },
      { key: 'yanbaihu', ruler: 'yanbaihu', capital: 'wu', cities: ['wu'] },
      { key: 'liubiao', ruler: 'liubiao', capital: 'xiangyang', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'wuling', 'lingling', 'guiyang', 'xinye'], power: 1.1 },
      { key: 'zhangxiu', ruler: 'zhangxiu', capital: 'wan', cities: ['wan'] },
      { key: 'lijue', ruler: 'lijue', capital: 'changan', cities: ['changan', 'hongnong'] },
      { key: 'liuzhang', ruler: 'liuzhang', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning'] },
      { key: 'zhanglu', ruler: 'zhanglu', capital: 'hanzhong', cities: ['hanzhong', 'wudu'] },
      { key: 'mateng', ruler: 'mateng', capital: 'tianshui', cities: ['tianshui', 'anding'] },
      { key: 'hansui', ruler: 'hansui', capital: 'jincheng', cities: ['jincheng', 'wuwei'] },
      { key: 'kongrong', ruler: 'kongrong', capital: 'beihai', cities: ['beihai'] },
      { key: 'gongsundu', ruler: 'gongsundu', capital: 'xiangping', cities: ['xiangping'] },
      { key: 'shixie', ruler: 'shixie', capital: 'jiaozhi', cities: ['jiaozhi'] },
      { key: 'zhangyan', ruler: 'zhangyan', capital: 'shangdang', cities: ['shangdang'], power: 0.8 },
    ],
  },
  {
    id: 's200',
    name: '관도대전 전야',
    year: 200,
    month: 1,
    desc: [
      '조조는 천자를 허도에 모시고 여포·원술·장수를 차례로 정리했다. 북쪽에서는 원소가 공손찬을 무너뜨리고 네 주를 아울렀다.',
      '황하를 사이에 둔 두 거인의 결전이 눈앞이다. 서주를 빼앗아 조조에게 등을 돌린 유비, 강동을 평정한 손책도 기회를 엿본다.',
    ],
    emperor: 'cao',
    hanAlive: true,
    factions: [
      { key: 'cao', ruler: 'caocao', capital: 'xuchang', cities: ['xuchang', 'chenliu', 'puyang', 'qiao', 'runan', 'luoyang', 'henei', 'hongnong', 'changan', 'wan', 'langya', 'shouchun'], power: 1.2 },
      { key: 'yuanshao', ruler: 'yuanshao', capital: 'ye', cities: ['ye', 'nanpi', 'pingyuan', 'beihai', 'ji', 'beiping', 'jinyang'], power: 1.5 },
      { key: 'liubei', ruler: 'liubei', capital: 'xiapi', cities: ['xiapi', 'xiaopei'] },
      { key: 'sun', ruler: 'sunce', capital: 'wu', cities: ['wu', 'jianye', 'kuaiji', 'lujiang', 'yuzhang', 'chaisang'], power: 1.1 },
      { key: 'liubiao', ruler: 'liubiao', capital: 'xiangyang', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'wuling', 'lingling', 'guiyang', 'xinye'] },
      { key: 'liuzhang', ruler: 'liuzhang', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning', 'yunnan'] },
      { key: 'zhanglu', ruler: 'zhanglu', capital: 'hanzhong', cities: ['hanzhong', 'wudu'] },
      { key: 'mateng', ruler: 'mateng', capital: 'tianshui', cities: ['tianshui', 'anding'] },
      { key: 'hansui', ruler: 'hansui', capital: 'jincheng', cities: ['jincheng', 'wuwei'] },
      { key: 'gongsundu', ruler: 'gongsundu', capital: 'xiangping', cities: ['xiangping'] },
      { key: 'shixie', ruler: 'shixie', capital: 'jiaozhi', cities: ['jiaozhi', 'cangwu', 'nanhai'] },
      { key: 'zhangyan', ruler: 'zhangyan', capital: 'shangdang', cities: ['shangdang'], power: 0.8 },
    ],
  },
  {
    id: 's208',
    name: '적벽대전 전야',
    year: 208,
    month: 7,
    desc: [
      '원씨를 멸하고 오환까지 평정한 조조는 승상이 되어 남쪽으로 눈을 돌렸다. 형주의 유표는 병이 깊다.',
      '신야의 유비는 삼고초려 끝에 제갈량을 얻었고, 강동의 손권은 황조를 무찔렀다. 장강이 천하를 가를 차례다.',
    ],
    liberty: '유비는 유표의 객장으로 신야에 주둔했으나 독립 세력으로 두었다.',
    emperor: 'cao',
    hanAlive: true,
    factions: [
      { key: 'cao', ruler: 'caocao', capital: 'ye', cities: ['ye', 'xuchang', 'nanpi', 'pingyuan', 'beihai', 'ji', 'beiping', 'jinyang', 'shangdang', 'puyang', 'chenliu', 'xiapi', 'xiaopei', 'langya', 'qiao', 'runan', 'shouchun', 'luoyang', 'henei', 'hongnong', 'changan', 'wan'], power: 1.4 },
      { key: 'liubiao', ruler: 'liubiao', capital: 'xiangyang', cities: ['xiangyang', 'jiangling', 'jiangxia', 'changsha', 'wuling', 'lingling', 'guiyang'] },
      { key: 'liubei', ruler: 'liubei', capital: 'xinye', cities: ['xinye'] },
      { key: 'sun', ruler: 'sunquan', capital: 'wu', cities: ['wu', 'jianye', 'kuaiji', 'lujiang', 'yuzhang', 'chaisang'], power: 1.1 },
      { key: 'mateng', ruler: 'machao', capital: 'tianshui', cities: ['tianshui', 'anding'] },
      { key: 'hansui', ruler: 'hansui', capital: 'jincheng', cities: ['jincheng', 'wuwei'] },
      { key: 'liuzhang', ruler: 'liuzhang', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning', 'yunnan'] },
      { key: 'zhanglu', ruler: 'zhanglu', capital: 'hanzhong', cities: ['hanzhong', 'wudu'] },
      { key: 'gongsundu', ruler: 'gongsunkang', capital: 'xiangping', cities: ['xiangping'] },
      { key: 'shixie', ruler: 'shixie', capital: 'jiaozhi', cities: ['jiaozhi', 'cangwu', 'nanhai'] },
    ],
  },
  {
    id: 's215',
    name: '삼국정립',
    year: 215,
    month: 1,
    desc: [
      '적벽에서 패한 조조는 관중의 마초·한수를 꺾고 위공에 올랐다. 유비는 형주에 이어 유장의 익주를 차지했다.',
      '손권은 건업에 도읍하고 형주 반환을 요구한다. 한중의 장로가 세 나라 사이에 끼어 있다.',
    ],
    emperor: 'cao',
    hanAlive: true,
    factions: [
      { key: 'cao', ruler: 'caocao', capital: 'ye', cities: ['ye', 'xuchang', 'nanpi', 'pingyuan', 'beihai', 'ji', 'beiping', 'jinyang', 'shangdang', 'puyang', 'chenliu', 'xiapi', 'xiaopei', 'langya', 'qiao', 'runan', 'shouchun', 'luoyang', 'henei', 'hongnong', 'changan', 'anding', 'tianshui', 'wuwei', 'jincheng', 'wan', 'xinye', 'xiangyang'], power: 1.3 },
      { key: 'liubei', ruler: 'liubei', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning', 'yunnan', 'jiangling', 'wuling', 'lingling', 'changsha', 'guiyang'], power: 1.1 },
      { key: 'sun', ruler: 'sunquan', capital: 'jianye', cities: ['jianye', 'wu', 'kuaiji', 'lujiang', 'chaisang', 'yuzhang', 'jiangxia', 'nanhai', 'cangwu'], power: 1.1 },
      { key: 'zhanglu', ruler: 'zhanglu', capital: 'hanzhong', cities: ['hanzhong', 'wudu'] },
      { key: 'gongsundu', ruler: 'gongsunkang', capital: 'xiangping', cities: ['xiangping'] },
      { key: 'shixie', ruler: 'shixie', capital: 'jiaozhi', cities: ['jiaozhi'] },
    ],
  },
  {
    id: 's228',
    name: '출사표',
    year: 228,
    month: 1,
    desc: [
      '220년 조비가 한의 선양을 받아 위를 세웠고, 유비와 손권도 각각 황제와 왕을 칭했다. 이릉에서 패한 유비는 백제성에서 죽었다.',
      '승상 제갈량은 남중을 평정하고 출사표를 올려 한중에 나와 있다. 위의 새 황제 조예, 오의 손권이 이를 지켜본다.',
    ],
    emperor: null,
    hanAlive: false,
    factions: [
      { key: 'cao', ruler: 'caorui', capital: 'luoyang', cities: ['luoyang', 'ye', 'xuchang', 'nanpi', 'pingyuan', 'beihai', 'ji', 'beiping', 'jinyang', 'shangdang', 'puyang', 'chenliu', 'xiapi', 'xiaopei', 'langya', 'qiao', 'runan', 'shouchun', 'henei', 'hongnong', 'changan', 'anding', 'tianshui', 'wuwei', 'jincheng', 'wudu', 'wan', 'xinye', 'xiangyang', 'shangyong'], power: 1.3 },
      { key: 'liubei', ruler: 'liushan', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning', 'yunnan', 'hanzhong'], power: 1.1 },
      { key: 'sun', ruler: 'sunquan', capital: 'jiangxia', cities: ['jiangxia', 'jianye', 'wu', 'kuaiji', 'lujiang', 'chaisang', 'yuzhang', 'jiangling', 'changsha', 'wuling', 'lingling', 'guiyang', 'nanhai', 'cangwu', 'jiaozhi'], power: 1.1 },
      { key: 'gongsundu', ruler: 'gongsunyuan', capital: 'xiangping', cities: ['xiangping'] },
    ],
  },
  {
    id: 's253',
    name: '사마씨의 시대',
    year: 253,
    month: 1,
    desc: [
      '249년 고평릉의 변으로 사마의가 조상을 제거한 뒤 위의 실권은 사마씨에게 넘어갔다. 사마의가 죽자 맏아들 사마사가 뒤를 이었다.',
      '오에서는 손권이 죽고 어린 손량을 제갈각이 보좌하며, 촉에서는 강유가 거듭 북벌을 외친다. 마지막 삼국의 판이다.',
    ],
    liberty: '위의 황제는 조방이지만 실권자 사마사를 군주로 두었다.',
    emperor: null,
    hanAlive: false,
    factions: [
      { key: 'cao', ruler: 'simashi', capital: 'luoyang', cities: ['luoyang', 'ye', 'xuchang', 'nanpi', 'pingyuan', 'beihai', 'ji', 'beiping', 'xiangping', 'jinyang', 'shangdang', 'puyang', 'chenliu', 'xiapi', 'xiaopei', 'langya', 'qiao', 'runan', 'shouchun', 'henei', 'hongnong', 'changan', 'anding', 'tianshui', 'wuwei', 'jincheng', 'wan', 'xinye', 'xiangyang', 'shangyong'], power: 1.4 },
      { key: 'liubei', ruler: 'liushan', capital: 'chengdu', cities: ['chengdu', 'zitong', 'jiangzhou', 'yongan', 'jianning', 'yunnan', 'hanzhong', 'wudu'] },
      { key: 'sun', ruler: 'sunliang', capital: 'jianye', cities: ['jianye', 'jiangxia', 'wu', 'kuaiji', 'lujiang', 'chaisang', 'yuzhang', 'jiangling', 'changsha', 'wuling', 'lingling', 'guiyang', 'nanhai', 'cangwu', 'jiaozhi'], power: 1.1 },
    ],
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
