import { CITY_BY_ID } from '../data/cities';
import type { CityId } from '../data/types';
import { type Result, joinFaction, lastActor, log } from './commands';
import { jo } from './josa';
import { CHA, INT, WAR, nameOf, stat } from './officers';
import { chance, clamp, pick, rint } from './rng';
import type { GameState } from './state';

/**
 * 결단 — 달마다 사람 세력에게 올라오는 청원·사건. 고르는 데 따라 금·군량·민심·충성·인재가 오간다.
 * 컴퓨터 세력은 받지 않는다(밸런스에 손대지 않는다). 그달 안에 고르지 않으면 다음 달에 사라진다.
 */

export type DecisionKind = 'reward' | 'leave' | 'recommend' | 'bandit' | 'merchant' | 'refugee' | 'omen' | 'duel';

export interface Decision {
  id: number;
  y: number;
  m: number;
  f: number;
  kind: DecisionKind;
  city: CityId;
  /** 말을 꺼낸 장수(초상으로 보인다) */
  by: string | null;
  /** 천거된 인재·도전한 장수 등 */
  other?: string;
  amount: number;
  title: string;
  text: string;
  options: { label: string; hint: string }[];
}

const cityName = (id: CityId) => CITY_BY_ID[id].name;

function ownCities(s: GameState, f: number) {
  return Object.values(s.cities).filter((c) => c.owner === f);
}
function serving(s: GameState, f: number) {
  return Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === f && o.city && s.factions[f].ruler !== o.id);
}

/** 이번 달 결단을 만든다(사람 세력만) */
export function genDecisions(s: GameState) {
  s.decisions = [];
  for (const fac of s.factions) {
    if (!fac.alive || !fac.human) continue;
    const n = chance(s, 0.7) ? (chance(s, 0.3) ? 2 : 1) : 0;
    const used = new Set<DecisionKind>();
    for (let k = 0; k < n; k++) {
      const d = makeOne(s, fac.idx, used);
      if (d) { s.decisions.push(d); used.add(d.kind); }
    }
  }
}

let seq = 1;

function makeOne(s: GameState, f: number, used: Set<DecisionKind>): Decision | null {
  const cities = ownCities(s, f);
  if (!cities.length) return null;
  const officers = serving(s, f);
  const kinds: [DecisionKind, number][] = [
    ['reward', officers.some((o) => o.loyalty < 90 && o.merit > 30) ? 3 : 0],
    ['leave', officers.length > 3 ? 2 : 0],
    ['recommend', officers.some((o) => stat(s, o.id, INT) >= 70) ? 3 : 0],
    ['bandit', cities.some((c) => c.loyalty < 75) ? 3 : 1],
    ['merchant', 2],
    ['refugee', 2],
    ['omen', 1],
    ['duel', officers.some((o) => stat(s, o.id, WAR) >= 80) ? 1.5 : 0],
  ];
  const pool = kinds.filter(([k, w]) => w > 0 && !used.has(k));
  const total = pool.reduce((a, [, w]) => a + w, 0);
  if (!total) return null;
  let r = rint(s, 0, Math.floor(total * 100)) / 100;
  let kind: DecisionKind = pool[0][0];
  for (const [k, w] of pool) { if (r < w) { kind = k; break; } r -= w; }
  const base = { id: seq++ + s.year * 1000 + s.month * 50, y: s.year, m: s.month, f, kind, amount: 0 };
  const gov = (cid: CityId) => s.cities[cid].governor ?? s.factions[f].advisor ?? s.factions[f].ruler;

  switch (kind) {
    case 'reward': {
      const o = pick(s, officers.filter((x) => x.loyalty < 90 && x.merit > 30));
      const amount = rint(s, 10, 30) * 10;
      return {
        ...base, city: o.city!, by: o.id, amount,
        title: '포상 청원',
        text: `${jo(nameOf(o.id), '이가')} 아뢴다. 「싸움터와 관아에서 힘써 온 지 오래입니다. 조금이라도 상을 내려 주시면 더욱 몸을 바치겠습니다.」`,
        options: [
          { label: `금 ${amount}을 내린다`, hint: `${cityName(o.city!)} 금 −${amount}, 충성 +10` },
          { label: '다음으로 미룬다', hint: '충성 −6' },
        ],
      };
    }
    case 'leave': {
      const o = pick(s, officers);
      return {
        ...base, city: o.city!, by: o.id,
        title: '귀향 청원',
        text: `${jo(nameOf(o.id), '이가')} 머리를 조아린다. 「고향의 늙은 어버이가 병들었다 하니, 한 달만 말미를 주십시오.」`,
        options: [
          { label: '허락한다', hint: '이번 달 일하지 않음, 충성 +12' },
          { label: '나라 일이 급하다', hint: '충성 −8' },
        ],
      };
    }
    case 'recommend': {
      const o = pick(s, officers.filter((x) => stat(s, x.id, INT) >= 70));
      const cand = Object.values(s.officers).filter((x) => x.status === 'free' && !x.found && x.city);
      if (!cand.length) return null;
      const t = pick(s, cand.sort((a, b) => stat(s, b.id, INT) + stat(s, b.id, WAR) - stat(s, a.id, INT) - stat(s, a.id, WAR)).slice(0, 8));
      return {
        ...base, city: o.city!, by: o.id, other: t.id, amount: 100,
        title: '인재 천거',
        text: `${jo(nameOf(o.id), '이가')} 아뢴다. 「${cityName(t.city!)}에 ${jo(nameOf(t.id), '이가')} 숨어 지낸다 합니다. 예를 갖춰 부르시면 큰 힘이 될 것입니다.」`,
        options: [
          { label: '예물을 갖춰 부른다', hint: `금 −100, 등용 시도(${o.city ? cityName(o.city) : ''}로)` },
          { label: '이름만 적어 둔다', hint: '인재를 찾아 둔다(나중에 등용 가능)' },
        ],
      };
    }
    case 'bandit': {
      const c = pick(s, cities.filter((x) => x.loyalty < 75).length ? cities.filter((x) => x.loyalty < 75) : cities);
      const n = rint(s, 3, 8) * 100;
      return {
        ...base, city: c.id, by: gov(c.id), amount: n,
        title: '도적 출몰',
        text: `${cityName(c.id)} 둘레 산골에 도적 무리 ${n}여 명이 나타나 마을을 털고 있다는 보고가 올라왔다.`,
        options: [
          { label: '군사를 내 토벌한다', hint: `병력 −${Math.round(n * 0.6)}, 민심 +6, 금 +${Math.round(n / 4)}` },
          { label: '타일러 군사로 받는다', hint: `금 −150, 병력 +${Math.round(n * 0.7)}, 민심 −2` },
          { label: '내버려 둔다', hint: '민심 −8, 상업 −5%' },
        ],
      };
    }
    case 'merchant': {
      const c = pick(s, cities);
      return {
        ...base, city: c.id, by: gov(c.id), amount: 300,
        title: '서역 상단',
        text: `낙타를 끈 서역 상단이 ${cityName(c.id)}에 들렀다. 비단과 곡식을 싣고 왔다고 한다.`,
        options: [
          { label: '곡식을 사들인다', hint: '금 −300, 군량 +1,600' },
          { label: '통행세를 받는다', hint: '금 +160, 민심 −2' },
          { label: '그냥 보낸다', hint: '아무 일 없음' },
        ],
      };
    }
    case 'refugee': {
      const c = pick(s, cities);
      const n = rint(s, 3, 9) * 1000;
      return {
        ...base, city: c.id, by: gov(c.id), amount: n,
        title: '유민',
        text: `난리를 피해 떠도는 백성 ${n.toLocaleString('ko-KR')}여 명이 ${cityName(c.id)} 성문 밖에 모여들었다.`,
        options: [
          { label: '받아들여 땅을 준다', hint: `인구 +${n.toLocaleString('ko-KR')}, 군량 −${Math.round(n / 8)}, 민심 +4` },
          { label: '젊은이를 군사로 뽑는다', hint: `병력 +${Math.round(n / 6)}, 민심 −3` },
          { label: '돌려보낸다', hint: '민심 −1' },
        ],
      };
    }
    case 'omen': {
      const c = pick(s, cities);
      const good = chance(s, 0.6);
      return {
        ...base, city: c.id, by: s.factions[f].advisor ?? gov(c.id), amount: good ? 1 : 0,
        title: good ? '길조' : '흉조',
        text: good ? `${cityName(c.id)}에 흰 사슴이 나타났다는 소문이 돈다. 백성들은 하늘이 주군을 돕는 조짐이라 수군거린다.`
          : `${cityName(c.id)} 하늘에 꼬리별이 나타났다. 백성들이 불안해한다.`,
        options: good ? [
          { label: '제사를 올리고 널리 알린다', hint: '금 −120, 모든 도시 민심 +3' },
          { label: '헛소문이다', hint: '아무 일 없음' },
        ] : [
          { label: '제사를 올려 민심을 달랜다', hint: '금 −150, 이 도시 민심 +2' },
          { label: '요언을 금한다', hint: `${cityName(c.id)} 민심 −4` },
        ],
      };
    }
    case 'duel': {
      const o = pick(s, officers.filter((x) => stat(s, x.id, WAR) >= 80));
      return {
        ...base, city: o.city!, by: o.id,
        title: '무예 겨루기',
        text: `${jo(nameOf(o.id), '이가')} 청한다. 「병사들 앞에서 무예를 겨루어 군의 기세를 올리고 싶습니다.」`,
        options: [
          { label: '열병식을 연다', hint: '금 −100, 이 도시 훈련 +8·사기 +8, 충성 +4' },
          { label: '지금은 때가 아니다', hint: '충성 −3' },
        ],
      };
    }
  }
}

/** 고른 대로 처리한다 */
export function resolveDecision(s: GameState, id: number, choice: number): Result {
  const list = s.decisions ?? [];
  const d = list.find((x) => x.id === id);
  if (!d) return { ok: false, msg: '이미 지난 일입니다.' };
  s.decisions = list.filter((x) => x.id !== id);
  const c = s.cities[d.city];
  if (!c || c.owner !== d.f) return { ok: false, msg: '그 도시는 이미 우리 땅이 아닙니다.' };
  const o = d.by ? s.officers[d.by] : null;
  lastActor.id = d.by;
  const pay = (g: number) => { if (c.gold < g) return false; c.gold -= g; return true; };
  const ok = (msg: string): Result => { log(s, msg, 'info', d.f); return { ok: true, msg }; };
  switch (d.kind) {
    case 'reward':
      if (!o) break;
      if (choice === 0) {
        if (!pay(d.amount)) { lastActor.id = null; return { ok: false, msg: `금이 모자랍니다(${d.amount} 필요).` }; }
        o.loyalty = clamp(o.loyalty + 10, 0, 100);
        return ok(`${nameOf(o.id)}: 「이 은혜, 목숨으로 갚겠습니다.」 (충성 +10)`);
      }
      o.loyalty = clamp(o.loyalty - 6, 0, 100);
      return ok(`${jo(nameOf(o.id), '은는')} 서운한 기색을 감추지 못했다. (충성 −6)`);
    case 'leave':
      if (!o) break;
      if (choice === 0) {
        o.acted = true;
        o.loyalty = clamp(o.loyalty + 12, 0, 100);
        return ok(`${jo(nameOf(o.id), '은는')} 눈물로 절하고 고향으로 떠났다. (이번 달 쉼, 충성 +12)`);
      }
      o.loyalty = clamp(o.loyalty - 8, 0, 100);
      return ok(`${jo(nameOf(o.id), '은는')} 고개를 숙였지만 얼굴이 어두웠다. (충성 −8)`);
    case 'recommend': {
      const t = d.other ? s.officers[d.other] : null;
      if (!t || t.status !== 'free') return ok('그 인물은 이미 다른 곳으로 떠났다.');
      if (choice === 0) {
        if (!pay(100)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(100 필요).' }; }
        const p = 0.4 + (o ? stat(s, o.id, CHA) / 250 : 0) + (stat(s, s.factions[d.f].ruler, CHA) - 60) / 200;
        if (chance(s, clamp(p, 0.15, 0.9))) {
          joinFaction(s, t, d.f, d.city);
          t.loyalty = Math.max(t.loyalty, 70);
          lastActor.id = t.id;
          return ok(`${jo(nameOf(t.id), '이가')} 예물을 받고 ${cityName(d.city)}에 이르렀다. 「부르심에 응하겠습니다.」`);
        }
        t.found = true;
        return ok(`${jo(nameOf(t.id), '은는')} 정중히 사양했다. 어디 있는지는 알아 두었다.`);
      }
      t.found = true;
      return ok(`${cityName(t.city!)}의 ${jo(nameOf(t.id), '을를')} 인재 명부에 적었다.`);
    }
    case 'bandit':
      if (choice === 0) {
        const loss = Math.round(d.amount * 0.6);
        if (c.troops < loss + 500) { lastActor.id = null; return { ok: false, msg: `토벌할 군사가 모자랍니다(병력 ${loss + 500} 필요).` }; }
        c.troops -= loss;
        c.loyalty = clamp(c.loyalty + 6, 0, 100);
        c.gold += Math.round(d.amount / 4);
        return ok(`${cityName(c.id)}의 도적을 쓸어버렸다. 백성들이 기뻐한다. (병력 −${loss}, 민심 +6, 금 +${Math.round(d.amount / 4)})`);
      }
      if (choice === 1) {
        if (!pay(150)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(150 필요).' }; }
        const add = Math.round(d.amount * 0.7);
        c.troops += add;
        c.loyalty = clamp(c.loyalty - 2, 0, 100);
        return ok(`도적들이 무기를 내려놓고 군문에 들었다. (병력 +${add}, 민심 −2)`);
      }
      c.loyalty = clamp(c.loyalty - 8, 0, 100);
      c.comm = Math.round(c.comm * 0.95);
      return ok(`${cityName(c.id)} 백성들이 관아를 원망한다. (민심 −8, 상업 −5%)`);
    case 'merchant':
      if (choice === 0) {
        if (!pay(300)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(300 필요).' }; }
        c.food += 1600;
        return ok(`상단의 곡식을 사들였다. (금 −300, 군량 +1,600)`);
      }
      if (choice === 1) { c.gold += 160; c.loyalty = clamp(c.loyalty - 2, 0, 100); return ok('상단에게서 통행세를 거두었다. (금 +160, 민심 −2)'); }
      return ok('상단은 다음 고을로 떠났다.');
    case 'refugee':
      if (choice === 0) {
        const need = Math.round(d.amount / 8);
        if (c.food < need) { lastActor.id = null; return { ok: false, msg: `군량이 모자랍니다(${need} 필요).` }; }
        c.food -= need;
        c.pop += d.amount;
        c.loyalty = clamp(c.loyalty + 4, 0, 100);
        return ok(`유민에게 땅을 나눠 주었다. (인구 +${d.amount.toLocaleString('ko-KR')}, 민심 +4)`);
      }
      if (choice === 1) {
        const add = Math.round(d.amount / 6);
        c.troops += add;
        c.loyalty = clamp(c.loyalty - 3, 0, 100);
        return ok(`유민 가운데 젊은이 ${add}명을 군사로 뽑았다. (민심 −3)`);
      }
      c.loyalty = clamp(c.loyalty - 1, 0, 100);
      return ok('유민들은 다른 고을로 흩어졌다.');
    case 'omen':
      if (d.amount === 1) {
        if (choice === 0) {
          if (!pay(120)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(120 필요).' }; }
          for (const x of ownCities(s, d.f)) x.loyalty = clamp(x.loyalty + 3, 0, 100);
          return ok('제사를 올리고 길조를 널리 알렸다. 온 고을의 민심이 오른다. (민심 +3)');
        }
        return ok('길조 이야기는 곧 잊혔다.');
      }
      if (choice === 0) {
        if (!pay(150)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(150 필요).' }; }
        c.loyalty = clamp(c.loyalty + 2, 0, 100);
        return ok('제사를 올려 백성의 마음을 달랬다. (민심 +2)');
      }
      c.loyalty = clamp(c.loyalty - 4, 0, 100);
      return ok('요언을 금했으나 수군거림은 그치지 않는다. (민심 −4)');
    case 'duel':
      if (!o) break;
      if (choice === 0) {
        if (!pay(100)) { lastActor.id = null; return { ok: false, msg: '금이 모자랍니다(100 필요).' }; }
        c.training = clamp(c.training + 8, 0, 100);
        c.morale = clamp(c.morale + 8, 0, 100);
        o.loyalty = clamp(o.loyalty + 4, 0, 100);
        return ok(`${jo(nameOf(o.id), '이가')} 연병장에서 무예를 펼치자 함성이 하늘을 찔렀다. (훈련·사기 +8)`);
      }
      o.loyalty = clamp(o.loyalty - 3, 0, 100);
      return ok(`${jo(nameOf(o.id), '은는')} 아쉬운 듯 물러났다. (충성 −3)`);
  }
  return { ok: false, msg: '처리할 수 없습니다.' };
}
