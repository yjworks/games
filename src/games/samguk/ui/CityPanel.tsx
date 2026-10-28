import { Portrait } from './art/Portrait';
import { CityScene } from './art/CityScene';
import { CITY_BY_ID } from '../data/cities';
import { agriCap, commCap, RANK_TITLES } from '../engine/setup';
import { factionName, freeIn, officersIn, worth, nameOf, def } from '../engine/officers';
import type { GameState } from '../engine/state';
import type { CityId } from '../data/types';
import { Bar, Dot, OfficerLine, StatHeader } from './common';
import { fmt, popText } from './labels';
import { allied } from '../engine/commands';
import { mapSummary } from '../engine/battlemap';

export type CmdKey =
  | 'agri' | 'comm' | 'flood' | 'wall' | 'relief'
  | 'draft' | 'train' | 'attack' | 'transport'
  | 'search' | 'recruit' | 'move' | 'reward' | 'appoint'
  | 'goodwill' | 'alliance' | 'surrender'
  | 'rumor' | 'discord' | 'betray'
  | 'trade';

export const CMD_GROUPS: { title: string; seal: string; cmds: [CmdKey, string][] }[] = [
  { title: '내정', seal: '政', cmds: [['agri', '개간'], ['comm', '상업'], ['flood', '치수'], ['wall', '성벽'], ['relief', '시혜']] },
  { title: '군사', seal: '軍', cmds: [['draft', '징병'], ['train', '훈련'], ['attack', '출진'], ['transport', '수송']] },
  { title: '인사', seal: '人', cmds: [['search', '탐색'], ['recruit', '등용'], ['move', '이동'], ['reward', '포상'], ['appoint', '임명']] },
  { title: '외교', seal: '外', cmds: [['goodwill', '친선'], ['alliance', '동맹'], ['surrender', '권항']] },
  { title: '계략', seal: '謀', cmds: [['rumor', '유언'], ['discord', '이간'], ['betray', '내응']] },
  { title: '거래', seal: '商', cmds: [['trade', '매매']] },
];

interface Props {
  s: GameState;
  city: CityId;
  me: number;
  onCmd: (k: CmdKey) => void;
  onPerson: (id: string) => void;
  onToggleDelegate: () => void;
  onClose: () => void;
}

export function CityPanel({ s, city, me, onCmd, onPerson, onToggleDelegate, onClose }: Props) {
  const c = s.cities[city];
  const cd = CITY_BY_ID[city];
  const mine = me >= 0 && c.owner === me;
  const owner = c.owner >= 0 ? s.factions[c.owner] : null;
  const color = owner?.color ?? '#8a8172';
  const officers = (c.owner >= 0 ? officersIn(s, city, c.owner) : []).sort((a, b) => worth(s, b.id) - worth(s, a.id));
  const free = freeIn(s, city).filter((o) => o.found);
  const captives = Object.values(s.officers).filter((o) => o.status === 'captive' && o.city === city);
  const ready = officers.filter((o) => !o.acted).length;
  const map = mapSummary(city);
  const rel = owner && me >= 0 && owner.idx !== me ? s.factions[me].rel[owner.idx] ?? 50 : null;
  const capital = owner?.capital === city;

  return (
    <section className="sg-city-panel sg-win" aria-label={`${cd.name} 정보`} style={{ ['--fac' as string]: color }}>
      <header className="sg-cp-hero">
        <CityScene city={city} color={color} month={s.month} capital={!!capital} />
        <div className="sg-cp-title">
          <h3>{cd.name}<span className="sg-cp-hanja">{cd.hanja}</span></h3>
          <span className="sg-cp-zhou">{cd.zhou} · {map.size}{capital ? ' · 도읍' : ''}</span>
        </div>
        <button className="sg-x on-art" onClick={onClose} aria-label="닫기">✕</button>
      </header>

      <div className="sg-cp-lord">
        {c.governor
          ? <Portrait id={c.governor} size={58} year={s.year} color={owner?.color} ruler={owner?.ruler === c.governor} className="sg-cp-face" />
          : <span className="sg-cp-noface">空</span>}
        <div className="sg-cp-lord-main">
          <p className="sg-cp-owner">
            {owner ? <><Dot color={owner.color} /> <b>{factionName(s, owner.idx)}</b> <small>{RANK_TITLES[owner.rank]}</small>
              {capital && <em className="sg-tag">수도</em>}</> : <span className="sg-muted">공백지 — 수비대만 있음</span>}
          </p>
          <p className="sg-cp-gov">태수 <b>{c.governor ? nameOf(c.governor) : '없음'}</b>
            {rel !== null && <span className="sg-cp-rel"> · 우호 {rel}{allied(s, me, owner!.idx) ? ' · 동맹' : ''}</span>}
          </p>
        </div>
      </div>
      <p className="sg-cp-note">{cd.note}</p>

      <div className="sg-ledger">
        <div className="sg-ledger-col">
          <h5><span>民</span>민정</h5>
          <Row k="인구" v={popText(c.pop)} />
          <Row k="민심" v={c.loyalty} bar={c.loyalty} />
          <Row k="농업" v={<>{c.agri}<small>/{agriCap(c)}</small></>} bar={(c.agri / agriCap(c)) * 100} />
          <Row k="상업" v={<>{c.comm}<small>/{commCap(c)}</small></>} bar={(c.comm / commCap(c)) * 100} />
          <Row k="치수" v={c.flood} bar={c.flood} />
        </div>
        <div className="sg-ledger-col">
          <h5><span>軍</span>군사</h5>
          <Row k="병력" v={fmt(c.troops)} strong />
          <Row k="훈련" v={c.training} bar={c.training} />
          <Row k="사기" v={c.morale} bar={c.morale} />
          <Row k="성벽" v={c.wall} bar={c.wall} />
          <h5><span>庫</span>부고</h5>
          <Row k="금" v={fmt(c.gold)} strong />
          <Row k="군량" v={fmt(c.food)} strong />
        </div>
      </div>
      <p className="sg-map-note"><b>전장</b> {map.size}{map.tags.length ? ` · ${map.tags.join(' · ')}` : ''} — {map.note}</p>

      {mine && (
        <div className="sg-cmds">
          <div className="sg-cmds-top">
            <span>명령 — 움직일 장수 <strong>{ready}</strong>/{officers.length}</span>
            <button className={`sg-chip ${c.delegated ? 'on' : ''}`} onClick={onToggleDelegate} aria-pressed={c.delegated}>
              {c.delegated ? '위임 중' : '위임'}
            </button>
          </div>
          {CMD_GROUPS.map((g) => (
            <div key={g.title} className="sg-cmd-row">
              <span className="sg-cmd-cat" title={g.title}><b>{g.seal}</b><small>{g.title}</small></span>
              <div className="sg-cmd-list">
                {g.cmds.map(([k, label]) => (
                  <button key={k} className="sg-cmd" onClick={() => onCmd(k)}
                    disabled={k !== 'trade' && k !== 'reward' && k !== 'appoint' && ready === 0}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <h4 className="sg-sub">장수 {officers.length}명</h4>
      {officers.length > 0 && <div className="sg-olist-head"><span>이름</span><StatHeader /><span className="sg-oright">충성</span></div>}
      <div className="sg-olist">
        {officers.map((o) => (
          <OfficerLine key={o.id} s={s} id={o.id} onClick={() => onPerson(o.id)} dim={mine && o.acted}
            right={<>{o.loyalty}{mine && o.acted ? <small> 완료</small> : null}</>} />
        ))}
        {officers.length === 0 && <p className="sg-muted">장수가 없습니다.</p>}
      </div>
      {mine && free.length > 0 && (
        <>
          <h4 className="sg-sub">재야 인재</h4>
          <div className="sg-olist">
            {free.map((o) => <OfficerLine key={o.id} s={s} id={o.id} onClick={() => onPerson(o.id)} right={def(o.id).style ?? ''} />)}
          </div>
        </>
      )}
      {captives.length > 0 && (
        <>
          <h4 className="sg-sub">포로</h4>
          <div className="sg-olist">
            {captives.map((o) => <OfficerLine key={o.id} s={s} id={o.id} onClick={() => onPerson(o.id)} right={factionName(s, o.faction)} />)}
          </div>
        </>
      )}
    </section>
  );
}

function Row({ k, v, bar, strong }: { k: string; v: React.ReactNode; bar?: number; strong?: boolean }) {
  return (
    <div className={`sg-lrow ${strong ? 'strong' : ''}`}>
      <span className="sg-lk">{k}</span>
      <b className="sg-lv">{v}</b>
      {bar !== undefined && <Bar v={bar} />}
    </div>
  );
}
