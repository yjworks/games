import { OFFICER_DEF } from '../data/officers';
import type { CityId } from '../data/types';
import { dropItems, giveItem, log } from './commands';
import { CHA, LEAD, bonded, def, factionName, nameOf, worth } from './officers';
import { clamp } from './rng';
import { pickGovernor, updateRank } from './setup';
import type { City, GameState, Officer } from './state';
import { jo } from './josa';

/** 역사상 뒤를 이은 사람(그 사람이 세력에 있으면 우선한다) */
export const HEIRS: Record<string, string> = {
  caocao: 'caopi', caopi: 'caorui', caorui: 'caofang', caofang: 'caomao', caomao: 'caohuan',
  simayi: 'simashi', simashi: 'simazhao', simazhao: 'simayan',
  liubei: 'liushan', sunjian: 'sunce', sunce: 'sunquan', sunquan: 'sunliang', sunliang: 'sunxiu', sunxiu: 'sunhao',
  yuanshao: 'yuanshang', liubiao: 'liucong', liuyan: 'liuzhang', mateng: 'machao', dongzhuo: 'lijue',
  gongsundu: 'gongsunkang', gongsunkang: 'gongsungong', gongsungong: 'gongsunyuan', zhangji: 'zhangxiu',
  taoqian: 'liubei', zhangjue: 'zhangbao2', shixie: 'shihui', yuanshu: 'yuanyin', lubu: 'chengong',
};

/** 군주가 죽거나 잡혔을 때 뒤를 잇는다. 이을 사람이 없으면 세력이 무너진다 */
export function succeed(s: GameState, f: number): boolean {
  const fac = s.factions[f];
  const old = fac.ruler;
  const cands = Object.values(s.officers).filter(
    (o) => o.status === 'serving' && o.faction === f && o.id !== old && o.city && s.cities[o.city].owner === f,
  );
  if (cands.length === 0) { destroyFaction(s, f); return false; }
  const score = (o: Officer) => {
    const d = OFFICER_DEF[o.id];
    let v = worth(s, o.id) + d.stats[CHA] * 0.5 + d.stats[LEAD] * 0.3 + o.merit / 100;
    if (d.father === old) v += 400 - Math.max(0, 16 - (s.year - d.born)) * 30;
    else if (OFFICER_DEF[old]?.father && d.father === OFFICER_DEF[old].father) v += 200; // 형제
    else if (bonded(o.id, old)) v += 120;
    return v;
  };
  cands.sort((a, b) => score(b) - score(a));
  const named = HEIRS[old] ? cands.find((o) => o.id === HEIRS[old]) : undefined;
  const heir = named ?? cands[0];
  fac.ruler = heir.id;
  if (fac.key === 'dong') fac.key = 'lijue'; // 동탁이 죽으면 남은 무리는 이각·곽사 계통
  if (fac.advisor === heir.id) fac.advisor = null;
  heir.loyalty = 100;
  if (heir.city) fac.capital = heir.city;
  for (const o of cands) {
    if (o === heir) continue;
    const d = OFFICER_DEF[o.id];
    /* 새 군주와 인연이 없고 야망이 큰 장수는 동요한다 */
    o.loyalty = clamp(o.loyalty - (bonded(o.id, heir.id) ? 0 : 4 + d.amb), 0, 100);
  }
  /* 옛 군주의 보물은 새 군주에게 */
  const prev = s.officers[old];
  if (prev && prev.status === 'dead') for (const it of [...prev.items]) giveItem(s, it, heir.id);
  for (const c of Object.values(s.cities) as City[]) if (c.owner === f) pickGovernor(s, c.id);
  log(s, `${nameOf(old)}의 뒤를 ${jo(nameOf(heir.id), '이가')} 이었습니다.`, 'event', f);
  return true;
}

export function destroyFaction(s: GameState, f: number) {
  const fac = s.factions[f];
  if (!fac.alive) return;
  fac.alive = false;
  for (const c of Object.values(s.cities) as City[]) {
    if (c.owner === f) { c.owner = -1; c.governor = null; c.delegated = false; }
  }
  for (const o of Object.values(s.officers)) {
    if (o.status === 'serving' && o.faction === f) {
      o.status = 'free';
      o.faction = -1;
      o.found = true;
      if (!o.city) o.city = def(o.id).home;
    }
    if (o.status === 'captive' && o.captor === f) {
      o.status = 'free';
      o.faction = -1;
      o.captor = -1;
      o.found = true;
    }
  }
  for (const other of s.factions) { delete other.ally[f]; }
  if (s.emperor === f) s.emperor = -1;
  log(s, `${nameOf(fac.ruler)}의 세력이 멸망했습니다.`, 'war', f);
}

/** 도시가 하나도 없으면 멸망 */
export function checkFaction(s: GameState, f: number) {
  const fac = s.factions[f];
  if (!fac.alive) return;
  const owned = (Object.values(s.cities) as City[]).filter((c) => c.owner === f);
  if (owned.length === 0) { destroyFaction(s, f); return; }
  if (!owned.some((c) => c.id === fac.capital)) {
    const r = s.officers[fac.ruler];
    fac.capital = r?.city && s.cities[r.city].owner === f ? r.city : owned.sort((a, b) => b.pop - a.pop)[0].id;
  }
  updateRank(s, f);
}

/** 장수의 죽음 (병사·전사·처형 모두) */
export function officerDies(s: GameState, o: Officer, how: string, where?: CityId) {
  const wasRuler = o.status === 'serving' && o.faction >= 0 && s.factions[o.faction]?.ruler === o.id;
  const f = o.faction;
  const city = where ?? o.city ?? undefined;
  if (!wasRuler) dropItems(s, o, city ?? undefined);
  o.status = 'dead';
  o.city = null;
  o.captor = -1;
  if (f >= 0 && s.factions[f]?.advisor === o.id) s.factions[f].advisor = null;
  for (const c of Object.values(s.cities) as City[]) if (c.governor === o.id) { c.governor = null; pickGovernor(s, c.id); }
  log(s, `${jo(nameOf(o.id), '이가')} ${how}했습니다. (향년 ${s.year - def(o.id).born}세)`, 'death', f >= 0 ? f : undefined);
  if (wasRuler) {
    succeed(s, f);
    const fac = s.factions[f];
    if (!fac.alive) dropItems(s, o, city ?? undefined);
  }
}

/** 군주가 포로로 잡혔을 때 */
export function rulerCaptured(s: GameState, f: number) {
  log(s, `${factionName(s, f)}의 군주 ${jo(nameOf(s.factions[f].ruler), '이가')} 사로잡혔습니다!`, 'war', f);
  succeed(s, f);
}
