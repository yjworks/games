import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { growupTutorial } from './tutorial';
import { useGrow } from './store';
import { Portrait } from './Portrait';
import { PixelAvatar } from './PixelAvatar';
import { WorldEffect, WorldView } from './WorldView';
import { TOTAL_TURNS, calendar } from './calendar';
import { CAREERS, careerById } from './careers';
import {
  FIELD_EMOJI, FIELD_LABEL, HAIR_COLORS, HAIR_STYLES, PLACES, STAT_COLOR, STAT_KEYS, STAT_LABEL, placeById,
} from './data';
import {
  CHARGE_MS, MAX_TOKENS, actStatus, actsOf, bubble, candidates, expression, fill, findAct, josa, nextChargeIn, odds,
  pendingEvent, placeStage, topFields,
} from './engine';
import { RIASEC_INFO, RIASEC_KEYS, careersForType, nearMisses, riasec, topRiasec } from './edu';
import { Flow, screenModel } from './flow';
import { FRIENDS, FRIEND_LEVELS, FRIEND_MET } from './friends';
import { LAYER, useButtons } from './input';
import { EXPR_KEYS, EXPR_NAMES, STAGE_KEYS, STAGE_NAMES, presetUrl, shrinkImage } from './portraits';
import { PRESETS } from './pixelart';
import { PixelEditor } from './PixelEditor';
import {
  Activity, Delta, FieldKey, FriendId, GameState, Look, Mode, PlaceId, StatKey, TurnReport, YearSummary,
} from './types';

const meta = gameById('growup');

/** 머리색 5 × 머리 모양 3 — ③ 버튼으로 차례로 넘긴다 */
const LOOKS: Look[] = HAIR_STYLES.flatMap((_, style) => HAIR_COLORS.map((_, hair) => ({ hair, style })));

export default function App() {
  const game = useGrow((s) => s.game);
  const dexOpen = useGrow((s) => s.dexOpen);
  const setDex = useGrow((s) => s.setDex);
  const toast = useGrow((s) => s.toast);
  const [portraits, setPortraits] = useState(false);

  return (
    <GameShell
      meta={meta}
      tutorial={growupTutorial}
      actions={<>
        <button className="db-btn shell-btn" onClick={() => setPortraits(true)} aria-label="초상 바꾸기" title="초상 바꾸기">🖼️</button>
        <button className="db-btn shell-btn" onClick={() => setDex(true)} aria-label="엔딩 도감" title="엔딩 도감">📖</button>
      </>}
    >
      <div className="gu-root">
        {!game ? <TitleScreen onDex={() => setDex(true)} onPortraits={() => setPortraits(true)} /> : <GameScreen game={game} />}
      </div>
      {dexOpen && <DexView onClose={() => setDex(false)} />}
      {portraits && <PortraitManager look={game?.look ?? { hair: 0, style: 0 }} onClose={() => setPortraits(false)} />}
      {toast && <Toast key={toast.key} text={toast.text} />}
    </GameShell>
  );
}

function Toast({ text }: { text: string }) {
  const [on, setOn] = useState(true);
  useEffect(() => { const id = window.setTimeout(() => setOn(false), 2200); return () => window.clearTimeout(id); }, []);
  return on ? <div className="gu-toast fade-in" role="status">{text}</div> : null;
}

/* ══════════════ 공용 조각 ══════════════ */

/** '학교로' · '집으로' · '교실로' — 받침이 없거나 ㄹ이면 '로' */
function euro(word: string): string {
  const ch = word.charCodeAt(word.length - 1);
  const jong = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 : 0;
  return word + (jong === 0 || jong === 8 ? '로' : '으로');
}

/** 버튼 번호 — 기기의 버튼 ①~④와 같은 자리 */
function Num({ n }: { n: number }) {
  return <span className="gu-num" aria-hidden="true">{n}</span>;
}

function Modal({ children, onClose, className = '', label }: {
  children: ReactNode; onClose?: () => void; className?: string; label: string;
}) {
  return (
    <div className="gu-modal-back fade-in" onClick={onClose} role="presentation">
      <div className={`gu-modal ${className}`} role="dialog" aria-modal="true" aria-label={label}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 1 ? Math.round(v) : Math.round(v * 10) / 10);
const signed = (v: number) => `${v > 0 ? '+' : ''}${fmt(v)}`;

function DeltaChips({ d }: { d: Delta }) {
  const chips: { key: string; text: string; tone: 'up' | 'down' | 'field' | 'neutral' }[] = [];
  for (const k of STAT_KEYS) {
    const v = d.stats[k];
    if (v && Math.abs(v) >= 0.5) chips.push({ key: k, text: `${STAT_LABEL[k]} ${signed(v)}`, tone: v > 0 ? 'up' : 'down' });
  }
  for (const [k, v] of Object.entries(d.fields) as [FieldKey, number][]) {
    if (v > 0.5) chips.push({ key: k, text: `${FIELD_EMOJI[k]} ${FIELD_LABEL[k]} 관심↑`, tone: 'field' });
  }
  const cond: [string, number, boolean][] = [['피로', d.fatigue, false], ['스트레스', d.stress, false], ['기분', d.mood, true]];
  for (const [name, v, goodUp] of cond) {
    if (Math.abs(v) >= 1) chips.push({ key: name, text: `${name} ${signed(v)}`, tone: (v > 0) === goodUp ? 'up' : 'down' });
  }
  if (d.money) chips.push({ key: 'money', text: `💰 ${signed(d.money)}만원`, tone: d.money > 0 ? 'up' : 'down' });
  if (d.bold >= 1) chips.push({ key: 'bold', text: '도전 성향↑', tone: 'neutral' });
  if (d.bold <= -1) chips.push({ key: 'bold', text: '신중 성향↑', tone: 'neutral' });
  if (!chips.length) return null;
  return <div className="gu-chips">{chips.map((c) => <span key={c.key} className={`gu-chip ${c.tone}`}>{c.text}</span>)}</div>;
}

/** 칸으로 나뉜 막대. alert: 높으면 위험(high)인지 낮으면 위험(low)인지 */
function Bar({ label, value, color, alert, icon }: { label: string; value: number; color: string; alert?: 'high' | 'low'; icon?: string }) {
  const warn = alert === 'high' ? value >= 75 : alert === 'low' ? value < 30 : false;
  return (
    <div className={`gu-bar ${warn ? 'warn' : ''}`}>
      <span className="gu-bar-label">{icon ? `${icon} ` : ''}{label}</span>
      <span className="gu-bar-track" style={{ ['--bar' as string]: color }}><span className="gu-bar-fill" style={{ width: `${value}%` }} /></span>
      <span className="gu-bar-num">{Math.round(value)}</span>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="gu-stars" aria-label={`${n}등급`}>{'★'.repeat(n)}<i>{'★'.repeat(3 - n)}</i></span>;
}

function Hearts({ v }: { v: number }) {
  const n = v >= FRIEND_LEVELS[1] ? 3 : v >= FRIEND_LEVELS[0] ? 2 : v >= FRIEND_MET ? 1 : 0;
  return <span className="gu-hearts" aria-label={`친밀도 ${Math.round(v)}`}>{'♥'.repeat(n)}<i>{'♥'.repeat(3 - n)}</i></span>;
}

const friendTitle = (v: number) => (v >= FRIEND_LEVELS[1] ? '단짝' : v >= FRIEND_LEVELS[0] ? '친구' : v >= FRIEND_MET ? '아는 사이' : '아직 몰라요');

/** 버튼 하나(번호 + 이모지 + 글) */
function ChoiceBtn({ n, emoji, label, sub, enabled = true, onClick, tone = '' }: {
  n: number; emoji?: string; label: string; sub?: ReactNode; enabled?: boolean; onClick: () => void; tone?: string;
}) {
  return (
    <button className={`gu-choice ${tone} ${enabled ? '' : 'off'}`} aria-disabled={!enabled} onClick={onClick}>
      <Num n={n} />
      {emoji && <span className="gu-choice-emoji">{emoji}</span>}
      <span className="gu-choice-body"><strong>{label}</strong>{sub && <small>{sub}</small>}</span>
    </button>
  );
}

/** “아무 버튼이나” 안내 */
function AnyKey({ text = '아무 버튼이나 눌러 계속', onClick }: { text?: string; onClick: () => void }) {
  return <button className="gu-anykey" onClick={onClick}><span>▶</span> {text}</button>;
}

/* ══════════════ 시작 화면 ══════════════ */

function TitleScreen({ onDex, onPortraits }: { onDex: () => void; onPortraits: () => void }) {
  const start = useGrow((s) => s.start);
  const dex = useGrow((s) => s.dex);
  const [name, setName] = useState('하늘');
  const [look, setLook] = useState<Look>({ hair: 0, style: 0 });
  const seen = Object.keys(dex).length;

  const go = (mode: Mode) => start({ name, look, mode });
  const nextLook = () => {
    const i = LOOKS.findIndex((l) => l.hair === look.hair && l.style === look.style);
    setLook(LOOKS[(i + 1) % LOOKS.length]);
  };

  useButtons((b) => {
    if (b === 1) go('classic');
    else if (b === 2) go('raise');
    else if (b === 3) nextLook();
    else if (b === 4) onDex();
  }, LAYER.screen, 'title', ['한 번에 키우기', '키우기 모드', '모습 바꾸기', '엔딩 도감']);

  const month = new Date().getMonth() + 1;
  const season = month >= 3 && month <= 5 ? '봄' : month >= 6 && month <= 8 ? '여름' : month >= 9 && month <= 11 ? '가을' : '겨울';

  return (
    <div className="gu-title center-scroll">
      <div className="gu-title-world">
        <WorldView stage={0} season={season} look={look} expr="happy" props={[]} trophies={0} friends={['seoyeon', 'doyun']}
          at="home" rain={false} bubble={`안녕! 나는 ${name.trim() || '하늘'}`} labels={['집', '학교', '동네', '체험센터']} />
      </div>
      <div className="gu-title-card gu-panel">
        <div className="gu-title-hero">
          <Portrait look={look} stage={0} expr="happy" scale={5} className="lg" />
          <div>
            <h2 className="gu-logo">커서 뭐 될래?</h2>
            {meta.lore.map((l) => <p key={l}>{l}</p>)}
          </div>
        </div>

        <label className="gu-field">
          <span>이름 (그대로 두면 “하늘”)</span>
          <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="하늘" />
        </label>

        <div className="gu-field">
          <span>머리색 · 머리 모양 <button className="gu-link inline" onClick={onPortraits}>직접 그린 초상 넣기</button></span>
          <div className="gu-swatches">
            {HAIR_COLORS.map((c, i) => (
              <button key={c} className={`gu-swatch ${look.hair === i ? 'on' : ''}`} style={{ background: c }}
                aria-label={`머리색 ${i + 1}`} aria-pressed={look.hair === i} onClick={() => setLook({ ...look, hair: i })} />
            ))}
          </div>
          <div className="gu-seg">
            {HAIR_STYLES.map((s, i) => (
              <button key={s} className={look.style === i ? 'on' : ''} aria-pressed={look.style === i}
                onClick={() => setLook({ ...look, style: i })}>{s}</button>
            ))}
          </div>
        </div>

        <div className="gu-four">
          <ChoiceBtn n={1} tone="primary" label="한 번에 키우기" sub="원하는 만큼 계속. 30~40분이면 졸업." onClick={() => go('classic')} />
          <ChoiceBtn n={2} emoji="🌱" label="키우기 모드" sub={`4시간마다 행동 1번(최대 ${MAX_TOKENS}번).`} onClick={() => go('raise')} />
          <ChoiceBtn n={3} emoji="✨" label="모습 바꾸기" sub="머리색·머리 모양을 차례로." onClick={nextLook} />
          <ChoiceBtn n={4} emoji="📖" label="엔딩 도감" sub={`${seen} / ${CAREERS.length} 직업`} onClick={onDex} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════ 게임 화면 ══════════════ */

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

const hms = (ms: number) => {
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** 4주를 한 주씩 펼쳐 보이는 간격(ms) */
const WEEK_MS = 650;

function GameScreen({ game }: { game: GameState }) {
  const flow = useGrow((s) => s.flow);
  const press = useGrow((s) => s.press);
  const setBusy = useGrow((s) => s.setBusy);
  const wake = useGrow((s) => s.wake);

  if (flow.s === 'ending') return <EndingScreen game={game} />;

  return <Playing game={game} flow={flow} press={press} setBusy={setBusy} wake={wake} />;
}

function Playing({ game, flow, press, setBusy, wake }: {
  game: GameState; flow: Flow; press: (b: 1 | 2 | 3 | 4 | 'back') => void; setBusy: (v: boolean) => void;
  wake: ReturnType<typeof useGrow.getState>['wake'];
}) {
  const raise = game.mode === 'raise';
  const now = useNow(raise);
  const cal = calendar(Math.min(game.turn, TOTAL_TURNS - 1));
  const expr = expression(game);
  const model = screenModel(flow, game);

  /* 아이가 서 있는 곳 — 장소를 고르면 걸어가고, 도착해야 활동 목록이 열린다 */
  const [at, setAt] = useState<PlaceId>('home');
  const [arrived, setArrived] = useState<PlaceId | null>('home');
  const walkTo = flow.s === 'place' ? flow.place : (flow.s === 'month' || flow.s === 'result') ? flow.report.place ?? 'home' : null;
  useEffect(() => {
    if (walkTo && walkTo !== at) { setArrived(null); setAt(walkTo); setBusy(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkTo]);
  const onArrive = () => { setArrived(at); setBusy(false); };

  /* 4주 연출 — 한 주씩 펼치고, 그 주 결과를 마을에도 보인다 */
  const [shown, setShown] = useState(4);
  const [effect, setEffect] = useState<WorldEffect | null>(null);
  const monthKey = flow.s === 'month' ? flow.report.when + (flow.report.act ?? '') : '';
  useEffect(() => {
    if (flow.s !== 'month') return;
    const weeks = flow.report.weeks ?? [];
    if (!weeks.length) { setShown(4); setEffect({ kind: 'sick', key: Date.now() }); return; }
    setShown(0);
    let i = 0;
    const id = window.setInterval(() => {
      const w = weeks[i];
      if (w) setEffect({ kind: w.outcome === 'great' ? 'great' : w.outcome === 'fail' ? 'fail' : 'ok', key: Date.now() + i });
      i += 1;
      setShown(i);
      if (i >= weeks.length) window.clearInterval(id);
    }, WEEK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    if (flow.s === 'eventResult' && (flow.delta?.mood ?? 0) > 0) setEffect({ kind: 'heart', key: Date.now() });
  }, [flow]);

  /* 버튼 — 4주 연출 중 첫 버튼은 연출을 건너뛴다 */
  const revealing = flow.s === 'month' && shown < (flow.report.weeks?.length ?? 0);
  const onButton = (b: 1 | 2 | 3 | 4 | 'back') => {
    if (revealing) { setShown(4); return; }
    if (flow.s === 'place' && arrived !== flow.place) return;
    press(b);
  };
  useButtons(onButton, LAYER.screen, flow.s, model.anyKey ? ['계속', '계속', '계속', '계속'] : model.choices.map((c) => c.label));

  /* 키우기 모드 행동력 */
  const toastSet = useGrow.setState;
  useEffect(() => {
    if (!raise) return;
    const run = () => {
      const r = wake();
      if (r?.missed) toastSet({ toast: { text: fill('어서 와! {name:이가} 반갑게 손을 흔들어요.', r.state.name), key: Date.now() } });
      else if (r && r.gained > 0) toastSet({ toast: { text: `⚡ 행동력 ${r.gained} 충전!`, key: Date.now() } });
    };
    run();
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [raise, wake, toastSet]);
  const wait = nextChargeIn(game, now);
  useEffect(() => { if (raise && game.tokens < MAX_TOKENS && wait <= 0) wake(); }, [raise, wait, game.tokens, wake]);

  const labels = PLACES.map((p) => placeStage(game, p).label);
  const props = topFields(game, 2).filter((t) => t.value >= 20).map((t) => t.field);
  const trophies = game.awards.filter((a) => a.rank !== 'fail').length;
  const met = FRIENDS.filter((f) => game.friends[f.id] >= FRIEND_MET).map((f) => f.id as FriendId);

  /* 대화창에 나오는 아이의 말 */
  const line = flow.s === 'place' ? (arrived === flow.place ? `${placeStage(game, placeById(flow.place)!).label}에 왔어! 뭘 할까?` : '가는 중…')
    : flow.s === 'month' ? `이번 달은 ${findAct(flow.report.act ?? '')?.name ?? '푹 쉬기'}!`
      : flow.s === 'graduation' ? '드디어 졸업이야! 나 어떤 어른이 될까?'
        : flow.s === 'review' ? '벌써 한 해가 지났네. 올해 뭐가 제일 좋았냐면…'
          : bubble(game);

  return (
    <div className="gu-main">
      <section className="gu-stage gu-panel" aria-label="블록 마을">
        <div className="gu-hud">
          <span className="gu-badge">{model.hud.when}</span>
          <span className={`gu-badge season ${cal.season}`}>{cal.season}{cal.vacation ? ' · 방학' : ''}</span>
          <span className="gu-badge">💰 {game.money}만원</span>
          {raise && <span className="gu-badge" title="행동력">{'⚡'.repeat(game.tokens)}<i className="gu-dim">{'⚡'.repeat(MAX_TOKENS - game.tokens)}</i>{game.tokens < MAX_TOKENS ? ` ${hms(wait || CHARGE_MS)}` : ''}</span>}
          <span className="gu-progress" title="졸업까지"><span style={{ width: `${(Math.min(game.turn, TOTAL_TURNS) / TOTAL_TURNS) * 100}%` }} /></span>
        </div>
        <WorldView
          stage={cal.stage} season={cal.season} look={game.look} expr={expr}
          props={props} trophies={trophies} friends={met}
          at={at} onArrive={onArrive} effect={effect} rain={game.stress >= 70}
          labels={labels}
          onPlace={(p) => { if (flow.s === 'town') press((PLACES.findIndex((x) => x.id === p) + 1) as 1 | 2 | 3 | 4); }}
        />
        {/* 대화창 — 초상과 아이의 한마디 */}
        <div className="gu-dialog">
          <Portrait look={game.look} stage={cal.stage} expr={expr} scale={3} className="sm" />
          <div className="gu-dialog-body">
            <b>{game.name}</b>
            <p>{line}</p>
          </div>
        </div>
        <Command game={game} flow={flow} arrived={arrived} shown={shown} press={onButton} />
      </section>

      <SidePanel game={game} />
    </div>
  );
}

/* ── 명령 패널 — 지금 버튼 ①~④가 무엇인지 ── */
function Command({ game, flow, arrived, shown, press }: {
  game: GameState; flow: Flow; arrived: PlaceId | null; shown: number; press: (b: 1 | 2 | 3 | 4 | 'back') => void;
}) {
  const pressN = (i: number) => press((i + 1) as 1 | 2 | 3 | 4);
  switch (flow.s) {
    case 'town':
      if (game.sick) {
        return (
          <div className="gu-cmd">
            <h3 className="gu-cmd-title">🤒 아파요</h3>
            <p className="gu-cmd-text">너무 무리했어요. 이번 달은 집에서 푹 쉬어요.</p>
            <AnyKey text="아무 버튼이나 눌러 한 달 쉬기" onClick={() => press(1)} />
          </div>
        );
      }
      return (
        <div className="gu-cmd">
          <h3 className="gu-cmd-title">이번 달엔 어디로 갈까요?</h3>
          <div className="gu-place-row">
            {PLACES.map((p, i) => {
              const v = game.stageVisits[p.id] ?? 0;
              return (
                <button key={p.id} className="gu-place" style={{ ['--pc' as string]: p.color }} onClick={() => pressN(i)}>
                  <Num n={i + 1} />
                  <span className="gu-place-emoji">{p.emoji}</span>
                  <span className="gu-place-name">{placeStage(game, p).label}</span>
                  <span className="gu-place-sub">{v > 0 ? `단골 ${v}` : '처음'}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    case 'place': {
      const place = placeById(flow.place)!;
      const st = placeStage(game, place);
      if (arrived !== flow.place) return <div className="gu-cmd"><p className="gu-cmd-text center">{place.emoji} {euro(st.label)} 가는 중…</p></div>;
      const here = FRIENDS.filter((f) => f.place === place.id && game.friends[f.id] >= FRIEND_MET);
      return (
        <div className="gu-cmd">
          <div className="gu-cmd-head">
            <h3 className="gu-cmd-title">{place.emoji} {st.label}</h3>
            <button className="gu-back" onClick={() => press('back')}>↩ 뒤로</button>
          </div>
          <p className="gu-cmd-text">{st.desc}{here.length ? ` ${josa(here.map((f) => `${f.emoji}${f.name}`).join(', '), '이가')} 와 있어요.` : ''}</p>
          <div className="gu-acts">
            {actsOf(game, place).map((a, i) => <ActCard key={a.id} n={i + 1} game={game} placeId={place.id} act={a} onClick={() => pressN(i)} />)}
          </div>
        </div>
      );
    }
    case 'month':
      return <MonthView report={flow.report} shown={shown} onNext={() => press(1)} />;
    case 'result':
      return <ResultView game={game} report={flow.report} onNext={() => press(1)} />;
    case 'review':
      return <ReviewView game={game} onPick={pressN} />;
    case 'quiz': {
      const q = game.quiz!;
      return (
        <div className="gu-cmd">
          <h3 className="gu-cmd-title">❓ 직업 퀴즈</h3>
          <p className="gu-cmd-text big">{q.question}</p>
          <div className="gu-options">
            {q.options.map((o, i) => <ChoiceBtn key={o} n={i + 1} label={o} onClick={() => pressN(i)} />)}
          </div>
        </div>
      );
    }
    case 'event': {
      const ev = pendingEvent(game)!;
      return (
        <div className="gu-cmd">
          <h3 className="gu-cmd-title">{ev.emoji} {fill(ev.title, game.name)}</h3>
          <p className="gu-cmd-text big">{fill(ev.text, game.name)}</p>
          <div className="gu-options">
            {ev.options.map((o, i) => {
              const ok = !o.need || game.money >= o.need;
              return <ChoiceBtn key={o.label} n={i + 1} label={o.label} sub={o.need ? `용돈 ${o.need}만원` : undefined} enabled={ok} onClick={() => pressN(i)} />;
            })}
          </div>
        </div>
      );
    }
    case 'eventResult':
      return (
        <div className={`gu-cmd ${flow.correct === true ? 'good' : flow.correct === false ? 'bad' : ''}`}>
          <h3 className="gu-cmd-title">{flow.emoji} {flow.title}</h3>
          <p className="gu-cmd-text big">{flow.text}</p>
          {flow.delta && <DeltaChips d={flow.delta} />}
          <AnyKey onClick={() => press(1)} />
        </div>
      );
    case 'graduation':
      return <GraduationView game={game} onPick={pressN} />;
    default:
      return null;
  }
}

/** 활동 카드에 붙는 예상 효과 */
function effectHints(a: Activity): { text: string; tone: 'up' | 'down' | 'field' | 'neutral' }[] {
  const out: { text: string; tone: 'up' | 'down' | 'field' | 'neutral' }[] = [];
  for (const [k, v] of Object.entries(a.stats ?? {}) as [StatKey, number][]) if (v > 0) out.push({ text: `${STAT_LABEL[k]}${v >= 5 ? '↑↑' : '↑'}`, tone: 'up' });
  for (const [k, v] of Object.entries(a.fields ?? {}) as [FieldKey, number][]) if (v >= 2) out.push({ text: `${FIELD_EMOJI[k]}${FIELD_LABEL[k]}`, tone: 'field' });
  if (a.special === 'topField') out.push({ text: '💡 가장 큰 관심사↑↑', tone: 'field' });
  if (a.special === 'randomField') out.push({ text: '💡 새로운 관심사', tone: 'field' });
  if (a.special === 'counsel') out.push({ text: '🗺️ 흥미 유형 확인', tone: 'field' });
  if (a.contest) out.push({ text: '🏆 대회', tone: 'neutral' });
  if (a.fatigue) out.push({ text: `피로${a.fatigue > 0 ? '+' : ''}${a.fatigue}`, tone: a.fatigue > 0 ? 'down' : 'up' });
  if (a.stress) out.push({ text: `스트레스${a.stress > 0 ? '+' : ''}${a.stress}`, tone: a.stress > 0 ? 'down' : 'up' });
  if (a.mood && a.mood > 0) out.push({ text: `기분+${a.mood}`, tone: 'up' });
  if (a.money && a.money > 0) out.push({ text: `💰+${a.money}`, tone: 'up' });
  if (a.cost) out.push({ text: `💰-${a.cost}`, tone: 'down' });
  return out;
}

function ActCard({ n, game, placeId, act, onClick }: { n: number; game: GameState; placeId: PlaceId; act: Activity; onClick: () => void }) {
  const place = placeById(placeId)!;
  const s = actStatus(game, place, act);
  const o = odds(game, act);
  return (
    <button className={`gu-act ${s.locked ? 'locked' : ''} ${s.ok ? '' : 'off'}`} aria-disabled={!s.ok} onClick={onClick}>
      <Num n={n} />
      <span className="gu-act-emoji">{s.locked ? '🔒' : act.emoji}</span>
      <span className="gu-act-body">
        <strong>{act.name}</strong>
        <small>{s.locked ? `잠김 — ${s.reason}` : act.desc}</small>
        {!s.locked && <span className="gu-hints">{effectHints(act).map((h) => <span key={h.text} className={`gu-chip ${h.tone}`}>{h.text}</span>)}</span>}
        {!s.locked && !act.safe && <span className="gu-odds">한 주마다 대성공 {Math.round(o.great * 100)}% · 실패 {Math.round(o.fail * 100)}%</span>}
        {!s.ok && !s.locked && <span className="gu-odds warn">{s.reason}</span>}
      </span>
    </button>
  );
}

const WEEK_ICON = { great: '★', ok: '●', fail: '✗' } as const;

function MonthView({ report, shown, onNext }: { report: TurnReport; shown: number; onNext: () => void }) {
  const act = report.act ? findAct(report.act) : undefined;
  const weeks = report.weeks ?? [];
  const done = shown >= weeks.length;
  return (
    <div className="gu-cmd">
      <h3 className="gu-cmd-title">{act ? `${act.emoji} ${act.name}` : '🛌 앓아누운 한 달'} <small>{report.when}</small></h3>
      {weeks.length ? (
        <ol className="gu-weeks">
          {weeks.map((w, i) => (
            <li key={i} className={`${i < shown ? 'on' : ''} ${w.outcome}`}>
              <span className="gu-week-n">{i + 1}주</span>
              <span className="gu-week-icon">{i < shown ? WEEK_ICON[w.outcome] : '…'}</span>
              <span className="gu-week-text">{i < shown ? w.text : ''}</span>
            </li>
          ))}
        </ol>
      ) : <p className="gu-cmd-text">한 달 동안 푹 쉬었어요. 몸이 회복됐어요.</p>}
      <AnyKey text={done ? '아무 버튼이나 눌러 결과 보기' : '아무 버튼이나 눌러 건너뛰기'} onClick={onNext} />
    </div>
  );
}

const OUTCOME_TEXT = { great: '대성공!', ok: '잘 해냈어요', fail: '아쉬워요', sick: '푹 쉬었어요' } as const;

function ResultView({ game, report, onNext }: { game: GameState; report: TurnReport; onNext: () => void }) {
  const last = game.turn >= TOTAL_TURNS;
  return (
    <div className={`gu-cmd ${report.outcome === 'great' ? 'good' : report.outcome === 'fail' ? 'bad' : ''}`}>
      <h3 className={`gu-cmd-title result ${report.outcome}`}>{OUTCOME_TEXT[report.outcome]} <small>{report.when}</small></h3>
      <DeltaChips d={report.delta} />
      {report.lines.map((l) => <p key={l} className="gu-cmd-line">{l}</p>)}
      {report.counsel && <RiasecMini game={game} />}
      {report.exam && <p className="gu-cmd-box">📝 {report.exam.grade} 시험 — {report.exam.label} ({report.exam.score}점)</p>}
      {report.yearEnd && (
        <div className="gu-cmd-box">
          <strong>🎒 {report.yearEnd.grade}을 마쳤어요!</strong>
          <div className="gu-chips">
            {(Object.entries(report.yearEnd.delta) as [StatKey, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <span key={k} className="gu-chip up">{STAT_LABEL[k]} +{Math.round(v)}</span>
            ))}
          </div>
        </div>
      )}
      <AnyKey text={last ? '아무 버튼이나 눌러 졸업식으로' : report.yearEnd ? '아무 버튼이나 눌러 한 해 돌아보기' : '아무 버튼이나 눌러 다음 달로'} onClick={onNext} />
    </div>
  );
}

/** 상담 결과 — 흥미 유형 맛보기 */
function RiasecMini({ game }: { game: GameState }) {
  const [a, b] = topRiasec(game);
  return (
    <div className="gu-cmd-box">
      <strong>🗺️ 상담 결과 — 지금 내 흥미 유형</strong>
      <span>{RIASEC_INFO[a].name}({a}) · {RIASEC_INFO[b].name}({b})</span>
      <small>{RIASEC_INFO[a].desc}</small>
      <small>어울리는 직업: {careersForType([a, b], 3).map((c) => `${c.emoji}${c.title}`).join(', ')}</small>
    </div>
  );
}

/** 학년 돌아보기 — 용돈 기입장·장소 비율·조언, 그리고 질문 하나 */
function ReviewView({ game, onPick }: { game: GameState; onPick: (i: number) => void }) {
  const y = game.history[game.history.length - 1];
  return (
    <div className="gu-cmd">
      <h3 className="gu-cmd-title">📔 {y.grade} 돌아보기</h3>
      <YearCard y={y} />
      <ul className="gu-tips">{y.tips.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="gu-cmd-text big">올해 가장 즐거웠던 일은 뭐였어?</p>
      <div className="gu-options">
        {y.choices.map((id, i) => {
          const a = findAct(id);
          return <ChoiceBtn key={id} n={i + 1} emoji={a?.emoji} label={a?.name ?? id} sub={`${y.acts[id]}번 했어요`} onClick={() => onPick(i)} />;
        })}
      </div>
    </div>
  );
}

function YearCard({ y }: { y: YearSummary }) {
  const total = Math.max(1, Object.values(y.places).reduce((a, b) => a + (b ?? 0), 0));
  return (
    <div className="gu-year-card">
      <div className="gu-ledger">
        <span>💰 들어온 돈 <b>{y.income}</b></span>
        <span>💸 쓴 돈 <b>{y.spend}</b></span>
        <span>🐷 남은 돈 <b>{y.money}</b></span>
      </div>
      <div className="gu-place-mix" aria-label="장소별 횟수">
        {PLACES.map((p) => {
          const v = y.places[p.id] ?? 0;
          return v ? <span key={p.id} style={{ flex: v, background: p.color }} title={`${p.name} ${v}번`}>{p.emoji}</span> : null;
        })}
        {y.sick ? <span style={{ flex: y.sick, background: '#5a6a8a' }} title={`아픔 ${y.sick}달`}>🤒</span> : null}
      </div>
      <small className="gu-muted">대성공 {y.greats} · 실패 {y.fails} · 쉰 달 {y.rests}{y.exam !== null ? ` · 시험 ${y.exam}점` : ''}{y.quizTotal ? ` · 퀴즈 ${y.quizRight}/${y.quizTotal}` : ''} · 장소 {Object.keys(y.places).length}곳 · 총 {total}달</small>
    </div>
  );
}

function GraduationView({ game, onPick }: { game: GameState; onPick: (i: number) => void }) {
  const list = useMemo(() => candidates(game), [game]);
  const burnout = list.length === 1 && list[0].careerId === 'gap' && game.stress >= 85;
  return (
    <div className="gu-cmd">
      <h3 className="gu-cmd-title">🎓 졸업! {burnout ? '너무 지쳐 있어요… 잠시 쉬어 가요.' : '어떤 길을 걸어갈까요?'}</h3>
      <div className="gu-options">
        {list.map((c, i) => {
          const j = careerById(c.careerId)!;
          return <ChoiceBtn key={c.careerId} n={i + 1} emoji={j.emoji} label={j.title}
            sub={<><span className={`gu-kind k-${j.kind}`}>{j.kind}</span> <Stars n={c.tier} /> {j.subjects.length ? `· ${j.subjects.join('·')}` : ''}</>}
            onClick={() => onPick(i)} />;
        })}
      </div>
    </div>
  );
}

/* ── 옆 단: 상태·친구·능력치·기록 ── */
function SidePanel({ game }: { game: GameState }) {
  const [tab, setTab] = useState<'stat' | 'friend' | 'log'>('stat');
  const switchClassic = useGrow((s) => s.toClassic);
  const reset = useGrow((s) => s.reset);
  const cal = calendar(Math.min(game.turn, TOTAL_TURNS - 1));
  const counseled = game.counseledAt >= 0 && game.turn - game.counseledAt <= 12;
  return (
    <aside className="gu-side gu-panel">
      <div className="gu-status-top">
        <Portrait look={game.look} stage={cal.stage} expr={expression(game)} scale={4} className="md" />
        <div className="gu-status-info">
          <strong className="gu-name">{game.name} <small>{cal.gradeLabel}</small></strong>
          <div className="gu-bars">
            <Bar label="피로" icon="⚡" value={game.fatigue} color="#f0a03c" alert="high" />
            <Bar label="스트레스" icon="💢" value={game.stress} color="#e0505a" alert="high" />
            <Bar label="기분" icon="😊" value={game.mood} color="#4fbf6b" alert="low" />
          </div>
        </div>
      </div>
      <div className="gu-tabs" role="tablist">
        {([['stat', '능력치'], ['friend', '친구'], ['log', '기록']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'stat' && (
        <>
          <div className="gu-stat-list">{STAT_KEYS.map((k) => <Bar key={k} label={STAT_LABEL[k]} value={game.stats[k]} color={STAT_COLOR[k]} />)}</div>
          <h3>요즘 관심사</h3>
          <Interests game={game} exact={counseled} />
          <h3>성향</h3>
          <div className="gu-bold"><span>신중</span><span className="gu-bold-track"><span className="gu-bold-dot" style={{ left: `${(game.bold + 100) / 2}%` }} /></span><span>도전</span></div>
        </>
      )}
      {tab === 'friend' && (
        <ul className="gu-friends">
          {FRIENDS.map((f) => {
            const v = game.friends[f.id];
            const known = v >= FRIEND_MET;
            return (
              <li key={f.id} className={known ? '' : 'unknown'}>
                <PixelAvatar look={{ hair: 0, style: f.style }} stage={cal.stage} expr="normal" scale={2} friend={known ? f : undefined} />
                <span className="gu-friend-name">{known ? `${f.emoji} ${f.name}` : '❔ ???'}</span>
                <span className="gu-friend-rel">{friendTitle(v)} <Hearts v={v} /></span>
                {known && <small className="gu-muted">{f.intro}</small>}
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'log' && (
        <div className="gu-log">
          <p className="gu-muted">알게 된 직업 {game.known.length}개 · 수상 {game.awards.filter((a) => a.rank !== 'fail').length}번{game.lastExam ? ` · 최근 시험 ${game.lastExam.score}점` : ''}</p>
          <h3>올해 용돈 기입장</h3>
          <div className="gu-ledger"><span>💰 들어온 돈 <b>{game.year.income}</b></span><span>💸 쓴 돈 <b>{game.year.spend}</b></span><span>🐷 지금 <b>{game.money}</b></span></div>
          {game.history.length > 0 && <h3>지난 학년</h3>}
          <ul className="gu-history">
            {[...game.history].reverse().map((y) => {
              const fav = y.favorite ? findAct(y.favorite) : undefined;
              return <li key={y.grade}><b>{y.grade}</b> {fav ? `${fav.emoji} ${fav.name}` : '—'} <span className="gu-muted">· 남은 돈 {y.money}</span></li>;
            })}
          </ul>
          {game.mode === 'raise' && (
            <button className="gu-link" onClick={() => { if (window.confirm('한 번에 키우기로 바꿀까요? 다시 키우기 모드로 돌아올 수 없어요.')) switchClassic(); }}>한 번에 키우기로 바꾸기</button>
          )}
          <button className="gu-link danger" onClick={() => { if (window.confirm(`${game.name}의 이야기를 지우고 처음부터 시작할까요?`)) reset(); }}>처음부터 다시 키우기</button>
        </div>
      )}
    </aside>
  );
}

function Interests({ game, exact }: { game: GameState; exact: boolean }) {
  const top = topFields(game, 3).filter((t) => t.value >= 3);
  if (!top.length) return <p className="gu-muted">아직 뚜렷한 관심사가 없어요. 이것저것 해 보세요.</p>;
  return (
    <ul className="gu-interests">
      {top.map((t) => (
        <li key={t.field}>
          <span>{FIELD_EMOJI[t.field]} {FIELD_LABEL[t.field]}</span>
          {exact ? <strong>{Math.round(t.value)}</strong> : <em>{'♥'.repeat(t.value >= 60 ? 3 : t.value >= 25 ? 2 : 1)}</em>}
        </li>
      ))}
      {!exact && <li className="gu-muted small">고등학교 진로 상담을 받으면 정확한 숫자와 흥미 유형을 알 수 있어요.</li>}
    </ul>
  );
}

/* ══════════════ 엔딩 — 진로 리포트 ══════════════ */

function RiasecChart({ game }: { game: GameState }) {
  const r = riasec(game);
  const R = 70;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [100 + Math.cos(a) * R * v, 95 + Math.sin(a) * R * v];
  };
  const poly = RIASEC_KEYS.map((k, i) => pt(i, Math.max(0.05, r[k] / 100)).join(',')).join(' ');
  return (
    <svg viewBox="0 0 200 190" className="gu-riasec" role="img" aria-label="진로흥미 유형 그래프">
      {[0.33, 0.66, 1].map((s) => <polygon key={s} points={RIASEC_KEYS.map((_, i) => pt(i, s).join(',')).join(' ')} className="grid" />)}
      {RIASEC_KEYS.map((_, i) => <line key={i} x1={100} y1={95} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} className="grid" />)}
      <polygon points={poly} className="value" />
      {RIASEC_KEYS.map((k, i) => {
        const [x, y] = pt(i, 1.2);
        return <text key={k} x={x} y={y + 4} textAnchor="middle">{RIASEC_INFO[k].name}</text>;
      })}
    </svg>
  );
}

function EndingScreen({ game }: { game: GameState }) {
  const press = useGrow((s) => s.press);
  const end = game.ending!;
  const job = careerById(end.careerId)!;
  const wins = game.awards.filter((a) => a.rank !== 'fail');
  const pals = FRIENDS.filter((f) => game.friends[f.id] >= FRIEND_LEVELS[0]);
  const [a, b] = topRiasec(game);
  const fits = careersForType([a, b], 4);
  const misses = nearMisses(game, 2);
  const quizR = game.history.reduce((s, y) => s + y.quizRight, 0) + game.year.quizRight;
  const quizT = game.history.reduce((s, y) => s + y.quizTotal, 0) + game.year.quizTotal;

  useButtons((btn) => { if (btn === 1 || btn === 2) press(btn); }, LAYER.screen, 'ending', ['새로 키우기', '엔딩 도감']);

  return (
    <div className="gu-end center-scroll">
      <article className="gu-end-card gu-panel">
        <div className="gu-end-hero">
          <Portrait look={game.look} stage={2} expr="happy" scale={4} className="md" />
          <div>
            <small>{fill('10년 뒤, {name:은는}', game.name)}</small>
            <h2>{job.emoji} {job.title}</h2>
            <div className="gu-end-meta"><span className={`gu-kind k-${job.kind}`}>{job.kind}</span><Stars n={end.tier} /></div>
          </div>
        </div>
        <p className="gu-epilogue">{job.epilogue[end.tier - 1]}</p>

        <section>
          <h3>무슨 일을 하나요?</h3>
          <p>{job.info}</p>
        </section>
        <section>
          <h3>어떻게 될 수 있나요?</h3>
          <p>{job.path}</p>
          {job.subjects.length > 0 && <p className="gu-muted">관련 과목: {job.subjects.join(' · ')}</p>}
        </section>

        <section className="gu-report">
          <h3>📋 {game.name}의 진로 리포트</h3>
          <div className="gu-report-riasec">
            <RiasecChart game={game} />
            <div>
              <p><b>흥미 유형: {RIASEC_INFO[a].name}·{RIASEC_INFO[b].name}</b></p>
              <p className="gu-muted">{RIASEC_INFO[a].desc}</p>
              <p className="gu-muted small">게임 속 활동으로 계산한 간이 유형이에요. 실제 진로흥미검사는 커리어넷 같은 곳에서 해 볼 수 있어요.</p>
            </div>
          </div>
          <p><b>이 유형과 어울리는 직업</b></p>
          <div className="gu-chips">{fits.map((c) => <span key={c.id} className="gu-chip field">{c.emoji} {c.title}</span>)}</div>
          {misses.length > 0 && (
            <>
              <p><b>조금만 더 했다면 닿았을 길</b></p>
              <ul className="gu-tips">
                {misses.map((m) => { const c = careerById(m.careerId)!; return <li key={m.careerId}>{c.emoji} {c.title} — {m.needs.join(', ')}</li>; })}
              </ul>
            </>
          )}
          <p><b>12년의 기록</b></p>
          <ol className="gu-timeline">
            {game.history.map((y) => {
              const fav = y.favorite ? findAct(y.favorite) : undefined;
              return <li key={y.grade} title={fav?.name}><span>{y.grade}</span><b>{fav?.emoji ?? '·'}</b></li>;
            })}
          </ol>
          <p className="gu-muted">직업 퀴즈 {quizR}/{quizT} · 알게 된 직업 {game.known.length}개 · 수상 {wins.length}번 · 모은 돈 {game.money}만원</p>
        </section>

        {pals.length > 0 && (
          <section>
            <h3>친구들의 10년 뒤</h3>
            <ul className="gu-pals">
              {pals.map((f) => (
                <li key={f.id}><b>{f.emoji} {f.name}</b> <span className="gu-friend-rel">{friendTitle(game.friends[f.id])}</span><br />
                  {f.epilogue[game.friends[f.id] >= FRIEND_LEVELS[1] ? 1 : 0]}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3>{game.name}의 능력</h3>
          <div className="gu-stat-list compact">{STAT_KEYS.map((k) => <Bar key={k} label={STAT_LABEL[k]} value={game.stats[k]} color={STAT_COLOR[k]} />)}</div>
        </section>
        <div className="gu-four two">
          <ChoiceBtn n={1} tone="primary" label="새로 키우기" onClick={() => press(1)} />
          <ChoiceBtn n={2} emoji="📖" label="엔딩 도감" onClick={() => press(2)} />
        </div>
      </article>
    </div>
  );
}

/* ══════════════ 도감 ══════════════ */

function DexView({ onClose }: { onClose: () => void }) {
  const dex = useGrow((s) => s.dex);
  const [pick, setPick] = useState<string | null>(null);
  const seen = Object.keys(dex).length;
  const job = pick ? careerById(pick) : null;

  useButtons((b) => { if (pick && b === 'back') setPick(null); else onClose(); }, LAYER.overlay, 'dex', ['닫기', '닫기', '닫기', '닫기']);

  return (
    <Modal label="엔딩 도감" onClose={onClose} className="gu-dex">
      <div className="gu-sheet-head">
        <span className="gu-sheet-emoji">📖</span>
        <div><h2>엔딩 도감</h2><p>{seen} / {CAREERS.length} 직업을 만났어요 · 아무 버튼이나 눌러 닫기</p></div>
        <button className="gu-close" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      {job ? (
        <div className="gu-dex-detail">
          <div className="gu-end-hero">
            <span className="gu-end-emoji">{job.emoji}</span>
            <div><h2>{job.title}</h2><div className="gu-end-meta"><span className={`gu-kind k-${job.kind}`}>{job.kind}</span><Stars n={dex[job.id] ?? 0} /></div></div>
          </div>
          <p>{job.info}</p>
          <p className="gu-muted">{job.path}</p>
          <p className="gu-muted">흥미 유형: {job.riasec.map((r) => RIASEC_INFO[r].name).join('·')} · 관련 과목: {job.subjects.join('·')}</p>
          <button className="gu-ghost" onClick={() => setPick(null)}>← 목록</button>
        </div>
      ) : (
        <div className="gu-dex-grid">
          {CAREERS.map((c) => {
            const t = dex[c.id];
            return (
              <button key={c.id} className={`gu-dex-item ${t ? '' : 'unseen'}`} disabled={!t} onClick={() => setPick(c.id)}>
                <span>{t ? c.emoji : '❔'}</span>
                <strong>{t ? c.title : '???'}</strong>
                <small>{c.kind}{t ? ' · ' : ''}{t ? '★'.repeat(t) : ''}</small>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* ══════════════ 초상 바꾸기 — 프리셋 · 직접 그리기(픽셀) · 이미지 올리기 ══════════════ */

function PortraitManager({ look, onClose }: { look: Look; onClose: () => void }) {
  const uploads = useGrow((s) => s.uploads);
  const setUpload = useGrow((s) => s.setUpload);
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string>('all');
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const cur = uploads.all ?? null;

  useButtons((b) => { if (b === 'back') { if (editing) setEditing(false); else onClose(); } }, LAYER.overlay, 'portraits', []);

  const pick = (key: string) => { setTarget(key); setErr(null); input.current?.click(); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { setUpload(target, await shrinkImage(f)); } catch { setErr('이미지를 읽지 못했어요. png·jpg 파일을 골라 주세요.'); }
    if (input.current) input.current.value = '';
  };

  if (editing) {
    return (
      <Modal label="초상 그리기" onClose={() => setEditing(false)} className="gu-portraits">
        <div className="gu-sheet-head">
          <span className="gu-sheet-emoji">✏️</span>
          <div><h2>초상 그리기</h2><p>칸을 눌러 칠해요. 좌우 대칭을 켜면 얼굴 반쪽만 그려도 돼요.</p></div>
          <button className="gu-close" onClick={() => setEditing(false)} aria-label="닫기">✕</button>
        </div>
        <PixelEditor from={cur} onSave={(url) => { setUpload('all', url); setEditing(false); }} onClose={() => setEditing(false)} />
      </Modal>
    );
  }

  return (
    <Modal label="초상 바꾸기" onClose={onClose} className="gu-portraits">
      <div className="gu-sheet-head">
        <span className="gu-sheet-emoji">🖼️</span>
        <div><h2>초상 바꾸기</h2><p>프리셋을 고르거나, 직접 그리거나, 그림 파일을 올려요. 이 기기에만 저장돼요.</p></div>
        <button className="gu-close" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {err && <p className="gu-odds warn">{err}</p>}

      <h3 className="gu-sub">프리셋</h3>
      <div className="gu-presets">
        <button className={`gu-preset ${!cur ? 'on' : ''}`} onClick={() => setUpload('all', null)}>
          <PixelAvatar look={look} stage={0} expr="happy" scale={3} />
          <small>마을 모습</small>
        </button>
        {PRESETS.map((p) => (
          <button key={p.id} className={`gu-preset ${cur === `preset:${p.id}` ? 'on' : ''}`} onClick={() => setUpload('all', `preset:${p.id}`)}>
            <img src={presetUrl(p.id, 'happy') ?? ''} alt="" />
            <small>{p.name}</small>
          </button>
        ))}
      </div>

      <div className="gu-four two">
        <button className="gu-choice" onClick={() => setEditing(true)}><span className="gu-choice-emoji">✏️</span><span className="gu-choice-body"><strong>직접 그리기</strong><small>16·24·32칸 픽셀 아트</small></span></button>
        <button className="gu-choice" onClick={() => pick('all')}><span className="gu-choice-emoji">📁</span><span className="gu-choice-body"><strong>그림 파일 올리기</strong><small>png · jpg · webp</small></span></button>
      </div>
      {cur && !cur.startsWith('preset:') && (
        <div className="gu-current">
          <img src={cur} alt="지금 초상" className="gu-portrait-img" />
          <span className="gu-muted small">지금 쓰는 내 그림 — 모든 학교급에 쓰여요.</span>
          <button className="gu-link" onClick={() => setUpload('all', null)}>지우기</button>
        </div>
      )}

      <details className="gu-more">
        <summary>학교급·표정마다 따로 넣기</summary>
        <table className="gu-pt-table">
          <thead><tr><th />{['전체', ...EXPR_KEYS.map((e) => EXPR_NAMES[e])].map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {STAGE_KEYS.map((st, si) => (
              <tr key={st}>
                <th>{STAGE_NAMES[si]}</th>
                {[st, ...EXPR_KEYS.map((e) => `${st}-${e}`)].map((key, ci) => {
                  const url = uploads[key];
                  const expr = ci ? EXPR_KEYS[ci - 1] : 'normal';
                  const shown = url && !url.startsWith('preset:') ? url : null;
                  return (
                    <td key={key}>
                      <button className={`gu-pt-slot ${url ? 'has' : ''}`} onClick={() => pick(key)} aria-label={`${STAGE_NAMES[si]} ${ci ? EXPR_NAMES[expr] : '전체'} 그림 넣기`}>
                        {shown ? <img src={shown} alt="" /> : <Portrait look={look} stage={si as 0 | 1 | 2} expr={expr} scale={2} className="xs" />}
                      </button>
                      {url && <button className="gu-pt-del" onClick={() => setUpload(key, null)} aria-label="지우기">✕</button>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="gu-muted small">「전체」에 넣은 그림은 그 학교급의 모든 표정에 쓰여요. 개발자는 <code>src/games/growup/portraits/</code> 폴더에 <code>elem-happy.png</code> 같은 이름으로 넣으면 모든 플레이어에게 나와요.</p>
      </details>
      <button className="gu-ghost" onClick={onClose}>닫기</button>
    </Modal>
  );
}
