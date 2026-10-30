import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { growupTutorial } from './tutorial';
import { useGrow } from './store';
import { Character } from './Character';
import { TOTAL_TURNS, calendar } from './calendar';
import { CAREERS, careerById } from './careers';
import {
  FIELD_EMOJI, FIELD_LABEL, HAIR_COLORS, HAIR_STYLES, PLACES, STAT_COLOR, STAT_KEYS, STAT_LABEL, placeById,
} from './data';
import {
  CHARGE_MS, MAX_TOKENS, actStatus, bubble, candidates, expression, fill, nextChargeIn, odds, pendingEvent, placeOpen, topFields,
} from './engine';
import {
  Activity, Delta, FieldKey, GameState, Look, Mode, Place, PlaceId, StatKey, TurnReport,
} from './types';

const meta = gameById('growup');

export default function App() {
  const game = useGrow((s) => s.game);
  const [dexOpen, setDexOpen] = useState(false);

  let screen: ReactNode;
  if (!game) screen = <TitleScreen onDex={() => setDexOpen(true)} />;
  else if (game.ending) screen = <EndingScreen game={game} onDex={() => setDexOpen(true)} />;
  else if (game.turn >= TOTAL_TURNS) screen = <Graduation game={game} />;
  else screen = <MainScreen game={game} />;

  return (
    <GameShell
      meta={meta}
      tutorial={growupTutorial}
      actions={<button className="db-btn shell-btn" onClick={() => setDexOpen(true)} aria-label="엔딩 도감" title="엔딩 도감">📖</button>}
    >
      <div className="gu-root">{screen}</div>
      {dexOpen && <DexView onClose={() => setDexOpen(false)} />}
    </GameShell>
  );
}

/* ══════════════ 공용 조각 ══════════════ */

function Modal({ children, onClose, className = '', label }: {
  children: ReactNode; onClose?: () => void; className?: string; label: string;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
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
  const cond: [string, number, boolean][] = [
    ['피로', d.fatigue, false], ['스트레스', d.stress, false], ['기분', d.mood, true],
  ];
  for (const [name, v, goodUp] of cond) {
    if (Math.abs(v) >= 1) chips.push({ key: name, text: `${name} ${signed(v)}`, tone: (v > 0) === goodUp ? 'up' : 'down' });
  }
  if (d.money) chips.push({ key: 'money', text: `💰 ${signed(d.money)}만원`, tone: d.money > 0 ? 'up' : 'down' });
  if (d.bold >= 1) chips.push({ key: 'bold', text: '도전 성향↑', tone: 'neutral' });
  if (d.bold <= -1) chips.push({ key: 'bold', text: '신중 성향↑', tone: 'neutral' });
  if (!chips.length) return null;
  return (
    <div className="gu-chips">
      {chips.map((c) => <span key={c.key} className={`gu-chip ${c.tone}`}>{c.text}</span>)}
    </div>
  );
}

/** alert: 높으면 위험(high)인지 낮으면 위험(low)인지. 능력치 막대는 경고하지 않는다 */
function Bar({ label, value, color, alert }: { label: string; value: number; color: string; alert?: 'high' | 'low' }) {
  const warn = alert === 'high' ? value >= 75 : alert === 'low' ? value < 30 : false;
  return (
    <div className={`gu-bar ${warn ? 'warn' : ''}`}>
      <span className="gu-bar-label">{label}</span>
      <span className="gu-bar-track"><span className="gu-bar-fill" style={{ width: `${value}%`, background: color }} /></span>
      <span className="gu-bar-num">{Math.round(value)}</span>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return <span className="gu-stars" aria-label={`${n}등급`}>{'★'.repeat(n)}<i>{'★'.repeat(3 - n)}</i></span>;
}

/* ══════════════ 시작 화면 ══════════════ */

function TitleScreen({ onDex }: { onDex: () => void }) {
  const start = useGrow((s) => s.start);
  const dex = useGrow((s) => s.dex);
  const [name, setName] = useState('하늘');
  const [look, setLook] = useState<Look>({ hair: 0, style: 0 });
  const [mode, setMode] = useState<Mode>('classic');
  const seen = Object.keys(dex).length;

  return (
    <div className="gu-title center-scroll">
      <div className="gu-title-card">
        <div className="gu-title-hero">
          <Character look={look} stage={0} expr="happy" size={110} />
          <div>
            <h2>커서 뭐 될래?</h2>
            {meta.lore.map((l) => <p key={l}>{l}</p>)}
          </div>
        </div>

        <label className="gu-field">
          <span>이름</span>
          <input value={name} maxLength={8} onChange={(e) => setName(e.target.value)} placeholder="하늘" />
        </label>

        <div className="gu-field">
          <span>머리색</span>
          <div className="gu-swatches">
            {HAIR_COLORS.map((c, i) => (
              <button key={c} className={`gu-swatch ${look.hair === i ? 'on' : ''}`} style={{ background: c }}
                aria-label={`머리색 ${i + 1}`} aria-pressed={look.hair === i}
                onClick={() => setLook({ ...look, hair: i })} />
            ))}
          </div>
        </div>

        <div className="gu-field">
          <span>머리 모양</span>
          <div className="gu-seg">
            {HAIR_STYLES.map((s, i) => (
              <button key={s} className={look.style === i ? 'on' : ''} aria-pressed={look.style === i}
                onClick={() => setLook({ ...look, style: i })}>{s}</button>
            ))}
          </div>
        </div>

        <div className="gu-field">
          <span>모드</span>
          <div className="gu-modes">
            <button className={mode === 'classic' ? 'on' : ''} aria-pressed={mode === 'classic'} onClick={() => setMode('classic')}>
              <strong>⏩ 한 번에 키우기</strong>
              <small>원하는 만큼 계속 진행. 30~40분이면 졸업.</small>
            </button>
            <button className={mode === 'raise' ? 'on' : ''} aria-pressed={mode === 'raise'} onClick={() => setMode('raise')}>
              <strong>🌱 키우기 모드</strong>
              <small>4시간마다 행동 1번(최대 {MAX_TOKENS}번). 매일 들러 돌봐요.</small>
            </button>
          </div>
        </div>

        <button className="gu-primary" onClick={() => start({ name, look, mode })}>키우기 시작</button>
        <button className="gu-ghost" onClick={onDex}>📖 엔딩 도감 ({seen}/{CAREERS.length})</button>
      </div>
    </div>
  );
}

/* ══════════════ 진행 화면 ══════════════ */

type Pop =
  | { kind: 'result'; report: TurnReport }
  | { kind: 'eventResult'; title: string; emoji: string; text: string; delta: Delta }
  | { kind: 'note'; title: string; text: string };

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
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

function MainScreen({ game }: { game: GameState }) {
  const act = useGrow((s) => s.act);
  const rest = useGrow((s) => s.rest);
  const choose = useGrow((s) => s.choose);
  const careFor = useGrow((s) => s.careFor);
  const wake = useGrow((s) => s.wake);
  const switchClassic = useGrow((s) => s.toClassic);
  const reset = useGrow((s) => s.reset);

  const [pops, setPops] = useState<Pop[]>([]);
  const [placeId, setPlaceId] = useState<PlaceId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const raise = game.mode === 'raise';
  const now = useNow(raise);
  const cal = calendar(game.turn);
  const expr = expression(game);

  const push = useCallback((p: Pop) => setPops((q) => [...q, p]), []);
  const shift = useCallback(() => setPops((q) => q.slice(1)), []);

  /* 키우기 모드: 들어올 때, 다시 볼 때, 충전 시각이 지났을 때 행동력을 채운다 */
  useEffect(() => {
    if (!raise) return;
    const run = () => {
      const r = wake();
      if (r?.missed) push({ kind: 'note', title: '보고 싶었어!', text: fill('오랜만이라 {name:이가} 반가워해요. 그동안 조금 심심했대요.', r.state.name) });
      else if (r && r.gained > 0) setToast(`행동력 ${r.gained} 충전!`);
    };
    run();
    const onVis = () => { if (document.visibilityState === 'visible') run(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [raise, wake, push]);
  const wait = nextChargeIn(game, now);
  useEffect(() => {
    if (raise && game.tokens < MAX_TOKENS && wait <= 0) {
      const r = wake();
      if (r && r.gained > 0) setToast(`행동력 ${r.gained} 충전!`);
    }
  }, [raise, wait, game.tokens, wake]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const noToken = raise && game.tokens <= 0;
  const ev = pendingEvent(game);
  const showEvent = !!ev && pops.length === 0 && !placeId;

  const doAct = (p: PlaceId, a: string) => {
    const res = act(p, a);
    if (!res.ok) { setToast(res.reason); return; }
    setPlaceId(null);
    push({ kind: 'result', report: res.report });
  };

  const doRest = () => {
    const res = rest();
    if (!res.ok) { setToast(res.reason); return; }
    push({ kind: 'result', report: res.report });
  };

  const pickOption = (i: number) => {
    if (!ev) return;
    const res = choose(i);
    if (!res.ok) { setToast(res.reason); return; }
    push({ kind: 'eventResult', title: ev.title, emoji: ev.emoji, text: res.text, delta: res.delta });
  };

  const doCare = (k: 'praise' | 'snack' | 'talk') => {
    const res = careFor(k);
    if (!res.ok) { setToast(res.reason); return; }
    push({ kind: 'note', title: k === 'talk' ? `${game.name}의 이야기` : '함께한 시간', text: res.line });
  };

  const place = placeId ? placeById(placeId) ?? null : null;
  const counseled = game.counseledAt >= 0 && game.turn - game.counseledAt <= 12;

  return (
    <div className="gu-main">
      {/* ── 상태 ── */}
      <section className="gu-status" aria-label="아이 상태">
        <div className="gu-status-top">
          <div className={`gu-avatar ${expr}`}>
            <Character look={game.look} stage={cal.stage} expr={expr} size={92} />
          </div>
          <div className="gu-status-info">
            <div className="gu-when">
              <strong>{game.name}</strong>
              <span className="gu-badge">{cal.gradeLabel} · {cal.month}월</span>
              <span className={`gu-badge season ${cal.season}`}>{cal.season}{cal.vacation ? ' · 방학' : ''}</span>
            </div>
            <p className="gu-bubble">{bubble(game)}</p>
            <div className="gu-wallet">
              <span>💰 {game.money}만원</span>
              <span className="gu-progress" title="졸업까지">
                <span style={{ width: `${(game.turn / TOTAL_TURNS) * 100}%` }} />
              </span>
              <span className="gu-left">졸업까지 {TOTAL_TURNS - game.turn}달</span>
            </div>
          </div>
        </div>
        <div className="gu-bars">
          <Bar label="피로" value={game.fatigue} color="#f0a03c" alert="high" />
          <Bar label="스트레스" value={game.stress} color="#e0505a" alert="high" />
          <Bar label="기분" value={game.mood} color="#4fbf6b" alert="low" />
        </div>
        {raise && (
          <div className="gu-tokens">
            <span className="gu-token-dots" aria-label={`행동력 ${game.tokens}/${MAX_TOKENS}`}>
              {Array.from({ length: MAX_TOKENS }, (_, i) => <i key={i} className={i < game.tokens ? 'on' : ''}>⚡</i>)}
            </span>
            <span className="gu-token-next">
              {game.tokens >= MAX_TOKENS ? '행동력 가득' : `다음 충전 ${hms(wait || CHARGE_MS)}`}
            </span>
            <button className="gu-link" onClick={() => {
              if (window.confirm('한 번에 키우기로 바꿀까요? 다시 키우기 모드로 돌아올 수 없어요.')) switchClassic();
            }}>한 번에 키우기로</button>
          </div>
        )}
        <div className="gu-care" role="group" aria-label="돌보기">
          <button disabled={game.cared} onClick={() => doCare('praise')}>👏 칭찬하기</button>
          <button disabled={game.cared || game.money < 1} onClick={() => doCare('snack')}>🍩 간식 (1만원)</button>
          <button disabled={game.cared} onClick={() => doCare('talk')}>💬 이야기 듣기</button>
        </div>
        {game.cared && <p className="gu-care-note">이번 달 돌보기를 했어요. 다음 달에 또 함께해요.</p>}
      </section>

      {/* ── 장소 ── */}
      <section className="gu-places" aria-label="장소">
        <div className="gu-sec-head">
          <h3>{game.sick ? '이번 달은 쉬어야 해요' : '이번 달엔 어디로 갈까요?'}</h3>
          {noToken && <span className="gu-warn">⚡ 행동력이 차면 다시 움직일 수 있어요</span>}
        </div>
        {game.sick ? (
          <div className="gu-sick">
            <div className="gu-sick-emoji">🤒</div>
            <p>너무 무리했나 봐요. 한 달 동안 푹 쉬면 피로와 스트레스가 크게 풀려요.</p>
            <button className="gu-primary" disabled={noToken} onClick={doRest}>한 달 쉬기</button>
          </div>
        ) : (
          <div className="gu-place-grid">
            {PLACES.map((p) => {
              const open = placeOpen(game, p);
              const v = game.visits[p.id] ?? 0;
              return (
                <button key={p.id} className={`gu-place ${open ? '' : 'locked'}`} disabled={!open}
                  style={{ ['--pc' as string]: p.color }}
                  onClick={() => setPlaceId(p.id)}>
                  <span className="gu-place-emoji">{open ? p.emoji : '🔒'}</span>
                  <span className="gu-place-name">{p.name}</span>
                  <span className="gu-place-sub">
                    {open ? (v > 0 ? `단골도 ${v}` : '처음') : `${calendar(p.from * 12).gradeLabel}부터`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 능력치 ── */}
      <section className="gu-stats" aria-label="능력치">
        <h3>능력치</h3>
        <div className="gu-stat-list">
          {STAT_KEYS.map((k) => <Bar key={k} label={STAT_LABEL[k]} value={game.stats[k]} color={STAT_COLOR[k]} />)}
        </div>
        <h3>요즘 관심사</h3>
        <Interests game={game} exact={counseled} />
        <h3>성향</h3>
        <div className="gu-bold">
          <span>신중</span>
          <span className="gu-bold-track"><span className="gu-bold-dot" style={{ left: `${(game.bold + 100) / 2}%` }} /></span>
          <span>도전</span>
        </div>
        {game.awards.filter((a) => a.rank !== 'fail').length > 0 && (
          <>
            <h3>수상 이력</h3>
            <ul className="gu-awards">
              {game.awards.filter((a) => a.rank !== 'fail').slice(-6).map((a, i) => (
                <li key={i}>{a.rank === 'great' ? '🏆' : '🥈'} {a.grade} {a.name} {a.rank === 'great' ? '대상' : '입상'}</li>
              ))}
            </ul>
          </>
        )}
        {game.lastExam && <p className="gu-exam-line">최근 시험: {game.lastExam.grade} · {game.lastExam.label} ({game.lastExam.score}점)</p>}
        <button className="gu-link danger" onClick={() => {
          if (window.confirm(`${game.name}의 이야기를 지우고 처음부터 시작할까요?`)) reset();
        }}>처음부터 다시 키우기</button>
      </section>

      {/* ── 활동 고르기 ── */}
      {place && (
        <ActivitySheet game={game} place={place} disabled={noToken}
          onPick={(a) => doAct(place.id, a)} onClose={() => setPlaceId(null)} />
      )}

      {/* ── 결과·사건 ── */}
      {pops[0]?.kind === 'result' && <ResultView report={pops[0].report} game={game} onClose={shift} />}
      {pops[0]?.kind === 'eventResult' && (
        <Modal label="사건 결과" onClose={shift}>
          <div className="gu-pop-head"><span className="gu-pop-emoji">{pops[0].emoji}</span><h2>{pops[0].title}</h2></div>
          <p className="gu-pop-text">{pops[0].text}</p>
          <DeltaChips d={pops[0].delta} />
          <OkButton onClick={shift} />
        </Modal>
      )}
      {pops[0]?.kind === 'note' && (
        <Modal label={pops[0].title} onClose={shift}>
          <div className="gu-pop-head"><span className="gu-pop-emoji">💛</span><h2>{pops[0].title}</h2></div>
          <p className="gu-pop-text">{pops[0].text}</p>
          <OkButton onClick={shift} />
        </Modal>
      )}
      {showEvent && ev && <EventView game={game} onPick={pickOption} />}

      {toast && <div className="gu-toast fade-in" role="status">{toast}</div>}
    </div>
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
      {!exact && <li className="gu-muted small">진로체험센터에서 상담을 받으면 정확히 알 수 있어요.</li>}
    </ul>
  );
}

function OkButton({ onClick, label = '확인' }: { onClick: () => void; label?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClick]);
  return <button className="gu-primary" onClick={onClick} autoFocus>{label}</button>;
}

/** 활동 카드에 붙는 예상 효과 */
function effectHints(a: Activity): { text: string; tone: 'up' | 'down' | 'field' | 'neutral' }[] {
  const out: { text: string; tone: 'up' | 'down' | 'field' | 'neutral' }[] = [];
  for (const [k, v] of Object.entries(a.stats ?? {}) as [StatKey, number][]) {
    if (v > 0) out.push({ text: `${STAT_LABEL[k]}${v >= 5 ? '↑↑' : '↑'}`, tone: 'up' });
  }
  for (const [k, v] of Object.entries(a.fields ?? {}) as [FieldKey, number][]) {
    if (v >= 2) out.push({ text: `${FIELD_EMOJI[k]}${FIELD_LABEL[k]}`, tone: 'field' });
  }
  if (a.special === 'topField') out.push({ text: '💡 가장 큰 관심사↑↑', tone: 'field' });
  if (a.special === 'randomField') out.push({ text: '💡 새로운 관심사', tone: 'field' });
  if (a.special === 'counsel') out.push({ text: '🗺️ 관심사 확인', tone: 'field' });
  if (a.contest) out.push({ text: '🏆 대회', tone: 'neutral' });
  if (a.fatigue) out.push({ text: `피로${a.fatigue > 0 ? '+' : ''}${a.fatigue}`, tone: a.fatigue > 0 ? 'down' : 'up' });
  if (a.stress) out.push({ text: `스트레스${a.stress > 0 ? '+' : ''}${a.stress}`, tone: a.stress > 0 ? 'down' : 'up' });
  if (a.mood && a.mood > 0) out.push({ text: `기분+${a.mood}`, tone: 'up' });
  if (a.money && a.money > 0) out.push({ text: `💰+${a.money}`, tone: 'up' });
  if (a.cost) out.push({ text: `💰-${a.cost}`, tone: 'down' });
  return out;
}

function ActivitySheet({ game, place, disabled, onPick, onClose }: {
  game: GameState; place: Place; disabled: boolean; onPick: (id: string) => void; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < 4) {
        const a = place.acts[i];
        if (!disabled && actStatus(game, place, a).ok) { e.preventDefault(); onPick(a.id); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, place, disabled, onPick]);

  return (
    <Modal label={place.name} onClose={onClose} className="gu-sheet">
      <div className="gu-sheet-head" style={{ ['--pc' as string]: place.color }}>
        <span className="gu-sheet-emoji">{place.emoji}</span>
        <div>
          <h2>{place.name}</h2>
          <p>{place.desc}</p>
        </div>
        <button className="gu-close" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <div className="gu-acts">
        {place.acts.map((a, i) => {
          const st = actStatus(game, place, a);
          const o = odds(game, a);
          return (
            <button key={a.id} className={`gu-act ${st.locked ? 'locked' : ''}`} disabled={!st.ok || disabled}
              onClick={() => onPick(a.id)}>
              <span className="gu-act-key kbd-only">{i + 1}</span>
              <span className="gu-act-emoji">{st.locked ? '🔒' : a.emoji}</span>
              <span className="gu-act-body">
                <strong>{a.name}</strong>
                <small>{st.locked ? `잠김 — ${st.reason}` : a.desc}</small>
                {!st.locked && (
                  <span className="gu-hints">
                    {effectHints(a).map((h) => <span key={h.text} className={`gu-chip ${h.tone}`}>{h.text}</span>)}
                  </span>
                )}
                {!st.locked && !a.safe && (
                  <span className="gu-odds">대성공 {Math.round(o.great * 100)}% · 실패 {Math.round(o.fail * 100)}%</span>
                )}
                {!st.ok && !st.locked && <span className="gu-odds warn">{st.reason}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

const OUTCOME_TEXT = {
  great: { title: '대성공!', emoji: '🌟' },
  ok: { title: '잘 해냈어요', emoji: '🙂' },
  fail: { title: '아쉬워요', emoji: '😥' },
  sick: { title: '푹 쉬었어요', emoji: '🛌' },
} as const;

function ResultView({ report, game, onClose }: { report: TurnReport; game: GameState; onClose: () => void }) {
  const place = report.place ? placeById(report.place) : undefined;
  const act = place?.acts.find((a) => a.id === report.act);
  const head = act?.safe && report.outcome === 'ok' ? { title: '좋은 시간이었어요', emoji: act.emoji } : OUTCOME_TEXT[report.outcome];
  return (
    <Modal label="이번 달 결과" onClose={onClose}>
      <div className={`gu-pop-head ${report.outcome}`}>
        <span className="gu-pop-emoji">{head.emoji}</span>
        <div>
          <small>{report.when}{act ? ` · ${place?.name} · ${act.name}` : ''}</small>
          <h2>{head.title}</h2>
        </div>
      </div>
      <DeltaChips d={report.delta} />
      {report.lines.map((l) => <p key={l} className="gu-pop-line">{l}</p>)}
      {report.counsel && (
        <div className="gu-counsel">
          <strong>🗺️ 상담 결과 — 관심이 큰 분야</strong>
          <ol>
            {report.counsel.map((c) => <li key={c.field}>{FIELD_EMOJI[c.field]} {FIELD_LABEL[c.field]} <b>{Math.round(c.value)}</b></li>)}
          </ol>
        </div>
      )}
      {report.exam && (
        <div className="gu-exam">
          <strong>📝 {report.exam.grade} 시험 결과</strong>
          <span>{report.exam.label} · {report.exam.score}점</span>
        </div>
      )}
      {report.yearEnd && (
        <div className="gu-year">
          <strong>🎒 {report.yearEnd.grade}을 마쳤어요!</strong>
          {Object.keys(report.yearEnd.delta).length ? (
            <div className="gu-chips">
              {(Object.entries(report.yearEnd.delta) as [StatKey, number][]).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} className="gu-chip up">{STAT_LABEL[k]} +{Math.round(v)}</span>
              ))}
            </div>
          ) : <span className="gu-muted">이번 해는 크게 자라지 못했어요.</span>}
          {game.turn < TOTAL_TURNS && <span className="gu-muted">이제 {calendar(game.turn).gradeLabel}!</span>}
        </div>
      )}
      <OkButton onClick={onClose} label={game.turn >= TOTAL_TURNS ? '졸업식으로' : '다음 달로'} />
    </Modal>
  );
}

function EventView({ game, onPick }: { game: GameState; onPick: (i: number) => void }) {
  const ev = pendingEvent(game)!;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (i >= 0 && i < ev.options.length) { e.preventDefault(); onPick(i); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ev, onPick]);
  return (
    <Modal label={ev.title}>
      <div className="gu-pop-head event">
        <span className="gu-pop-emoji">{ev.emoji}</span>
        <div><small>이번 달의 일</small><h2>{ev.title}</h2></div>
      </div>
      <p className="gu-pop-text">{fill(ev.text, game.name)}</p>
      <div className="gu-options">
        {ev.options.map((o, i) => (
          <button key={o.label} className="gu-option" disabled={!!o.need && game.money < o.need} onClick={() => onPick(i)}>
            <span className="gu-act-key kbd-only">{i + 1}</span>
            {o.label}{o.need ? <small> (💰{o.need}만원)</small> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* ══════════════ 졸업 ══════════════ */

function Graduation({ game }: { game: GameState }) {
  const finish = useGrow((s) => s.finish);
  const list = useMemo(() => candidates(game), [game]);
  const most = (Object.entries(game.visits) as [PlaceId, number][]).sort((a, b) => b[1] - a[1])[0];
  const best = [...STAT_KEYS].sort((a, b) => game.stats[b] - game.stats[a]).slice(0, 2);
  const wins = game.awards.filter((a) => a.rank !== 'fail').length;
  const burnout = list.length === 1 && list[0].careerId === 'gap' && game.stress >= 85;

  return (
    <div className="gu-grad center-scroll">
      <div className="gu-grad-card">
        <Character look={game.look} stage={2} expr={burnout ? 'tired' : 'happy'} size={110} />
        <h2>🎓 {game.name}, 졸업을 축하해요!</h2>
        <ul className="gu-summary">
          <li>가장 자주 간 곳: <b>{most ? `${placeById(most[0])?.emoji} ${placeById(most[0])?.name} (${most[1]}번)` : '-'}</b></li>
          <li>가장 자란 능력: <b>{best.map((k) => `${STAT_LABEL[k]} ${Math.round(game.stats[k])}`).join(', ')}</b></li>
          <li>수상: <b>{wins}번</b> · 모은 돈: <b>{game.money}만원</b></li>
        </ul>
        <h3>{burnout ? '너무 지쳐 있어요… 잠시 쉬어 가기로 했어요.' : '어떤 길을 걸어갈까요?'}</h3>
        <div className="gu-cands">
          {list.map((c) => {
            const job = careerById(c.careerId)!;
            return (
              <button key={c.careerId} className="gu-cand" onClick={() => finish(c.careerId)}>
                <span className="gu-cand-emoji">{job.emoji}</span>
                <span className="gu-cand-body">
                  <strong>{job.title}</strong>
                  <small><span className={`gu-kind k-${job.kind}`}>{job.kind}</span> {job.field ? `${FIELD_EMOJI[job.field]} ${FIELD_LABEL[job.field]}` : ''}</small>
                </span>
                <Stars n={c.tier} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════ 엔딩 ══════════════ */

function EndingScreen({ game, onDex }: { game: GameState; onDex: () => void }) {
  const reset = useGrow((s) => s.reset);
  const end = game.ending!;
  const job = careerById(end.careerId)!;
  const wins = game.awards.filter((a) => a.rank !== 'fail');
  return (
    <div className="gu-end center-scroll">
      <article className="gu-end-card">
        <div className="gu-end-hero">
          <span className="gu-end-emoji">{job.emoji}</span>
          <div>
            <small>{fill('10년 뒤, {name:은는}', game.name)}</small>
            <h2>{job.title}</h2>
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
        </section>
        <section>
          <h3>{game.name}의 12년</h3>
          <div className="gu-stat-list compact">
            {STAT_KEYS.map((k) => <Bar key={k} label={STAT_LABEL[k]} value={game.stats[k]} color={STAT_COLOR[k]} />)}
          </div>
          {wins.length > 0 && (
            <ul className="gu-awards">
              {wins.map((a, i) => <li key={i}>{a.rank === 'great' ? '🏆' : '🥈'} {a.grade} {a.name} {a.rank === 'great' ? '대상' : '입상'}</li>)}
            </ul>
          )}
        </section>
        <div className="gu-end-actions">
          <button className="gu-ghost" onClick={onDex}>📖 엔딩 도감</button>
          <button className="gu-primary" onClick={reset}>새로 키우기</button>
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
  return (
    <Modal label="엔딩 도감" onClose={onClose} className="gu-dex">
      <div className="gu-sheet-head">
        <span className="gu-sheet-emoji">📖</span>
        <div><h2>엔딩 도감</h2><p>{seen} / {CAREERS.length} 직업을 만났어요</p></div>
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
