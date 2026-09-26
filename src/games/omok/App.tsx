import { Component, ReactNode } from 'react';
import { useGameStore } from './stores/gameStore';
import { Board } from './components/Board';
import { Menu } from './components/Menu';
import { GameInfo } from './components/GameInfo';
import { ResultOverlay } from './components/ResultOverlay';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { omokTutorial } from './tutorial';

const meta = gameById('omok');

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-900 text-red-200 rounded-xl p-6 max-w-lg w-full">
          <h2 className="text-lg font-bold mb-2">오류 발생</h2>
          <pre className="text-xs whitespace-pre-wrap break-all">{this.state.error}</pre>
          <button className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm"
            onClick={() => window.location.reload()}>새로고침</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

function GameApp() {
  const status = useGameStore(s => s.status);
  const goToMenu = useGameStore(s => s.goToMenu);
  const undoMove = useGameStore(s => s.undoMove);
  const restart = useGameStore(s => s.restart);

  useKeys({
    u: () => { if (status !== 'menu') undoMove(); },
    n: () => { if (status !== 'menu') restart(); },
    Escape: () => { if (status !== 'menu') goToMenu(); },
  });

  if (status === 'menu') return <Menu />;

  return (
    <div className="relative flex-1 min-h-0 flex flex-col items-center px-2 py-2 gap-2 overflow-hidden select-none"
      style={{ background: 'radial-gradient(ellipse at 50% 0%,#2a1a08 0%,#140d04 60%,#0a0602 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-10" style={{
        backgroundImage:
          'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(180,140,60,0.15) 40px,rgba(180,140,60,0.15) 41px),' +
          'repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(180,140,60,0.1) 40px,rgba(180,140,60,0.1) 41px)'
      }} />

      <main className="flex-1 w-full max-w-4xl min-h-0 relative z-10 flex flex-col landscape-row gap-2">
        <div className="flex-1 min-h-0 flex items-center justify-center"><Board /></div>
        <div className="shrink-0 info-pane"><GameInfo /></div>
      </main>

      <ResultOverlay />
    </div>
  );
}

export default function App() {
  const goToMenu = useGameStore(s => s.goToMenu);
  const status = useGameStore(s => s.status);
  return (
    <ErrorBoundary>
      <GameShell
        meta={meta}
        tutorial={omokTutorial}
        actions={status !== 'menu' ? (
          <button className="db-btn shell-btn" onClick={goToMenu} aria-label="게임 메뉴">메뉴</button>
        ) : undefined}
      >
        <GameApp />
      </GameShell>
    </ErrorBoundary>
  );
}
