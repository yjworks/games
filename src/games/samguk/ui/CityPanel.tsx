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

export const CMD_GROUPS: { title: string; cmds: [CmdKey, string][] }[] = [
  { title: '내정', cmds: [['agri', '개간'], ['comm', '상업'], ['flood', '치수'], ['wall', '성벽'], ['relief', '시혜']] },
  { title: '군사', cmds: [['draft', '징병'], ['train', '훈련'], ['attack', '출진'], ['transport', '수송']] },
  { title: '인사', cmds: [['search', '탐색'], ['recruit', '등용'], ['move', '이동'], ['reward', '포상'], ['appoint', '임명']] },
  { title: '외교', cmds: [['goodwill', '친선'], ['alliance', '동맹'], ['surrender', '권항']] },
  { title: '계략', cmds: [['rumor', '유언'], ['discord', '이간'], ['betray', '내응']] },
  { title: '거래', cmds: [['trade', '매매']] },
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
  const officers = (c.owner >= 0 ? officersIn(s, city, c.owner) : []).sort((a, b) => worth(s, b.id) - worth(s, a.id));
  const free = freeIn(s, city).filter((o) => o.found);
  const captives = Object.values(s.officers).filter((o) => o.status === 'captive' && o.city === city);
  const ready = officers.filter((o) => !o.acted).length;
  const map = mapSummary(city);
  const rel = owner && me >= 0 && owner.idx !== me ? s.factions[me].rel[owner.idx] ?? 50 : null;

  return (
    <section className="sg-city-panel" aria-label={`${cd.name} 정보`}>
      <header className="sg-cp-head">
        <div>
          <h3>{cd.name} <small>{cd.hanja} · {cd.zhou}</small></h3>
          <p className="sg-cp-owner">
            {owner ? <><Dot color={owner.color} /> {factionName(s, owner.idx)} {RANK_TITLES[owner.rank]}
              {owner.capital === city && <em className="sg-tag">수도</em>}</> : <span className="sg-muted">공백지 (수비대만 있음)</span>}
            {rel !== null && <span className="sg-muted"> · 우호 {rel}{allied(s, me, owner!.idx) ? ' · 동맹' : ''}</span>}
          </p>
        </div>
        <button className="sg-x" onClick={onClose} aria-label="닫기">✕</button>
      </header>
      <p className="sg-cp-note">{cd.note}</p>
      <p className="sg-map-note">전장 <b>{map.size}</b>{map.tags.length ? ` · ${map.tags.join(' · ')}` : ''} — {map.note}</p>
      <div className="sg-cp-grid">
        <Cell k="인구" v={popText(c.pop)} />
        <Cell k="민심" v={c.loyalty} bar={c.loyalty} />
        <Cell k="농업" v={`${c.agri}/${agriCap(c)}`} bar={(c.agri / agriCap(c)) * 100} />
        <Cell k="상업" v={`${c.comm}/${commCap(c)}`} bar={(c.comm / commCap(c)) * 100} />
        <Cell k="치수" v={c.flood} bar={c.flood} />
        <Cell k="성벽" v={c.wall} bar={c.wall} />
        <Cell k="병력" v={fmt(c.troops)} strong />
        <Cell k="훈련" v={c.training} bar={c.training} />
        <Cell k="사기" v={c.morale} bar={c.morale} />
        <Cell k="금" v={fmt(c.gold)} strong />
        <Cell k="군량" v={fmt(c.food)} strong />
        <Cell k="태수" v={nameOf(c.governor)} />
      </div>

      {mine && (
        <div className="sg-cmds">
          <div className="sg-cmds-top">
            <span>명령 — 움직일 수 있는 장수 <strong>{ready}</strong>/{officers.length}</span>
            <button className={`sg-chip ${c.delegated ? 'on' : ''}`} onClick={onToggleDelegate} aria-pressed={c.delegated}>
              {c.delegated ? '위임 중' : '위임'}
            </button>
          </div>
          {CMD_GROUPS.map((g) => (
            <div key={g.title} className="sg-cmd-row">
              <span className="sg-cmd-cat">{g.title}</span>
              {g.cmds.map(([k, label]) => (
                <button key={k} className="sg-cmd" onClick={() => onCmd(k)}
                  disabled={k !== 'trade' && k !== 'reward' && k !== 'appoint' && ready === 0}>
                  {label}
                </button>
              ))}
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

function Cell({ k, v, bar, strong }: { k: string; v: string | number; bar?: number; strong?: boolean }) {
  return (
    <div className={`sg-cell ${strong ? 'strong' : ''}`}>
      <span>{k}</span>
      <b>{v}</b>
      {bar !== undefined && <Bar v={bar} />}
    </div>
  );
}
