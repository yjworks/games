import type { CityId, Stats, TraitId } from './types';

/** 보물 — 사서에 이름이 남은 명마·인장·서책만 골랐다 */
export interface ItemDef {
  id: string;
  name: string;
  hanja: string;
  kind: '명마' | '인장' | '서책';
  /** 능력치 보정 [통솔, 무력, 지력, 정치, 매력] */
  bonus: Stats;
  /** 전투 이동력 보정 */
  move?: number;
  /** 부여 특기 */
  trait?: TraitId;
  /** 값(매매·포상 기준) */
  value: number;
  note: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'chitu', name: '적토', hanja: '赤兔', kind: '명마', bonus: [0, 4, 0, 0, 0], move: 2, value: 900,
    note: '여포의 명마. 「사람 가운데 여포, 말 가운데 적토」라는 말이 『삼국지』 여포전 주에 전한다.' },
  { id: 'dilu', name: '적로', hanja: '的盧', kind: '명마', bonus: [0, 1, 0, 0, 2], move: 1, value: 600,
    note: '유비가 형주에서 탄 말. 단계(檀溪)를 뛰어넘어 그를 살렸다고 『세어』가 전한다.' },
  { id: 'jueying', name: '절영', hanja: '絶影', kind: '명마', bonus: [1, 1, 0, 0, 0], move: 1, value: 500,
    note: '조조의 말. 197년 완성에서 장수의 기습 때 화살을 맞고 쓰러졌다(『위서』).' },
  { id: 'yuxi', name: '전국새', hanja: '傳國璽', kind: '인장', bonus: [0, 0, 0, 3, 10], value: 1200,
    note: '진시황 이래의 옥새. 191년 손견이 낙양 우물에서 얻었다고 『오서』가 전한다.' },
  { id: 'sunzi', name: '손자병법', hanja: '孫子兵法', kind: '서책', bonus: [5, 0, 3, 0, 0], value: 700,
    note: '조조가 직접 주석을 단 판본(『손자약해』)이 전한다.' },
  { id: 'wuzi', name: '오자', hanja: '吳子', kind: '서책', bonus: [3, 0, 2, 1, 0], value: 450,
    note: '전국시대 오기의 병법서.' },
  { id: 'liutao', name: '육도', hanja: '六韜', kind: '서책', bonus: [2, 0, 3, 1, 0], value: 450,
    note: '태공망에 가탁한 병법서. 유비가 유선에게 읽기를 권했다(유비 유조).' },
  { id: 'zuozhuan', name: '춘추좌씨전', hanja: '春秋左氏傳', kind: '서책', bonus: [1, 0, 3, 1, 2], value: 400,
    note: '관우가 즐겨 읽어 거의 외웠다고 『강표전』이 전한다.' },
  { id: 'hanshu', name: '한서', hanja: '漢書', kind: '서책', bonus: [0, 0, 2, 4, 0], value: 400,
    note: '반고의 전한 역사서. 손권이 여몽에게 읽기를 권한 책 가운데 하나다.' },
  { id: 'shiji', name: '사기', hanja: '史記', kind: '서책', bonus: [0, 0, 3, 3, 0], value: 450,
    note: '사마천의 통사. 삼국의 사인들이 경전과 함께 익혔다.' },
  { id: 'taiping', name: '태평경', hanja: '太平經', kind: '서책', bonus: [0, 0, 4, 0, 2], trait: '혼란', value: 500,
    note: '우길이 전했다는 도교 경전. 장각의 태평도가 이를 따랐다.' },
  { id: 'shanghan', name: '상한잡병론', hanja: '傷寒雜病論', kind: '서책', bonus: [0, 0, 2, 1, 1], trait: '의술', value: 500,
    note: '장기(장중경)가 지은 의서. 역병이 돌던 시대의 산물이다.' },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** 시나리오 시작 때 보물 위치: 장수 id(보유) 또는 도시(숨김 — 탐색으로 찾음) */
export function initialItemPlacement(year: number): Record<string, { holder?: string; city?: CityId }> {
  const p: Record<string, { holder?: string; city?: CityId }> = {
    chitu: { holder: 'lubu' },
    dilu: year >= 201 ? { holder: 'liubei' } : { city: 'xiangyang' },
    jueying: year < 197 ? { holder: 'caocao' } : { city: 'wan' },
    yuxi: year < 191 ? { city: 'luoyang' } : year < 199 ? { holder: 'yuanshu' } : { city: 'xuchang' },
    sunzi: year < 220 ? { holder: 'caocao' } : { city: 'ye' },
    wuzi: { city: 'chenliu' },
    liutao: { city: 'chengdu' },
    zuozhuan: year < 219 ? { holder: 'guanyu' } : { city: 'jiangling' },
    hanshu: { city: 'luoyang' },
    shiji: { city: 'changan' },
    taiping: { city: 'kuaiji' },
    shanghan: { city: 'changsha' },
  };
  return p;
}
