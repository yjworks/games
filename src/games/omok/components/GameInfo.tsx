import { useGameStore, lastMoveOf } from '../stores/gameStore';
import { coordLabel } from './Board';
import { PieceColor } from '../game/types';

const DIFF_LABEL: Record<string, string> = { easy: '쉬움', normal: '중간', hard: '어려움', expert: '최고' };

function StoneDot({ color, size = 14 }: { color: PieceColor; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', display: 'inline-block',
        background: color === 'black'
          ? 'radial-gradient(circle at 35% 30%,#666,#111 70%)'
          : 'radial-gradient(circle at 35% 30%,#fff,#cdc5ad 75%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}
    />
  );
}

export function GameInfo() {
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const status = useGameStore(s => s.status);
  const aiThinking = useGameStore(s => s.aiThinking);
  const aiInfo = useGameStore(s => s.aiInfo);
  const moves = useGameStore(s => s.moves);
  const mode = useGameStore(s => s.mode);
  const difficulty = useGameStore(s => s.difficulty);
  const playerColor = useGameStore(s => s.playerColor);
  const showCoords = useGameStore(s => s.showCoords);
  const setPref = useGameStore(s => s.setPref);
  const undoMove = useGameStore(s => s.undoMove);
  const restart = useGameStore(s => s.restart);

  const last = lastMoveOf(moves);
  const myTurn = mode === 'vs-human' || currentPlayer === playerColor;

  const turnText = mode === 'vs-ai'
    ? (myTurn ? '내 차례' : 'AI 차례')
    : (currentPlayer === 'black' ? '흑 차례' : '백 차례');

  return (
    <div className="rounded-2xl px-4 py-3 text-amber-100 text-sm"
      style={{ background: 'rgba(32,24,14,0.85)', border: '1px solid rgba(217,164,60,0.22)', backdropFilter: 'blur(6px)' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <StoneDot color={currentPlayer} size={16} />
          <span className="font-bold">{turnText}</span>
          {aiThinking && <span className="text-amber-500 text-xs animate-pulse">수읽는 중…</span>}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-amber-600">
          <span>{mode === 'vs-ai' ? `AI · ${DIFF_LABEL[difficulty]}` : '2인 대국'}</span>
          <span>{moves.length}수</span>
          {last && <span>최근 {coordLabel(last)}</span>}
          {mode === 'vs-ai' && aiInfo && !aiThinking && (
            <span className="text-amber-800" title="직전 AI 탐색 결과">
              {aiInfo.depth}수 앞 · {aiInfo.nodes.toLocaleString()}노드
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={undoMove} disabled={!moves.length || aiThinking}
          className="flex-1 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring">
          ↩ 무르기
        </button>
        <button onClick={restart} disabled={aiThinking}
          className="flex-1 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-30 focus-ring">
          ⟳ 새 대국
        </button>
        <button onClick={() => setPref({ showCoords: !showCoords })}
          aria-pressed={showCoords}
          title={showCoords ? '좌표 숨기기' : '좌표 표시'}
          className="px-3 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs transition-colors focus-ring">
          {showCoords ? '#' : '#̶'}
        </button>
      </div>

      {status === 'playing' && (
        <p className="mt-2 text-[11px] text-amber-700/80 hidden sm:block kbd-only">
          방향키로 커서 이동 · Enter 착수 · U 무르기 · N 새 대국
        </p>
      )}
    </div>
  );
}
