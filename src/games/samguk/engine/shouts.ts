import { OFFICER_DEF } from '../data/officers';

/**
 * 전장 대사 — 장수 성격(능력치)에 따라 외치는 말이 다르다. 이름난 장수 몇은 자기 말이 따로 있다.
 * 모두 이 게임을 위해 새로 쓴 글이며, 몇 줄은 『삼국지연의』(퍼블릭 도메인) 장면에서 착안했다.
 * 고르기는 난수 대신 seed로 하므로 전투 결과(난수 순서)에 영향을 주지 않는다.
 */

export type ShoutKind = 'open' | 'tactic' | 'combo' | 'bond' | 'rout' | 'win';

type Pool = Record<ShoutKind, string[]>;

const TYPE: Record<'brave' | 'wise' | 'noble' | 'common', Pool> = {
  brave: {
    open: ['내 창끝을 막을 자 누구냐!', '북을 울려라, 단숨에 짓밟는다!', '겁 많은 놈부터 베어 주마!'],
    tactic: ['길을 비켜라!', '한 놈도 놓치지 마라!', '이 일격을 받아 보아라!'],
    combo: ['내가 뒤를 받친다, 몰아쳐라!', '틈이 보였다, 같이 친다!'],
    bond: ['네 등은 내가 지킨다!', '우리 둘이면 못 꺾을 적이 없다!'],
    rout: ['이럴 수가… 물러서라!', '분하다, 다음엔 이렇지 않으리라!'],
    win: ['보았느냐, 이것이 우리 군의 힘이다!', '하하, 싱겁구나!'],
  },
  wise: {
    open: ['모든 것은 계산대로다.', '적의 진형에 빈틈이 보이는구나.', '서두르지 마라, 때를 기다린다.'],
    tactic: ['지금이다, 계책대로 움직여라!', '적은 이미 내 손바닥 안이다.', '흐름이 바뀌었다.'],
    combo: ['좌우에서 함께 친다!', '지금 협공하면 무너진다!'],
    bond: ['그대와 나라면 이 정도 판은 쉽지요.', '말하지 않아도 뜻은 통하는 법.'],
    rout: ['계산이 어긋났나… 일단 물러난다.', '훗날을 도모하자.'],
    win: ['예상대로로군.', '싸우기 전에 이미 이긴 싸움이었다.'],
  },
  noble: {
    open: ['백성을 위한 싸움이다, 모두 힘을 내라!', '의로운 군사는 지지 않는다!'],
    tactic: ['나를 따르라!', '모두 함께 나아가자!'],
    combo: ['힘을 합치자!', '혼자 싸우게 두지 않겠다!'],
    bond: ['그대와 함께라면 두렵지 않다!', '맹세를 잊지 않았다!'],
    rout: ['면목이 없구나… 군사를 살려라.', '모두 살아서 돌아가라!'],
    win: ['모두 고생했다, 이 공은 그대들의 것이다.'],
  },
  common: {
    open: ['진을 갖춰라!', '곧 싸움이다, 정신 바짝 차려라!'],
    tactic: ['간다!', '받아라!'],
    combo: ['돕겠소!', '함께 치시오!'],
    bond: ['내가 왔소!', '늘 하던 대로 갑시다!'],
    rout: ['더는 못 버티겠다, 퇴각!', '으윽… 후퇴하라!'],
    win: ['이겼다!', '해냈다!'],
  },
};

const SPECIAL: Record<string, Partial<Pool>> = {
  zhangfei: { open: ['연인 장익덕이 여기 있다! 나와서 겨뤄 보아라!'], tactic: ['으하하, 속이 다 시원하구나!'], bond: ['형님들, 이 셋째가 왔소!'] },
  guanyu: { open: ['청룡도가 녹슬 틈이 없구나.'], tactic: ['이 관운장의 칼을 받아라!'], bond: ['아우여, 함께 가자!'] },
  liubei: { open: ['한실을 바로 세우는 싸움이다!'], bond: ['아우들아, 함께하자!'] },
  zhaoyun: { open: ['상산 조자룡, 나아간다!'], tactic: ['창 한 자루면 충분하다!'] },
  lubu: { open: ['천하에 나를 당할 자가 있느냐!'], tactic: ['방천화극 맛을 보아라!'], rout: ['이 여포가… 밀리다니!'] },
  caocao: { open: ['천하의 일은 나 조맹덕이 정한다.'], win: ['하하하! 이것이 천명이다.'] },
  zhugeliang: { open: ['바람의 방향마저 셈에 넣었소.'], tactic: ['이 또한 계책 가운데 하나.'] },
  zhouyu: { open: ['강동의 물길은 나의 진이다.'] },
  sunce: { open: ['강동의 작은 패왕이 간다!'] },
  sunquan: { open: ['강동을 지키는 것은 나의 몫이다.'] },
  machao: { open: ['서량 철기가 너희를 짓밟으리라!'] },
  huangzhong: { open: ['늙었다고 얕보지 마라!'], tactic: ['이 활은 아직 녹슬지 않았다!'] },
  xuchu: { open: ['갑옷이 거추장스럽다, 맨몸으로라도 싸우겠다!'] },
  dianwei: { open: ['주공 곁은 이 전위가 지킨다!'] },
  xiahoudun: { open: ['눈 하나 잃었다고 기세까지 잃지는 않았다!'] },
  zhangliao: { open: ['장문원이 왔다! 길을 비켜라!'] },
  ganning: { open: ['방울 소리가 들리느냐! 금범적이 간다!'] },
  taishici: { open: ['태사자, 약속을 지키러 왔다!'] },
  weiyan: { open: ['누가 감히 나를 당하겠느냐!'] },
  simayi: { open: ['서두를 것 없다. 기다리는 자가 이긴다.'] },
  luxun: { open: ['서생이라 얕보면 큰코다친다.'] },
};

function typeOf(id: string): keyof typeof TYPE {
  const st = OFFICER_DEF[id]?.stats;
  if (!st) return 'common';
  const [, war, int, , cha] = st;
  if (war >= 85 && war >= int) return 'brave';
  if (int >= 85) return 'wise';
  if (cha >= 85) return 'noble';
  if (war >= 75 && war > int) return 'brave';
  return 'common';
}

export function shoutLine(id: string, kind: ShoutKind, seed: number): string {
  const own = SPECIAL[id]?.[kind];
  const pool = own && (seed % 3 !== 2 || !TYPE[typeOf(id)][kind].length) ? own : TYPE[typeOf(id)][kind];
  return pool[Math.abs(seed) % pool.length];
}
