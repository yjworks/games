/**
 * 천하삼분 — 데이터 자료형.
 * 인물·도시·시나리오 데이터는 정사(진수 『삼국지』·배송지 주, 범엽 『후한서』, 『진서』, 『자치통감』)를
 * 바탕으로 새로 작성한 것이다. 능력치는 기록된 행적을 근거로 이 게임이 따로 매긴 값이다.
 */

/** 도시 식별자 */
export type CityId =
  | 'xiangping' | 'beiping' | 'ji' | 'nanpi' | 'ye' | 'jinyang' | 'shangdang'
  | 'pingyuan' | 'beihai' | 'puyang' | 'chenliu' | 'xiapi' | 'xiaopei' | 'langya'
  | 'xuchang' | 'runan' | 'qiao' | 'shouchun' | 'lujiang'
  | 'luoyang' | 'hongnong' | 'changan' | 'henei'
  | 'anding' | 'tianshui' | 'wuwei' | 'jincheng' | 'wudu'
  | 'hanzhong' | 'zitong' | 'chengdu' | 'jiangzhou' | 'yongan' | 'jianning' | 'yunnan' | 'shangyong'
  | 'wan' | 'xinye' | 'xiangyang' | 'jiangling' | 'jiangxia' | 'changsha' | 'wuling' | 'lingling' | 'guiyang'
  | 'jianye' | 'wu' | 'kuaiji' | 'chaisang' | 'yuzhang'
  | 'nanhai' | 'cangwu' | 'jiaozhi';

/**
 * 역사상 소속 계통. 군주가 바뀌어도 같은 계통이면 같은 키를 쓴다
 * (예: 손견·손책·손권·손량… 은 모두 'sun', 조조·조비·조예… 는 'cao').
 */
export type FactionKey =
  | 'none'        // 재야(벼슬하지 않음·은거·낙향)
  | 'han'         // 후한 조정(동탁 집권 이전의 중앙 관료, 황족)
  | 'yellow'      // 황건
  | 'dong'        // 동탁 (192년까지. 동탁 집권기 조정 관료 포함)
  | 'lijue'       // 이각·곽사 (192~198)
  | 'yuanshao'    // 원소 → 원담·원상 (~207)
  | 'yuanshu'     // 원술 (~199)
  | 'cao'         // 조조 → 위(魏) (~265)
  | 'jin'         // 사마씨 진(晉) (265~)
  | 'liubei'      // 유비 → 촉한(蜀漢) (~263)
  | 'sun'         // 손견 → 손책 → 오(吳) (~280)
  | 'lubu'        // 여포 (192~198)
  | 'gongsunzan'  // 공손찬 (~199)
  | 'taoqian'     // 도겸 (~194)
  | 'kongrong'    // 공융 (북해, ~196)
  | 'liubiao'     // 유표 → 유종 (~208)
  | 'liuzhang'    // 유언 → 유장 (익주, ~214)
  | 'zhanglu'     // 장로 (한중, ~215)
  | 'mateng'      // 마등 → 마초 (~214)
  | 'hansui'      // 한수 (~215)
  | 'zhangxiu'    // 장제 → 장수 (~199)
  | 'gongsundu'   // 공손도 → 공손강 → 공손공 → 공손연 (요동, ~238)
  | 'shixie'      // 사섭 (교지, ~226)
  | 'liuyao'      // 유요 (~197)
  | 'wanglang'    // 왕랑 (회계, ~196)
  | 'yanbaihu'    // 엄백호 (오군, ~196)
  | 'zhangyan'    // 장연 (흑산, ~205)
  | 'menghuo';    // 맹획 (남중, ~225)

/** 특기. 효과는 engine/traits.ts 참고 */
export type TraitId =
  | '기병'   // 평지 기병 공격력↑
  | '궁병'   // 2칸 사격 가능, 사격 피해↑
  | '수군'   // 수상 전투 공격·방어↑
  | '돌격'   // 공격 시 추가 피해
  | '일기'   // 일기토 강함
  | '수비'   // 성·관에서 방어↑
  | '화계'   // 화공 성공률·피해↑
  | '신산'   // 계략 성공률↑, 적 계략 간파
  | '매복'   // 숲·산에서 매복 피해
  | '혼란'   // 적 부대 혼란 계략
  | '의술'   // 전투 중 병력 회복
  | '둔전'   // 개간 효과↑
  | '상재'   // 상업 효과↑
  | '축성'   // 성벽 효과↑
  | '명성'   // 등용·징병 효과↑
  | '외교'   // 외교 성공률↑
  | '인덕'   // 민심 상승↑, 부하 충성 하락 완화
  | '구변';  // 설득(등용·권항) 성공률↑

/** 능력치: [통솔, 무력, 지력, 정치, 매력] 1~100 */
export type Stats = [number, number, number, number, number];

export interface OfficerDef {
  /** 병음 소문자, 공백 없음. 같은 병음이 있으면 뒤에 2,3… */
  id: string;
  /** 한글 이름 */
  name: string;
  /** 한자 이름 */
  hanja: string;
  /** 자(字) 한글. 모르면 생략 */
  style?: string;
  /** 출생 연도. 기록이 없으면 추정치와 bornEst: true */
  born: number;
  bornEst?: boolean;
  /** 사망 연도. 기록이 없으면 추정치와 diedEst: true */
  died: number;
  diedEst?: boolean;
  /** 고향에서 가장 가까운 게임 도시 */
  home: CityId;
  stats: Stats;
  /** 0~3개 */
  traits: TraitId[];
  /** 역사상 소속 이력: [그해부터, 계통]. 연도 오름차순. 첫 항목 연도가 등장(출사) 연도 */
  svc: [number, FactionKey][];
  /** 의리 1~10 (높을수록 배신·이탈 안 함) */
  gi: number;
  /** 야망 1~10 (높을수록 독립·하극상 가능) */
  amb: number;
  /** 아버지 id (데이터에 있을 때만) */
  father?: string;
  /** 깊은 인연(형제·부부·의형제·평생의 주종) id 목록 */
  bonds?: string[];
  /** 정사 기반 한두 문장 */
  bio: string;
}

export interface CityDef {
  id: CityId;
  name: string;
  hanja: string;
  /** 주(州) */
  zhou: string;
  /** 대략의 경도·위도 (지도 배치용) */
  lon: number;
  lat: number;
  /** 시작 인구(만 명). 『후한서』 군국지 호구를 반올림해 게임용으로 보정 */
  pop: number;
  /** 전장 지형 성격 */
  land: 'plain' | 'hill' | 'mountain' | 'river' | 'marsh';
  /** 한 줄 설명 */
  note: string;
}

/** 도시 사이 길. l=육로, r=강을 건너는 육로, w=수로(수상전) */
export type RoadKind = 'l' | 'r' | 'w';
export type RoadDef = [CityId, CityId, RoadKind];
