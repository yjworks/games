import { NEIGHBORS } from '../data/cities';
import type { CityId } from '../data/types';
import { absorbFaction, joinFaction, log } from './commands';
import { factionName, nameOf } from './officers';
import { chance } from './rng';
import { cityName, pickGovernor } from './setup';
import type { City, GameState } from './state';
import { officerDies, succeed } from './world';
import { jo } from './josa';

/** 역사대로 그해에 죽을 때 쓰는 사인(死因) — 정사 기록 */
export const HISTORIC_DEATH: Record<string, string> = {
  dongzhuo: '왕윤·여포에게 살해',
  sunjian: '현산에서 황조 군의 화살에 맞아 전사',
  sunce: '사냥 중 허공의 식객에게 습격당해 사망',
  lubu: '하비에서 사로잡혀 처형',
  chengong: '하비에서 사로잡혀 처형',
  gaoshun: '하비에서 사로잡혀 처형',
  guanyu: '임저에서 오군에게 사로잡혀 처형',
  guanping: '임저에서 관우와 함께 처형',
  zhangfei: '부하 장달·범강에게 살해',
  pangtong: '낙성 공격 중 화살에 맞아 전사',
  xiahouyuan: '정군산에서 황충에게 전사',
  dianwei: '완성에서 조조를 지키다 전사',
  caoang: '완성에서 전사',
  yanliang: '백마에서 관우에게 참수',
  wenchou: '연진에서 전사',
  yuanshu: '피를 토하고 병사',
  gongsunzan: '역경에서 자결',
  zhugeliang: '오장원 진중에서 병사',
  zhangliao: '강도 진중에서 병사',
  dengai: '성도에서 위관이 보낸 군사에게 살해',
  zhonghui: '성도에서 난을 일으켰다가 피살',
  jiangwei: '종회의 난 속에서 피살',
  zhugeke: '손준에게 살해',
  machao: '병사',
  caocao: '낙양에서 병사',
  liubei: '백제성에서 병사',
  sunquan: '건업에서 병사',
  huatuo: '조조에게 처형',
  kongrong: '조조에게 처형',
  yangxiu: '조조에게 처형',
  xunyu: '수춘에서 근심 끝에 사망',
  lusu: '병사',
  lvmeng: '병사',
  zhouyu: '파구에서 병사',
  zhangjiao: '병사',
  hejin: '환관에게 살해',
  wangyun: '이각·곽사에게 살해',
  liubiao: '병사',
  yuanshao: '피를 토하고 병사',
  zhanghe: '목문도에서 화살에 맞아 전사',
  wangshuang: '진창에서 촉군에게 전사',
  menghuo: '병사',
  lingtong: '병사',
  ganning: '병사',
  taishici: '병사',
  caopi: '낙양에서 병사',
  caorui: '낙양에서 병사',
  simayi: '낙양에서 병사',
  caoshuang: '사마의에게 처형',
  heyan: '사마의에게 처형',
  wangling: '압송 중 자결',
  zhugedan: '수춘에서 전사',
  guanqiujian: '도망 중 피살',
  sunchen: '손휴에게 처형',
  liushan: '낙양에서 사망',
  sunhao: '낙양에서 사망',
};

/** 사망 문구: 역사 모드에서 기록된 해에 죽으면 사인을 쓴다 */
export function deathText(s: GameState, id: string, fallback: string, histYear: number): string {
  if (s.options.lifespan === 'history' && s.year === histYear && HISTORIC_DEATH[id]) return HISTORIC_DEATH[id];
  return fallback;
}

const alive = (s: GameState, id: string) => s.officers[id] && s.officers[id].status !== 'dead' && s.officers[id].status !== 'hidden';
const serving = (s: GameState, id: string, f?: number) => {
  const o = s.officers[id];
  return !!o && o.status === 'serving' && (f === undefined || o.faction === f);
};
const fkey = (s: GameState, key: string) => s.factions.find((f) => f.alive && f.key === key);
const owns = (s: GameState, f: number, c: CityId) => s.cities[c].owner === f;
const citiesOf = (s: GameState, f: number) => (Object.values(s.cities) as City[]).filter((c) => c.owner === f);

function once(s: GameState, id: string, cond: boolean, act: () => void) {
  if (!cond || s.fired.includes(id)) return;
  s.fired.push(id);
  act();
}

export function runEvents(s: GameState) {
  const y = s.year, m = s.month;

  /* 192 동탁 암살 */
  const dong = fkey(s, 'dong');
  once(s, 'dong-assassination',
    !!dong && !dong.human && y >= 192 && (y > 192 || m >= 4) && dong.ruler === 'dongzhuo'
      && serving(s, 'lubu', dong.idx) && serving(s, 'wangyun', dong.idx),
    () => {
      const d = dong!;
      log(s, '사도 왕윤이 여포와 손잡고 미앙전 앞에서 동탁을 베었습니다. 장안의 백성이 거리에서 춤을 추었다고 합니다.', 'event', d.idx);
      const lubu = s.officers.lubu;
      const base = lubu.city ?? d.capital;
      officerDies(s, s.officers.dongzhuo, '왕윤·여포에게 살해');
      if (!d.alive) return;
      /* 여포는 따르는 무리를 데리고 독립한다 */
      const idx = s.factions.length;
      const newCity = citiesOf(s, d.idx).find((c) => c.id !== d.capital && c.id === base) ?? citiesOf(s, d.idx).find((c) => c.id !== d.capital);
      if (!newCity) return;
      s.factions.push({
        idx, key: 'lubu', ruler: 'lubu', advisor: null, capital: newCity.id, color: '#b8327a', alive: true, human: false,
        rel: {}, ally: {}, rank: 0, done: true,
      });
      for (const g of s.factions) if (g.idx !== idx) { g.rel[idx] = 40; s.factions[idx].rel[g.idx] = 40; }
      newCity.owner = idx;
      newCity.governor = null;
      lubu.faction = idx; lubu.city = newCity.id; lubu.loyalty = 100;
      for (const id of ['gaoshun', 'zhangliao', 'wangyun', 'chengong', 'songxian', 'weixu', 'houcheng', 'zangba']) {
        const o = s.officers[id];
        if (o && o.status === 'serving' && o.faction === d.idx) { o.faction = idx; o.city = newCity.id; o.loyalty = 70; }
      }
      pickGovernor(s, newCity.id);
      d.key = 'lijue';
      log(s, `여포가 ${cityName(newCity.id)}에서 자립했습니다. 동탁의 남은 무리는 ${jo(nameOf(d.ruler), '이가')} 거느립니다.`, 'event', idx);
    });

  /* 192 청주병 */
  const cao = fkey(s, 'cao');
  once(s, 'qingzhou-army', !!cao && y >= 192 && y <= 194 && (owns(s, cao.idx, 'puyang') || owns(s, cao.idx, 'chenliu')),
    () => {
      const c = owns(s, cao!.idx, 'puyang') ? s.cities.puyang : s.cities.chenliu;
      c.troops += 15000;
      c.training = Math.max(30, c.training - 10);
      log(s, `조조가 청주 황건 30만을 항복시켜 정예를 가려 청주병으로 삼았습니다. (${cityName(c.id)} 병력 +15,000)`, 'event', cao!.idx);
    });

  /* 194 도겸의 서주 양도 */
  const tao = fkey(s, 'taoqian');
  const lb = fkey(s, 'liubei');
  once(s, 'xu-handover',
    !!tao && !!lb && !tao.human && y >= 194 && tao.ruler === 'taoqian' && chance(s, 0.35)
      && citiesOf(s, tao.idx).some((c) => NEIGHBORS[c.id].some((n) => s.cities[n.to].owner === lb.idx)),
    () => {
      log(s, '병이 깊어진 도겸이 「유비가 아니면 이 주를 편안케 할 수 없다」며 서주를 유비에게 맡겼습니다.', 'event', lb!.idx);
      absorbFaction(s, tao!.idx, lb!.idx);
    });

  /* 196 둔전제 */
  once(s, 'tuntian', !!cao && y >= 196, () => {
    for (const c of citiesOf(s, cao!.idx)) c.agri = Math.round(c.agri * 1.12);
    log(s, '조조가 조지·임준의 건의로 허현 일대에 둔전을 열었습니다. (조조군 농업 +12%)', 'event', cao!.idx);
  });

  /* 천자 봉영 */
  if (s.hanAlive && s.emperor < 0 && y >= 196 && (y > 196 || m >= 7)) {
    const holder = (['luoyang', 'xuchang', 'changan'] as CityId[]).map((c) => s.cities[c].owner).find((o) => o >= 0);
    if (holder !== undefined && holder >= 0) {
      s.emperor = holder;
      log(s, `${jo(factionName(s, holder), '이가')} 떠돌던 헌제를 맞아들였습니다. 천자를 끼고 제후를 호령할 명분을 얻었습니다.`, 'event', holder);
    }
  }

  /* 207 삼고초려 */
  once(s, 'three-visits',
    !!lb && y >= 207 && alive(s, 'zhugeliang') && s.officers.zhugeliang.status === 'free'
      && !!s.officers.zhugeliang.city
      && (owns(s, lb.idx, s.officers.zhugeliang.city) || NEIGHBORS[s.officers.zhugeliang.city].some((n) => owns(s, lb.idx, n.to))),
    () => {
      const zg = s.officers.zhugeliang;
      const ruler = s.officers[lb!.ruler];
      const at = ruler.city ?? lb!.capital;
      joinFaction(s, zg, lb!.idx, at);
      zg.loyalty = 100;
      log(s, `${jo(nameOf(lb!.ruler), '이가')} 융중의 초가를 세 번 찾아간 끝에 제갈량을 맞았습니다. 「천하삼분지계」가 제시되었습니다.`, 'event', lb!.idx);
    });

  /* 칭호: 위공·위왕 */
  if (cao && cao.ruler === 'caocao') {
    once(s, 'wei-duke', y >= 213 && (y > 213 || m >= 5) && citiesOf(s, cao.idx).length >= 10 && cao.rank < 3, () => {
      cao.rank = 3;
      log(s, '조조가 위공(魏公)에 오르고 구석을 받았습니다.', 'event', cao.idx);
    });
    once(s, 'wei-king', y >= 216 && (y > 216 || m >= 5) && citiesOf(s, cao.idx).length >= 15 && cao.rank < 4, () => {
      cao.rank = 4;
      log(s, '조조가 위왕(魏王)에 올랐습니다.', 'event', cao.idx);
    });
  }

  /* 220 선양: 천자를 모신 세력의 군주가 바뀌었거나 220년이 지나면 */
  if (s.hanAlive && s.emperor >= 0 && y >= 220) {
    const f = s.factions[s.emperor];
    if (f.ruler !== 'caocao' && citiesOf(s, f.idx).length >= 12) {
      s.hanAlive = false;
      s.emperor = -1;
      f.rank = 5;
      log(s, `헌제가 ${nameOf(f.ruler)}에게 제위를 물려주었습니다. 400년 한 왕조가 막을 내렸습니다.`, 'event', f.idx);
    }
  }
  /* 한이 사라진 뒤에는 큰 세력이 황제를 칭한다 */
  if (!s.hanAlive) {
    for (const f of s.factions) {
      if (!f.alive || f.rank >= 5) continue;
      const n = citiesOf(s, f.idx).length;
      if (n >= 7 && (f.key !== 'sun' || y >= 229)) {
        f.rank = 5;
        log(s, `${jo(nameOf(f.ruler), '이가')} 황제에 즉위했습니다.`, 'event', f.idx);
      }
    }
  }

  /* 249 고평릉의 변 */
  if (cao && !cao.human && y >= 249 && !cao.ruler.startsWith('sima')) {
    const sima = ['simayi', 'simashi', 'simazhao'].find((id) => serving(s, id, cao.idx));
    once(s, 'gaopingling', !!sima, () => {
      cao.ruler = sima!;
      s.officers[sima!].loyalty = 100;
      if (cao.advisor === sima) cao.advisor = null;
      log(s, `${jo(nameOf(sima!), '이가')} 고평릉의 변을 일으켜 위의 실권을 쥐었습니다.`, 'event', cao.idx);
    });
  }
  /* 265 진 건국 */
  if (cao && y >= 265 && cao.ruler.startsWith('sima')) {
    once(s, 'jin-founding', true, () => {
      cao.key = 'jin';
      cao.rank = 5;
      cao.color = '#5562c4';
      log(s, `${jo(nameOf(cao.ruler), '이가')} 위의 선양을 받아 진(晉)을 세웠습니다.`, 'event', cao.idx);
    });
  }

  /* 군주가 없는 세력 정리(데이터상 군주가 죽어 있는 경우 대비) */
  for (const f of s.factions) {
    if (f.alive && s.officers[f.ruler]?.status !== 'serving') succeed(s, f.idx);
  }
}
