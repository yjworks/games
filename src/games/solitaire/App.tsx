import { useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { solitaireTutorial } from './tutorial';
import { bestMoves, canAutoComplete, useSolitaire } from './store';
import { Card, RANK_LABEL, SUITS, SUIT_SYMBOL, Source, Target, isRed, legalMove } from './engine';

const meta = gameById('solitaire');

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function CardFace({ card, selected, style, onClick, label }: {
  card: Card; selected?: boolean; style?: React.CSSProperties;
  onClick?: () => void; label?: string;
}) {
  if (!card.faceUp) {
    return <button className="sl-card back" style={style} onClick={onClick} aria-label="뒷면 카드" />;
  }
  return (
    <button
      className={`sl-card${isRed(card.suit) ? ' red' : ''}${selected ? ' sel' : ''}`}
      style={style}
      onClick={onClick}
      aria-label={label ?? `${SUIT_SYMBOL[card.suit]} ${RANK_LABEL[card.rank]}`}
    >
      <span>{RANK_LABEL[card.rank]}</span>
      <span className="sl-suit">{SUIT_SYMBOL[card.suit]}</span>
    </button>
  );
}

export default function App() {
  const game = useSolitaire((s) => s.game);
  const selected = useSolitaire((s) => s.selected);
  const status = useSolitaire((s) => s.status);
  const elapsedMs = useSolitaire((s) => s.elapsedMs);
  const message = useSolitaire((s) => s.message);
  const historyDepth = useSolitaire((s) => s.history.length);
  const tapCard = useSolitaire((s) => s.tapCard);
  const tapPile = useSolitaire((s) => s.tapPile);
  const drawCard = useSolitaire((s) => s.drawCard);
  const undo = useSolitaire((s) => s.undo);
  const newGame = useSolitaire((s) => s.newGame);
  const autoComplete = useSolitaire((s) => s.autoComplete);
  const tick = useSolitaire((s) => s.tick);

  const [showResult, setShowResult] = useState(false);
  const best = bestMoves();

  const startRef = useRef(0);
  useEffect(() => {
    if (status !== 'playing') return;
    startRef.current = Date.now() - useSolitaire.getState().elapsedMs;
    const id = setInterval(() => tick(Date.now() - startRef.current), 250);
    return () => clearInterval(id);
  }, [status, tick, game.moves === 0]);

  useEffect(() => {
    if (status === 'won') {
      const t = setTimeout(() => setShowResult(true), 350);
      return () => clearTimeout(t);
    }
    setShowResult(false);
  }, [status]);

  useKeys({
    d: () => drawCard(),
    z: () => undo(),
    n: () => newGame(),
  });

  const canDrop = (dst: Target) => (selected ? legalMove(game, selected, dst) : false);
  const isSelected = (src: Source) =>
    !!selected &&
    selected.type === src.type &&
    (src.type !== 'tableau' || (selected.type === 'tableau' && selected.pile === src.pile && selected.index === src.index)) &&
    (src.type !== 'foundation' || (selected.type === 'foundation' && selected.pile === src.pile));

  const wasteTop = game.waste[game.waste.length - 1];
  const auto = canAutoComplete(game);

  return (
    <GameShell
      meta={meta}
      tutorial={solitaireTutorial}
      actions={
        <button className="db-btn shell-btn" onClick={() => newGame(game.drawCount === 1 ? 3 : 1)}
          aria-label="뽑기 장수 바꾸기">{game.drawCount}장</button>
      }
    >
      <div className="sl-root">
        <div className="sl-stats">
          <span>⏱ <strong>{formatTime(elapsedMs)}</strong></span>
          <span>수 <strong>{game.moves}</strong></span>
          <span className="sl-right">{best ? `최소 ${best.value}수` : '기록 없음'}</span>
        </div>

        <div className="sl-top">
          {/* 스톡 */}
          <button className="sl-slot" onClick={drawCard} aria-label="카드 뽑기">
            {game.stock.length > 0 ? <span className="sl-card back static" /> : '↻'}
          </button>

          {/* 버린 더미 */}
          <div className="sl-pile">
            {wasteTop ? (
              <CardFace
                card={wasteTop}
                selected={isSelected({ type: 'waste' })}
                style={{ position: 'relative' }}
                onClick={() => tapCard({ type: 'waste' })}
              />
            ) : (
              <div className="sl-slot" aria-label="버린 더미 비어 있음" />
            )}
          </div>

          <div />

          {/* 기초 더미 */}
          {SUITS.map((suit, i) => {
            const pile = game.foundations[i];
            const top = pile[pile.length - 1];
            const dropOk = canDrop({ type: 'foundation', pile: i });
            return (
              <div className="sl-pile" key={suit}>
                {top ? (
                  <CardFace
                    card={top}
                    style={{ position: 'relative', outline: dropOk ? '2px solid #10a37f' : undefined }}
                    onClick={() => (selected ? tapPile({ type: 'foundation', pile: i }) : tapCard({ type: 'foundation', pile: i }))}
                  />
                ) : (
                  <button
                    className={`sl-slot${dropOk ? ' drop' : ''}`}
                    onClick={() => tapPile({ type: 'foundation', pile: i })}
                    aria-label={`${SUIT_SYMBOL[suit]} 기초 더미`}
                  >
                    {SUIT_SYMBOL[suit]}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="sl-tableau">
          {game.tableau.map((pile, p) => {
            const dropOk = canDrop({ type: 'tableau', pile: p });
            return (
              <div
                className="sl-pile"
                key={p}
                style={{ height: `calc(var(--sl-card-h) + ${Math.max(pile.length - 1, 0)} * var(--sl-stack))` }}
              >
                {pile.length === 0 ? (
                  <button
                    className={`sl-slot${dropOk ? ' drop' : ''}`}
                    onClick={() => tapPile({ type: 'tableau', pile: p })}
                    aria-label={`${p + 1}번 열 비어 있음`}
                  />
                ) : (
                  pile.map((card, i) => (
                    <CardFace
                      key={card.id}
                      card={card}
                      selected={isSelected({ type: 'tableau', pile: p, index: i })}
                      style={{
                        top: `calc(${i} * var(--sl-stack))`,
                        zIndex: i + 1,
                        outline: dropOk && i === pile.length - 1 ? '2px solid #10a37f' : undefined,
                      }}
                      onClick={() => tapCard({ type: 'tableau', pile: p, index: i })}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>

        <div className="sl-message" aria-live="polite">{message}</div>

        <div className="sl-controls">
          <button onClick={drawCard}>🂠 뽑기</button>
          <button onClick={undo} disabled={historyDepth === 0}>↩ 되돌리기</button>
          {auto ? (
            <button className="primary" onClick={autoComplete}>✨ 자동 완성</button>
          ) : (
            <button onClick={() => newGame()}>⟳ 새 판</button>
          )}
        </div>

        {showResult && status === 'won' && (
          <div className="sl-result fade-in" role="dialog" aria-modal="true" aria-label="결과">
            <div className="sl-result-box pop-in">
              <div style={{ fontSize: '2.2rem' }}>🃏</div>
              <h2>다 올렸어요</h2>
              <p>
                {game.moves}수 · {formatTime(elapsedMs)}
                {best ? <><br />최소 기록 {best.value}수</> : null}
              </p>
              <button className="sl-btn" onClick={() => { newGame(); setShowResult(false); }}>새 판</button>
              <button className="sl-btn ghost" onClick={() => setShowResult(false)}>판 보기</button>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}
