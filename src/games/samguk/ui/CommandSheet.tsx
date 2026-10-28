import { useMemo, useState } from 'react';
import { CITY_BY_ID, NEIGHBORS } from '../data/cities';
import { ITEM_BY_ID } from '../data/items';
import type { CityId } from '../data/types';
import {
  allianceChance, allied, appointAdvisor, appointGovernor, attack, autoAllot, betray, betrayChance, buyPrice, connected,
  COST, demandSurrender, develop, discord, discordChance, draft, draftMax, goodwill, moveOfficer, proposeAlliance,
  recruit, recruitChance, relief, reliefCost, reward, rumor, rumorChance, search, sellPrice, surrenderChance, trade,
  train, transport, type DevKind, type Result,
} from '../engine/commands';
import { CHA, INT, LEAD, POL, WAR, factionName, officersIn, stat, troopCap, worth, nameOf } from '../engine/officers';
import type { GameState, Officer } from '../engine/state';
import { useGame } from '../store';
import { Dot, OfficerLine, Sheet, Slider, StatHeader, pct } from './common';
import type { CmdKey } from './CityPanel';
import { fmt } from './labels';
import { KINDS, KIND_LIST, autoKind, horseLand, kindAllowed, kindCost, waterSide, type UnitKind } from '../engine/units';
import { compassName, entryVector, mapSummary } from '../engine/battlemap';
import { jo } from '../engine/josa';

interface Props { s: GameState; city: CityId; me: number; cmd: CmdKey; onClose: () => void }

const TITLES: Record<CmdKey, string> = {
  agri: '개간', comm: '상업', flood: '치수', wall: '성벽', relief: '시혜', draft: '징병', train: '훈련', attack: '출진',
  transport: '수송', search: '탐색', recruit: '등용', move: '이동', reward: '포상', appoint: '임명', goodwill: '친선',
  alliance: '동맹', surrender: '권항', rumor: '유언비어', discord: '이간', betray: '내응', trade: '매매',
};

const HINT: Partial<Record<CmdKey, string>> = {
  agri: `농업을 올려 7월 수확을 늘립니다. 금 ${COST.develop}. 정치·둔전 특기가 좋을수록 효과가 큽니다.`,
  comm: `상업을 올려 매달 금 수입을 늘립니다. 금 ${COST.develop}. 정치·상재 특기.`,
  flood: `치수를 높여 여름 홍수를 막습니다. 금 ${COST.develop}. 정치.`,
  wall: `성벽을 쌓아 공성전에서 성벽·성문이 단단해집니다. 금 ${COST.develop}. 정치·통솔·축성 특기.`,
  relief: '군량을 풀어 민심을 올립니다. 매력·인덕 특기.',
  draft: '인구에서 병사를 모읍니다. 병사 10명당 금 1, 민심이 조금 떨어지고 훈련이 묽어집니다. 매력·명성 특기.',
  train: '도시 병력의 훈련과 사기를 올립니다. 통솔.',
  search: '재야 인재·보물·금·군량을 찾습니다. 지력·매력.',
  recruit: '재야 인재나 다른 세력 장수를 설득합니다. 매력·구변 특기, 인연·옛 주군이 크게 작용합니다.',
  rumor: '맞닿은 적 도시의 민심과 사기를 떨어뜨립니다. 지력·신산.',
  discord: '적 장수와 주군 사이를 벌려 충성을 떨어뜨립니다. 지력·신산.',
  betray: '충성이 낮은 적 장수에게 싸움이 나면 돌아서도록 약속받습니다.',
};

export function CommandSheet({ s, city, me, cmd, onClose }: Props) {
  const act = useGame((u) => u.act);
  useGame((u) => u.rev); // 명령 뒤 다시 그리기
  const c = s.cities[city];
  const pool = officersIn(s, city, me).filter((o) => !o.acted);
  const run = (fn: (g: GameState) => Result) => act(fn) as Result | undefined;

  let body: JSX.Element;
  switch (cmd) {
    case 'agri': case 'comm': case 'flood': case 'wall':
      body = <PickOfficer s={s} list={pool} hi={cmd === 'wall' ? LEAD : POL}
        onPick={(id) => run((g) => develop(g, city, id, cmd as DevKind))} />;
      break;
    case 'relief':
      body = <><p className="sg-muted">군량 {fmt(reliefCost(c))} 소모</p>
        <PickOfficer s={s} list={pool} hi={CHA} onPick={(id) => run((g) => relief(g, city, id))} /></>;
      break;
    case 'train':
      body = <PickOfficer s={s} list={pool} hi={LEAD} onPick={(id) => run((g) => train(g, city, id))} />;
      break;
    case 'search':
      body = <PickOfficer s={s} list={pool} hi={INT} onPick={(id) => run((g) => search(g, city, id))} />;
      break;
    case 'draft':
      body = <DraftForm s={s} city={city} pool={pool} run={run} />;
      break;
    case 'attack':
      body = <AttackForm s={s} city={city} me={me} pool={pool} run={run} onDone={onClose} />;
      break;
    case 'transport':
      body = <TransportForm s={s} city={city} me={me} pool={pool} run={run} />;
      break;
    case 'recruit':
      body = <TargetOfficerForm s={s} city={city} me={me} pool={pool} kind="recruit" run={run} />;
      break;
    case 'discord':
      body = <TargetOfficerForm s={s} city={city} me={me} pool={pool} kind="discord" run={run} />;
      break;
    case 'betray':
      body = <TargetOfficerForm s={s} city={city} me={me} pool={pool} kind="betray" run={run} />;
      break;
    case 'move':
      body = <MoveForm s={s} city={city} me={me} pool={pool} run={run} />;
      break;
    case 'reward':
      body = <RewardForm s={s} city={city} me={me} run={run} />;
      break;
    case 'appoint':
      body = <AppointForm s={s} city={city} me={me} run={run} />;
      break;
    case 'goodwill': case 'alliance': case 'surrender':
      body = <DiploForm s={s} me={me} pool={pool} kind={cmd} run={run} />;
      break;
    case 'rumor':
      body = <RumorForm s={s} me={me} pool={pool} run={run} />;
      break;
    case 'trade':
      body = <TradeForm s={s} city={city} me={me} run={run} />;
      break;
  }
  return (
    <Sheet title={<>{TITLES[cmd]} <small>{CITY_BY_ID[city].name} · 금 {fmt(c.gold)} · 군량 {fmt(c.food)} · 병력 {fmt(c.troops)}</small></>} onClose={onClose}>
      {HINT[cmd] && <p className="sg-hint">{HINT[cmd]}</p>}
      <Advisor s={s} me={me} cmd={cmd} />
      {body}
    </Sheet>
  );
}

function Advisor({ s, me, cmd }: { s: GameState; me: number; cmd: CmdKey }) {
  const adv = s.factions[me].advisor;
  if (!adv || !['recruit', 'rumor', 'discord', 'betray', 'alliance', 'surrender', 'attack'].includes(cmd)) return null;
  return <p className="sg-advisor">군사 <strong>{nameOf(adv)}</strong>: 「확률을 잘 보고 고르십시오. 숫자는 제가 헤아린 것입니다.」</p>;
}

function PickOfficer({ s, list, hi, onPick, chance, label }: {
  s: GameState; list: Officer[]; hi?: number; onPick: (id: string) => void; chance?: (id: string) => number; label?: string;
}) {
  const sorted = [...list].sort((a, b) => (chance ? chance(b.id) - chance(a.id) : hi !== undefined ? stat(s, b.id, hi) - stat(s, a.id, hi) : 0));
  if (!sorted.length) return <p className="sg-muted">이번 달 움직일 수 있는 장수가 없습니다.</p>;
  return (
    <>
      <div className="sg-olist-head"><span>{label ?? '맡길 장수'}</span><StatHeader />{chance && <span className="sg-oright">확률</span>}</div>
      <div className="sg-olist">
        {sorted.map((o) => (
          <OfficerLine key={o.id} s={s} id={o.id} hi={hi} onClick={() => onPick(o.id)}
            right={chance ? <strong className={chance(o.id) >= 0.6 ? 'good' : chance(o.id) < 0.25 ? 'bad' : ''}>{pct(chance(o.id))}</strong> : undefined} />
        ))}
      </div>
    </>
  );
}

function DraftForm({ s, city, pool, run }: { s: GameState; city: CityId; pool: Officer[]; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const c = s.cities[city];
  const [who, setWho] = useState<string | null>(null);
  const [n, setN] = useState(2000);
  if (!who) return <PickOfficer s={s} list={pool} hi={CHA} onPick={setWho} />;
  const max = draftMax(s, c, who);
  return (
    <div className="sg-form">
      <p>{nameOf(who)} — 최대 {fmt(max)}명 (인구 {fmt(c.pop)})</p>
      <Slider label="인원" value={Math.min(n, max)} min={0} max={max} onChange={setN} unit="명" />
      <p className="sg-muted">금 {fmt(Math.ceil(Math.min(n, max) / 10))} 소모</p>
      <div className="sg-form-go">
        <button className="sg-btn" onClick={() => setWho(null)}>다른 장수</button>
        <button className="sg-btn primary" disabled={max < 100} onClick={() => { const r = run((g) => draft(g, city, who, n)); if (r?.ok) setWho(null); }}>징병</button>
      </div>
    </div>
  );
}

function AttackForm({ s, city, me, pool, run, onDone }: {
  s: GameState; city: CityId; me: number; pool: Officer[]; run: (fn: (g: GameState) => Result) => Result | undefined; onDone: () => void;
}) {
  const c = s.cities[city];
  const targets = NEIGHBORS[city].filter((n) => s.cities[n.to].owner !== me && !allied(s, me, s.cities[n.to].owner));
  const [to, setTo] = useState<CityId | null>(targets.length === 1 ? targets[0].to : null);
  const [team, setTeam] = useState<string[]>([]);
  const [total, setTotal] = useState(Math.floor(c.troops * 0.8 / 100) * 100);
  const sorted = useMemo(() => [...pool].sort((a, b) => stat(s, b.id, LEAD) + stat(s, b.id, WAR) - stat(s, a.id, LEAD) - stat(s, a.id, WAR)), [pool, s]);
  const [kinds, setKinds] = useState<Record<string, UnitKind>>({});
  const naval = !!to && NEIGHBORS[city].find((n) => n.to === to)?.kind === 'w';
  const kindFor = (id: string): UnitKind => kinds[id] ?? autoKind(s, city, id, naval);
  const cap = team.reduce((a, id) => a + (kindFor(id) === '공성' ? Math.min(3000, troopCap(s, id)) : troopCap(s, id)), 0);
  const allot = autoAllot(s, team, Math.min(total, c.troops)).map((n, i) => (kindFor(team[i]) === '공성' ? Math.min(n, KINDS.공성.cap!) : n));
  const sum = allot.reduce((a, b) => a + b, 0);
  const teamKinds = team.map(kindFor);
  const kindGold = teamKinds.reduce((a, k, i) => a + kindCost(city, k, allot[i] ?? 0), 0);
  const [food, setFood] = useState(Math.min(c.food, 8000));
  if (!targets.length) return <p className="sg-muted">공격할 수 있는 이웃 도시가 없습니다.</p>;
  if (!to) {
    return (
      <div className="sg-list">
        {targets.map((n) => {
          const t = s.cities[n.to];
          const offs = t.owner >= 0 ? officersIn(s, n.to, t.owner).length : 0;
          return (
            <button key={n.to} className="sg-row-btn" onClick={() => setTo(n.to)}>
              <strong>{t.owner >= 0 && <Dot color={s.factions[t.owner].color} />} {CITY_BY_ID[n.to].name}</strong>
              <span>{factionName(s, t.owner)} · 병력 {fmt(t.troops)} · 장수 {offs} · 성벽 {t.wall}{n.kind === 'w' ? ' · 수로' : n.kind === 'r' ? ' · 도하' : ''}</span>
              <span>전장: {mapSummary(n.to).size}{mapSummary(n.to).tags.length ? ` · ${mapSummary(n.to).tags.join(' · ')}` : ''} · {compassName(entryVector(city, n.to))}쪽으로 진입</span>
            </button>
          );
        })}
      </div>
    );
  }
  const t = s.cities[to];
  const need = Math.ceil(sum * 0.05);
  return (
    <div className="sg-form">
      <p><strong>{CITY_BY_ID[to].name}</strong> ({factionName(s, t.owner)}) — 병력 {fmt(t.troops)}, 성벽 {t.wall}
        <button className="sg-link" onClick={() => setTo(null)}>바꾸기</button></p>
      <p className="sg-map-note"><b>{mapSummary(to).size}</b> {mapSummary(to).note}</p>
      <div className="sg-olist-head"><span>출진 장수 {team.length}/10 (첫 번째가 총대장)</span><StatHeader /><span className="sg-oright">병력</span></div>
      <div className="sg-olist">
        {sorted.map((o) => {
          const i = team.indexOf(o.id);
          return (
            <OfficerLine key={o.id} s={s} id={o.id} sel={i >= 0} hi={LEAD}
              onClick={() => setTeam(i >= 0 ? team.filter((x) => x !== o.id) : team.length < 10 ? [...team, o.id] : team)}
              right={i >= 0 ? <strong>{i === 0 ? '대장 ' : ''}{fmt(allot[i])}</strong> : <small>{fmt(troopCap(s, o.id))}</small>} />
          );
        })}
      </div>
      {team.length > 0 && (
        <div className="sg-kinds">
          <div className="sg-olist-head"><span>병종 편성 — 누르면 바뀝니다 {horseLand(city) ? '· 말 산지' : ''}{waterSide(city) ? ' · 물가' : ''}</span></div>
          {team.map((id, i) => {
            const cur = kindFor(id);
            return (
              <div key={id} className="sg-kind-row">
                <strong>{nameOf(id)}</strong>
                <div className="sg-kind-chips">
                  {KIND_LIST.map((k) => {
                    const al = kindAllowed(s, city, id, k);
                    const bad = !al.ok || (k === '공성' && naval);
                    return (
                      <button key={k} className={`sg-kind-chip ${cur === k ? 'on' : ''}`} disabled={bad} aria-pressed={cur === k}
                        title={bad ? (al.why ?? '수로로는 실어 갈 수 없습니다') : KINDS[k].desc}
                        onClick={() => setKinds({ ...kinds, [id]: k })}>
                        <b>{KINDS[k].hanja}</b>{k}
                      </button>
                    );
                  })}
                </div>
                <small className="sg-muted">{KINDS[cur].desc} {kindCost(city, cur, allot[i] ?? 0) ? `금 ${kindCost(city, cur, allot[i] ?? 0)}` : ''}</small>
              </div>
            );
          })}
        </div>
      )}
      <Slider label="병력" value={total} min={0} max={Math.min(c.troops, cap || c.troops)} onChange={setTotal} />
      <Slider label="군량" value={food} min={0} max={c.food} onChange={setFood} />
      <p className="sg-muted">하루 군량 약 {fmt(Math.ceil(sum * 0.004))} · 최소 {fmt(need)} · 30일 {fmt(Math.ceil(sum * 0.004 * 30))} · 병종 편성 금 {fmt(kindGold)}{kindGold > c.gold ? ' (모자람)' : ''}</p>
      <div className="sg-form-go">
        <button className="sg-btn primary" disabled={!team.length || sum < 100 || food < need || kindGold > c.gold}
          onClick={() => { const r = run((g) => attack(g, city, to, team, allot, food, teamKinds)); if (r?.ok) onDone(); }}>
          출진 ({fmt(sum)}명)
        </button>
      </div>
    </div>
  );
}

function TransportForm({ s, city, me, pool, run }: { s: GameState; city: CityId; me: number; pool: Officer[]; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const c = s.cities[city];
  const dests = NEIGHBORS[city].filter((n) => s.cities[n.to].owner === me);
  const [to, setTo] = useState<CityId | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [g, setG] = useState(0), [f, setF] = useState(0), [t, setT] = useState(0);
  if (!dests.length) return <p className="sg-muted">이웃한 아군 도시가 없습니다.</p>;
  if (!to) return (
    <div className="sg-list">{dests.map((n) => (
      <button key={n.to} className="sg-row-btn" onClick={() => setTo(n.to)}>
        <strong>{CITY_BY_ID[n.to].name}</strong><span>병력 {fmt(s.cities[n.to].troops)} · 금 {fmt(s.cities[n.to].gold)} · 군량 {fmt(s.cities[n.to].food)}</span>
      </button>))}
    </div>
  );
  if (!who) return <PickOfficer s={s} list={pool} hi={LEAD} onPick={setWho} label="호송할 장수(함께 이동)" />;
  return (
    <div className="sg-form">
      <p>{nameOf(who)} → {CITY_BY_ID[to].name}</p>
      <Slider label="금" value={g} min={0} max={c.gold} step={10} onChange={setG} />
      <Slider label="군량" value={f} min={0} max={c.food} onChange={setF} />
      <Slider label="병력" value={t} min={0} max={c.troops} onChange={setT} />
      <div className="sg-form-go">
        <button className="sg-btn primary" onClick={() => { const r = run((gs) => transport(gs, city, who, to, g, f, t)); if (r?.ok) { setWho(null); setTo(null); } }}>수송</button>
      </div>
    </div>
  );
}

function TargetOfficerForm({ s, city, me, pool, kind, run }: {
  s: GameState; city: CityId; me: number; pool: Officer[]; kind: 'recruit' | 'discord' | 'betray'; run: (fn: (g: GameState) => Result) => Result | undefined;
}) {
  const [fac, setFac] = useState<number | 'free'>(kind === 'recruit' ? 'free' : -1);
  const [target, setTarget] = useState<string | null>(null);
  const others = s.factions.filter((f) => f.alive && f.idx !== me);
  const list = useMemo(() => {
    if (fac === 'free') return Object.values(s.officers).filter((o) => o.status === 'free' && o.city === city && o.found);
    if (fac === -1) return [];
    return Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === fac && s.factions[fac].ruler !== o.id)
      .sort((a, b) => worth(s, b.id) - worth(s, a.id));
  }, [fac, s, city]);
  const chanceFn = (id: string) => (kind === 'recruit' ? recruitChance(s, id, target!) : kind === 'discord' ? discordChance(s, id, target!) : betrayChance(s, id, target!));
  if (target) {
    return (
      <>
        <p>대상: <strong>{nameOf(target)}</strong> {s.officers[target].status === 'serving' && <>({factionName(s, s.officers[target].faction)} · 충성 {s.officers[target].loyalty})</>}
          <button className="sg-link" onClick={() => setTarget(null)}>바꾸기</button></p>
        <PickOfficer s={s} list={pool} hi={kind === 'recruit' ? CHA : INT} chance={chanceFn}
          onPick={(id) => { const r = run((g) => (kind === 'recruit' ? recruit(g, city, id, target) : kind === 'discord' ? discord(g, id, target) : betray(g, id, target))); if (r?.ok) setTarget(null); }} />
      </>
    );
  }
  return (
    <>
      <div className="sg-seg small wrap">
        {kind === 'recruit' && <button aria-pressed={fac === 'free'} onClick={() => setFac('free')}>이 도시의 재야</button>}
        {others.map((f) => (
          <button key={f.idx} aria-pressed={fac === f.idx} onClick={() => setFac(f.idx)}><Dot color={f.color} /> {nameOf(f.ruler)}</button>
        ))}
      </div>
      {fac === -1 ? <p className="sg-muted">세력을 고르세요.</p> : list.length === 0 ? <p className="sg-muted">{fac === 'free' ? '찾아낸 재야 인재가 없습니다. 먼저 「탐색」하세요.' : '대상이 없습니다.'}</p> : (
        <>
          <div className="sg-olist-head"><span>대상</span><StatHeader /><span className="sg-oright">{fac === 'free' ? '' : '충성'}</span></div>
          <div className="sg-olist">
            {list.slice(0, 80).map((o) => (
              <OfficerLine key={o.id} s={s} id={o.id} onClick={() => setTarget(o.id)} right={o.status === 'serving' ? o.loyalty : ''} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function MoveForm({ s, city, me, pool, run }: { s: GameState; city: CityId; me: number; pool: Officer[]; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const [who, setWho] = useState<string | null>(null);
  if (!who) return <PickOfficer s={s} list={pool} hi={LEAD} onPick={setWho} />;
  const dests = (Object.keys(s.cities) as CityId[]).filter((id) => id !== city && s.cities[id].owner === me && connected(s, city, id, me));
  return (
    <>
      <p>{jo(nameOf(who), '을를')} 어디로 보낼까요? <button className="sg-link" onClick={() => setWho(null)}>다른 장수</button></p>
      <div className="sg-list">
        {dests.map((id) => (
          <button key={id} className="sg-row-btn" onClick={() => { const r = run((g) => moveOfficer(g, who, id)); if (r?.ok) setWho(null); }}>
            <strong>{CITY_BY_ID[id].name}</strong><span>장수 {officersIn(s, id, me).length} · 병력 {fmt(s.cities[id].troops)}</span>
          </button>
        ))}
        {!dests.length && <p className="sg-muted">이어진 아군 도시가 없습니다.</p>}
      </div>
    </>
  );
}

function RewardForm({ s, city, me, run }: { s: GameState; city: CityId; me: number; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const [who, setWho] = useState<string | null>(null);
  const list = officersIn(s, city, me).filter((o) => o.id !== s.factions[me].ruler).sort((a, b) => a.loyalty - b.loyalty);
  if (!who) {
    return (
      <>
        <p className="sg-muted">금 {COST.reward}을 내리거나 아군이 가진 보물을 하사합니다(장수 행동을 쓰지 않음).</p>
        <div className="sg-olist">
          {list.map((o) => <OfficerLine key={o.id} s={s} id={o.id} onClick={() => setWho(o.id)} right={o.loyalty} />)}
          {!list.length && <p className="sg-muted">포상할 장수가 없습니다.</p>}
        </div>
      </>
    );
  }
  const items = Object.entries(s.items).filter(([, p]) => p.holder && s.officers[p.holder]?.faction === me && s.officers[p.holder]?.status === 'serving' && p.holder !== who);
  return (
    <div className="sg-form">
      <p>{nameOf(who)} · 충성 {s.officers[who].loyalty} <button className="sg-link" onClick={() => setWho(null)}>다른 장수</button></p>
      <button className="sg-row-btn" onClick={() => run((g) => reward(g, me, who))}><strong>금 {COST.reward}</strong><span>충성 +6~12</span></button>
      {items.map(([id, p]) => (
        <button key={id} className="sg-row-btn" onClick={() => run((g) => reward(g, me, who, id))}>
          <strong>「{ITEM_BY_ID[id].name}」</strong><span>{ITEM_BY_ID[id].kind} · 지금 {nameOf(p.holder)} · {ITEM_BY_ID[id].note}</span>
        </button>
      ))}
    </div>
  );
}

function AppointForm({ s, city, me, run }: { s: GameState; city: CityId; me: number; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const here = officersIn(s, city, me).sort((a, b) => worth(s, b.id) - worth(s, a.id));
  const all = Object.values(s.officers).filter((o) => o.status === 'serving' && o.faction === me && o.id !== s.factions[me].ruler)
    .sort((a, b) => stat(s, b.id, INT) - stat(s, a.id, INT)).slice(0, 30);
  return (
    <>
      <h4 className="sg-sub">{CITY_BY_ID[city].name} 태수 (지금 {nameOf(s.cities[city].governor)})</h4>
      <div className="sg-olist">
        {here.map((o) => <OfficerLine key={o.id} s={s} id={o.id} hi={POL} sel={s.cities[city].governor === o.id} onClick={() => run((g) => appointGovernor(g, city, o.id))} />)}
      </div>
      <h4 className="sg-sub">군사 (지금 {nameOf(s.factions[me].advisor)}) — 지력 높은 순</h4>
      <div className="sg-olist">
        {all.map((o) => <OfficerLine key={o.id} s={s} id={o.id} hi={INT} sel={s.factions[me].advisor === o.id} onClick={() => run((g) => appointAdvisor(g, me, o.id))} />)}
      </div>
    </>
  );
}

function DiploForm({ s, me, pool, kind, run }: {
  s: GameState; me: number; pool: Officer[]; kind: 'goodwill' | 'alliance' | 'surrender'; run: (fn: (g: GameState) => Result) => Result | undefined;
}) {
  const [target, setTarget] = useState<number | null>(null);
  const [gold, setGold] = useState(200);
  const others = s.factions.filter((f) => f.alive && f.idx !== me);
  if (target === null) {
    return (
      <div className="sg-list">
        {others.map((f) => (
          <button key={f.idx} className="sg-row-btn" onClick={() => setTarget(f.idx)}>
            <strong><Dot color={f.color} /> {factionName(s, f.idx)}</strong>
            <span>우호 {s.factions[me].rel[f.idx] ?? 50}{allied(s, me, f.idx) ? ` · 동맹 ${s.factions[me].ally[f.idx]}개월` : ''}{f.human ? ' · 사람' : ''}</span>
          </button>
        ))}
      </div>
    );
  }
  const chanceFn = kind === 'alliance' ? (id: string) => allianceChance(s, me, id, target) : kind === 'surrender' ? (id: string) => surrenderChance(s, me, id, target) : undefined;
  const cityGold = (id: string) => s.cities[s.officers[id].city!].gold;
  return (
    <>
      <p>상대: <strong>{factionName(s, target)}</strong> · 우호 {s.factions[me].rel[target] ?? 50} <button className="sg-link" onClick={() => setTarget(null)}>바꾸기</button></p>
      {kind === 'goodwill' && <Slider label="보낼 금" value={gold} min={50} max={2000} step={50} onChange={setGold} />}
      <PickOfficer s={s} list={pool} hi={kind === 'goodwill' ? POL : CHA} chance={chanceFn} label="사신"
        onPick={(id) => run((g) => (kind === 'goodwill' ? goodwill(g, me, id, target, Math.min(gold, cityGold(id))) : kind === 'alliance' ? proposeAlliance(g, me, id, target) : demandSurrender(g, me, id, target)))} />
    </>
  );
}

function RumorForm({ s, me, pool, run }: { s: GameState; me: number; pool: Officer[]; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const [to, setTo] = useState<CityId | null>(null);
  const targets = useMemo(() => {
    const set = new Set<CityId>();
    for (const [id, c] of Object.entries(s.cities) as [CityId, GameState['cities'][CityId]][]) {
      if (c.owner !== me) continue;
      for (const n of NEIGHBORS[id]) if (s.cities[n.to].owner >= 0 && s.cities[n.to].owner !== me) set.add(n.to);
    }
    return [...set];
  }, [s, me]);
  if (!to) return (
    <div className="sg-list">
      {targets.map((id) => (
        <button key={id} className="sg-row-btn" onClick={() => setTo(id)}>
          <strong><Dot color={s.factions[s.cities[id].owner].color} /> {CITY_BY_ID[id].name}</strong>
          <span>{factionName(s, s.cities[id].owner)} · 민심 {s.cities[id].loyalty} · 태수 {nameOf(s.cities[id].governor)}</span>
        </button>
      ))}
      {!targets.length && <p className="sg-muted">맞닿은 적 도시가 없습니다.</p>}
    </div>
  );
  return (
    <>
      <p>대상: <strong>{CITY_BY_ID[to].name}</strong> <button className="sg-link" onClick={() => setTo(null)}>바꾸기</button></p>
      <PickOfficer s={s} list={pool} hi={INT} chance={(id) => rumorChance(s, id, to)} onPick={(id) => { run((g) => rumor(g, id, to)); }} />
    </>
  );
}

function TradeForm({ s, city, me, run }: { s: GameState; city: CityId; me: number; run: (fn: (g: GameState) => Result) => Result | undefined }) {
  const c = s.cities[city];
  const [buy, setBuy] = useState(true);
  const [n, setN] = useState(1000);
  const max = buy ? Math.floor(c.gold / buyPrice(s)) * 100 : Math.floor(c.food / 100) * 100;
  return (
    <div className="sg-form">
      <p>시세: 군량 100 = 살 때 금 {buyPrice(s)} · 팔 때 금 {sellPrice(s)} {c.traded && <em className="sg-tag">이번 달 거래함</em>}</p>
      <div className="sg-seg">
        <button aria-pressed={buy} onClick={() => setBuy(true)}>사기</button>
        <button aria-pressed={!buy} onClick={() => setBuy(false)}>팔기</button>
      </div>
      <Slider label="군량" value={Math.min(n, max)} min={0} max={max} onChange={setN} />
      <p className="sg-muted">{buy ? `금 ${fmt(Math.floor(Math.min(n, max) / 100) * buyPrice(s))} 소모` : `금 ${fmt(Math.floor(Math.min(n, max) / 100) * sellPrice(s))} 획득`}</p>
      <div className="sg-form-go">
        <button className="sg-btn primary" disabled={c.traded || max < 100} onClick={() => run((g) => trade(g, city, me, buy, n))}>{buy ? '사기' : '팔기'}</button>
      </div>
    </div>
  );
}
