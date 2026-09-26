import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, Category, GAMES, GameMeta, gameHref } from '../shared/registry';
import { getProgress } from '../shared/progress';
import { getPrimaryBest } from '../shared/records';
import { formatStats, getStats } from '../shared/stats';
import { DbHome, SoundButton } from '../shared/react/GameShell';
import { GameMark } from '../shared/react/GameMark';
import { ROOT_NS } from '../shared/storage';

interface CardInfo {
  resume: string | null;
  record: string | null;
}

function readInfo(meta: GameMeta): CardInfo {
  const progress = getProgress(meta.id);
  const best = getPrimaryBest(meta.id);
  const stats = formatStats(getStats(meta.id));
  return {
    resume: progress?.label ?? null,
    record: best ? best.label : stats,
  };
}

function GameCard({ meta, index }: { meta: GameMeta; index: number }) {
  const [info, setInfo] = useState<CardInfo>(() => readInfo(meta));

  /* 다른 탭에서 기록이 바뀌었을 수도 있으니 다시 보일 때 갱신한다 */
  useEffect(() => {
    const refresh = () => setInfo(readInfo(meta));
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [meta]);

  return (
    <a
      className="game-card"
      href={gameHref(meta.id)}
      style={{ ['--card-accent' as string]: meta.accent }}
      aria-label={`${meta.title} — ${meta.desc}`}
    >
      <div className="card-top">
        <span className="card-icon" aria-hidden><GameMark id={meta.id} size={44} /></span>
        <div className="card-heading">
          <h2>{meta.title}</h2>
          <span className="card-sub">{meta.subtitle}</span>
        </div>
        {/* 숫자키 안내는 마우스·키보드가 있는 기기에서만 보인다(base.css .kbd-only) */}
        {index < 9 && <span className="card-key kbd-only" aria-hidden>{index + 1}</span>}
      </div>

      <p className="card-desc">{meta.desc}</p>
      <p className="card-lore">“{meta.lore[0]}”</p>

      <div className="card-tags">
        {meta.tags.map((t) => <span key={t} className="card-tag">{t}</span>)}
      </div>

      <div className="card-foot">
        {info.resume && <span className="card-badge">이어하기</span>}
        <span>{info.resume ?? '아직 기록 없음'}</span>
        {info.record && <span className="card-record">🏅 {info.record}</span>}
        {meta.touchControls ? (
          <>
            <span className="card-controls kbd-only">{meta.controls}</span>
            <span className="card-controls touch-only">{meta.touchControls}</span>
          </>
        ) : (
          <span className="card-controls">{meta.controls}</span>
        )}
      </div>
    </a>
  );
}

export function Hub() {
  const [filter, setFilter] = useState<Category | '전체'>('전체');

  const visible = useMemo(
    () => (filter === '전체' ? GAMES : GAMES.filter((g) => g.category === filter)),
    [filter]
  );

  /* 숫자키로 바로 진입 — 지금 화면에 보이는 순서 기준 */
  const onKey = useCallback((e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
    const n = parseInt(e.key, 10);
    if (!Number.isNaN(n) && n >= 1 && n <= visible.length) {
      window.location.href = gameHref(visible[n - 1].id);
    }
  }, [visible]);

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  const resetAll = () => {
    if (!confirm('딴짓에 저장된 기록(진행 상황·최고 기록)을 모두 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${ROOT_NS}:`)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* 무시 */ }
    location.reload();
  };

  return (
    <div className="hub">
      <header className="db-bar">
        <DbHome />
        <span className="db-title">딴짓</span>
        <span className="db-sp"></span>
        <SoundButton />
      </header>

      <section className="hub-header">
        <div className="hub-brand">
          <h1>딴짓<span>.</span></h1>
          <p>
            설치도 서버도 없이 브라우저에서 바로 도는 게임 {GAMES.length}개.<br />
            진행 상황과 기록은 이 기기에만 저장됩니다.
            <span className="kbd-only"><br />카드의 숫자키를 누르면 바로 실행합니다.</span>
          </p>
        </div>
      </section>

      <nav className="hub-filter" aria-label="게임 분류">
        {(['전체', ...CATEGORIES] as const).map((c) => {
          const count = c === '전체' ? GAMES.length : GAMES.filter((g) => g.category === c).length;
          if (count === 0) return null;
          return (
            <button
              key={c}
              className="filter-chip"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
            >
              {c} <span className="filter-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <main className="hub-grid">
        {visible.map((meta, i) => <GameCard key={meta.id} meta={meta} index={i} />)}
      </main>

      <footer className="hub-footer">
        <span>기록은 이 기기에만 저장됩니다. (진행 상황·최고 기록)</span>
        <button className="hub-reset" onClick={resetAll}>기록 전체 삭제</button>
      </footer>
    </div>
  );
}
