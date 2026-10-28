import { useEffect } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { samgukTutorial } from './tutorial';
import { useGame } from './store';
import { Title, Setup } from './ui/Title';
import { Game } from './ui/Game';
import { Portrait } from './ui/art/Portrait';
import { EventArt, sceneFor } from './ui/art/EventArt';
import { OFFICER_DEF } from './data/officers';

const meta = gameById('samguk');

/** 명령 결과 — 일을 맡은 장수가 초상과 함께 아뢴다 */
function Speech() {
  const toast = useGame((u) => u.toast);
  const game = useGame((u) => u.game);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useGame.setState({ toast: null }), toast.by ? 3200 : 2600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const who = toast.by && OFFICER_DEF[toast.by] ? toast.by : null;
  return (
    <button key={toast.at} className={`sg-speech ${toast.ok ? '' : 'bad'} ${who ? '' : 'plain'}`} role="status"
      onClick={() => useGame.setState({ toast: null })}>
      {who && <Portrait id={who} size={58} year={game?.year} color={toast.color} className="sg-speech-face" />}
      <span className="sg-speech-body">
        {who && <strong>{OFFICER_DEF[who].name}</strong>}
        <span>{toast.text}</span>
      </span>
    </button>
  );
}

/** 역사 사건 카드 */
function EventCards() {
  const events = useGame((u) => u.events);
  const screen = useGame((u) => u.screen);
  const game = useGame((u) => u.game);
  if (screen !== 'game' || !events.length || game?.battle) return null;
  const e = events[0];
  const next = () => useGame.setState({ events: events.slice(1) });
  return (
    <div className="sg-overlay" onClick={next}>
      <div className="sg-event" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true">
        <EventArt kind={sceneFor(e.text)} />
        <div className="sg-event-body">
          <span className="sg-event-date">{e.y}년 {e.m}월</span>
          <p>{e.text}</p>
          <button className="sg-btn primary" onClick={next}>{events.length > 1 ? `다음 (${events.length - 1})` : '확인'}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useGame((u) => u.screen);
  return (
    <GameShell meta={meta} tutorial={samgukTutorial}>
      <div className="sg-root">
        {screen === 'title' && <Title />}
        {screen === 'setup' && <Setup />}
        {screen === 'game' && <Game />}
        <Speech />
        <EventCards />
      </div>
    </GameShell>
  );
}
