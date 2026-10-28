import { useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { samgukTutorial } from './tutorial';
import { useGame } from './store';
import { Title, Setup } from './ui/Title';
import { Game } from './ui/Game';
import { Portrait } from './ui/art/Portrait';
import { EventArt, sceneFor } from './ui/art/EventArt';
import { OFFICER_DEF } from './data/officers';
import { audioPrefs, onAudioPrefs, playMusic, setAudioPrefs, sg, type Track } from './audio';

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

type Phase = Track | 'won' | 'lost';

/** 화면에 맞춰 곡을 바꾸고, 출진·승패 때 짧은 연주를 넣는다 */
function AudioDirector() {
  const screen = useGame((u) => u.screen);
  const game = useGame((u) => u.game);
  useGame((u) => u.rev);
  const bs = game?.battle;
  let phase: Phase = 'title';
  if (screen === 'game' && game && !game.over) {
    if (!bs) phase = 'map';
    else if (!bs.over) phase = 'battle';
    else {
      const mine = bs.human[bs.over.winner] || (!bs.human[0] && !bs.human[1]);
      phase = mine ? 'won' : 'lost';
    }
  }
  const prev = useRef<Phase | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = phase;
    if (phase === 'battle' && was !== 'battle') sg.battleStart();
    if (phase === 'won' && was === 'battle') sg.victory();
    if (phase === 'lost' && was === 'battle') sg.defeat();
    playMusic(phase === 'won' || phase === 'lost' ? null : phase);
  }, [phase]);
  return null;
}

/** 상단 바 음악 켜기·끄기 */
function MusicButton() {
  const [on, setOn] = useState(audioPrefs().music);
  useEffect(() => onAudioPrefs(() => setOn(audioPrefs().music)), []);
  return (
    <button className="db-btn shell-btn sg-music-btn" aria-pressed={on}
      aria-label={on ? '배경음악 끄기' : '배경음악 켜기'} title={on ? '배경음악 끄기' : '배경음악 켜기'}
      onClick={() => setAudioPrefs({ music: !on })}>
      {on ? '♫' : <s>♫</s>}
    </button>
  );
}

/** 전체 화면 — 브라우저 테두리와 사이트 상단 바를 가린다 */
function FullscreenButton() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  if (typeof document === 'undefined' || !document.documentElement.requestFullscreen) return null;
  return (
    <button className="db-btn shell-btn" aria-pressed={on} aria-label={on ? '전체 화면 끝내기' : '전체 화면'} title={on ? '전체 화면 끝내기' : '전체 화면'}
      onClick={() => { if (on) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => {}); }}>
      {on ? '⤡' : '⛶'}
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
  return <EventCard e={e} more={events.length - 1} next={() => useGame.setState({ events: events.slice(1) })} />;
}

function EventCard({ e, more, next }: { e: { y: number; m: number; text: string }; more: number; next: () => void }) {
  useEffect(() => { sg.event(); }, [e]);
  return (
    <div className="sg-overlay" onClick={next}>
      <div className="sg-event" onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true">
        <EventArt kind={sceneFor(e.text)} />
        <div className="sg-event-body">
          <span className="sg-event-date">{e.y}년 {e.m}월</span>
          <p>{e.text}</p>
          <button className="sg-btn primary" onClick={next}>{more > 0 ? `다음 (${more})` : '확인'}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useGame((u) => u.screen);
  return (
    <GameShell meta={meta} tutorial={samgukTutorial} actions={<><MusicButton /><FullscreenButton /></>}>
      <div className="sg-root">
        {screen === 'title' && <Title />}
        {screen === 'setup' && <Setup />}
        {screen === 'game' && <Game />}
        <Speech />
        <EventCards />
        <AudioDirector />
      </div>
    </GameShell>
  );
}
