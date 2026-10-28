import type { FactionKey } from '../data/types';

/** 소속 이력에 쓰는 계통 이름 */
export const KEY_LABEL: Record<FactionKey, string> = {
  none: '재야', han: '후한 조정', yellow: '황건', dong: '동탁', lijue: '이각·곽사', yuanshao: '원소', yuanshu: '원술',
  cao: '조조·위', jin: '진(晉)', liubei: '유비·촉한', sun: '손씨·오', lubu: '여포', gongsunzan: '공손찬', taoqian: '도겸',
  kongrong: '공융', liubiao: '유표', liuzhang: '유언·유장', zhanglu: '장로', mateng: '마등·마초', hansui: '한수',
  zhangxiu: '장수', gongsundu: '공손씨(요동)', shixie: '사섭', liuyao: '유요', wanglang: '왕랑', yanbaihu: '엄백호',
  zhangyan: '장연', menghuo: '맹획',
};

export const SEASON = (m: number) => (m <= 3 ? '봄' : m <= 6 ? '여름' : m <= 9 ? '가을' : '겨울');

export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

export const popText = (p: number) => (p >= 10000 ? `${(p / 10000).toFixed(1)}만` : fmt(p));
