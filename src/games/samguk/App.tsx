import { useEffect } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { samgukTutorial } from './tutorial';
import { useGame } from './store';
import { Title, Setup } from './ui/Title';
import { Game } from './ui/Game';

const meta = gameById('samguk');

function Toast() {
  const toast = useGame((u) => u.toast);
  const say = useGame((u) => u.say);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => useGame.setState({ toast: null }), 2600);
    return () => clearTimeout(t);
  }, [toast, say]);
  if (!toast) return null;
  return <div key={toast.at} className={`sg-toast ${toast.ok ? '' : 'bad'}`} role="status">{toast.text}</div>;
}

export default function App() {
  const screen = useGame((u) => u.screen);
  return (
    <GameShell meta={meta} tutorial={samgukTutorial}>
      <div className="sg-root">
        {screen === 'title' && <Title />}
        {screen === 'setup' && <Setup />}
        {screen === 'game' && <Game />}
        <Toast />
      </div>
    </GameShell>
  );
}
