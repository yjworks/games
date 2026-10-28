import type { OfficerDef } from '../types';
import { OFFICERS_WEI } from './wei';
import { OFFICERS_SHU } from './shu';
import { OFFICERS_WU } from './wu';
import { OFFICERS_RIVALS } from './rivals';
import { OFFICERS_LATE } from './late';

/** 다섯 묶음을 합친 전체 인물. 같은 id가 두 번 나오면 먼저 나온 것을 쓴다 */
export const OFFICERS: OfficerDef[] = (() => {
  const seen = new Set<string>();
  const out: OfficerDef[] = [];
  for (const o of [...OFFICERS_WEI, ...OFFICERS_SHU, ...OFFICERS_WU, ...OFFICERS_RIVALS, ...OFFICERS_LATE]) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  const ids = new Set(out.map((o) => o.id));
  /* 없는 인물을 가리키는 인연·아버지는 지운다 */
  return out.map((o) => ({
    ...o,
    father: o.father && ids.has(o.father) ? o.father : undefined,
    bonds: o.bonds?.filter((b) => ids.has(b) && b !== o.id),
  }));
})();

export const OFFICER_DEF: Record<string, OfficerDef> = Object.fromEntries(OFFICERS.map((o) => [o.id, o]));
