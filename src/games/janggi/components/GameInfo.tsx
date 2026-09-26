import { useGameStore, lastMoveOf, capturesFrom } from '../stores/gameStore';
import { Player, PieceType } from '../game/types';
import { materialScore, notate } from '../game/board';
import { isInCheck } from '../game/moves';
import { pieceName } from './Board';

const CHARS: Record<PieceType, { han: string; cho: string }> = {
  general: { han: '漢', cho: '楚' },
  guard: { han: '士', cho: '士' },
  elephant: { han: '象', cho: '象' },
  horse: { han: '馬', cho: '馬' },
  chariot: { han: '車', cho: '車' },
  cannon: { han: '包', cho: '包' },
  soldier: { han: '卒', cho: '兵' },
};

const DIFF_LABEL: Record<string, string> = { easy: '쉬움', normal: '보통', hard: '어려움', expert: '최고' };

function SideLabel({ p }: { p: Player }) {
  return p === 'cho'
    ? <span className="text-green-400 font-bold">초 楚</span>
    : <span className="text-red-400 font-bold">한 漢</span>;
}

function CaptureList({ types, by }: { types: PieceType[]; by: Player }) {
  if (!types.length) return <span className="text-stone-600 text-xs">-</span>;
  /* 잡은 기물은 상대 진영의 것이므로 상대 색 글자로 표시 */
  const owner: Player = by === 'cho' ? 'han' : 'cho';
  return (
    <span className="text-xs leading-none" style={{ fontFamily: 'serif' }}>
      {types.map((t, i) => (
        <span key={i} className={owner === 'cho' ? 'text-green-300/90' : 'text-red-300/90'}>
          {CHARS[t][owner]}
        </span>
      ))}
    </span>
  );
}

export function GameInfo() {
  const board = useGameStore(s => s.board);
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const status = useGameStore(s => s.status);
  const aiThinking = useGameStore(s => s.aiThinking);
  const aiInfo = useGameStore(s => s.aiInfo);
  const moves = useGameStore(s => s.moves);
  const mode = useGameStore(s => s.mode);
  const difficulty = useGameStore(s => s.difficulty);
  const playerSide = useGameStore(s => s.playerSide);
  const flipBoard = useGameStore(s => s.flipBoard);
  const error = useGameStore(s => s.error);
  const setPref = useGameStore(s => s.setPref);
  const undoMove = useGameStore(s => s.undoMove);
  const restart = useGameStore(s => s.restart);
  const passTurn = useGameStore(s => s.passTurn);

  const caps = capturesFrom(moves);
  const last = lastMoveOf(moves);
  const inCheck = status === 'playing' && isInCheck(board, currentPlayer);
  const myTurn = mode === 'vs-human' || currentPlayer === playerSide;
  const scoreCho = materialScore(board, 'cho');
  const scoreHan = materialScore(board, 'han');

  const recent = moves.slice(-4).reverse();

  return (
    <div className="rounded-2xl px-4 py-3 text-amber-100 text-sm space-y-2.5"
      style={{ background: 'rgba(32,24,14,0.85)', border: '1px solid rgba(217,164,60,0.22)', backdropFilter: 'blur(6px)' }}>

      {error && (
        <div className="bg-red-900/80 text-red-200 rounded-lg p-2 text-xs">
          <span className="font-bold">오류:</span> {error}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-stone-400 text-xs">차례</span>
        <SideLabel p={currentPlayer} />
        {mode === 'vs-ai' && (
          <span className="text-xs text-amber-600">{myTurn ? '(나)' : '(AI)'}</span>
        )}
        {inCheck && <span className="text-red-400 font-bold text-sm animate-pulse">· 장군!</span>}
        {aiThinking && <span className="text-amber-500 text-xs animate-pulse">수읽는 중…</span>}
        <span className="ml-auto text-xs text-amber-700">
          {mode === 'vs-ai' ? `AI · ${DIFF_LABEL[difficulty]}` : '2인 대국'} · {moves.length}수
          {mode === 'vs-ai' && aiInfo && !aiThinking ? ` · ${aiInfo.depth}수 앞` : ''}
        </span>
      </div>

      {/* 점수 · 잡은 기물 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(24,90,58,0.22)' }}>
          <div className="flex justify-between items-center">
            <span className="text-green-300 font-bold">초 {scoreCho.toFixed(1)}점</span>
            <CaptureList types={caps.cho} by="cho" />
          </div>
        </div>
        <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(120,30,30,0.2)' }}>
          <div className="flex justify-between items-center">
            <span className="text-red-300 font-bold">한 {scoreHan.toFixed(1)}점</span>
            <CaptureList types={caps.han} by="han" />
          </div>
        </div>
      </div>

      {/* 기보 */}
      {recent.length > 0 && (
        <div className="text-[11px] text-amber-700/90 flex flex-wrap gap-x-3 gap-y-0.5">
          {recent.map((m, i) => (
            <span key={moves.length - i}>
              <span className="text-stone-500">{moves.length - i}.</span>{' '}
              <span className={m.player === 'cho' ? 'text-green-300/80' : 'text-red-300/80'}>
                {m.pass ? '한 수 쉼' : `${pieceName(m.type, m.player)} ${notate(m.from)}→${notate(m.to)}${m.captured ? `(${pieceName(m.captured, m.player === 'cho' ? 'han' : 'cho')} 잡음)` : ''}`}
              </span>
            </span>
          ))}
        </div>
      )}
      {last && (
        <p className="sr-only" aria-live="polite">
          최근 수 {pieceName(last.type, last.player)} {notate(last.from)}에서 {notate(last.to)}
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={undoMove} disabled={!moves.length || aiThinking}
          className="flex-1 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring">
          ↩ 무르기
        </button>
        <button onClick={passTurn} disabled={status !== 'playing' || aiThinking || !myTurn || inCheck}
          title={inCheck ? '장군을 받는 중에는 쉴 수 없습니다' : '한 수 쉬기'}
          className="flex-1 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-ring">
          한 수 쉼
        </button>
        <button onClick={restart} disabled={aiThinking}
          className="flex-1 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs font-semibold transition-colors disabled:opacity-30 focus-ring">
          ⟳ 새 대국
        </button>
        <button onClick={() => setPref({ flipBoard: !flipBoard })} aria-pressed={flipBoard}
          title="판 뒤집기"
          className="px-3 py-2 rounded-lg bg-stone-700/80 hover:bg-stone-600 text-amber-200 text-xs transition-colors focus-ring">
          ⇅
        </button>
      </div>

      {status === 'playing' && (
        <p className="text-[11px] text-amber-700/70 hidden sm:block kbd-only">
          방향키 이동 · Enter 선택/착수 · U 무르기 · N 새 대국 · F 판 뒤집기
        </p>
      )}
    </div>
  );
}
